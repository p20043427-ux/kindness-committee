import { Menu, Search } from "lucide-react";

interface TopbarProps {
  onToggleMenu?: () => void;
}

export function Topbar({ onToggleMenu }: TopbarProps) {
  
  return (
    <header className="flex justify-between items-center shrink-0 w-full max-w-7xl mx-auto border-b border-surface-200 md:border-b-0 pb-4 md:pb-0 mb-2 md:mb-0">
      <div className="flex items-center space-x-3">
        <button 
          onClick={onToggleMenu}
          className="md:hidden p-2 -ml-2 text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-surface-800">친절위원회</h1>
          <p className="hidden xs:block text-surface-500 text-xs md:text-sm">친절점검 현황 및 부서별 친절도 리포트</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
          className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg shadow-sm text-surface-500 hover:text-surface-700 hover:bg-surface-50 transition-colors"
          aria-label="전체 검색 (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">검색</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-xs rounded border border-surface-200 bg-surface-50 text-surface-400 font-mono">⌃K</kbd>
        </button>
        <div className="hidden sm:flex items-center space-x-2 text-sm bg-white border border-surface-200 py-2 px-3 rounded-lg shadow-sm">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-surface-600 font-semibold font-mono text-xs">System Online</span>
        </div>
        
      </div>
    </header>
  );
}
