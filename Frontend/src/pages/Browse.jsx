import React, { useMemo, useState } from "react";
import { AuctionCard, Icon, StatePanel } from "../components";

// تم التعديل من عبير: الفلاتر تنحفظ بالرابط والبحث يشتغل على النتائج المحمله فقط.
export default function Browse({
  auctions,
  categories,
  loading,
  error,
  retry,
  onOpen,
  category,
  status,
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  function filter(key, value) {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    if (value) params.set(key, value);
    else params.delete(key);
    location.hash = "/auctions" + (params.size ? "?" + params.toString() : "");
  }
  const visible = useMemo(() => {
    let result = auctions.filter(
      (a) =>
        !search.trim() ||
        a.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    );
    if (sort === "price-low")
      result = [...result].sort(
        (a, b) => Number(a.current_price) - Number(b.current_price),
      );
    if (sort === "ending")
      result = [...result].sort(
        (a, b) => new Date(a.end_time) - new Date(b.end_time),
      );
    return result;
  }, [auctions, search, sort]);
  return (
    <div className="container browse-page">
      <div className="breadcrumb">
        <a href="#/">الرئيسية</a>
        <span>/</span>المزادات
      </div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">أصول تختارها على مهل</p>
          <h1>
            دوّر على <em>الاستثنائي</em>
          </h1>
          <p>كل أصل له تفاصيله تصفح، قارن، وافتح المزاد اللي يهمك</p>
        </div>
        <span className="heading-mark">
          <Icon name="gavel" size={44} />
        </span>
      </div>
      <div className="browse-tools">
        <label className="search-input">
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={"ابحث ضمن النتائج المحملة"}
            aria-label={"البحث ضمن النتائج المحملة"}
          />
          {search && (
            <button
              className="icon-button"
              onClick={() => setSearch("")}
              aria-label={"مسح البحث"}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
        <label className="sort-label">
          ترتيب النتائج
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="default">الترتيب الافتراضي</option>
            <option value="ending">موعد النهاية الأقرب</option>
            <option value="price-low">السعر الأقل</option>
          </select>
        </label>
      </div>
      <div className="browse-layout">
        <aside className="filters" aria-label={"فلاتر المزادات"}>
          <div className="filter-heading">
            <h2>اختر تفاصيلك</h2>
          </div>
          <fieldset>
            <legend>الفئة</legend>
            <label className="radio-option">
              <input
                type="radio"
                name="category"
                checked={!category}
                onChange={() => filter("category", "")}
              />
              <span>كل الأصول</span>
            </label>
            {categories.map((c) => (
              <label className="radio-option" key={c.id}>
                <input
                  type="radio"
                  name="category"
                  checked={category === c.id}
                  onChange={() => filter("category", c.id)}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>حالة المزاد</legend>
            {[
              ["", "كل الحالات"],
              ["ACTIVE", "جارٍ الآن"],
              ["SCHEDULED", "قريبًا"],
              ["CLOSED", "منتهٍ"],
            ].map(([value, label]) => (
              <label className="radio-option" key={value}>
                <input
                  type="radio"
                  name="status"
                  checked={status === value}
                  onChange={() => filter("status", value)}
                />
                <span>{label}</span>
                {value === "ACTIVE" && <i className="live-dot" />}
              </label>
            ))}
          </fieldset>
          <div className="filter-note">
            <Icon name="shield" />
            <p>المزادات المعروضة هنا عامة فقط المزاد الخاص يحتاج رمز وصول</p>
          </div>
        </aside>
        <section className="browse-results" aria-label={"نتائج المزادات"}>
          <div className="results-heading">
            <p aria-live="polite">
              {loading ? (
                "جاري التحميل"
              ) : error ? (
                "تعذر تحميل النتائج"
              ) : (
                <>
                  <strong>{visible.length}</strong> مزادات للاكتشاف
                </>
              )}
            </p>
            <span>السعر بالريال السعودي</span>
          </div>
          {loading || error ? (
            <StatePanel loading={loading} error={error} onRetry={retry} />
          ) : visible.length ? (
            <div className="auction-grid browse-grid">
              {visible.map((a) => (
                <AuctionCard key={a.id} auction={a} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <div className="state-panel">
              <Icon name="search" size={34} />
              <h3>ما لقينا أصلًا بهالاختيار</h3>
              <p>جرّب فئة ثانية، أو خفف الفلاتر يمكن اللي يلفت نظرك قريب</p>
            </div>
          )}
        </section>
      </div>
      <div className="browse-end">
        <span>اختيار مدروس، يبدأ بتفاصيل واضحة</span>
        <a href="#/guide">
          جديدة على المزادات؟ <Icon size={18} />
        </a>
      </div>
    </div>
  );
}
