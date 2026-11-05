import AdminDashboardAseel from "./pages/AdminDashboard-Aseel";
import { useAutoRefresh } from "./useAutoRefresh";
import { Avatar } from "./Avatar";
import BrandScene from "./BrandScene";
import { Notices, PaymentPage } from "./InteractionUI";
import "./interaction-ui.css";
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
import { Icon } from "./components";
import { categoryLabels, demoAuctions, demoCategories } from "./data";
const pageTitles = {
  admin: "لوحة الإدارة",
  payment: "مراجعة الدفع",
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
  guide: "كيف يعمل مزياد",
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
  // تم التعديل من عبير: نلتقط رجعه ميسر ونخلي الباك يتحقق من معرف العمليه.
  const callback = new URLSearchParams(location.search);
  if (!location.hash && callback.has("moyasarAuction") && callback.has("id")) {
    return {
      page: "payment",
      params: new URLSearchParams({
        id: callback.get("moyasarAuction"),
        paymentId: callback.get("id"),
      }),
    };
  }
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const name = path.replace(/^\//, "") || "home";
  return {
    page: name,
    params: new URLSearchParams(query || ""),
  };
}

// تم التعديل من عبير: نحفظ مسار الصفحه بالفاصل # عشان الروابط والرجوع تشتغل بدون مكتبه اضافيه.
export default function App() {
  const [route, setRoute] = useState(readRoute);
  // تم التعديل من عبير: الموقع يفتح ببياناته الحقيقيه؛ ملف PREVIEW وحده مخصص للتجربه.
  const demo = location.pathname.endsWith("/PREVIEW.html");
  const workspace = useWorkspace(demo);
  const market = useMarket(workspace);
  const [catalog, setCatalog] = useState({
    auctions: [],
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useAutoRefresh(
    () => setRefresh((n) => n + 1),
    !demo && ["home", "auctions"].includes(route.page),
  );
  const [menu, setMenu] = useState(false);
  const mainRef = useRef(null);
  const category =
    route.page === "auctions" ? route.params.get("category") || "" : "";
  const status =
    route.page === "auctions" ? route.params.get("status") || "" : "";
  useEffect(() => {
    const onRoute = () => {
      setRoute(readRoute());
      setMenu(false);
    };
    window.addEventListener("hashchange", onRoute);
    return () => window.removeEventListener("hashchange", onRoute);
  }, []);
  useEffect(() => {
    document.title = (pageTitles[route.page] || "غير موجودة") + " | مزياد";
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
    mainRef.current?.focus({
      preventScroll: true,
    });
  }, [route.page]);
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
          setCatalog({
            auctions: [],
            categories: [],
          });
          setError("تعذّر تحميل المزادات الآن حاول مرة ثانية بعد شوي");
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
      location.hash = workspace.user
        ? workspace.user.role === "ADMIN"
          ? "/admin"
          : "/activity"
        : "/login";
      return;
    }
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
      {/* تم التعديل من عبير: نعرض رساله البراند، والتنبيه المختصر يظهر بملف التجربه فقط. */}
      <div className="preview-bar brand-bar">
        <span>
          <i /> للقيمة أهلها، وللمنافسة مزياد
        </span>
        {demo ? (
          <small>نسخة تجربة — العمليات هنا ما تنفّذ شراء أو بيع</small>
        ) : (
          <a href="#/guide">
            خطوتك الأولى للمزاد <Icon size={13} />
          </a>
        )}
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <a href="#/" className="brand" aria-label={"مزياد — الرئيسية"}>
            <img src="/images/mezyad-logo.png" alt={"Mezyad مزياد"} />
          </a>
          <nav
            className={"main-nav " + (menu ? "is-open" : "")}
            aria-label={"التنقل الرئيسي"}
          >
            {[
              ["home", "/", "الرئيسية"],
              ["auctions", "/auctions", "المزادات"],
              ["guide", "/guide", "كيف يعمل مزياد"],
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
              {workspace.user ? (
                <Avatar value={workspace.avatar} name={workspace.user.name} />
              ) : (
                <Icon name="user" size={17} />
              )}
              <span>
                {workspace.user
                  ? workspace.user.role === "ADMIN"
                    ? "الإدارة"
                    : "مزاداتي"
                  : "تسجيل الدخول"}
              </span>
            </button>
            {![
              "listings",
              "create-listing",
              "edit-listing",
              "create-auction",
            ].includes(route.page) && (
              <button
                className="button small dark sell-button"
                onClick={() => onFeature("sell")}
              >
                اعرض أصلك <Icon name="plus" size={17} />
              </button>
            )}
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
      <Notices />
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <div
          key={route.page + "-" + demo + "-" + (route.params.get("id") || "")}
        >
          {/* تم التعديل من عبير: نربط صفحات المنافسه والمتابعه بنفس حساب المستخدم. */}
          {route.page === "admin" && (
            <AdminDashboardAseel workspace={workspace} />
          )}
          {route.page === "payment" && (
            <PaymentPage
              market={market}
              id={route.params.get("id")}
              paymentId={route.params.get("paymentId")}
            />
          )}
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
            <p>ارجع للمزاد ونبدأ من جديد</p>
            <a className="button dark" href="#/">
              الرئيسية <Icon />
            </a>
          </div>
        )}
        {!["admin", "activity", "listings", "profile", "my-auctions"].includes(
          route.page,
        ) && <BrandScene page={route.page} />}
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <img src="/images/mezyad-logo.png" alt={"مزياد"} />
              <p>
                أصول لها قيمة
                <br />
                ومزاد يجمعها
              </p>
            </div>
            <div>
              <h2>خذ لفة</h2>
              <a href="#/auctions">المزادات العامة</a>
              <a href="#/guide">كيف يعمل مزياد</a>
              <a href="#/help">المساعدة والأسئلة</a>
            </div>
            <div>
              <h2>نبدأ من هنا</h2>
              {/* تم التعديل من عبير: نخلي عرض الاصل بمكان واحد ونوجه هنا لشرح خطوات البيع. */}
              <a href="#/guide">خطوات عرض أصلك</a>
              <button onClick={() => onFeature("private")}>
                دخول مزاد خاص
              </button>
              <a href="#/help?topic=bank">عن الالتزام البنكي</a>
            </div>
            <div className="footer-signature">
              <Icon name="gavel" size={38} />
              <span>القيمة في التفاصيل</span>
              <small>THE MEZYAD WAY</small>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="abeer-signature" aria-label={"تصميم وتطوير عبير"}>
              <b>
                A<span>✦</span>
              </b>
              <span>
                عبير <small>CRAFTED BY ABEER</small>
              </span>
            </span>
            <span>
              <i />
              المملكة العربية السعودية
            </span>
            <span>للقيمة أهلها</span>
          </div>
        </div>
      </footer>
    </>
  );
}
