"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد الحذف",
  cancelLabel = "إلغاء",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="card w-full max-w-md p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-bold">
          {title}
        </h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "جارٍ الحذف..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function deleteTaskConfirmMessage(taskNo: string, name: string) {
  return `هل أنت متأكد من حذف المهمة «${taskNo} — ${name}»؟\n\nسيتم حذف التحديثات والموردين والمستندات المرتبطة بها نهائيًا.\nلا يمكن التراجع عن هذا الإجراء.`;
}

export function deleteUserConfirmMessage(roleLabel: string, name: string) {
  return `هل أنت متأكد من حذف ${roleLabel} «${name}»؟\n\nسيتم حذف الحساب نهائيًا.\nلا يمكن التراجع عن هذا الإجراء.`;
}
