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
      className={`px-3 py-1.5 text-sm rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        isSelected
          ? "bg-primary-100 border-primary-500 text-primary-800 font-medium"
          : "bg-white border-surface-300 text-surface-600 hover:bg-surface-50"
      }`}
    >
      {name}
      {department ? ` (${department})` : ""}
    </button>
  );
}
