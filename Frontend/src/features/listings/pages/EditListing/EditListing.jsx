// تم التعديل من عبير: يحمل الاعلان المرفوض عشان يتعدل وينرسل من جديد
import React from "react";
import {
  AccountLayout,
  ResourceState,
} from "../../../account/components/account-components.jsx";
import ListingEditor from "../../components/ListingEditor/ListingEditor.jsx";
import { Icon } from "../../../../shared/ui/index.jsx";

// تم التعديل من عبير: ما نفتح التعديل الا لاعلان المستخدم المرفوض والباك يتحقق بعد.
export default function EditListing({ workspace, params }) {
  const item = workspace.items.find((i) => i.id === params.get("id"));
  return (
    <AccountLayout
      workspace={workspace}
      active="listings"
      eyebrow={"نعدّلها، ونكمل"}
      title={"تعديل الإعلان"}
      description={"راجع ملاحظة المشرف، وعدّل إعلانك ثم أعد إرساله"}
    >
      <ResourceState workspace={workspace}>
        {item?.status === "REJECTED" ? (
          <ListingEditor key={item.id} workspace={workspace} existing={item} />
        ) : (
          <div className="paper-card empty-box">
            <Icon name="lock" size={36} />
            <h2>هالإعلان مو متاح للتعديل</h2>
            <p>التعديل هنا للإعلانات المرفوضة اللي تخص حسابك فقط</p>
            <a className="button dark" href="#/listings">
              العودة لإعلاناتي <Icon />
            </a>
          </div>
        )}
      </ResourceState>
    </AccountLayout>
  );
}
