import { Button } from "./Button";

interface FormActionsProps {
  isSaving: boolean;
  isEditing?: boolean;
  onCancel: () => void;
  saveLabel?: string;
  editLabel?: string;
  cancelLabel?: string;
  className?: string;
}

export function FormActions({
  isSaving,
  isEditing = false,
  onCancel,
  saveLabel   = "추가완료",
  editLabel   = "수정완료",
  cancelLabel = "취소",
  className   = "",
}: FormActionsProps) {
  return (
    <div className={`flex justify-end gap-2 pt-4 ${className}`}>
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={onCancel}
        disabled={isSaving}
      >
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={isSaving}
      >
        {isEditing ? editLabel : saveLabel}
      </Button>
    </div>
  );
}
