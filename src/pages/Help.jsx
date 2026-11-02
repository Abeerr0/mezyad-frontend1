import React, { useState } from "react";
import { Auctioneer, Icon } from "../components";
import { faqItems } from "../data";

// تم التعديل من عبير: نبحث باجابات المساعده ونخلي السؤال ينفتح بالكيبورد بعد.
export default function Help({ topic = "" }) {
  const [search, setSearch] = useState("");
  const groups = [
    ["", "كل الأسئلة"],
    ["general", "البداية"],
    ["seller", "عرض الأصول"],
    ["bidder", "المزايدة"],
    ["private", "المزادات الخاصة"],
    ["bank", "الالتزام البنكي"],
  ];
  const selected = groups.some(([value]) => value === topic) ? topic : "";
  const filtered = faqItems.filter(
    (item) =>
      (!selected || item.group === selected) &&
      (!search.trim() ||
        (item.question + " " + item.answer).includes(search.trim())),
  );
  return (
    <div className="container help-page">
      <div className="breadcrumb">
        <a href="#/">الرئيسية</a>
        <span>/</span>المساعدة
      </div>
      <section className="help-intro">
        <p className="eyebrow">ما نترك سؤالك معلّق</p>
        <h1>
          وش ودّك <em>تعرف؟</em>
        </h1>
        <p>جمعنا لك إجابات واضحة، من أول إعلان إلى آخر عرض.</p>
        <label className="search-input help-search">
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اكتب سؤالك أو كلمة تدور عليها"
            aria-label="البحث في الأسئلة الشائعة"
          />
          {search && (
            <button
              className="icon-button"
              onClick={() => setSearch("")}
              aria-label="مسح البحث"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
      </section>
      <div className="help-layout">
        <nav className="help-categories" aria-label="تصنيفات المساعدة">
          {groups.map(([value, label]) => (
            <a
              key={value}
              href={"#/help" + (value ? "?topic=" + value : "")}
              aria-current={selected === value ? "page" : undefined}
            >
              {label}
              <Icon size={16} />
            </a>
          ))}
        </nav>
        <section className="faq-list" aria-label="الأسئلة والأجوبة">
          <p className="faq-count" aria-live="polite">
            {filtered.length} إجابات قد تساعدك
          </p>
          {filtered.length ? (
            filtered.map((item) => (
              <details className="faq-item" key={item.question}>
                <summary>
                  {item.question}
                  <Icon name="plus" size={20} />
                </summary>
                <div className="faq-answer">
                  <p>{item.answer}</p>
                  {item.action && (
                    <a className="text-link" href="#/guide">
                      شوف الرحلة كاملة <Icon size={17} />
                    </a>
                  )}
                </div>
              </details>
            ))
          ) : (
            <div className="state-panel">
              <Icon name="search" size={30} />
              <h2>ما لقينا إجابة بهالكلمات</h2>
              <p>جرّب كلمة أبسط أو ارجع لكل الأسئلة.</p>
              <button
                className="button outline"
                onClick={() => {
                  setSearch("");
                  location.hash = "/help";
                }}
              >
                كل الأسئلة <Icon />
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="help-bottom">
        <div>
          <p className="eyebrow">أحيانًا، الشرح بالصورة أوضح</p>
          <h2>خلّينا نوريك الرحلة.</h2>
          <p>دليل قصير يشرح لك خطوات البيع والمزايدة، بدون تعقيد.</p>
          <a className="button dark" href="#/guide">
            كيف تشتغل مزياد <Icon />
          </a>
        </div>
        <Auctioneer small />
      </section>
    </div>
  );
}
