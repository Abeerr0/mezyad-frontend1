import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// تم التعديل من عبير: نحول طلبات API للباك المحلي بدون تغيير اعداداته.
// تم التعديل من عبير: نرجع خطا JSON واضح اذا الباك مو متاح بدل رد ينفهم انه عنوان غلط.
function backendProxy() {
  return {
    target: "http://127.0.0.1:3000", changeOrigin: true,
    configure(proxy) {
      proxy.on("error", (_error, _req, res) => {
        if (!res || typeof res.writeHead !== "function" || res.headersSent || res.writableEnded) return;
        res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({error:{code:"BACKEND_UNAVAILABLE",message:"Backend is not reachable"}}));
      });
    },
  };
}
const proxy = {"/api":backendProxy(),"/uploads":backendProxy(),"/auctions":backendProxy()};
export default defineConfig({
  plugins: [react()],
  preview: { proxy },
  server: {
    allowedHosts: ["terminal.local"],
    proxy,
  },
});
