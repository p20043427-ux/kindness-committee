import { useEffect, useRef, useState, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { Search, Building2, LayoutGrid, X } from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: typeof Search;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { buildings, departments } = useOrganization();

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results: SearchResult[] = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const items: SearchResult[] = [];

    departments.forEach(d => {
      if (d.name.toLowerCase().includes(q)) {
        const bldg = buildings.find(b => b.id === d.buildingId);
        items.push({
          id: `dept-${d.id}`,
          label: d.name,
          sublabel: bldg?.name,
          href: `/data-management?dept=${d.id}&building=${d.buildingId}`,
          icon: LayoutGrid,
        });
      }
    });

    buildings.forEach(b => {
      if (b.name.toLowerCase().includes(q)) {
        items.push({
          id: `bld-${b.id}`,
          label: b.name,
          sublabel: "건물 전체 보기",
          href: `/data-management?building=${b.id}`,
          icon: Building2,
        });
      }
    });

    return items.slice(0, 8);
  })();

  const select = (result: SearchResult) => {
    navigate(result.href);
    close();
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      select(results[cursor]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="전체 검색"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-200">
          <Search className="w-5 h-5 text-surface-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="부서명 또는 건물명 검색..."
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            className="flex-1 text-surface-900 placeholder-surface-400 text-sm outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-surface-400 hover:text-surface-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded border border-surface-200 text-xs text-surface-400 font-mono bg-surface-50">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query.trim() ? (
          results.length > 0 ? (
            <ul role="listbox" className="py-2 max-h-80 overflow-y-auto">
              {results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <li key={r.id} role="option" aria-selected={cursor === i}>
                    <button
                      onClick={() => select(r)}
                      onMouseEnter={() => setCursor(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        cursor === i ? "bg-primary-50 text-primary-900" : "text-surface-700 hover:bg-surface-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${cursor === i ? "text-primary-600" : "text-surface-400"}`} />
                      <span className="flex-1">
                        <span className="font-medium text-sm">{r.label}</span>
                        {r.sublabel && (
                          <span className="ml-2 text-xs text-surface-400">{r.sublabel}</span>
                        )}
                      </span>
                      {cursor === i && (
                        <kbd className="text-xs text-primary-400 font-mono">Enter</kbd>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-surface-400">
              <span>"{query}"에 대한 결과가 없습니다.</span>
            </div>
          )
        ) : (
          <div className="py-6 text-center text-xs text-surface-400">
            <p>부서명 또는 건물명을 입력하세요.</p>
            <p className="mt-1">↑ ↓ 로 이동, Enter로 선택</p>
          </div>
        )}
      </div>
    </div>
  );
}
