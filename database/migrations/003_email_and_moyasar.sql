-- تم التعديل من عبير: نخزن بصمه رمز البريد فقط ونفصل التسجيل المعلق عن الحسابات الفعليه.
CREATE TABLE IF NOT EXISTS email_challenges (
 email varchar(254) NOT NULL,
 purpose varchar(12) NOT NULL CHECK (purpose IN ('SIGNUP','RESET')),
 code_hash text,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 expires_at timestamptz NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 reset_token_hash text UNIQUE,
 PRIMARY KEY(email,purpose)
);
CREATE INDEX IF NOT EXISTS idx_email_challenges_expiry ON email_challenges(expires_at);
-- تم التعديل من عبير: نربط تفويض ميسر التجريبي بالتزام واحد وبمبلغ محدد من الباك.
ALTER TABLE bid_commitments ADD COLUMN IF NOT EXISTS provider varchar(20);
ALTER TABLE bid_commitments ADD COLUMN IF NOT EXISTS payment_id uuid;
ALTER TABLE bid_commitments ADD COLUMN IF NOT EXISTS amount_minor integer CHECK(amount_minor >= 100);
ALTER TABLE bid_commitments ADD COLUMN IF NOT EXISTS checkout_nonce text;
ALTER TABLE bid_commitments ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS bid_commitments_payment_unique ON bid_commitments(payment_id) WHERE payment_id IS NOT NULL;
