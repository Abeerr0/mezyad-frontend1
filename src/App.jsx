import { useMarket } from "./market";
import AuctionDetails from "./pages/AuctionDetails";
import PrivateAccess from "./pages/PrivateAccess";
import Commitment from "./pages/Commitment";
import Bidding from "./pages/Bidding";
import BidHistory from "./pages/BidHistory";
import AuctionResult from "./pages/AuctionResult";
import MyAuctions from "./pages/MyAuctions";
import BankStatus from "./pages/BankStatus";
import "./auction-pages.css";
import React, { useEffect, useRef, useState } from "react";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Guide from "./pages/Guide";
import Help from "./pages/Help";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Activity from "./pages/Activity";
import MyListings from "./pages/MyListings";
import CreateListing from "./pages/CreateListing";
import EditListing from "./pages/EditListing";
import CreateAuction from "./pages/CreateAuction";
import { useWorkspace } from "./workspace";
import { API, imageUrl } from "./api";
import {
  Auctioneer,
  Icon,
  Modal,
  dateText,
  money,
  statusLabels,
} from "./components";
import { categoryLabels, demoAuctions, demoCategories } from "./data";

const pageTitles = {
  auction: "تفاصيل المزاد",
  "private-access": "المزاد الخاص",
  commitment: "الالتزام",
  bid: "تقديم عرض",
  "bid-history": "سجل العروض",
  "auction-result": "نتيجة المزاد",
  "my-auctions": "مزاداتي",
  "bank-status": "حالة البنك",
  home: "الرئيسية",
  auctions: "استكشاف المزادات",
  guide: "كيف تشتغل مزياد",
  help: "المساعدة",
  login: "تسجيل الدخول",
  register: "إنشاء حساب",
  profile: "الملف الشخصي",
  activity: "نشاطي",
  listings: "إعلاناتي",
  "create-listing": "إنشاء إعلان",
  "edit-listing": "تعديل الإعلان",
  "create-auction": "إعداد المزاد",
};
function readRoute() {
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const name = path.replace(/^\//, "") || "home";
  return { page: name, params: new URLSearchParams(query || "") };
}

// تم التعديل من عبير: نحفظ مسار الصفحه بالفاصل # عشان الروابط والرجوع تشتغل بدون مكتبه اضافيه.
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [demo, setDemo] = useState(() => {
    if (location.protocol === "file:") return true;
    try {
      return sessionStorage.getItem("mezyad-group-one-mode") !== "api";
    } catch {
      return true;
    }
  });
  const workspace = useWorkspace(demo);
  const market = useMarket(workspace);
  const [catalog, setCatalog] = useState({ auctions: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const detailRequest = useRef(null);
  const mainRef = useRef(null);
  const category =
    route.page === "auctions" ? route.params.get("category") || "" : "";
  const status =
    route.page === "auctions" ? route.params.get("status") || "" : "";

  useEffect(() => {
    const onRoute = () => {
      setRoute(readRoute());
      setMenu(false);
      setModal(null);
    };
    window.addEventListener("hashchange", onRoute);
    return () => window.removeEventListener("hashchange", onRoute);
  }, []);
  useEffect(() => {
    document.title = (pageTitles[route.page] || "غير موجودة") + " | مزياد";
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current?.focus({ preventScroll: true });
  }, [route.page]);
  useEffect(() => () => detailRequest.current?.abort(), []);

  function changeMode(next) {
    if (!next && location.protocol === "file:") {
      setModal({ type: "api", title: "ربط الباك يحتاج تشغيل Vite" });
      return;
    }
    setDemo(next);
    setModal(null);
    try {
      sessionStorage.setItem("mezyad-group-one-mode", next ? "demo" : "api");
    } catch {
      /* تم التعديل من عبير: لو التخزين مقفول نكمل وضع المعاينه بنفس الجلسه. */
    }
    if (location.hash.includes("?")) location.hash = "/" + route.page;
  }

  // تم التعديل من عبير: وضع API يقرا بيانات الباك فقط ولا يستبدل الخطا ببيانات تجريبيه.
  useEffect(() => {
    if (!["home", "auctions"].includes(route.page)) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (demo) {
        const filtered = demoAuctions.filter(
          (a) =>
            (!category || a.category_id === category) &&
            (!status || a.status === status),
        );
        setCatalog({
          categories: demoCategories,
          auctions: filtered.map((a) => ({
            ...a,
            categoryLabel: categoryLabels[a.category_name] || a.category_name,
          })),
        });
        setLoading(false);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (category) params.set("categoryId", category);
        if (status) params.set("status", status);
        async function get(path) {
          const response = await fetch(API + path, {
            signal: controller.signal,
          });
          const json = await response.json();
          if (!response.ok || !Array.isArray(json.data))
            throw new Error("Invalid API response");
          return json.data;
        }
        const [categories, auctions] = await Promise.all([
          get("/categories"),
          get("/auctions" + (params.size ? "?" + params.toString() : "")),
        ]);
        if (active)
          setCatalog({
            categories: categories.map((c) => ({
              ...c,
              label: categoryLabels[c.name] || c.name,
            })),
            auctions: auctions
              .filter((a) => a.visibility === "PUBLIC")
              .map((a) => ({
                ...a,
                categoryLabel:
                  categoryLabels[a.category_name] || a.category_name,
                image_url: a.image_url
                  ? new URL(a.image_url, new URL(API + "/", location.origin))
                      .href
                  : null,
              })),
          });
      } catch (err) {
        if (active && err.name !== "AbortError") {
          setCatalog({ auctions: [], categories: [] });
          setError(
            "تأكد أن الباك يعمل على المنفذ 3000 وأن قاعدة البيانات متصلة. ما نعرض بيانات تجريبية بدل بياناته.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [demo, route.page, category, status, refresh]);

  // تم التعديل من عبير: نفتح صفحه المزاد الكامله بدل نافذه التفاصيل القديمه.
  function openAuction(auction) {
    location.hash = "/auction?id=" + encodeURIComponent(auction.id);
  }
  function closeModal() {
    detailRequest.current?.abort();
    setModal(null);
  }
  function onFeature(type) {
    if (type === "private") {
      location.hash = "/private-access";
      return;
    }
    if (type === "sell") {
      location.hash = workspace.user
        ? "/create-listing"
        : "/login?next=%2Fcreate-listing";
      return;
    }
    if (type === "account") {
      location.hash = workspace.user ? "/activity" : "/login";
      return;
    }
    setModal({
      type,
      title:
        type === "private"
          ? "دخول المزاد الخاص"
          : type === "sell"
            ? "ابدأ حكاية أصلك"
            : "حسابك في مزياد",
    });
  }
  // تم التعديل من عبير: نخلي سعر المعاينه ومشاركات المستخدم متوافقه بين الصفحات القديمه والجديده.
  const accountWorkspace = demo
    ? {
        ...workspace,
        auctions: [
          ...workspace.auctions,
          ...market.records.filter((a) =>
            a.bids.some((b) => b.bidder_id === workspace.user?.id),
          ),
        ],
      }
    : workspace;
  const common = {
    ...catalog,
    auctions: demo
      ? catalog.auctions.map((a) => ({
          ...a,
          ...market.records.find((r) => r.id === a.id),
        }))
      : catalog.auctions,
    loading,
    error,
    retry: () => setRefresh((n) => n + 1),
    onDemo: () => changeMode(true),
    onOpen: openAuction,
    onFeature,
  };

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        تخطي إلى المحتوى
      </a>
      <div className={"preview-bar " + (!demo ? "api-mode" : "")}>
        <span>
          <i />
          {demo
            ? "معاينة التصميم · بيانات توضيحية غير معروضة للبيع"
            : "وضع API · بيانات الباك المحلي"}
          <small>المجموعات 01 — 05</small>
        </span>
        <button onClick={() => changeMode(!demo)}>
          {demo ? "ربط بيانات الباك" : "الرجوع للمعاينة"}
          <Icon name="refresh" size={13} />
        </button>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <a href="#/" className="brand" aria-label="مزياد — الرئيسية">
            <img src="/images/mezyad-logo.png" alt="Mezyad مزياد" />
          </a>
          <nav
            className={"main-nav " + (menu ? "is-open" : "")}
            aria-label="التنقل الرئيسي"
          >
            {[
              ["home", "/", "الرئيسية"],
              ["auctions", "/auctions", "المزادات"],
              ["guide", "/guide", "كيف تشتغل مزياد"],
              ["help", "/help", "المساعدة"],
            ].map(([key, path, label]) => (
              <a
                key={key}
                href={"#" + path}
                aria-current={route.page === key ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="account-button"
              onClick={() => onFeature("account")}
            >
              <Icon name="user" size={17} />
              <span>{workspace.user ? "مجلسي" : "تسجيل الدخول"}</span>
            </button>
            <button
              className="button small dark sell-button"
              onClick={() => onFeature("sell")}
            >
              اعرض أصلك <Icon name="plus" size={17} />
            </button>
            <button
              className="icon-button menu-button"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menu}
            >
              <Icon name={menu ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <div
          key={route.page + "-" + demo + "-" + (route.params.get("id") || "")}
        >
          {/* تم التعديل من عبير: نربط صفحات المنافسه والمتابعه بنفس حساب المستخدم. */}
          {route.page === "auction" && (
            <AuctionDetails market={market} id={route.params.get("id")} />
          )}
          {route.page === "private-access" && <PrivateAccess market={market} />}
          {route.page === "commitment" && (
            <Commitment market={market} id={route.params.get("id")} />
          )}
          {route.page === "bid" && (
            <Bidding market={market} id={route.params.get("id")} />
          )}
          {route.page === "bid-history" && (
            <BidHistory market={market} id={route.params.get("id")} />
          )}
          {route.page === "auction-result" && (
            <AuctionResult market={market} id={route.params.get("id")} />
          )}
          {route.page === "my-auctions" && <MyAuctions market={market} />}
          {route.page === "bank-status" && (
            <BankStatus market={market} id={route.params.get("id")} />
          )}
          {route.page === "login" && (
            <Login workspace={workspace} params={route.params} />
          )}
          {route.page === "register" && <Register workspace={workspace} />}
          {route.page === "profile" && <Profile workspace={workspace} />}
          {route.page === "activity" && (
            <Activity workspace={accountWorkspace} onOpen={openAuction} />
          )}
          {route.page === "listings" && (
            <MyListings workspace={workspace} params={route.params} />
          )}
          {route.page === "create-listing" && (
            <CreateListing workspace={workspace} />
          )}
          {route.page === "edit-listing" && (
            <EditListing workspace={workspace} params={route.params} />
          )}
          {route.page === "create-auction" && (
            <CreateAuction workspace={workspace} params={route.params} />
          )}
        </div>
        {route.page === "home" && <Home {...common} />}
        {route.page === "auctions" && (
          <Browse {...common} category={category} status={status} />
        )}
        {route.page === "guide" && <Guide onFeature={onFeature} />}
        {route.page === "help" && (
          <Help topic={route.params.get("topic") || ""} />
        )}
        {!pageTitles[route.page] && (
          <div className="container state-panel">
            <h1>الصفحة مو هنا</h1>
            <p>ارجع للمجلس ونبدأ من جديد.</p>
            <a className="button dark" href="#/">
              الرئيسية <Icon />
            </a>
          </div>
        )}
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <img src="/images/mezyad-logo.png" alt="مزياد" />
              <p>
                أصول لها قيمة.
                <br />
                ومجلس يجمعها.
              </p>
            </div>
            <div>
              <h2>خذ لفة</h2>
              <a href="#/auctions">المزادات العامة</a>
              <a href="#/guide">كيف تشتغل مزياد</a>
              <a href="#/help">المساعدة والأسئلة</a>
            </div>
            <div>
              <h2>نبدأ من هنا</h2>
              <button onClick={() => onFeature("sell")}>
                عرض أصل للمراجعة
              </button>
              <button onClick={() => onFeature("private")}>
                دخول مزاد خاص
              </button>
              <a href="#/help?topic=bank">عن الالتزام البنكي</a>
            </div>
            <div className="footer-signature">
              <Icon name="gavel" size={38} />
              <span>القيمة في التفاصيل.</span>
              <small>THE MEZYAD WAY</small>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} مزياد · مشروع MVP تعليمي</span>
            <span>
              <i />
              المملكة العربية السعودية
            </span>
            <span>لا تحويلات مالية حقيقية</span>
          </div>
        </div>
      </footer>
      {modal && (
        <Modal title={modal.title} onClose={closeModal}>
          {modal.type === "auction" ? (
            <>
              <p className="modal-eyebrow">
                {demo
                  ? "معاينة أصل توضيحي — ليست مزايدة فعلية"
                  : "تفاصيل من الباك المحلي"}
              </p>
              {detailBusy ? (
                <p role="status">جاري جلب التفاصيل…</p>
              ) : detailError ? (
                <p role="alert">{detailError}</p>
              ) : (
                <>
                  {/* تم التعديل من عبير: نعرض صوره الاصل اذا موجوده بدون نحط صوره اصل ثاني بدالها. */}
                  {detail.image_url ? (
                    <img
                      className="detail-photo"
                      src={detail.image_url}
                      alt={detail.title}
                    />
                  ) : (
                    <p className="detail-photo">
                      لا توجد صورة متاحة لهذا الأصل.
                    </p>
                  )}
                  <div className="detail-price">
                    <span>{statusLabels[detail.status]}</span>
                    <strong>{money(detail.current_price)} ر.س</strong>
                  </div>
                  <p>{detail.description || "لا يوجد وصف إضافي متاح."}</p>
                  <dl className="detail-facts">
                    <div>
                      <dt>أقل زيادة</dt>
                      <dd>{money(detail.minimum_increment)} ر.س</dd>
                    </div>
                    <div>
                      <dt>البداية — بتوقيت الرياض</dt>
                      <dd>
                        {detail.start_time
                          ? dateText(detail.start_time)
                          : "غير متاحة"}
                      </dd>
                    </div>
                    <div>
                      <dt>النهاية — بتوقيت الرياض</dt>
                      <dd>
                        {detail.end_time
                          ? dateText(detail.end_time)
                          : "غير متاحة"}
                      </dd>
                    </div>
                  </dl>
                  <p className="scope-note">
                    واجهة تقديم العروض والالتزام تُستكمل ضمن مجموعة المشاركة،
                    ولا يتم إرسال أي عرض من هنا.
                  </p>
                  <a
                    className="button dark"
                    href="#/guide"
                    onClick={closeModal}
                  >
                    فهم خطوات المشاركة <Icon />
                  </a>
                </>
              )}
            </>
          ) : (
            <>
              <Auctioneer small />
              <p>
                {modal.type === "api"
                  ? "افتح المجلد في VS Code وشغّل npm ci ثم npm run dev، وبعدها افتح رابط localhost واضغط ربط بيانات الباك."
                  : "صفحة الدخول برمز خاص وتقديم العروض والالتزام ضمن مجموعة المشاركة القادمة. إعداد المزاد الخاص للبائع متاح الآن من إعلاناتي."}
              </p>
              <p className="scope-note">
                في المعاينة، كل التجارب داخل الصفحة فقط. وضع API يتصل بالباك عند
                اختياره.
              </p>
              <a className="button dark" href="#/guide" onClick={closeModal}>
                تعرّف على الخطوات <Icon />
              </a>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
