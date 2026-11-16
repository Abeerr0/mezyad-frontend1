import React from "react";
import { AccountLayout } from "../account/components/account-components.jsx";
import { API } from "../../shared/api/client.js";
import AdminReview from "./review/AdminReview";
import { isAdminRole } from "./admin-access";
import { ADMIN_PAGE } from "./admin-navigation";
import "./admin.css";

export default function AdminDashboard({ workspace }) {
  return (
    <AccountLayout
      workspace={workspace}
      active={ADMIN_PAGE}
      title={"لوحة الإدارة"}
      eyebrow={"متابعة وقرار"}
      description={"راجع الإعلانات وتابع المزادات من مكان واحد"}
    >
      {isAdminRole(workspace.user?.role) ? (
        <AdminReview
          api={new URL(API, location.origin).href}
          token={workspace.session.token}
          onUnauthorized={() => {
            workspace.expireSession();
            location.hash = "/login";
          }}
        />
      ) : (
        workspace.user && (
          <div className="paper-card" role="alert">
            هذي الصفحة مخصصة للإدارة <a href="#/activity">ارجع لحسابك</a>
          </div>
        )
      )}
    </AccountLayout>
  );
}
