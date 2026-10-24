import { useEffect, useRef } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

export type StockToastTone = "success" | "error";

export function StockToast({
  message,
  tone = "success",
  onClose,
}: {
  message: string | null;
  tone?: StockToastTone;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onCloseRef.current(), 7000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <>
      <div className="ss-toast" hidden={!message}>
        <span
          className={`ss-toast-icon${tone === "error" ? " is-error" : ""}`}
          aria-hidden="true"
        >
          {tone === "error" ? <CircleAlert /> : <CircleCheck />}
        </span>
        <p className="ss-toast-text">{message}</p>
        <button
          type="button"
          className="ss-toast-close"
          onClick={onClose}
          aria-label="Tutup pemberitahuan"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <p className="ss-sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}
