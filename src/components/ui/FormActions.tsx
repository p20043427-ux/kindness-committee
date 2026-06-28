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
  saveLabel = "추가완료",
  editLabel = "수정완료",
  cancelLabel = "취소",
  className = "",
}: FormActionsProps) {
  return (
    <div className={`flex justify-end gap-2 pt-4 ${className}`}>
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="px-4 py-2 text-surface-600 bg-surface-100 hover:bg-surface-200 rounded-md font-medium transition-colors disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={isSaving}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {isSaving ? "저장 중..." : isEditing ? editLabel : saveLabel}
      </button>
    </div>
  );
}
