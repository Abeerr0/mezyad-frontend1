import React from "react";
import { AccountLayout } from "../account-components";
import { API } from "../api";
import AdminReview from "../AdminReview-Aseel";

// تم التعديل من عبير: نربط لوحه اسيل بصلاحيات الادمن ونحافظ على منطق المراجعه الاصلي.
export default function AdminDashboardAseel({ workspace }) {
  return (
    <AccountLayout
      workspace={workspace}
      active="admin"
      title={"لوحة الإدارة"}
      eyebrow={"متابعة وقرار"}
      description={"راجع الإعلانات وتابع المزادات من مكان واحد"}
    >
      {workspace.user?.role === "ADMIN" ? (
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
