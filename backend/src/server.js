import "./env.js";
import { app } from "./app.js";

// نشغّل السيرفر على المنفذ الموجود في الإعدادات.
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log("Mezyad API listening on " + port);
});
