import React, { useState } from "react";
import { Auctioneer, Icon } from "../components";
import { guideSteps } from "../data";

// تم التعديل من عبير: نفس الحساب يقدر يبيع ويزايد ونشرح كل رحله بتبويب مستقل.
export default function Guide({ onFeature }) {
  const [role, setRole] = useState("bidder");
  return (
    <div className="guide-page">
      <div className="container">
        <div className="breadcrumb">
          <a href="#/">الرئيسية</a>
          <span>/</span>كيف تشتغل مزياد
        </div>
        <section className="guide-intro">
          <div>
            <p className="eyebrow">حياك، خلّينا نوضحها</p>
            <h1>
              المزاد مو معقّد.
              <br />
              <em>نمشيها سوا.</em>
            </h1>
            <p>
              من عرض الأصل إلى إعلان النتيجة، لكل خطوة مكانها.
              <br />
              حساب واحد يكفيك للبيع والمزايدة.
            </p>
            <div
              className="segment"
              role="group"
              aria-label="اختيار رحلة الاستخدام"
            >
              <button
                aria-pressed={role === "bidder"}
                onClick={() => setRole("bidder")}
              >
                أبغى أزايد <Icon name="gavel" size={18} />
              </button>
              <button
                aria-pressed={role === "seller"}
                onClick={() => setRole("seller")}
              >
                أبغى أعرض أصل <Icon name="image" size={18} />
              </button>
            </div>
          </div>
          <div className="guide-art">
            <div className="art-ring" />
            <Auctioneer
              character={role === "bidder" ? "collector" : "auctioneer"}
              motion={role === "bidder" ? "bid" : "inspect"}
            />
            <span className="speech-bubble">كل خطوة، ولها حكاية.</span>
          </div>
        </section>
        <section
          className="guide-steps"
          aria-label={role === "bidder" ? "خطوات المزايدة" : "خطوات البيع"}
          key={role}
        >
          {guideSteps[role].map((step, i) => (
            <article key={step.title}>
              <span className="step-number">0{i + 1}</span>
              <div className="step-icon">
                <Icon name={step.icon} size={27} />
              </div>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </article>
          ))}
        </section>
        <section className="type-comparison">
          <div className="section-heading">
            <div>
              <p className="eyebrow">نفس وضوح التجربة</p>
              <h2>عام، أو بدعوة خاصة؟</h2>
            </div>
          </div>
          <div className="comparison-grid">
            <article>
              <Icon name="globe" size={32} />
              <h3>المزاد العام</h3>
              <p>
                يظهر في الاستكشاف للجميع. تقدر تقرأ التفاصيل، وتحتاج حسابًا
                واستيفاء شروط المشاركة قبل تقديم العرض.
              </p>
              <a className="text-link" href="#/auctions">
                استكشف المزادات <Icon />
              </a>
            </article>
            <article>
              <Icon name="lock" size={30} />
              <h3>المزاد الخاص</h3>
              <p>
                ما يظهر بالقائمة العامة. البائع يشارك الرمز مع المدعوين، ويُتحقق
                منه بعد الدخول قبل عرض التفاصيل المحمية.
              </p>
              <button
                className="text-link"
                onClick={() => onFeature("private")}
              >
                عندي رمز دعوة <Icon />
              </button>
            </article>
          </div>
        </section>
        <section className="guide-bank">
          <Icon name="shield" size={34} />
          <div>
            <h2>خطوة تسبق المنافسة</h2>
            <p>
              قبل ما تقدّم عرضك، أكمل الالتزام البنكي الخاص بالمزاد. تقدر تتابع
              حالته من حسابك، وتبدأ المزايدة بعد تأكيده. الالتزام ما يعني دفع
              قيمة الأصل.
            </p>
            <a href="#/help?topic=bank" className="text-link">
              اقرأ عن الالتزام <Icon size={18} />
            </a>
          </div>
        </section>
        <section className="guide-cta">
          <p className="eyebrow">الخطوة الجاية لك</p>
          <h2>
            {role === "bidder" ? "جاهز تشوف اللي يستحق؟" : "عندك أصل له قصة؟"}
          </h2>
          {role === "bidder" ? (
            <a href="#/auctions" className="button dark">
              استكشف المزادات <Icon />
            </a>
          ) : (
            <button onClick={() => onFeature("sell")} className="button dark">
              ابدأ عرض أصلك <Icon />
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
