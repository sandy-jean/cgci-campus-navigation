/**
 * Accessible modal dialog.
 *
 * Built on <dialog> so focus trapping, the top layer, Escape-to-close, and inert
 * background content come from the platform rather than a hand-rolled handler that
 * would be easy to get wrong.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Widens the dialog for data-heavy admin forms. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="modal-title"
      className={`m-auto w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-white p-0 shadow-2xl backdrop:bg-ink-900/45 backdrop:backdrop-blur-[1px] ${SIZES[size]}`}
    >
      <div className="flex max-h-[88vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-base font-semibold text-ink-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-ink-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded-md p-1.5 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-ink-200 bg-ink-50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/**
 * Confirmation dialog for destructive administrator actions.
 * Deactivating a building or closing a path changes routing for every visitor, so
 * the consequence is spelled out before the write happens.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ink-300 bg-white px-4 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${
              tone === 'danger' ? 'bg-red-700 hover:bg-red-800' : 'bg-cgci-700 hover:bg-cgci-800'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-700">{message}</p>
    </Modal>
  );
}