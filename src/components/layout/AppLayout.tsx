import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { GlobalSearch } from "@/src/components/features/GlobalSearch";
import { useState } from "react";

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMenu = () => setIsMobileMenuOpen(v => !v);

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden font-sans">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onToggleMenu={toggleMenu} />
        <main className="flex-1 overflow-auto">
          <div className="p-5 pb-24 md:p-7 md:pb-7 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav onMoreClick={toggleMenu} />

      <GlobalSearch />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
