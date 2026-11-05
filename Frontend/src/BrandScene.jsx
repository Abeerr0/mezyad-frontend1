import React from "react";

// تم التعديل من عبير: نوزع صور الهويه حسب سياق الصفحه ونخلي عناصر النماذج واضحه بدون زحمه.
const scenes = {
  home: [
    "collection",
    "gold-birds",
    "أصول تستاهل توقف عندها",
    "من أول نظرة، تبدأ الحكاية",
    "استكشف المزادات",
    "auctions",
  ],
  auctions: [
    "desert-drive",
    "red-classic",
    "شي يلفت وشي يبقى",
    "خذ وقتك، وتعرّف على الأصل اللي يناسبك",
    "كيف تبدأ؟",
    "guide",
  ],
  guide: [
    "heritage",
    "hourglass",
    "القيمة ما تستعجل",
    "اقرأ التفاصيل، وحدد ميزانيتك، وادخل المزاد وأنت عارف خطوتك",
    "خذ لفة بالمزادات",
    "auctions",
  ],
  help: [
    "riyadh-drive",
    "pocket-watch",
    "خذ راحتك، واسأل",
    "كل خطوة واضحة تخلي قرارك أريح",
    "كيف يعمل مزياد؟",
    "guide",
  ],
  "private-access": [
    "brand/masmak.jpg",
    null,
    "مزاد خاص، بدعوتك",
    "رمزك يفتح لك تفاصيل المزاد اللي انَدعيت له",
    "تصفح المزادات العامة",
    "auctions",
  ],
  profile: [
    "brand/murabba.jpg",
    "timepieces",
    "لك حضورك في المزاد",
    "اختر الصورة اللي تمثلك، وخلّ حسابك بطابعك",
    "نشاطي",
    "activity",
  ],
  listings: [
    "brand/bujairi.jpg",
    "burgundy-classic",
    "كل أصل له حكاية",
    "وضّح التفاصيل، وخلّ الصور تحكي الباقي",
    "اعرض أصلك",
    "create-listing",
  ],
  activity: [
    "brand/kindi.jpg",
    "black-coupe",
    "خطوتك الجاية تبدأ هنا",
    "تابع أصولك، وخلك قريب من المزاد",
    "مزاداتي ومشاركاتي",
    "my-auctions",
  ],
};
export default function BrandScene({ page }) {
  const scene = scenes[page];
  if (!scene) return null;
  const [photo, cutout, title, text, label, link] = scene;
  // تم التعديل من عبير: لكل صفحه صوره مختلفه وما نكرر صور العروض داخل هويه الموقع.
  const photoPath = photo.includes("/")
    ? "/images/" + photo
    : `/images/notion/${photo}.webp`;
  return (
    <section className={"container brand-scene brand-scene-" + page}>
      <div className="brand-scene-photo">
        <img
          src={photoPath}
          loading="lazy"
          alt={
            photo.startsWith("brand/") || photo === "heritage"
              ? "تفاصيل من العماره والاحياء السعوديه"
              : "تفاصيل من عالم مزياد"
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
      {cutout &&
        !["red-classic", "black-coupe", "burgundy-classic"].includes(
          cutout,
        ) && (
          <img
            className="brand-scene-cutout"
            src={`/images/notion/${cutout}.webp`}
            loading="lazy"
            alt=""
            aria-hidden="true"
          />
        )}
    </section>
  );
}
