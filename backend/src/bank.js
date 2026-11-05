// ما نعتبر الالتزام ناجح لين يرجع تأكيد من البنك الرسمي.
export function startCommitment() {
  throw Object.assign(
    new Error("Sandbox provider and commitment operation are not configured"),
    {
      status: 503,
      apiCode: "BANK_SANDBOX_UNAVAILABLE",
    },
  );
}
