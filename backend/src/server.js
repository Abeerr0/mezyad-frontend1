import "./config.js";
import { app } from "./app.js";
// تم التعديل من عبير: نستخدم نفس المنفذ للواجهه المبنيه وAPI.
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log("Mezyad listening on http://localhost:"+port));
