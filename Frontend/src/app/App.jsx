// تم التعديل من عبير: يجمع الصفحات والحساب والمزاد والهيدر والفوتر بدون تكرار تفاصيلهم
import SiteHeader from "../shared/layout/SiteHeader.jsx";
import SiteFooter from "../shared/layout/SiteFooter.jsx";
import { useAutoRefresh } from "../shared/hooks/useAutoRefresh.js";
import { Avatar } from "../features/profile/components/Avatar.jsx";
import BrandScene from "../shared/components/BrandScene.jsx";
import { Notices, PaymentPage } from "../shared/components/InteractionUI.jsx";
import "../shared/components/interaction-ui.css";
import { useMarket } from "../features/auctions/hooks/useMarket.js";
import AuctionDetails from "../features/auctions/pages/AuctionDetails/AuctionDetails.jsx";
import PrivateAccess from "../features/auctions/pages/PrivateAccess/PrivateAccess.jsx";
import Commitment from "../features/payments/pages/Commitment/Commitment.jsx";
import Bidding from "../features/auctions/pages/Bidding/Bidding.jsx";
import BidHistory from "../features/auctions/pages/BidHistory/BidHistory.jsx";
import AuctionResult from "../features/auctions/pages/AuctionResult/AuctionResult.jsx";
import MyAuctions from "../features/auctions/pages/MyAuctions/MyAuctions.jsx";
import BankStatus from "../features/payments/pages/BankStatus/BankStatus.jsx";
import "../features/auctions/styles/auction-pages.css";
import React, { useEffect, useRef, useState } from "react";
import Home from "../features/home/pages/Home/Home.jsx";
import Browse from "../features/auctions/pages/Browse/Browse.jsx";
import Guide from "../features/support/pages/Guide/Guide.jsx";
import Help from "../features/support/pages/Help/Help.jsx";
import Login from "../features/auth/pages/Login/Login.jsx";
import Register from "../features/auth/pages/Register/Register.jsx";
import Profile from "../features/profile/pages/Profile/Profile.jsx";
import Activity from "../features/activity/pages/Activity/Activity.jsx";
import MyListings from "../features/listings/pages/MyListings/MyListings.jsx";
import CreateListing from "../features/listings/pages/CreateListing/CreateListing.jsx";
import EditListing from "../features/listings/pages/EditListing/EditListing.jsx";
import CreateAuction from "../features/auctions/pages/CreateAuction/CreateAuction.jsx";
import { useWorkspace } from "../features/account/hooks/useWorkspace.js";
import { API, imageUrl, request } from "../shared/api/client.js";
import { Icon } from "../shared/ui/index.jsx";
import {
  categoryLabels,
  demoAuctions,
  demoCategories,
} from "../shared/data/site-data.js";
const pageTitles = {
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
// تم التعديل من عبير: نقرا رابط الصفحه ومعرف المزاد ورجعه الدفع
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
    // تم التعديل من عبير: نجيب بيانات هالجزء ونعرض التحميل او الخطا حسب الرد
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
        // تم التعديل من عبير: نستخدم طلب API الموحد ونظهر سبب فشل القائمه بدل رساله وحده لكل الاخطاء.
        async function get(path) {
          const rows = await request(path, { signal: controller.signal });
          if (!Array.isArray(rows))
            throw new Error("وصلت قائمة غير مكتملة حاول تحديث الصفحة");
          return rows;
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
          setError(
            err.message || "تعذّر تحميل المزادات الآن حاول مرة ثانية بعد شوي",
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
  // تم التعديل من عبير: نربط ضغط الزر بالخطوه المطلوبه في الموقع
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
      <SiteHeader
        menu={menu}
        route={route}
        onFeature={onFeature}
        workspace={workspace}
        setMenu={setMenu}
      />
      <Notices />
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <div
          key={route.page + "-" + demo + "-" + (route.params.get("id") || "")}
        >
          {/* تم التعديل من عبير: نربط صفحات المنافسه والمتابعه بنفس حساب المستخدم. */}
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
        {!["activity", "listings", "profile", "my-auctions"].includes(
          route.page,
        ) && <BrandScene page={route.page} />}
      </main>
      <SiteFooter onFeature={onFeature} />
    </>
  );
}
