import React, { useState } from "react";
import {
  AccountLayout,
  ResourceState,
  listingLabels,
} from "../account-components";
import { Icon, Modal, dateText } from "../components";
import { categoryLabels } from "../data";
import { imageUrl } from "../api";

// تم التعديل من عبير: نعرض اعلانات صاحب الحساب ونخلي الاكشن حسب حاله كل اعلان.
export default function MyListings({ workspace, params }) {
  const [status, setStatus] = useState(params.get("status") || "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(params.get("item"));
  const item = workspace.items.find((i) => i.id === selected);
  const shown = workspace.items.filter(
    (i) => (!status || i.status === status) && i.title.includes(search.trim()),
  );
  function actions(record) {
    if (record.status === "REJECTED")
      return (
        <a
          className="button dark small"
          href={"#/edit-listing?id=" + encodeURIComponent(record.id)}
        >
          تعديل وإعادة إرسال <Icon name="refresh" size={16} />
        </a>
      );
    if (record.status === "APPROVED")
      return (
        <a
          className="button dark small"
          href={"#/create-auction?item=" + encodeURIComponent(record.id)}
        >
          إعداد المزاد <Icon name="gavel" size={16} />
        </a>
      );
    return (
      <span className="waiting-label">
        <Icon name="clock" size={16} /> بانتظار مراجعة المشرف
      </span>
    );
  }
  return (
    <AccountLayout
      workspace={workspace}
      active="listings"
      eyebrow="أصولك، وحكاياتها"
      title="إعلاناتي"
      description="شوف حالة كل إعلان، واعرف وش يحتاج منك."
    >
      <ResourceState workspace={workspace}>
        {params.get("saved") === "1" && (
          <p className="inline-notice" role="status">
            تمت إعادة إرسال إعلانك للمراجعة
            {workspace.demo ? " داخل المعاينة فقط" : ""}.
          </p>
        )}
        <div className="listing-toolbar">
          <div className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="البحث في إعلاناتي"
              placeholder="دور على إعلانك"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <a href="#/create-listing" className="button dark">
            إعلان جديد <Icon name="plus" size={18} />
          </a>
          <button
            className="icon-button"
            aria-label="تحديث إعلاناتي"
            onClick={workspace.reload}
          >
            <Icon name="refresh" />
          </button>
        </div>
        <div className="filter-tabs listing-tabs" aria-label="حالة إعلاناتي">
          {[
            ["", "الكل"],
            ["PENDING_REVIEW", "قيد المراجعة"],
            ["APPROVED", "معتمدة"],
            ["REJECTED", "تحتاج تعديل"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
              <span>
                {
                  workspace.items.filter((i) => !value || i.status === value)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        {!shown.length ? (
          <div className="paper-card empty-box">
            <Icon name="image" size={40} />
            <h2>
              {workspace.items.length
                ? "ما لقينا إعلان بهالاختيار"
                : "أول حكاية تبدأ بإعلان"}
            </h2>
            <p>
              {workspace.items.length
                ? "خفف البحث أو غيّر الحالة."
                : "جهّز صور أصل تفتخر فيه، وخلّنا نشوف تفاصيله."}
            </p>
            {workspace.items.length ? (
              <button
                className="button outline"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                عرض كل الإعلانات
              </button>
            ) : (
              <a className="button dark" href="#/create-listing">
                أنشئ أول إعلان <Icon />
              </a>
            )}
          </div>
        ) : (
          <div className="owned-listings">
            {shown.map((record) => (
              <article className="owned-card" key={record.id}>
                <button
                  className="owned-image"
                  aria-label={"تفاصيل " + record.title}
                  onClick={() => setSelected(record.id)}
                >
                  {record.images?.length ? (
                    <img src={imageUrl(record.images[0])} alt={record.title} />
                  ) : (
                    <Icon name="image" size={40} />
                  )}
                  <span className={"status-tag " + record.status.toLowerCase()}>
                    {listingLabels[record.status]}
                  </span>
                </button>
                <div className="owned-card-body">
                  <p className="eyebrow">
                    {categoryLabels[
                      workspace.categories.find(
                        (c) => c.id === record.category_id,
                      )?.name
                    ] || "أصل مميز"}
                  </p>
                  <h2>
                    <button onClick={() => setSelected(record.id)}>
                      {record.title}
                    </button>
                  </h2>
                  <p className="owned-description">{record.description}</p>
                  {record.status === "REJECTED" && (
                    <div className="rejection-note">
                      <strong>ملاحظة المشرف</strong>
                      <p>
                        {record.review_reason ||
                          "ما وصل سبب الرفض. راجع المشرف قبل التعديل."}
                      </p>
                    </div>
                  )}
                  <div className="owned-actions">
                    {actions(record)}
                    <button
                      className="text-link"
                      onClick={() => setSelected(record.id)}
                    >
                      التفاصيل <Icon size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {item && (
          <Modal title={item.title} onClose={() => setSelected(null)}>
            <span className={"status-tag " + item.status.toLowerCase()}>
              {listingLabels[item.status]}
            </span>
            <div className="listing-gallery">
              {item.images?.map((image, index) => (
                <img
                  key={index}
                  src={imageUrl(image)}
                  alt={"صورة " + (index + 1) + " — " + item.title}
                />
              ))}
            </div>
            <p className="preserve-lines">{item.description}</p>
            <dl className="spec-list">
              {Object.entries(
                item.categoryFields || item.category_fields || {},
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
            {item.created_at && (
              <p className="field-hint">أُرسل: {dateText(item.created_at)}</p>
            )}
            {item.status === "REJECTED" && (
              <div className="rejection-note">
                <strong>سبب الرفض</strong>
                <p>{item.review_reason || "غير متاح"}</p>
              </div>
            )}
            {item.status === "APPROVED" && (
              <p className="inline-notice">
                اعتماد الإعلان ما ينشئ المزاد تلقائيًا. حدد شروطه من إعداد
                المزاد.
              </p>
            )}
            <div className="form-actions">{actions(item)}</div>
          </Modal>
        )}
      </ResourceState>
    </AccountLayout>
  );
}
