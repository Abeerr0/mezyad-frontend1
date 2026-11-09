// تم التعديل من عبير: يفتح نموذج انشاء اعلان داخل حساب المستخدم
import React from "react";
import {
  AccountLayout,
  ResourceState,
} from "../../../account/components/account-components.jsx";
import ListingEditor from "../../components/ListingEditor/ListingEditor.jsx";

// تم التعديل من عبير: صفحه الانشاء تستخدم بيانات التصنيفات الحاليه للحساب.
export default function CreateListing({ workspace }) {
  return (
    <AccountLayout
      workspace={workspace}
      active="listings"
      eyebrow={"ابدأ حكاية جديدة"}
      title={"اعرض أصلك"}
      description={"أربع خطوات بسيطة، وإعلانك يوصل للمراجعة"}
    >
      <ResourceState workspace={workspace}>
        {workspace.user && <ListingEditor workspace={workspace} />}
      </ResourceState>
    </AccountLayout>
  );
}
