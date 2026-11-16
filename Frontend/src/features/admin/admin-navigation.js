import { isAdminRole } from "./admin-access.js";

export const ADMIN_PAGE = "admin";
export const ADMIN_PATH = "/" + ADMIN_PAGE;
export const ADMIN_HREF = "#" + ADMIN_PATH;

export const ADMIN_ACCOUNT_LINKS = [
  [ADMIN_PAGE, "لوحة الإدارة", "shield"],
  ["profile", "الملف الشخصي", "user"],
];

export function accountDestination(role, fallback) {
  return isAdminRole(role) ? ADMIN_PATH : fallback;
}

export function accountBreadcrumbHref(role) {
  return isAdminRole(role) ? "#/profile" : "#/activity";
}
