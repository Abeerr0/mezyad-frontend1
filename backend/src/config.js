import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
// تم التعديل من عبير: نقرا اعدادات الباك من نفس المكان مهما كان مكان امر التشغيل.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
