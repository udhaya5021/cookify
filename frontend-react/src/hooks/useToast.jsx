import { useState, useCallback, useRef } from "react";

// Lightweight replacement for alert() — a floating, auto-dismissing toast
// instead of a blocking native dialog. Usage: const [toast, showToast] = useToast();
// render {toast} once in the page, then showToast("Saved", "success").
export function useToast() {
  const [toast, setToast] = useState(null); // { text, type }
  const timerRef = useRef(null);

  const showToast = useCallback((text, type = "success") => {
    clearTimeout(timerRef.current);
    setToast({ text, type });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const element = toast ? <div className={`toast ${toast.type}`}>{toast.text}</div> : null;

  return [element, showToast];
}
