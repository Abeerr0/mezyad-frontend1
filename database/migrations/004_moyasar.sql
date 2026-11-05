-- هنا نضيف خانة نحفظ فيها المبلغ المحجوز للمزايد
ALTER TABLE bid_commitments
ADD COLUMN IF NOT EXISTS max_amount numeric(14,2)
CHECK (max_amount > 0);

-- هنا نضيف خانة نحفظ فيها وقت فك الحجز
ALTER TABLE bid_commitments
ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- هنا نمنع استخدام نفس عملية ميسر في أكثر من التزام
CREATE UNIQUE INDEX IF NOT EXISTS bid_commitments_moyasar_payment_unique
ON bid_commitments (sandbox_reference)
-- هنا نطبق المنع على الالتزامات اللي لها مبلغ محجوز
WHERE max_amount IS NOT NULL;