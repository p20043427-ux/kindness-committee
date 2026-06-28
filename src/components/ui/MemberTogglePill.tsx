interface MemberTogglePillProps {
  name: string;
  department?: string;
  isSelected: boolean;
  onToggle: () => void;
}

export function MemberTogglePill({
  name,
  department,
  isSelected,
  onToggle,
}: MemberTogglePillProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onToggle}
      className={
        "h-7 px-3 text-xs rounded border transition-colors " +
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 " +
        (isSelected
          ? "bg-primary-50 border-primary-400 text-primary-800 font-semibold"
          : "bg-white border-surface-300 text-surface-600 hover:bg-surface-50 hover:border-surface-400")
      }
    >
      {name}
      {department ? ` (${department})` : ""}
    </button>
  );
}
