// تم التعديل من عبير: فوتر مشترك بروابط الموقع
import React from "react";
import { Icon } from "../ui/index.jsx";
export default function SiteFooter({ onFeature }) {
  return (
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
            <button onClick={() => onFeature("private")}>دخول مزاد خاص</button>
            <a href="#/help?topic=bank">عن الالتزام البنكي</a>
          </div>
          <div className="footer-signature">
            <Icon name="gavel" size={38} />
            <span>القيمة في التفاصيل</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            <i />
            المملكة العربية السعودية
          </span>
          <span>للقيمة أهلها</span>
        </div>
      </div>
    </footer>
  );
}
