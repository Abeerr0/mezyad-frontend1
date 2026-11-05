import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import "../backend/src/env.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = new Set();
let stopping = false;
// تم التعديل من عبير: نشغل الجزئين من امر واحد ونوقفهم مع بعض بدون قتل اي سيرفر ثاني.
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {stdio:"ignore"});
    else { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
  }
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
function start(folder, extra = []) {
  const child = spawn(process.execPath, [process.env.npm_execpath, "--prefix", folder, "run", "dev", ...extra], {cwd:root,stdio:"inherit",env:process.env,detached:process.platform !== "win32"});
  children.add(child);
  child.on("error", () => {console.error("Could not start", folder);stop(1)});
  child.on("exit", code => {children.delete(child);if (!stopping) stop(code || 0)});
}
try {
  if (Number(process.env.PORT || 3000) !== 3000) throw new Error("Set backend PORT=3000 to match the local frontend proxy");
  // تم التعديل من عبير: ما نستخدم سيرفر قديم شغال بالغلط ونوضح تعارض المنفذ قبل التشغيل.
  const occupied = await fetch("http://127.0.0.1:3000/health", {signal:AbortSignal.timeout(1000)}).then(()=>true,()=>false);
  if (occupied) throw new Error("Port 3000 is already serving a backend Stop the previous backend terminal first");
  start("backend");
  let ready = false;
  for (let i=0;i<30 && !stopping;i++) {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/v1/categories", {signal:AbortSignal.timeout(1500)});
      if (response.ok && Array.isArray((await response.json()).data)) {ready=true;break}
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!stopping) {
    if (!ready) throw new Error("Backend/database not ready Check the backend errors above and run docker compose up -d db");
    console.log("Backend and database ready Starting frontend on http://localhost:5173");
    start("Frontend", ["--", "--port", "5173", "--strictPort"]);
  }
} catch (error) {console.error(error.message);stop(1)}
