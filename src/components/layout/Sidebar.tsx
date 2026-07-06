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

interface NavItem  { to: string; icon: LucideIcon; label: string }
interface NavGroup { label: string; indicatorColor: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: "점검 운영",
    indicatorColor: "#1E9E5A",
    items: [
      { to: "/",                icon: LayoutDashboard, label: "대시보드" },
      { to: "/monitoring",      icon: ClipboardCheck,  label: "점검 조회/입력" },
      { to: "/data-management", icon: FileSpreadsheet, label: "데이터 관리" },
      { to: "/schedule",        icon: CalendarDays,    label: "점검 스케줄" },
    ],
  },
  {
    label: "분석·리포트",
    indicatorColor: "#F78B1E",
    items: [
      { to: "/yearly-report", icon: TrendingUp, label: "연간 분석 리포트" },
    ],
  },
  {
    label: "위원회 관리",
    indicatorColor: "#5FA9E6",
    items: [
      { to: "/committee", icon: Users,         label: "위원회 명단" },
      { to: "/events",    icon: CalendarRange, label: "월별 행사 관리" },
    ],
  },
  {
    label: "시스템",
    indicatorColor: "#64748B",
    items: [
      { to: "/management", icon: Building2, label: "건물/부서 코드" },
      { to: "/admin",      icon: Settings,  label: "시스템 설정" },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  return (
    <aside className={cn(
      "w-56 flex flex-col shrink-0 overflow-hidden",
      "fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:transform-none",
      isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
    )}
    style={{ backgroundColor: "#101826" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid #263450" }}>
        <div
          className="w-8 h-8 flex items-center justify-center rounded text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: "#0F5DAA" }}
          aria-hidden="true"
        >
          ✚
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm leading-tight truncate">좋은문화병원</div>
          <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "#93A3BA" }}>친절위원회</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-3 px-2" aria-label="메인 메뉴">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn("mb-1", gi > 0 && "mt-4")}>
            {/* Group label */}
            <div className="flex items-center gap-1.5 px-3 mb-1">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: group.indicatorColor }}
                aria-hidden="true"
              />
              <span
                className="text-[9px] font-bold tracking-[0.12em] uppercase select-none"
                style={{ color: "#5C6C86" }}
              >
                {group.label}
              </span>
            </div>

            {/* Items */}
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-colors duration-100",
                      isActive
                        ? "text-white font-medium"
                        : "font-normal hover:text-white"
                    )
                  }
                  style={({ isActive }) => isActive
                    ? { backgroundColor: "#2270B4", color: "#FFFFFF" }
                    : { color: "#93A3BA" }
                  }
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    if (!el.classList.contains("text-white")) {
                      el.style.backgroundColor = "#1E2B45";
                      el.style.color = "#B7D2EE";
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    if (!el.classList.contains("text-white")) {
                      el.style.backgroundColor = "";
                      el.style.color = "#93A3BA";
                    }
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: isActive ? "#B7D2EE" : "inherit" }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span
                          className="absolute right-0 top-1 bottom-1 w-0.5 rounded-l"
                          style={{ backgroundColor: "#5FA9E6" }}
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 text-[10px] shrink-0" style={{ borderTop: "1px solid #263450", color: "#5C6C86" }}>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#1E9E5A" }}
            aria-hidden="true"
          />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
}
