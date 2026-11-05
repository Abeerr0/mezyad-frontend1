import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// تم التعديل من عبير: نشغل واجهه المستخدم ولوحه الاداره بنفس هويه الموقع.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
