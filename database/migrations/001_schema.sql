-- هنا ننشئ الجداول حسب Stage_3/Report.MD؛ نشغله على قاعدة التطوير فقط.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- حساب واحد يقدر يبيع ويزايد، وصلاحية الأدمن منفصلة بالدور.
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(160) NOT NULL,
 email varchar(254) NOT NULL UNIQUE, password_hash varchar(255) NOT NULL,
 role varchar(10) NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','ADMIN')),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- نربط الجلسة بالمستخدم ونحفظ بصمة الرمز وتاريخ انتهائه.
CREATE TABLE IF NOT EXISTS user_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash varchar(128) NOT NULL UNIQUE, expires_at timestamptz NOT NULL
);
-- هذي تصنيفات الأصول، والاسم ما يتكرر.
CREATE TABLE IF NOT EXISTS categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(120) NOT NULL UNIQUE
);
-- نربط الإعلان بصاحبه وتصنيفه ونحفظ حالة المراجعة.
CREATE TABLE IF NOT EXISTS items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), seller_id uuid NOT NULL REFERENCES users(id),
 category_id uuid NOT NULL REFERENCES categories(id), title varchar(240) NOT NULL,
 description text NOT NULL, category_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
 status varchar(30) NOT NULL DEFAULT 'PENDING_REVIEW'
 CHECK(status IN ('PENDING_REVIEW','APPROVED','REJECTED')),
 review_reason text, reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz
);
-- كل صورة مرتبطة بإعلان، ونحفظ مسار الملف هنا.
CREATE TABLE IF NOT EXISTS item_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
 image_url text NOT NULL
);
-- لكل إعلان مزاد واحد، ونحدد السعر والوقت ونوع الدخول.
CREATE TABLE IF NOT EXISTS auctions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL UNIQUE REFERENCES items(id),
 visibility varchar(10) NOT NULL CHECK(visibility IN ('PUBLIC','PRIVATE')),
 access_code_hash varchar(255), starting_price numeric(14,2) NOT NULL CHECK(starting_price>0),
 current_price numeric(14,2) NOT NULL CHECK(current_price>0),
 minimum_increment numeric(14,2) NOT NULL CHECK(minimum_increment>0),
 start_time timestamptz NOT NULL, end_time timestamptz NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'SCHEDULED'
 CHECK(status IN ('SCHEDULED','ACTIVE','CLOSED')),
 CHECK(end_time>start_time),
 CHECK((visibility='PUBLIC' AND access_code_hash IS NULL) OR (visibility='PRIVATE' AND access_code_hash IS NOT NULL))
);
-- نحفظ مين مسموح له يدخل المزاد الخاص بدون تكرار.
CREATE TABLE IF NOT EXISTS private_auction_access (
 auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id), granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auction_id,user_id)
);
-- لكل مستخدم التزام واحد في المزاد ونحفظ حالته.
CREATE TABLE IF NOT EXISTS bid_commitments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auction_id uuid NOT NULL REFERENCES auctions(id),
 user_id uuid NOT NULL REFERENCES users(id), status varchar(20) NOT NULL
 CHECK(status IN ('PENDING','SUCCESS','FAILED')),
 sandbox_reference varchar(255), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(auction_id,user_id)
);
-- نحفظ المزايدة ورقم الطلب عشان ما يتكرر نفس الطلب.
CREATE TABLE IF NOT EXISTS bids (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auction_id uuid NOT NULL REFERENCES auctions(id),
 bidder_id uuid NOT NULL REFERENCES users(id), amount numeric(14,2) NOT NULL CHECK(amount>0),
 request_id uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(auction_id,id)
);
-- نحفظ نتيجة واحدة، والعرض الفائز لازم يكون من نفس المزاد.
CREATE TABLE IF NOT EXISTS auction_results (
 auction_id uuid PRIMARY KEY REFERENCES auctions(id), winner_bid_id uuid,
 closed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (auction_id,winner_bid_id) REFERENCES bids(auction_id,id)
);
-- الفهارس تساعد استعلامات الحالة والمزايدات وإعلانات المستخدم.
CREATE INDEX IF NOT EXISTS idx_auctions_status_end ON auctions(status,end_time);
CREATE INDEX IF NOT EXISTS idx_bids_auction_time ON bids(auction_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_seller ON items(seller_id,status);
CREATE INDEX IF NOT EXISTS idx_commitments_user ON bid_commitments(user_id,auction_id);
