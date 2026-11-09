// تم التعديل من عبير: يعرض تفاصيل المزاد والصور والخطوه المناسبه للمستخدم
import { Avatar } from "../../../profile/components/Avatar.jsx";
import React, { useState } from "react";
import { Icon, money, dateText } from "../../../../shared/ui/index.jsx";
import { imageUrl } from "../../../../shared/api/client.js";
import {
  auctionLink,
  displayStatus,
  useAuction,
} from "../../hooks/useMarket.js";
import {
  AuctionLayout,
  AuctionState,
  AuctionNav,
  AuctionSummary,
} from "../../components/auction-components.jsx";

// تم التعديل من عبير: نعرض الاصل وصوره وشروطه ونربط الخطوه المناسبه بحاله المزاد.
export default function AuctionDetails({ market, id }) {
  const state = useAuction(market, id);
  const [selected, setSelected] = useState(0);
  const a = state.auction;
  const images = a?.images?.filter(Boolean) || [];
  const owner = a?.seller_id === market.userId;
  const status = a && displayStatus(a);
  return (
    <AuctionLayout
      market={market}
      title={"كل قيمة، وراها تفاصيل"}
      eyebrow={"قبل ما ترفع العرض"}
      description={"خذ وقتك مع الأصل، واقرأ شروط المزاد"}
    >
      <AuctionState state={state}>
        {a && (
          <>
            <AuctionNav id={id} current="auction" />
            <AuctionSummary auction={a} />
            <div className="auction-detail-grid">
              <div>
                <div className="asset-stage">
                  {images.length ? (
                    <img
                      src={imageUrl(
                        images[Math.min(selected, images.length - 1)],
                      )}
                      alt={a.title}
                    />
                  ) : (
                    <div className="empty-box">
                      <Icon name="image" size={50} />
                      <p>ما فيه صور متاحة للأصل</p>
                    </div>
                  )}
                  <span className="asset-edition">THE MEZYAD COLLECTION</span>
                </div>
                {images.length > 1 && (
                  <div className="asset-thumbnails">
                    {images.map((image, index) => (
                      <button
                        key={index}
                        aria-label={"عرض الصورة " + (index + 1)}
                        aria-pressed={index === selected}
                        onClick={() => setSelected(index)}
                      >
                        <img src={imageUrl(image)} alt="" />
                      </button>
                    ))}
                  </div>
                )}
                <section className="paper-card asset-story">
                  <p className="eyebrow">حكاية الأصل</p>
                  <h2>{a.title}</h2>
                  <p>{a.description || "ما أضاف البائع وصف إضافي"}</p>
                  <dl className="spec-list">
                    {Object.entries(
                      a.category_fields || a.categoryFields || {},
                    ).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
              <aside className="auction-ticket">
                {/* تم التعديل من عبير: نعرض هويه صاحب الجلسه بدون نسب اسمه او افتاره لبائع ثاني. */}
                {market.workspace.user && (
                  <div className="auction-member">
                    <Avatar
                      value={market.workspace.avatar}
                      name={market.workspace.user.name}
                    />
                    <div>
                      <strong>{market.workspace.user.name}</strong>
                      <small>{owner ? "هذا مزادك" : "تتصفح بحسابك"}</small>
                    </div>
                  </div>
                )}
                <p className="eyebrow">شروط المزاد</p>
                <div className="ticket-price">
                  <small>السعر الحالي</small>
                  <strong>{money(a.current_price)}</strong>
                  <span>ريال سعودي</span>
                </div>
                <dl>
                  <div>
                    <dt>سعر البداية</dt>
                    <dd>{money(a.starting_price)} ريال</dd>
                  </div>
                  <div>
                    <dt>أقل زيادة</dt>
                    <dd>{money(a.minimum_increment)} ريال</dd>
                  </div>
                  <div>
                    <dt>البداية — الرياض</dt>
                    <dd>{dateText(a.start_time)}</dd>
                  </div>
                  <div>
                    <dt>النهاية — الرياض</dt>
                    <dd>{dateText(a.end_time)}</dd>
                  </div>
                </dl>
                {status === "CLOSED" ? (
                  <a
                    className="button dark full"
                    href={auctionLink("auction-result", id)}
                  >
                    شوف النتيجة <Icon />
                  </a>
                ) : owner ? (
                  <p className="inline-notice">
                    هذا مزادك تابع العروض؛ المالك ما يزايد على أصله
                  </p>
                ) : status === "SCHEDULED" ? (
                  <p className="inline-notice">
                    المزاد ما بدأ ارجع بوقت البداية عشان تقدم عرضك
                  </p>
                ) : (
                  <a className="button dark full" href={auctionLink("bid", id)}>
                    قدّم عرضك <Icon name="gavel" />
                  </a>
                )}
                <a
                  className="button outline full"
                  href={auctionLink("bid-history", id)}
                >
                  سجل العروض
                </a>
                <p className="field-hint">
                  السعر يتحدّث تلقائيًا يتأكد قبول عرضك بعد إرساله وفق آخر سعر
                  ووقت المزاد
                </p>
                {state.updated && (
                  <small>
                    آخر تحديث: {state.updated.toLocaleTimeString("ar-SA")}
                  </small>
                )}
              </aside>
            </div>
          </>
        )}
      </AuctionState>
    </AuctionLayout>
  );
}
