import React from "react";

// تم التعديل من عبير: نوزع صور الهويه حسب سياق الصفحه ونخلي عناصر النماذج واضحه بدون زحمه.
const scenes = {
  home: [
    "collection",
    "gold-birds",
    "أصول تستاهل توقف عندها.",
    "من أول نظرة، تبدأ الحكاية.",
    "استكشف المزادات",
    "auctions",
  ],
  auctions: [
    "desert-drive",
    "red-classic",
    "شي يلفت. وشي يبقى.",
    "خذ وقتك، وتعرّف على الأصل اللي يناسبك.",
    "كيف تبدأ؟",
    "guide",
  ],
  guide: [
    "heritage",
    "hourglass",
    "القيمة ما تستعجل.",
    "اقرأ التفاصيل، وحدد ميزانيتك، وادخل المجلس وأنت عارف خطوتك.",
    "خذ لفة بالمزادات",
    "auctions",
  ],
  help: [
    "riyadh-drive",
    "pocket-watch",
    "خذ راحتك، واسأل.",
    "كل خطوة واضحة تخلي قرارك أريح.",
    "كيف يعمل مزياد؟",
    "guide",
  ],
  "private-access": [
    "heritage",
    "gold-birds",
    "مجلس خاص، بدعوتك.",
    "رمزك يفتح لك تفاصيل المزاد اللي انَدعيت له.",
    "تصفح المزادات العامة",
    "auctions",
  ],
  profile: [
    "riyadh-drive",
    "timepieces",
    "لك حضورك في المجلس.",
    "اختر الصورة اللي تمثلك، وخلّ حسابك بطابعك.",
    "نشاطي",
    "activity",
  ],
  listings: [
    "collection",
    "burgundy-classic",
    "كل أصل له حكاية.",
    "وضّح التفاصيل، وخلّ الصور تحكي الباقي.",
    "اعرض أصلك",
    "create-listing",
  ],
  activity: [
    "desert-drive",
    "black-coupe",
    "خطوتك الجاية تبدأ هنا.",
    "تابع أصولك، وخلك قريب من المجلس.",
    "مزاداتي ومشاركاتي",
    "my-auctions",
  ],
};
export default function BrandScene({ page }) {
  const scene = scenes[page];
  if (!scene) return null;
  const [photo, cutout, title, text, label, link] = scene;
  return (
    <section className={"container brand-scene brand-scene-" + page}>
      <div className="brand-scene-photo">
        <img
          src={`/images/notion/${photo}.webp`}
          loading="lazy"
          alt={
            photo === "heritage"
              ? "نخيل وعمارة بطابع نجدي"
              : "سيارات وملامح من البيئة السعودية"
          }
        />
      </div>
      <div className="brand-scene-copy">
        <span className="eyebrow">من عالم مزياد</span>
        <h2>{title}</h2>
        <p>{text}</p>
        <a className="text-link" href={"#/" + link}>
          {label} <span aria-hidden="true">←</span>
        </a>
      </div>
      <img
        className="brand-scene-cutout"
        src={`/images/notion/${cutout}.webp`}
        loading="lazy"
        alt=""
        aria-hidden="true"
      />
    </section>
  );
}
