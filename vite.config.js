import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// تم التعديل من عبير: نحول طلبات API للباك المحلي بدون تغيير اعداداته.
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["terminal.local"],
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
});
