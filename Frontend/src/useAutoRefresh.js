import { useEffect, useRef } from "react";

// تم التعديل من عبير: نحدث البيانات كل دقيقتين ونوقف وقت الكتابه او فتح نافذه عشان ما يضيع شغلك.
export function useAutoRefresh(refresh, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    async function update() {
      if (
        running ||
        document.hidden ||
        document.querySelector("form, dialog[open]") ||
        document.activeElement?.matches(
          "input, textarea, select, [contenteditable=true]",
        )
      )
        return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
      }
    }
    const timer = setInterval(update, 120000);
    return () => clearInterval(timer);
  }, [enabled]);
}
