import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Menu, Search, ChevronRight } from "lucide-react";

const PAGE_NAMES: Record<string, string> = {
  "/":                "대시보드",
  "/monitoring":      "점검 조회/입력",
  "/data-management": "데이터 관리",
  "/schedule":        "점검 스케줄",
  "/yearly-report":   "연간 분석 리포트",
  "/committee":       "위원회 명단",
  "/events":          "월별 행사 관리",
  "/management":      "건물/부서 코드",
  "/admin":           "시스템 설정",
};

interface TopbarProps {
  onToggleMenu?: () => void;
}

export function Topbar({ onToggleMenu }: TopbarProps) {
  const { pathname } = useLocation();
  const pageName = PAGE_NAMES[pathname] ?? "—";
  const isHome = pathname === "/";

  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = time.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  });
  const timeStr = time.toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });

  return (
    <header className="h-12 bg-white flex items-center justify-between px-5 shrink-0"
      style={{ borderBottom: "1px solid #D1D9E6", borderTop: "2px solid #1558A0" }}>

      {/* Left: breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleMenu}
          className="md:hidden p-1.5 -ml-1.5 rounded text-surface-500 hover:bg-surface-100 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5" />
        </button>
        <nav className="flex items-center gap-1 text-xs" aria-label="경로">
          <span className="text-surface-400 font-medium">친절위원회</span>
          {!isHome && (
            <>
              <ChevronRight className="w-3 h-3 text-surface-300 shrink-0" aria-hidden />
              <span className="text-surface-700 font-semibold truncate">{pageName}</span>
            </>
          )}
        </nav>
      </div>

      {/* Right: search / clock / status */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
          className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 text-xs bg-surface-50 border border-surface-200 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
          aria-label="전체 검색 (Ctrl+K)"
        >
          <Search className="w-3 h-3" />
          <span>검색</span>
          <kbd className="ml-0.5 px-1 py-px text-[10px] rounded border border-surface-200 bg-white text-surface-400 font-mono">⌃K</kbd>
        </button>

        {/* Clock */}
        <div className="hidden md:flex items-center gap-2 h-7 px-2.5 bg-surface-50 border border-surface-200 rounded text-surface-600 text-xs font-mono tabular-nums">
          <span>{dateStr}</span>
          <span className="text-surface-300">|</span>
          <span className="font-medium">{timeStr}</span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5 h-7 px-2.5 rounded border text-xs font-medium"
          style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", color: "#15803D" }}>
          <span className="relative flex w-1.5 h-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: "#22C55E" }} />
            <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ backgroundColor: "#22C55E" }} />
          </span>
          <span className="hidden sm:inline">정상운영</span>
        </div>
      </div>
    </header>
  );
}
