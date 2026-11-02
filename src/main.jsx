import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// تم التعديل من عبير: نشغل صفحات المجموعه الاولى فقط بدون صفحات الادمن.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
