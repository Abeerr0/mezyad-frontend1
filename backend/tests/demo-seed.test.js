import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";
import {
  seedDemo,
  demoId,
  demoCode,
  assertLocalDemo,
} from "../scripts/seed-demo.js";
import { checkDemo } from "../scripts/check-demo.js";
const value = process.env.TEST_DATABASE_URL;
let control, pool, schema, uploads, server, first;
const passwordHash = await bcrypt.hash("Unrelated-account-password", 4);
async function migrate(connection) {
  for (const name of [
    "001_schema.sql",
    "002_private_auction_code_lookup.sql",
    "003_email_and_moyasar.sql",
  ])
    await connection.query(
      await readFile(
        new URL("../../database/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
}
before(async () => {
  if (!value) return;
  const url = new URL(value);
  assert.match(url.pathname, /_test$/);
  control = new pg.Pool({ connectionString: value });
  schema = "seed_" + randomBytes(6).toString("hex");
  await control.query('CREATE SCHEMA "' + schema + '"');
  url.searchParams.set("options", "-c search_path=" + schema + ",public");
  process.env.DATABASE_URL = url.toString();
  uploads = await mkdtemp(join(tmpdir(), "mezyad-seed-test-"));
  process.env.UPLOAD_DIR = uploads;
  ({ pool } = await import("../src/db.js"));
  await migrate(pool);
  await pool.query(
    "INSERT INTO users(name,email,password_hash) VALUES('Existing','existing@example.invalid',$1)",
    [passwordHash],
  );
  const { app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});
after(async () => {
  if (!value) return;
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool?.end();
  if (schema) await control.query('DROP SCHEMA "' + schema + '" CASCADE');
  await control?.end();
  if (uploads) await rm(uploads, { recursive: true, force: true });
});
const check = (name, fn) => test(name, { skip: !value }, fn);
check(
  "Demo seed creates 6 accounts, 12 listings and 6 varied auctions without financial successes",
  async () => {
    first = await seedDemo({ pool, uploadsRoot: uploads });
    assert.equal(first.accounts.length, 6);
    assert.equal(first.listingCount, 12);
    assert.equal(first.auctions.length, 6);
    assert.equal(first.auctions.filter((a) => a.status === "ACTIVE").length, 2);
    assert.equal(
      first.auctions.filter((a) => a.status === "SCHEDULED").length,
      2,
    );
    assert.equal(first.auctions.filter((a) => a.status === "CLOSED").length, 2);
    assert.equal(
      first.auctions.filter((a) => a.visibility === "PRIVATE").length,
      2,
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
      7,
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM items")).rows[0].n,
      12,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM auction_results WHERE winner_bid_id IS NULL",
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM bids")).rows[0].n,
      0,
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM bid_commitments"))
        .rows[0].n,
      0,
    );
    const account = (
      await pool.query("SELECT * FROM users WHERE email='abeer@example.com'")
    ).rows[0];
    assert.notEqual(account.password_hash, "Aa112233");
    assert.ok(await bcrypt.compare("Aa112233", account.password_hash));
    const privateRow = (
      await pool.query("SELECT * FROM auctions WHERE id=$1", [
        demoId("auction:1"),
      ])
    ).rows[0];
    assert.notEqual(privateRow.access_code_hash, demoCode(1));
    assert.ok(await bcrypt.compare(demoCode(1), privateRow.access_code_hash));
    assert.equal(privateRow.access_code_lookup.length, 64);
    assert.ok((await readdir(uploads)).length > 0);
  },
);
check(
  "Seeded accounts, public states and private invitation work through actual HTTP routes",
  async () => {
    const result = await checkDemo({
      pool,
      base: "http://127.0.0.1:" + server.address().port + "/api/v1",
    });
    assert.deepEqual(
      result.results.filter((r) => r.Result !== "PASS"),
      [],
    );
    assert.equal(result.privateAuction.owner, "Abeer");
    assert.equal(result.privateAuction.accessCode, demoCode(1));
    const image = (
      await pool.query("SELECT image_url FROM item_images LIMIT 1")
    ).rows[0].image_url;
    const { imageLink } = await import("../src/uploads.js");
    const response = await fetch(
      "http://127.0.0.1:" + server.address().port + imageLink(image),
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /image\/jpeg/);
    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM user_sessions")).rows[0]
        .n,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM private_auction_access",
        )
      ).rows[0].n,
      1,
    );
    console.log("API checks passed:", result.results.length);
  },
);
check(
  "Repeated seed preserves changed passwords, prices, times, existing data and images",
  async () => {
    await pool.query(
      "UPDATE users SET password_hash=$1 WHERE email='abeer@example.com'",
      [passwordHash],
    );
    await pool.query(
      "UPDATE auctions SET current_price=current_price+10000 WHERE id=$1",
      [demoId("auction:0")],
    );
    const old = (
      await pool.query("SELECT * FROM auctions WHERE id=$1", [
        demoId("auction:0"),
      ])
    ).rows[0];
    const files = await readdir(uploads);
    const again = await seedDemo({ pool, uploadsRoot: uploads });
    assert.equal(again.auctions.filter((a) => a.created).length, 0);
    assert.equal(
      again.accounts.find((a) => a.name === "Abeer").password,
      "Existing password unchanged",
    );
    assert.deepEqual(
      (await pool.query("SELECT * FROM auctions WHERE id=$1", [old.id]))
        .rows[0],
      old,
    );
    assert.deepEqual(await readdir(uploads), files);
    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM items")).rows[0].n,
      12,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT password_hash FROM users WHERE email='existing@example.invalid'",
        )
      ).rows[0].password_hash,
      passwordHash,
    );
  },
);
check(
  "Seed never promotes an existing user or resets a conflicting account",
  async () => {
    await pool.query(
      "UPDATE users SET role='USER' WHERE email='tala@example.com'",
    );
    await assert.rejects(
      seedDemo({ pool, uploadsRoot: uploads }),
      /no role or password was changed/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT role FROM users WHERE email='tala@example.com'",
        )
      ).rows[0].role,
      "USER",
    );
    await pool.query(
      "UPDATE users SET role='ADMIN' WHERE email='tala@example.com'",
    );
  },
);
check(
  "Missing photos roll back the new dataset instead of leaving partial accounts",
  async () => {
    const second = "seed_rollback_" + randomBytes(6).toString("hex"),
      url = new URL(value);
    await control.query('CREATE SCHEMA "' + second + '"');
    url.searchParams.set("options", "-c search_path=" + second + ",public");
    const other = new pg.Pool({ connectionString: url.toString() });
    try {
      await migrate(other);
      await assert.rejects(
        seedDemo({
          pool: other,
          uploadsRoot: uploads,
          photosRoot: join(uploads, "missing"),
        }),
        /ENOENT/,
      );
      assert.equal(
        (await other.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
        0,
      );
      assert.equal(
        (await other.query("SELECT count(*)::int AS n FROM items")).rows[0].n,
        0,
      );
    } finally {
      await other.end();
      await control.query('DROP SCHEMA "' + second + '" CASCADE');
    }
  },
);
test("Demo command rejects production and remote databases", () => {
  assert.doesNotThrow(() =>
    assertLocalDemo("postgresql://postgres@localhost/mezyad", false),
  );
  assert.throws(
    () => assertLocalDemo("postgresql://postgres@localhost/mezyad", true),
    /never production/,
  );
  assert.throws(
    () =>
      assertLocalDemo("postgresql://postgres@remote.example.com/mezyad", false),
    /local development/,
  );
});
check(
  "Compaction removes only untouched v1 sample rows and preserves edited or financially linked records",
  async () => {
    const { createHash } = await import("node:crypto");
    const oldId = (label) => {
      const h = createHash("sha256")
        .update("mezyad-showcase-v1:" + label)
        .digest("hex");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
    };
    const hash = await bcrypt.hash("Aa112233", 4);
    for (const name of ["Noura", "Sara", "Reem"])
      await pool.query(
        "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'USER')",
        [
          oldId("account:" + name),
          name,
          name.toLowerCase() + "@example.com",
          hash,
        ],
      );
    const admin = (
      await pool.query("SELECT id FROM users WHERE email='tala@example.com'")
    ).rows[0].id;
    const fixtures = [
      [
        0,
        "Abeer",
        "بورش كاريرا GT فضية",
        "Rare Vehicles",
        4200000,
        "porsche-carrera-gt.jpg",
      ],
      [3, "Noura", "لوحة ن ج د 1", "Vehicle Plates", 95000, "plate-njd1.jpg"],
      [4, "Sara", "حقيبة جلد كلاسيكية", "Luxury Handbags", 8500, null],
      [
        5,
        "Reem",
        "سيارة كلاسيكية حمراء",
        "Rare Vehicles",
        195000,
        "notion/red-classic.webp",
      ],
    ];
    for (const [i, name, title, category, price, photo] of fixtures) {
      const user = (
        await pool.query("SELECT id FROM users WHERE email=$1", [
          name.toLowerCase() + "@example.com",
        ])
      ).rows[0];
      const categoryId = (
        await pool.query("SELECT id FROM categories WHERE name=$1", [category])
      ).rows[0].id;
      const fields =
        category === "Rare Vehicles"
          ? { اللون: title.includes("حمراء") ? "أحمر" : "حسب الصور" }
          : {};
      const item = oldId("item:auction:" + i);
      await pool.query(
        "INSERT INTO items(id,seller_id,category_id,title,description,category_fields,status,reviewed_by,reviewed_at) VALUES($1,$2,$3,$4,$5,$6,'APPROVED',$7,now()-interval '2 hours')",
        [
          item,
          user.id,
          categoryId,
          title,
          "تعرّف على تفاصيل الأصل وصوره، وراجع المعلومات قبل تقديم عرضك.",
          JSON.stringify(fields),
          admin,
        ],
      );
      if (photo)
        await pool.query(
          "INSERT INTO item_images(id,item_id,image_url) VALUES($1,$2,$3)",
          [
            oldId("image:" + item),
            item,
            "/uploads/" + oldId("photo:" + photo) + ".jpg",
          ],
        );
      await pool.query(
        "INSERT INTO auctions(id,item_id,visibility,starting_price,current_price,minimum_increment,start_time,end_time,status) VALUES($1,$2,'PUBLIC',$3,$3,$4,clock_timestamp()-interval '2 hours',clock_timestamp()+$5*interval '1 hour','ACTIVE')",
        [
          oldId("auction:" + i),
          item,
          price,
          price >= 1000000 ? 10000 : price >= 100000 ? 1000 : 500,
          72 + i * 2,
        ],
      );
    }
    await pool.query("UPDATE items SET title=title||' edited' WHERE id=$1", [
      oldId("item:auction:4"),
    ]);
    await pool.query(
      "INSERT INTO bid_commitments(auction_id,user_id,status) VALUES($1,$2,'PENDING')",
      [oldId("auction:5"), demoId("account:Ghadi")],
    );
    const result = await seedDemo({ pool, uploadsRoot: uploads });
    assert.equal(result.cleanup.removedItems, 2);
    assert.equal(result.cleanup.removedAccounts, 1);
    assert.equal(result.cleanup.preservedItems, 2);
    assert.equal(
      (
        await pool.query("SELECT id FROM users WHERE id=$1", [
          oldId("account:Noura"),
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query("SELECT id FROM users WHERE id=$1", [
          oldId("account:Sara"),
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query("SELECT id FROM users WHERE id=$1", [
          oldId("account:Reem"),
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query("SELECT id FROM auctions WHERE id=$1", [
          oldId("auction:5"),
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query("SELECT id FROM items WHERE id=ANY($1::uuid[])", [
          Array.from({ length: 6 }, (_, i) => demoId("item:auction:" + i)),
        ])
      ).rowCount,
      6,
    );
  },
);
