// تم التعديل من عبير: هيدر مشترك للتنقل والدخول وعرض الاصل
import React from "react";
import { Avatar } from "../../features/profile/components/Avatar.jsx";
import { Icon } from "../ui/index.jsx";
export default function SiteHeader({
  menu,
  route,
  onFeature,
  workspace,
  setMenu,
}) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="#/" className="brand" aria-label={"مزياد — الرئيسية"}>
          <img src="/images/mezyad-logo.png" alt={"Mezyad مزياد"} />
        </a>
        <nav
          className={"main-nav " + (menu ? "is-open" : "")}
          aria-label={"التنقل الرئيسي"}
        >
          {[
            ["home", "/", "الرئيسية"],
            ["auctions", "/auctions", "المزادات"],
            ["guide", "/guide", "كيف يعمل مزياد"],
            ["help", "/help", "المساعدة"],
          ].map(([key, path, label]) => (
            <a
              key={key}
              href={"#" + path}
              aria-current={route.page === key ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="account-button"
            onClick={() => onFeature("account")}
          >
            {workspace.user ? (
              <Avatar value={workspace.avatar} name={workspace.user.name} />
            ) : (
              <Icon name="user" size={17} />
            )}
            <span>{workspace.user ? "مزاداتي" : "تسجيل الدخول"}</span>
          </button>
          {![
            "listings",
            "create-listing",
            "edit-listing",
            "create-auction",
          ].includes(route.page) && (
            <button
              className="button small dark sell-button"
              onClick={() => onFeature("sell")}
            >
              اعرض أصلك <Icon name="plus" size={17} />
            </button>
          )}
          <button
            className="icon-button menu-button"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={menu}
          >
            <Icon name={menu ? "close" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}
