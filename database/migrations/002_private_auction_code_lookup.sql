-- نحدد جدول المزادات اللي بنضيف له العمود.
ALTER TABLE auctions
-- نضيف عمود نصي نحفظ فيه بصمة رمز المزاد إذا كان العمود مو موجود.
ADD COLUMN IF NOT EXISTS access_code_lookup TEXT;

-- ننشئ فهرس إذا كان مو موجود عشان نسرّع البحث ونمنع تكرار نفس البصمة.
CREATE UNIQUE INDEX IF NOT EXISTS auctions_access_code_lookup_unique
-- نخلي الفهرس على عمود البصمة في جدول المزادات.
ON auctions (access_code_lookup)
-- ندخل في الفهرس بس المزادات اللي لها بصمة، لأن المزاد العام ما يحتاج رمز.
WHERE access_code_lookup IS NOT NULL;