import { useState, useCallback } from "react";
import Modal from "../components/Modal";

// Promise-based replacement for window.confirm — `await confirm("...")`
// resolves true/false, but renders as a real styled modal instead of the
// browser's native dialog. Usage: const [confirmModal, confirm] = useConfirm();
// then render {confirmModal} once in the page and call confirm(...) anywhere.
export function useConfirm() {
  const [state, setState] = useState(null); // { message, resolve, danger, confirmLabel }

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({
        message,
        resolve,
        danger: !!opts.danger,
        confirmLabel: opts.confirmLabel || (opts.danger ? "Delete" : "Confirm"),
      });
    });
  }, []);

  function close(result) {
    state?.resolve(result);
    setState(null);
  }

  const modal = state ? (
    <Modal title="Please confirm" onClose={() => close(false)}>
      <p style={{ marginBottom: 20 }}>{state.message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="btn small secondary" onClick={() => close(false)}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn small ${state.danger ? "danger" : ""}`}
          onClick={() => close(true)}
        >
          {state.confirmLabel}
        </button>
      </div>
    </Modal>
  ) : null;

  return [modal, confirm];
}
