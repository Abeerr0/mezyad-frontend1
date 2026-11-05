import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// تم التعديل من عبير: نحول طلبات API للباك المحلي بدون تغيير اعداداته.
const proxy = {
  "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
  "/uploads": { target: "http://127.0.0.1:3000", changeOrigin: true },
  // تم التعديل من عبير: مسار قراءه الحجز الاصلي يروح للباك بدل صفحه الفرونت.
  "/auctions": { target: "http://127.0.0.1:3000", changeOrigin: true },
};
export default defineConfig({
  plugins: [react()],
  preview: { proxy },
  server: {
    allowedHosts: ["terminal.local"],
    proxy,
  },
});
