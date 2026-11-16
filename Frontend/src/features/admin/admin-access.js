const blockedPages = new Set([
  "create-listing",
  "edit-listing",
  "create-auction",
  "listings",
  "bid",
  "commitment",
  "payment",
]);

export function isAdminRole(role) {
  return role === "ADMIN";
}

export function isAdminPageBlocked(role, page) {
  return isAdminRole(role) && blockedPages.has(page);
}

export function canShowMarketplaceActions(role) {
  return !isAdminRole(role);
}

export function canShowAuctionNavPage(role, page) {
  return !isAdminRole(role) || (page !== "commitment" && page !== "bid");
}

export function canShowAccountSettings(role) {
  return !isAdminRole(role);
}
