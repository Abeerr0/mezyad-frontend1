// تم التعديل من عبير: يعرض مقدمه الموقع والتصنيفات والمزادات المختاره
import React from "react";
import {
  AuctionCard,
  Auctioneer,
  Icon,
  StatePanel,
} from "../../../../shared/ui/index.jsx";

// تم التعديل من عبير: نعرض المزادات العامه من نفس مصدر البيانات المستخدم بالتصفح.
export default function Home({
  auctions,
  categories,
  loading,
  error,
  retry,
  onOpen,
  onFeature,
}) {
  const featured = auctions.filter((a) => a.status === "ACTIVE").slice(0, 3);
  return (
    <>
      <section className="home-hero">
        <div className="hero-image">
          <img
            src="/images/home-interior.jpg"
            alt={"عمارة سعودية معاصرة وسط التكوينات الصخرية"}
            fetchpriority="high"
          />
        </div>
        <div className="hero-inner container">
          <div className="hero-copy">
            <p className="eyebrow light">
              <span />
              مزاد الأصول المميزة
            </p>
            <h1>
              أصول تستحق
              <br />
              ومنافسة <em>تليق بها</em>
            </h1>
            <p className="hero-description">
              اكتشف المزادات واختر اللي يناسبك
            </p>
            <div className="hero-actions">
              <a className="button gold" href="#/auctions">
                استكشف المزادات <Icon />
              </a>
              <button className="hero-sell" onClick={() => onFeature("sell")}>
                عندك أصل مميز؟ <span>اعرضه هنا</span>
              </button>
            </div>
          </div>
          <div className="hero-caption">
            <span className="caption-line" />
            <span>
              قيمة تُرى
              <br />
              وتفاصيل تُحكى
            </span>
            <span className="vertical-label">THE MEZYAD COLLECTION</span>
          </div>
        </div>
        <button
          className="scroll-cue"
          onClick={() => document.getElementById("featured")?.scrollIntoView()}
        >
          <span>ابدأ الاكتشاف</span>
          <Icon name="chevron" size={17} />
        </button>
      </section>

      <section className="principles-strip" aria-label={"مزايا التجربة"}>
        <div className="container">
          <span>
            <Icon name="image" />
            أصول بتفاصيل واضحة
          </span>
          <span>
            <Icon name="shield" />
            مراجعة قبل إنشاء المزاد
          </span>
          <span>
            <Icon name="gavel" />
            كل عرض، بشروط واضحة
          </span>
          <a href="#/guide">
            تعرّف على الرحلة <Icon size={16} />
          </a>
        </div>
      </section>

      <section className="section container" id="featured">
        <div className="section-heading">
          <div>
            <p className="eyebrow">اختيارات من المزاد</p>
            <h2>
              المنافسة بدأت<span className="gold-dot"></span>
            </h2>
          </div>
          <a className="text-link" href="#/auctions">
            كل المزادات <Icon />
          </a>
        </div>
        {loading || error ? (
          <StatePanel loading={loading} error={error} onRetry={retry} />
        ) : featured.length ? (
          <div className="auction-grid">
            {featured.map((a) => (
              <AuctionCard key={a.id} auction={a} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="state-panel">
            <Icon name="clock" size={30} />
            <h3>المزاد ينتظر بدايات جديدة</h3>
            <p>ما فيه مزادات عامة نشطة حاليًا تقدر تشوف المجدولة أو المنتهية</p>
            <a href="#/auctions" className="button outline">
              تصفح كل الحالات <Icon />
            </a>
          </div>
        )}
      </section>

      <section className="category-section">
        {/* تم التعديل من عبير: صوره الرياض بقصه منحنيه مع عنوان واضح. */}
        {/* تم التعديل من عبير: الاطار اكبر والنص بمكان مستقل والرموز موزعه حول المنحنى. */}
        <div className="category-portrait-wrap">
          <figure className="category-portrait">
            <img
              src="/images/riyadh-architecture.webp"
              alt={"عمارة الرياض ونخلة، بعدسة يوسف بوزوينة"}
              loading="lazy"
            />
            <figcaption>
              <span>الرياض</span>
              <small>أصالة نعيشها وقيمة نختارها</small>
            </figcaption>
          </figure>
          <div className="portrait-symbols" aria-hidden="true">
            <span>
              <Icon name="image" size={30} />
            </span>
            <span>
              <Icon name="flag" size={30} />
            </span>
            <span>
              <Icon name="gavel" size={30} />
            </span>
          </div>
        </div>
        <div className="container category-layout">
          <div>
            <p className="eyebrow">لكل قيمة مكان</p>
            <h2>
              وش يلفت
              <br />
              <em>نظرك؟</em>
            </h2>
            <p>
              اختر الفئة اللي تهمك
            </p>
          </div>
          <div className="category-links">
            {categories.map((c, i) => (
              <a
                key={c.id}
                href={"#/auctions?category=" + encodeURIComponent(c.id)}
              >
                <span className="category-number">0{i + 1}</span>
                <span>{c.label}</span>
                <Icon />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section container journey-section">
        <div className="journey-art">
          <div className="art-ring" />
          <span className="art-star">𓃗</span>
          <Auctioneer character="auctioneer" motion="gavel" />
          <span className="art-stamp">مزادك ينتظرك</span>
        </div>
        <div className="journey-copy">
          <p className="eyebrow">من أول نظرة، إلى آخر عرض</p>
          <h2>
            كل خطوة واضحة
            <br />
            وكل قرار <em>لك</em>
          </h2>
          <p>
            راجع تفاصيل الأصل وشروط المزاد قبل تقديم عرضك
          </p>
          <ol className="mini-steps">
            <li>
              <span>01</span>اكتشف وراجع التفاصيل
            </li>
            <li>
              <span>02</span>جهّز مشاركتك وأكّد عرضك
            </li>
            <li>
              <span>03</span>تابع المزاد والنتيجة
            </li>
          </ol>
          <a className="text-link" href="#/guide">
            خلّينا نمشيها خطوة خطوة <Icon />
          </a>
        </div>
      </section>

      <section className="private-invite container">
        <span className="invite-icon">
          <Icon name="lock" size={30} />
        </span>
        <div>
          <p className="eyebrow">دعوة خاصة، ومزاد خاص</p>
          <h2>معك رمز مزاد؟</h2>
          <p>
            المزادات الخاصة ما تظهر في التصفح العام الدخول لها يبدأ برمزك وحسابك
          </p>
        </div>
        <button className="button outline" onClick={() => onFeature("private")}>
          دخول مزاد خاص <Icon />
        </button>
      </section>
    </>
  );
}
