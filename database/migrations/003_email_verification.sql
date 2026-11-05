-- نستخدم DO عشان نكتب شرط يحدد متى نضيف العمود ونستثني الحسابات القديمه
DO $$
-- نبدأ الاوامر اللي داخل DO
BEGIN
  -- نتاكد ان عمود email_verified_at مو موجود قبل اضافته
  IF NOT EXISTS (
    -- نبحث في قائمة اعمدة قاعدة البيانات
    SELECT 1 FROM information_schema.columns
    -- نحدد جدول users وعمود email_verified_at
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'email_verified_at'
  -- اذا العمود مو موجود ننفذ الاوامر اللي تحت
  ) THEN
    -- نضيف عمود email_verified_at لحفظ وقت تاكيد الايميل
    ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
    -- نعتبر الحسابات الموجوده قبل اضافة العمود مؤكده كاستثناء للحسابات القديمه
    UPDATE users SET email_verified_at = now();
  -- ننهي شرط اضافة العمود واستثناء الحسابات القديمه
  END IF;
-- ننهي الاوامر اللي داخل DO
END $$;
-- نضيف عمود email_code_hash لحفظ بصمة الرمز اللي يحسبها bcrypt
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_code_hash varchar(64);
-- نضيف عمود email_code_expires_at لحفظ وقت انتهاء صلاحية الرمز
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_code_expires_at timestamptz;
-- نضيف عمود email_code_attempts لعدد محاولات ادخال الرمز يبدأ من صفر وما يقبل عدد سالب
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_code_attempts integer NOT NULL DEFAULT 0 CHECK (email_code_attempts >= 0);
-- نضيف عمود email_code_sent_at لحفظ وقت طلب ارسال الرمز عشان نحسب مدة الانتظار قبل اعادة الارسال
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_code_sent_at timestamptz;