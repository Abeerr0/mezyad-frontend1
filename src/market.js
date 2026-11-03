import { useEffect, useRef, useState } from "react";
import { request } from "./api";
import { demoAuctions } from "./data";

// تم التعديل من عبير: نولد رقم طلب امن حتى لو المتصفح ما يدعم randomUUID على التشغيل المحلي.
export function newRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
export const auctionLink = (page, id) =>
  "#/" + page + "?id=" + encodeURIComponent(id);
export const statusLabels = {
  ACTIVE: "المجلس مفتوح",
  SCHEDULED: "قريب يبدأ",
  CLOSED: "انتهى المزاد",
};
const messages = {
  INVALID_CODE: "رمز الدخول مو صحيح. تأكد منه وحاول من جديد.",
  OWNER: "هذا مزادك. تقدر تتابعه، لكن ما تقدر تشارك فيه كمزايد.",
  COMMITMENT_REQUIRED: "تحتاج التزام بنكي موثق قبل تقديم العرض.",
  BANK_SANDBOX_UNAVAILABLE:
    "خدمة البنك التجريبية غير متاحة حاليًا. ما تم اعتماد أي التزام.",
  BID_TOO_LOW: "وصل عرض أعلى أو المبلغ أقل من المطلوب. راجع آخر سعر.",
  AUCTION_NOT_ACTIVE: "المزاد مو مفتوح للمزايدة الآن. راجع موعده وحالته.",
  DUPLICATE_REQUEST: "هذا الطلب تمت معالجته. تحقق من عروضك قبل تقديم عرض جديد.",
  NOT_FOUND: "المزاد مو متاح. لو كان خاص، ادخل برمزه أول.",
  INVALID_ID: "رابط المزاد مو صحيح. ارجع لقائمة المزادات.",
};

// تم التعديل من عبير: نوقف الطلب المتاخر ونوضح الخطا بدون افتراض نجاح العمليه.
export async function marketRequest(path, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 12000);
  try {
    return await request(path, { ...options, signal: controller.signal });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error.name === "AbortError") {
      const timeout = new Error(
        "تأخر رد الخادم. تحقق من اتصالك ومن حالة الطلب قبل تكراره.",
      );
      timeout.uncertain = options.method === "POST";
      throw timeout;
    }
    if (messages[error.code]) error.message = messages[error.code];
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

// تم التعديل من عبير: نحسب الحد بالهللات عشان ما تضيع دقه الكسور.
export function cents(value) {
  const text = String(value ?? "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= 99999999999999
    ? amount
    : null;
}
export function minimumBid(auction, bids) {
  if (!auction || !Array.isArray(bids)) return null;
  const start = cents(auction.starting_price),
    current = cents(auction.current_price),
    increment = cents(auction.minimum_increment);
  if ([start, current, increment].includes(null)) return null;
  return bids.length ? current + increment : start;
}
export function displayStatus(auction) {
  if (auction.status === "CLOSED" || Date.parse(auction.end_time) <= Date.now())
    return "CLOSED";
  if (Date.parse(auction.start_time) > Date.now()) return "SCHEDULED";
  return auction.status;
}
function previewRows(auction) {
  return Array.from({ length: auction.bid_count || 0 }, (_, n) => ({
    id: auction.id + "-bid-" + n,
    amount: (
      Number(auction.current_price) -
      n * Number(auction.minimum_increment)
    ).toFixed(2),
    created_at: new Date(Date.now() - (n + 1) * 120000).toISOString(),
    bidder_id: "preview-other",
  }));
}
const privateExample = {
  ...demoAuctions[0],
  id: "preview-private",
  title: "مجلس خاص — بورش كلاسيكية",
  visibility: "PRIVATE",
  bid_count: 0,
  current_price: "4000000",
};

// تم التعديل من عبير: بيانات التجربه مستقله عن البنك والداتا الحقيقيه وتنمسح مع تحديث الصفحه.
export function useMarket(workspace) {
  const [records, setRecords] = useState(() =>
    [...demoAuctions, privateExample].map((a) => ({
      ...a,
      seller_id: "preview-seller",
      bids: previewRows(a),
    })),
  );
  const [grants, setGrants] = useState([]);
  const [revision, setRevision] = useState(0);
  const userId = workspace.user?.id;
  const token = workspace.session?.token;
  useEffect(() => {
    setGrants([]);
  }, [userId, workspace.demo]);
  const all = [
    ...records,
    ...workspace.auctions
      .filter((a) => !records.some((r) => r.id === a.id))
      .map((a) => ({ ...a, seller_id: userId, bids: [] })),
  ];
  function previewAuction(id) {
    const a = all.find((a) => a.id === id);
    if (
      !a ||
      (a.visibility === "PRIVATE" &&
        a.seller_id !== userId &&
        !grants.includes(a.id))
    )
      throw new Error(messages.NOT_FOUND);
    const own = a.bids.filter((b) => b.bidder_id === userId);
    const closed = displayStatus(a) === "CLOSED";
    const top = a.bids[0];
    return {
      ...a,
      status: displayStatus(a),
      images: a.images || [a.image_url],
      participation: userId
        ? {
            bidCount: own.length,
            hasBid: own.length > 0,
            highestBid: own[0]?.amount || null,
            latestBidId: own[0]?.id || null,
          }
        : null,
      result: closed
        ? {
            winner_bid_id: top?.id || null,
            winning_amount: top?.amount || null,
            isWinner: userId ? top?.bidder_id === userId : null,
            closed_at: a.end_time,
          }
        : null,
    };
  }
  async function getAuction(id, signal) {
    if (!id) throw new Error("اختر مزاد من القائمة أول.");
    if (workspace.demo) return previewAuction(id);
    const a = await marketRequest("/auctions/" + encodeURIComponent(id), {
      token,
      signal,
    });
    if (!a?.id || a.id !== id)
      throw new Error("وصلت تفاصيل غير مكتملة للمزاد.");
    return a;
  }
  async function getBids(id, offset = 0, signal) {
    if (workspace.demo)
      return previewAuction(id).bids.slice(offset, offset + 20);
    const rows = await marketRequest(
      "/auctions/" + encodeURIComponent(id) + "/bids?limit=20&offset=" + offset,
      { token, signal },
    );
    if (!Array.isArray(rows)) throw new Error("وصل سجل عروض غير مكتمل.");
    return rows;
  }
  async function getCommitment(id, signal) {
    if (workspace.demo) return null;
    try {
      return await marketRequest(
        "/auctions/" + encodeURIComponent(id) + "/commitment",
        { token, signal },
      );
    } catch (error) {
      if (error.status === 404 && error.code === "NOT_FOUND") return null;
      throw error;
    }
  }
  async function enter(code) {
    if (!userId) throw new Error("سجل دخولك أول.");
    if (workspace.demo) {
      const own = all.find((a) => a.accessCode === code);
      if (own) throw new Error(messages.OWNER);
      if (code !== "MEZYAD-PREVIEW") throw new Error(messages.INVALID_CODE);
      setGrants((old) => [...new Set([...old, privateExample.id])]);
      return privateExample.id;
    }
    const result = await marketRequest("/auctions/access", {
      method: "POST",
      token,
      body: { accessCode: code },
    });
    if (result?.accessGranted !== true || typeof result.auctionId !== "string")
      throw new Error("ما وصل تأكيد السماح بالدخول.");
    return result.auctionId;
  }
  async function commit(id) {
    if (workspace.demo) throw new Error(messages.BANK_SANDBOX_UNAVAILABLE);
    // تم التعديل من عبير: ما نعتمد الالتزام من زر او رابط؛ نرجع نفحصه من الباك.
    await marketRequest("/auctions/" + encodeURIComponent(id) + "/commitment", {
      method: "POST",
      token,
    });
    return getCommitment(id);
  }
  async function bid(id, amount, requestId) {
    if (workspace.demo) {
      const a = previewAuction(id);
      if (a.seller_id === userId) throw new Error(messages.OWNER);
      if (a.status !== "ACTIVE") throw new Error(messages.AUCTION_NOT_ACTIVE);
      if (a.bids.some((b) => b.requestId === requestId))
        throw Object.assign(new Error(messages.DUPLICATE_REQUEST), {
          code: "DUPLICATE_REQUEST",
        });
      const value = cents(amount);
      if (value === null || value < minimumBid(a, a.bids))
        throw new Error(messages.BID_TOO_LOW);
      const row = {
        id: newRequestId(),
        amount,
        requestId,
        bidder_id: userId,
        created_at: new Date().toISOString(),
      };
      setRecords((old) =>
        old.map((r) =>
          r.id === id
            ? {
                ...r,
                current_price: amount,
                bid_count: r.bids.length + 1,
                bids: [row, ...r.bids],
              }
            : r,
        ),
      );
      setRevision((n) => n + 1);
      return { bidId: row.id, amount, currentPrice: amount };
    }
    const result = await marketRequest(
      "/auctions/" + encodeURIComponent(id) + "/bids",
      { method: "POST", token, body: { amount: Number(amount), requestId } },
    );
    if (!result?.bidId || cents(result.amount) !== cents(amount))
      throw Object.assign(
        new Error("ما تأكدنا من حفظ العرض. راجع السجل قبل إرسال عرض جديد."),
        { uncertain: true },
      );
    setRevision((n) => n + 1);
    return result;
  }
  async function myAuctions(signal) {
    if (workspace.demo)
      return all
        .filter(
          (a) =>
            a.seller_id === userId ||
            a.bids.some((b) => b.bidder_id === userId),
        )
        .map((a) => previewAuction(a.id));
    const rows = await marketRequest("/me/auctions", { token, signal });
    if (!Array.isArray(rows)) throw new Error("تعذر قراءة قائمة مزاداتك.");
    return rows;
  }
  return {
    workspace,
    userId,
    token,
    demo: workspace.demo,
    revision,
    getAuction,
    getBids,
    getCommitment,
    enter,
    commit,
    bid,
    myAuctions,
    records,
  };
}

// تم التعديل من عبير: نحدث كل اربع ثواني بدون تداخل طلبات، ونوقف التحديث اذا الصفحه مخفيه.
export function useAuction(
  market,
  id,
  { bids = false, commitment = false, offset = 0 } = {},
) {
  const latest = useRef(market);
  latest.current = market;
  const [state, setState] = useState({
    auction: null,
    bids: null,
    commitment: null,
    loading: true,
    error: "",
    updated: null,
  });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let stopped = false,
      timer;
    const controller = new AbortController();
    setState({
      auction: null,
      bids: null,
      commitment: null,
      loading: true,
      error: "",
      updated: null,
    });
    async function load() {
      if (stopped) return;
      if (document.hidden) {
        timer = setTimeout(load, 4000);
        return;
      }
      try {
        const m = latest.current;
        const a = await m.getAuction(id, controller.signal);
        const rows =
          bids && m.userId
            ? await m.getBids(id, offset, controller.signal)
            : null;
        const bank =
          commitment && m.userId
            ? await m.getCommitment(id, controller.signal)
            : null;
        if (!stopped)
          setState({
            auction: a,
            bids: rows,
            commitment: bank,
            loading: false,
            error: "",
            updated: new Date(),
          });
      } catch (error) {
        if (!stopped)
          setState((old) => ({ ...old, loading: false, error: error.message }));
      } finally {
        if (!stopped) timer = setTimeout(load, 4000);
      }
    }
    load();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    id,
    market.demo,
    market.token,
    market.userId,
    market.revision,
    bids,
    commitment,
    offset,
    refresh,
  ]);
  return { ...state, reload: () => setRefresh((n) => n + 1) };
}
