// تم التعديل من عبير: يشغل React ويحمل التنسيق العام ويربط التطبيق بالصفحه
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import "./shared/styles/typography.css";
import "./shared/styles/global.css";

// تم التعديل من عبير: نشغل صفحات المستخدم بنفس هويه الموقع.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
