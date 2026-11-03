import React, { useRef, useState } from "react";
import { Icon } from "../components";
import { auctionLink } from "../market";
import { AuctionLayout, SignInGate } from "../auction-components";

// تم التعديل من عبير: نرسل الرمز فقط ونفتح معرّف المزاد اللي يرجع من الباك.
export default function PrivateAccess({ market }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (sending.current) return;
    if (!code.trim()) {
      setError("اكتب رمز الدخول أول.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await market.enter(code.trim());
      location.hash = auctionLink("auction", id).slice(1);
    } catch (err) {
      setError(err.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <AuctionLayout
      market={market}
      title="دعوتك للمجلس الخاص."
      eyebrow="رمز واحد، ومجلس يجمعكم"
      description="الرمز من صاحب المزاد، والدخول بحسابك أنت."
    >
      <SignInGate market={market}>
        <div className="private-entry">
          <div className="private-art">
            <Icon name="lock" size={90} />
            <span>BY INVITATION</span>
            <h2>
              بعض الأصول،
              <br />
              لها مجلس خاص.
            </h2>
            <p>خصوصية الدخول ما تغيّر شروط المنافسة العادلة.</p>
          </div>
          <form className="paper-card" onSubmit={submit}>
            <p className="eyebrow">حياك في المجلس</p>
            <h2>معك الدعوة؟</h2>
            <p>
              أدخل الرمز اللي وصلك من البائع، وبنفتح لك تفاصيل المزاد بعد
              التحقق.
            </p>
            <label className="field">
              <span>رمز الدخول</span>
              <input
                dir="ltr"
                autoComplete="off"
                maxLength={80}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                required
                placeholder="رمز المزاد"
              />
            </label>
            {market.demo && (
              <p className="inline-notice">
                رمز المعاينة: <bdi>MEZYAD-PREVIEW</bdi>
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button dark full" disabled={busy}>
              {busy ? "نتحقق من دعوتك…" : "افتح المجلس"} <Icon />
            </button>
            <p className="field-hint">
              الرمز ما يمنح موافقة بنك، وما يسمح لك بالمزايدة على مزادك.
            </p>
            <a className="text-link" href="#/auctions">
              تصفح المزادات العامة <Icon />
            </a>
          </form>
        </div>
      </SignInGate>
    </AuctionLayout>
  );
}
