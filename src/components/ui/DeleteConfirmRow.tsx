interface DeleteConfirmRowProps {
  label?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmRow({
  label = "정말 삭제할까요?",
  confirmLabel = "네, 삭제",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: DeleteConfirmRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red-600 font-medium whitespace-nowrap">
        {label}
      </span>
      <button
        type="button"
        onClick={onConfirm}
        className="px-3 py-1.5 text-white bg-red-600 rounded-md text-sm hover:bg-red-700 font-medium transition-colors whitespace-nowrap"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-surface-600 bg-surface-100 rounded-md text-sm hover:bg-surface-200 font-medium transition-colors whitespace-nowrap"
      >
        {cancelLabel}
      </button>
    </div>
  );
}
