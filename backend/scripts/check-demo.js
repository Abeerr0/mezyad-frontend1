import "../src/config.js";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  assertLocalDemo,
  demoNames,
  demoPassword,
  demoId,
  demoCode,
} from "./seed-demo.js";

// تم التعديل من عبير: نفحص البيانات المحفوظه عن طريق API ونخلي الاعلانات والمزادات موجوده بعد الفحص.
export async function checkDemo({
  pool,
  base = "http://127.0.0.1:3000/api/v1",
}) {
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("Use a local API URL only.");
  base = base.replace(/\/+$/, "");
  const results = [],
    tokens = new Map(),
    sessions = [];
  async function request(path, { method = "GET", body, token } = {}) {
    try {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      return { status: response.status, json: await response.json() };
    } catch {
      throw new Error(
        `Cannot read API at ${base}. Start the backend and check the port and DATABASE_URL.`,
      );
    }
  }
  function check(name, response, status, code, valid = true) {
    const passed =
      response.status === status &&
      (!code || response.json.error?.code === code) &&
      valid;
    results.push({
      Test: name,
      HTTP: response.status,
      Code: response.json.error?.code || "OK",
      Result: passed ? "PASS" : "FAIL",
    });
    return passed;
  }
  try {
    check("Server health", await request("/health"), 200);
    const categories = await request("/categories");
    check(
      "Categories",
      categories,
      200,
      null,
      Array.isArray(categories.json.data) && categories.json.data.length >= 5,
    );
    for (const name of demoNames) {
      const email = name.toLowerCase() + "@example.com",
        user = (
          await pool.query(
            "SELECT id,password_hash FROM users WHERE email=$1",
            [email],
          )
        ).rows[0];
      if (!user || !(await bcrypt.compare(demoPassword, user.password_hash))) {
        results.push({
          Test: "Login " + name,
          HTTP: "-",
          Code: "Existing password unchanged",
          Result: "SKIP",
        });
        continue;
      }
      const login = await request("/auth/login", {
        method: "POST",
        body: { email, password: demoPassword },
      });
      if (
        check(
          "Login " + name,
          login,
          200,
          null,
          login.json.data?.user?.id === user.id &&
            typeof login.json.data?.token === "string",
        )
      ) {
        tokens.set(name, login.json.data.token);
        sessions.push(login.json.data.token);
      }
    }
    for (const status of ["ACTIVE", "SCHEDULED", "CLOSED"]) {
      const response = await request("/auctions?status=" + status);
      const expected = (
        await pool.query(
          `SELECT a.id FROM auctions a WHERE a.visibility='PUBLIC' AND a.id=ANY($1::uuid[]) AND (CASE WHEN a.status='CLOSED' OR a.end_time<=clock_timestamp() THEN 'CLOSED' WHEN a.start_time<=clock_timestamp() THEN 'ACTIVE' ELSE 'SCHEDULED' END)=$2`,
          [Array.from({ length: 6 }, (_, i) => demoId("auction:" + i)), status],
        )
      ).rows;
      const actual = response.json.data;
      check(
        "Public auctions " + status,
        response,
        200,
        null,
        Array.isArray(actual) &&
          expected.every((e) => actual.some((a) => a.id === e.id)) &&
          actual.every((a) => a.visibility !== "PRIVATE"),
      );
    }
    if (tokens.has("Tala"))
      for (const status of ["PENDING_REVIEW", "APPROVED", "REJECTED"])
        check(
          "Admin items " + status,
          await request("/items?status=" + status, {
            token: tokens.get("Tala"),
          }),
          200,
        );
    const privateId = demoId("auction:1"),
      code = demoCode(1);
    check(
      "Private details require login",
      await request("/auctions/" + privateId),
      404,
      "NOT_FOUND",
    );
    if (tokens.has("Abeer")) {
      check(
        "Owner cannot join own private auction",
        await request("/auctions/access", {
          method: "POST",
          token: tokens.get("Abeer"),
          body: { accessCode: code },
        }),
        403,
        "OWNER",
      );
      check(
        "My listings",
        await request("/me/items", { token: tokens.get("Abeer") }),
        200,
      );
    }
    if (tokens.has("Ghadi")) {
      check(
        "Wrong private code",
        await request("/auctions/access", {
          method: "POST",
          token: tokens.get("Ghadi"),
          body: { accessCode: "000000000000000000000000" },
        }),
        403,
        "INVALID_CODE",
      );
      for (let n = 1; n <= 2; n++) {
        const response = await request("/auctions/access", {
          method: "POST",
          token: tokens.get("Ghadi"),
          body: { accessCode: code },
        });
        check(
          "Private code attempt " + n,
          response,
          200,
          null,
          response.json.data?.accessGranted === true &&
            response.json.data?.auctionId === privateId,
        );
      }
      check(
        "Private details after code",
        await request("/auctions/" + privateId, { token: tokens.get("Ghadi") }),
        200,
      );
      const user = (
        await pool.query("SELECT id FROM users WHERE email='ghadi@example.com'")
      ).rows[0];
      const grants = (
        await pool.query(
          "SELECT count(*)::int AS n FROM private_auction_access WHERE auction_id=$1 AND user_id=$2",
          [privateId, user.id],
        )
      ).rows[0].n;
      results.push({
        Test: "No duplicate access grant",
        HTTP: "SQL",
        Code: String(grants),
        Result: grants === 1 ? "PASS" : "FAIL",
      });
      const publicId = demoId("auction:0");
      const commitment = (
        await pool.query(
          "SELECT 1 FROM bid_commitments WHERE auction_id=$1 AND user_id=$2 AND status='SUCCESS'",
          [
            publicId,
            (
              await pool.query(
                "SELECT id FROM users WHERE email='aseel@example.com'",
              )
            ).rows[0].id,
          ],
        )
      ).rowCount;
      if (!commitment)
        check(
          "Bid needs verified commitment",
          await request("/auctions/" + publicId + "/bids", {
            method: "POST",
            token: tokens.get("Aseel"),
            body: { amount: 1, requestId: randomUUID() },
          }),
          403,
          "COMMITMENT_REQUIRED",
        );
      else
        results.push({
          Test: "Bid needs verified commitment",
          HTTP: "-",
          Code: "Existing commitment; no new bid sent",
          Result: "SKIP",
        });
    }
    if (tokens.has("Aseel")) {
      const grant = (
        await pool.query(
          "SELECT 1 FROM private_auction_access p JOIN users u ON u.id=p.user_id WHERE p.auction_id=$1 AND u.email='aseel@example.com'",
          [privateId],
        )
      ).rowCount;
      check(
        grant
          ? "Aseel existing access preserved"
          : "Aseel has no private access",
        await request("/auctions/" + privateId, { token: tokens.get("Aseel") }),
        grant ? 200 : 404,
        grant ? null : "NOT_FOUND",
      );
    }
    check(
      "Closed auction result",
      await request("/auctions/" + demoId("auction:4")),
      200,
    );
    return {
      results,
      privateAuction: { id: privateId, owner: "Abeer", accessCode: code },
    };
  } finally {
    // تم التعديل من عبير: ننهي جلسات الفحص بس؛ بيانات الموقع وتصريح غدي تبقى محفوظين.
    for (const token of sessions)
      await request("/auth/logout", { method: "POST", token }).catch(() => {});
  }
}
async function main() {
  assertLocalDemo(process.env.DATABASE_URL);
  const { pool } = await import("../src/db.js");
  try {
    const { results, privateAuction } = await checkDemo({
      pool,
      base: process.env.DEMO_API_URL,
    });
    console.table(results);
    console.log("PRIVATE AUCTION:", privateAuction.id);
    console.log("PRIVATE CODE:", privateAuction.accessCode);
    for (const result of ["PASS", "FAIL", "SKIP"])
      console.log(
        result + "=" + results.filter((row) => row.Result === result).length,
      );
    console.log("Accounts, listings, auctions and access grants were kept.");
    if (results.some((row) => row.Result === "FAIL")) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error("STOP:", error.message);
    process.exitCode = 1;
  });
