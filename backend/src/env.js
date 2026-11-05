import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// تم التعديل من عبير: نقرا ملف الباك بمساره الثابت حتى لو التشغيل من جذر المشروع ونحافظ على متغيرات النظام.
export const backendEnvPath = fileURLToPath(new URL("../.env", import.meta.url));
dotenv.config({ path: backendEnvPath });
// تم التعديل من عبير: ملف الجذر يكمل القيم الناقصه فقط وما يستبدل اعدادات الباك.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
