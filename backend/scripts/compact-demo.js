import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

// تم التعديل من عبير: هذي بصمات بيانات التعبئه القديمه فقط عشان ما نحذف بيانات مختلفه او معدله.
const manifest = [
  {
    key: "auction:0",
    fingerprint:
      "ab8e73e4f4dfd3a57604b00b59a59a753d1c0f9268746de65b077330d5f7e21c",
    price: 4200000,
  },
  {
    key: "auction:1",
    fingerprint:
      "8f825f4b6cc6c17b186da9b202fef241f6053e1cde427130a1cca0cd6bd971a8",
    price: 4200000,
  },
  {
    key: "auction:2",
    fingerprint:
      "858568d8d233fdf0895c48f961f4de196a788154e89dcdcedaab8661ee23d05a",
    price: 180000,
  },
  {
    key: "auction:3",
    fingerprint:
      "e235b58dcc0aa161b9b47dd743e4f28902c0ffac2e3b37a266d82b3d4f4d6b68",
    price: 95000,
  },
  {
    key: "auction:4",
    fingerprint:
      "517b07e3c771373ddaea9f79c9e4bc36b4a754e86d608edf909a7fead28b19b9",
    price: 8500,
  },
  {
    key: "auction:5",
    fingerprint:
      "e761cd6c21da3204ce76ac24e7971242858587ba834b380b8ec1ca4a0a6637b1",
    price: 195000,
  },
  {
    key: "auction:6",
    fingerprint:
      "282b1de0a44df65c5fb722e876c6fc48bf503ad73599ffdeafb8442da4093c53",
    price: 1350000,
  },
  {
    key: "auction:7",
    fingerprint:
      "fbff1d7f77bbbd1f9c3e291dd4e5d1de01a09057d5170dbe22fe4becebcc56ce",
    price: 135000,
  },
  {
    key: "auction:8",
    fingerprint:
      "7bdb92ae668e46646c31bb22c460c44b42305c965fded7919b3fe803090197d8",
    price: 12500,
  },
  {
    key: "auction:9",
    fingerprint:
      "94e2446445f705f240bf96cd24f80eb26e128f732e1bcaf54a4fc90c033bb51f",
    price: 245000,
  },
  {
    key: "auction:10",
    fingerprint:
      "bb6b287838b9068c3c44869e6ced2d66ca48142ee57367144a125270a3771fdb",
    price: 110000,
  },
  {
    key: "auction:11",
    fingerprint:
      "0806b49410227fdc9ab00202fd31fb3965a4f25722da6bfcff30fceb82402eb3",
    price: 3850000,
  },
  {
    key: "auction:12",
    fingerprint:
      "650bd7f68e037346c15a1e1121d780fefb2cfb5bd3e0bfd7abb727b3604d85f9",
    price: 365000,
  },
  {
    key: "auction:13",
    fingerprint:
      "ff4bcf509d9f0079bbef4b238308c64c831615223b623cb8479ecc28a8f3ce57",
    price: 165000,
  },
  {
    key: "auction:14",
    fingerprint:
      "998c4930da5042fe99534f9a242f8425cb8dff52ecb0bd51cef74be82df8252e",
    price: 9500,
  },
  {
    key: "auction:15",
    fingerprint:
      "c6d9b0e0de066ad9f6e64c7bca4f367a2c0de3c04bad32a51efef30f9c75eecd",
    price: 2950000,
  },
  {
    key: "auction:16",
    fingerprint:
      "cdb91929c694ab26837662094c1832f78950c5949282d2f5559c08bd4e1483ad",
    price: 78000,
  },
  {
    key: "auction:17",
    fingerprint:
      "2729626ef78dab5ad7cec584463be8e0d089f75dc28c9a684d17603ff411009d",
    price: 225000,
  },
  {
    key: "auction:18",
    fingerprint:
      "e30e389d7c8615fecf97cd54c28a4b40d93cd95fed9b4548614529cb5b646f86",
    price: 1950000,
  },
  {
    key: "auction:19",
    fingerprint:
      "fa5b7a0e34cb0b944611d1ecb7be4768e72a6f343bf80a5106b68f1b5deec18e",
    price: 15000,
  },
  {
    key: "auction:20",
    fingerprint:
      "69704c342ebb38db4c598bc72103c2dcec7a8af6a4829e179ada893107e6f496",
    price: 3950000,
  },
  {
    key: "auction:21",
    fingerprint:
      "f322b949b96cdc964cfbc7345478096b2b8d39fb955a8c6285b51cbaefda8d9f",
    price: 195000,
  },
  {
    key: "auction:22",
    fingerprint:
      "821d261aa014f545788da8ade05962d797de1f3235df47cf85be1e6a74f77086",
    price: 125000,
  },
  {
    key: "auction:23",
    fingerprint:
      "44861c5a211803e855be2279e620a84cb6ed5ae07ef95d1ae5ac49871fcb7e48",
    price: 3650000,
  },
  {
    key: "auction:24",
    fingerprint:
      "23fa939c8f0f9e29c40e583e01eba775c5bdd2be4d74dc137f57cafafec8128c",
    price: 185000,
  },
  {
    key: "auction:25",
    fingerprint:
      "bf131256d979fcc72c26ec9e836337ba32189a4b2ba0f5863bff42a5be55370b",
    price: 325000,
  },
  {
    key: "auction:26",
    fingerprint:
      "1a16a00c2d3addc9774de1d45f62523d1a12feffd62d450cc85c30d53aaa7ed1",
    price: 265000,
  },
  {
    key: "auction:27",
    fingerprint:
      "75beb9b44e4fcc6c7255870dc118f3d1ccbc74011af5eb32dd9ef09aeee4bfc1",
    price: 4350000,
  },
  {
    key: "auction:28",
    fingerprint:
      "6b28a91d3f2e2b8e991a55efef082ab57bda7332bd12427c520c481070bc3494",
    price: 215000,
  },
  {
    key: "auction:29",
    fingerprint:
      "c2ecb241b5d11ba853f1b15f01ef500ef3dd66ed8043f4aa93d091d806e783ec",
    price: 395000,
  },
  {
    key: "extra:0",
    fingerprint:
      "307ea54273547e89797c15eb68f939fe00897e5431f304f6c4af5a269e49c31a",
    price: null,
  },
  {
    key: "extra:1",
    fingerprint:
      "97d0ddee2fae1445afe4c15f3e6a5d95c572e9c05685f857dcfdc60f61e5d2c5",
    price: null,
  },
  {
    key: "extra:2",
    fingerprint:
      "c30def81ca5c852bc8520dba1cde9fcf167d2621501436fe7baa2cb11d7f376f",
    price: null,
  },
  {
    key: "extra:3",
    fingerprint:
      "f96e9a3ce71cf92e8a830abb699eb53a2d5268454ac446cda5c43e1be9ddf951",
    price: null,
  },
  {
    key: "extra:4",
    fingerprint:
      "e6e50b53ec1b564afc5640bff252eff1997281521305fcf9c090a9f4293f41d8",
    price: null,
  },
  {
    key: "extra:5",
    fingerprint:
      "fa8c52cba2d1dded65698dc465417b36655cd6d851b8cb5a0ac245373328c1be",
    price: null,
  },
  {
    key: "extra:6",
    fingerprint:
      "98adda46b068bbffc3c3a9bc3f8f6607ee140adf0a80d0061506a32e3ef9fa3a",
    price: null,
  },
  {
    key: "extra:7",
    fingerprint:
      "30becbfe5bfb86bcf9e8c9e574655ad37fc7e982c036ff290e7dafb4d403b29b",
    price: null,
  },
  {
    key: "extra:8",
    fingerprint:
      "4b0e8d985bf81fa05ceef1408139ef61e37ddddff5125cc828505bfaca90944c",
    price: null,
  },
  {
    key: "extra:9",
    fingerprint:
      "fc54d12f40484fa8daea3676cd99677bd713f07952c2a2718500abd02159865f",
    price: null,
  },
  {
    key: "extra:10",
    fingerprint:
      "cf0c6bfc55fe6b6c3be1428692c9f37c2931cc9744954f5c7e2b4bfdc6b00147",
    price: null,
  },
  {
    key: "extra:11",
    fingerprint:
      "5cb9972fc8a0d9f0430a37ffb7602e6bda2199e4d4de30d595939ec24f11029c",
    price: null,
  },
  {
    key: "extra:12",
    fingerprint:
      "deab5ced63e86afbe7bb59faf7e489d6d7feddc6d572cc1ea66084ec96e8707f",
    price: null,
  },
  {
    key: "extra:13",
    fingerprint:
      "9b7c7aa743bd1e3124633631b61782956f2b884f985846f9eba0e7f4dbfeb1b8",
    price: null,
  },
];
function oldId(label) {
  const h = createHash("sha256")
    .update("mezyad-showcase-v1:" + label)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export async function compactDemo(c) {
  const report = { removedItems: 0, removedAccounts: 0, preservedItems: 0 };
  for (const entry of manifest) {
    const id = oldId("item:" + entry.key);
    const item = (
      await c.query(
        `SELECT i.*,u.email AS seller_email,k.name AS category_name,r.email AS reviewer
   FROM items i JOIN users u ON u.id=i.seller_id JOIN categories k ON k.id=i.category_id LEFT JOIN users r ON r.id=i.reviewed_by WHERE i.id=$1 FOR UPDATE OF i`,
        [id],
      )
    ).rows[0];
    if (!item) continue;
    const images = (
      await c.query(
        "SELECT id,image_url FROM item_images WHERE item_id=$1 ORDER BY id",
        [id],
      )
    ).rows;
    const data = {
      seller_email: item.seller_email,
      title: item.title,
      category_name: item.category_name,
      description: item.description,
      category_fields: item.category_fields,
      status: item.status,
      review_reason: item.review_reason,
      reviewer: item.reviewer,
      images,
    };
    if (
      createHash("sha256").update(JSON.stringify(data)).digest("hex") !==
      entry.fingerprint
    ) {
      report.preservedItems++;
      continue;
    }
    const a = (
      await c.query("SELECT * FROM auctions WHERE item_id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (a) {
      const index = Number(entry.key.split(":")[1]),
        expectedStatus =
          index < 12 ? "ACTIVE" : index < 20 ? "SCHEDULED" : "CLOSED";
      const privateAuction = [1, 6, 10, 15, 19, 25].includes(index);
      const oldCode = createHash("sha256")
        .update("mezyad-local-demo-invite-v1:" + index)
        .digest("hex")
        .slice(0, 24);
      const duration = index < 12 ? 74 + index * 2 : index < 20 ? 72 : 24;
      const untouched =
        a.id === oldId("auction:" + index) &&
        Number(a.starting_price) === entry.price &&
        Number(a.current_price) === entry.price &&
        Number(a.minimum_increment) ===
          (entry.price >= 1000000
            ? 10000
            : entry.price >= 100000
              ? 1000
              : 500) &&
        a.visibility === (privateAuction ? "PRIVATE" : "PUBLIC") &&
        (a.status === expectedStatus ||
          (a.status === "CLOSED" && new Date(a.end_time) <= new Date())) &&
        Math.abs(
          new Date(a.end_time) - new Date(a.start_time) - duration * 3600000,
        ) < 1000 &&
        (!privateAuction ||
          (await bcrypt.compare(oldCode, a.access_code_hash)));
      const linked = (
        await c.query(
          "SELECT (EXISTS(SELECT 1 FROM bids WHERE auction_id=$1) OR EXISTS(SELECT 1 FROM bid_commitments WHERE auction_id=$1) OR EXISTS(SELECT 1 FROM auction_results WHERE auction_id=$1 AND winner_bid_id IS NOT NULL)) AS protected",
          [a.id],
        )
      ).rows[0].protected;
      if (!untouched || linked) {
        report.preservedItems++;
        continue;
      }
      // تم التعديل من عبير: نحذف روابط بيانات التعبئه البسيطه فقط؛ اي مزايده او التزام يحمي المزاد من الحذف.
      await c.query("DELETE FROM private_auction_access WHERE auction_id=$1", [
        a.id,
      ]);
      await c.query("DELETE FROM auction_results WHERE auction_id=$1", [a.id]);
      await c.query("DELETE FROM auctions WHERE id=$1", [a.id]);
    }
    await c.query("DELETE FROM items WHERE id=$1", [id]);
    report.removedItems++;
  }
  for (const name of [
    "Noura",
    "Sara",
    "Reem",
    "Lama",
    "Haya",
    "Reema",
    "Nouf",
    "Dana",
  ]) {
    const id = oldId("account:" + name),
      email = name.toLowerCase() + "@example.com";
    const user = (
      await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (
      !user ||
      user.name !== name ||
      user.email !== email ||
      user.role !== "USER" ||
      !(await bcrypt.compare("Aa112233", user.password_hash))
    )
      continue;
    const deleted = await c.query(
      `DELETE FROM users WHERE id=$1
   AND NOT EXISTS(SELECT 1 FROM items WHERE seller_id=$1 OR reviewed_by=$1)
   AND NOT EXISTS(SELECT 1 FROM bids WHERE bidder_id=$1)
   AND NOT EXISTS(SELECT 1 FROM bid_commitments WHERE user_id=$1)
   AND NOT EXISTS(SELECT 1 FROM private_auction_access WHERE user_id=$1)
   AND NOT EXISTS(SELECT 1 FROM email_challenges WHERE email=$2) RETURNING id`,
      [id, email],
    );
    report.removedAccounts += deleted.rowCount;
  }
  return report;
}
