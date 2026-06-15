import { NavLink } from "react-router";
import { cn } from "@/src/lib/utils";
import {
  LayoutDashboard,
  ClipboardCheck,
  FileSpreadsheet,
  CalendarDays,
  Users,
  CalendarRange,
  Building2,
  TrendingUp,
  Settings,
  type LucideIcon,
} from "lucide-react";

const navItems: { to: string; icon: LucideIcon; label: string }[] = [
  { to: "/",                icon: LayoutDashboard,  label: "대시보드" },
  { to: "/monitoring",      icon: ClipboardCheck,   label: "점검 조회/입력" },
  { to: "/data-management", icon: FileSpreadsheet,  label: "점검 데이터 관리" },
  { to: "/schedule",        icon: CalendarDays,     label: "점검 스케줄" },
  { to: "/committee",       icon: Users,            label: "위원회 명단 관리" },
  { to: "/events",          icon: CalendarRange,    label: "월별 행사 관리" },
  { to: "/management",      icon: Building2,        label: "건물/부서 코드 관리" },
  { to: "/yearly-report",   icon: TrendingUp,       label: "연간 분석 리포트" },
  { to: "/admin",           icon: Settings,         label: "시스템 설정" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  return (
    <aside className={cn(
      "w-64 bg-white border-r border-surface-200 flex flex-col p-6 space-y-8 shrink-0",
      "fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:transform-none",
      isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
          좋
        </div>
        <span className="text-xl font-bold tracking-tight text-surface-900">좋은문화병원</span>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Menu</div>
        <nav className="space-y-1" aria-label="메인 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-surface-500 hover:bg-surface-100 hover:text-surface-700"
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

    </aside>
  );
}
