import { NavLink } from "react-router";
import {
  LayoutDashboard,
  ClipboardCheck,
  FileSpreadsheet,
  CalendarDays,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

interface BottomNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: BottomNavItem[] = [
  { to: "/",                icon: LayoutDashboard, label: "대시보드" },
  { to: "/monitoring",      icon: ClipboardCheck,  label: "점검 입력" },
  { to: "/data-management", icon: FileSpreadsheet, label: "데이터" },
  { to: "/schedule",        icon: CalendarDays,    label: "스케줄" },
];

interface BottomNavProps {
  onMoreClick: () => void;
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-white border-t border-surface-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="하단 내비게이션"
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-w-0",
                isActive
                  ? "text-primary-600"
                  : "text-surface-400 hover:text-surface-600"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("w-6 h-6 shrink-0", isActive && "stroke-[2.2]")} aria-hidden />
                <span className="leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* 더보기 — opens sidebar */}
        <button
          onClick={onMoreClick}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-surface-400 hover:text-surface-600 transition-colors min-w-0"
          aria-label="전체 메뉴 열기"
        >
          <Menu className="w-6 h-6 shrink-0" aria-hidden />
          <span className="leading-none">더보기</span>
        </button>
      </div>
    </nav>
  );
}
