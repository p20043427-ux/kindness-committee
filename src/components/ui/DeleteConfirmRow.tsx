import { Button } from "./Button";

interface DeleteConfirmRowProps {
  label?:        string;
  confirmLabel?: string;
  cancelLabel?:  string;
  onConfirm: () => void;
  onCancel:  () => void;
}

export function DeleteConfirmRow({
  label        = "정말 삭제할까요?",
  confirmLabel = "네, 삭제",
  cancelLabel  = "취소",
  onConfirm,
  onCancel,
}: DeleteConfirmRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red-600 font-medium whitespace-nowrap">
        {label}
      </span>
      <Button type="button" variant="danger" size="sm" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}
