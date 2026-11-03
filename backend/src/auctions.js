import { query, pool } from "./db.js";

// تعبير برمجي لحساب حالة المزاد مباشرة من قاعدة البيانات حسب الوقت الحالي (منتهي، نشط، أو مجدول)
export const auctionStatus = `CASE WHEN a.status='CLOSED' OR a.end_time<=clock_timestamp() THEN 'CLOSED'
  WHEN a.start_time<=clock_timestamp() THEN 'ACTIVE' ELSE 'SCHEDULED' END`;

// دالة للتحقق مما إذا كان المستخدم مصرحاً له برؤية المزاد (عام، المالك، الأدمن، أو مسجل في المزاد الخاص)
export async function accessible(auctionData, user) {
  if (
    auctionData.visibility === "PUBLIC" ||
    auctionData.seller_id === user?.id ||
    user?.role === "ADMIN"
  )
    return true;
  if (!user) return false;
  const result = await query(
    "SELECT 1 FROM private_auction_access WHERE auction_id=$1 AND user_id=$2",
    [auctionData.id, user.id],
  );
  return result.rowCount > 0;
}

// دالة لجلب تفاصيل المزاد الأساسية مع بيانات الإعلان المرتبط به
export async function auction(id) {
  const result = await query(
    "SELECT a.*,i.seller_id,i.title FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1",
    [id],
  );
  return result.rows[0];
}

// دالة لإغلاق المزاد تلقائياً أو تحديث حالته بناءً على الوقت (تستخدم المعاملات وقفل الصفوف)
export async function closeIfEnded(id) {
  const client = await pool.connect();
  try {
    // نقفل صف المزاد عشان الإغلاق ما يتعارض مع المزايدات.
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT * FROM auctions WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    const auctionData = result.rows[0];

    // نقرأ الوقت بعد القفل؛ ممكن الطلب كان ينتظر مزايدة ثانية.
    const databaseTime = await client.query(
      "SELECT clock_timestamp() AS current_time",
    );

    // لو وقت المزاد انتهى ولم يتم إغلاقه بعد
    if (
      auctionData.status !== "CLOSED" &&
      new Date(auctionData.end_time) <= databaseTime.rows[0].current_time
    ) {
      // أعلى عرض مقبول يفوز، وإذا ما فيه عروض تكون النتيجة بدون فائز.
      const winningBidResult = await client.query(
        "SELECT id FROM bids WHERE auction_id=$1 ORDER BY amount DESC,created_at ASC LIMIT 1",
        [id],
      );
      await client.query("UPDATE auctions SET status='CLOSED' WHERE id=$1", [
        id,
      ]);
      await client.query(
        "INSERT INTO auction_results(auction_id,winner_bid_id) VALUES($1,$2) ON CONFLICT(auction_id) DO NOTHING",
        [id, winningBidResult.rows[0]?.id || null],
      );
    }

    // تحديث حالة المزاد إلى نشط إذا كان مجدولاً وحان وقت بدايته
    await client.query(
      "UPDATE auctions SET status='ACTIVE' WHERE id=$1 AND status='SCHEDULED' AND start_time<=clock_timestamp() AND end_time>clock_timestamp()",
      [id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// دالة لجلب نتيجة المزاد ومعرفة ما إذا كان المستخدم الحالي هو الفائز
export async function resultFor(auctionId, userId = null) {
  const result = await query(
    `SELECT r.winner_bid_id,r.closed_at,b.amount AS winning_amount,
    CASE WHEN $2::uuid IS NULL THEN NULL ELSE COALESCE(b.bidder_id=$2,false) END AS "isWinner"
    FROM auction_results r LEFT JOIN bids b ON b.id=r.winner_bid_id AND b.auction_id=r.auction_id
    WHERE r.auction_id=$1`,
    [auctionId, userId],
  );
  return result.rows[0] || null;
}

// دالة لجلب إحصائيات مشاركة المستخدم الحالي في المزاد (عدد مزايداته، أعلى مبلغ، وأحدث مزايدة)
export async function participationFor(auctionId, userId) {
  if (!userId) return null;
  // نرجع بيانات مشاركته بس، وما نظهر هوية باقي المزايدين.
  const result = await query(
    `SELECT count(*)::int AS "bidCount",max(amount) AS "highestBid",
    (SELECT id FROM bids WHERE auction_id=$1 AND bidder_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1) AS "latestBidId"
    FROM bids WHERE auction_id=$1 AND bidder_id=$2`,
    [auctionId, userId],
  );
  return { ...result.rows[0], hasBid: result.rows[0].bidCount > 0 };
}
