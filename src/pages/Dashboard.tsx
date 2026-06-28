import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { supabase } from "@/src/lib/supabase";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import { CalendarDays, Users, RefreshCw } from "lucide-react";
import { Skeleton } from "@/src/components/ui/Skeleton";

const mobileNavItems = [
  { to: "/monitoring",      icon: "📅", label: "점검 조회/입력",  color: "bg-blue-100 text-blue-700" },
  { to: "/data-management", icon: "📋", label: "점검 데이터",     color: "bg-purple-100 text-purple-700" },
  { to: "/schedule",        icon: "🗓️", label: "점검 스케줄",     color: "bg-green-100 text-green-700" },
  { to: "/committee",       icon: "👥", label: "명단 관리",       color: "bg-orange-100 text-orange-700" },
  { to: "/events",          icon: "🤝", label: "월별 행사",       color: "bg-pink-100 text-pink-700" },
  { to: "/management",      icon: "🏢", label: "코드 관리",       color: "bg-indigo-100 text-indigo-700" },
  { to: "/yearly-report",   icon: "📈", label: "연간 리포트",     color: "bg-teal-100 text-teal-700" },
  { to: "/admin",           icon: "⚙️", label: "시스템 설정",     color: "bg-slate-100 text-slate-700" },
];

function ScheduleSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex flex-col border-b border-surface-50 pb-3">
          <div className="flex justify-between items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48 mt-2 ml-7" />
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { isLoading: orgLoading } = useOrganization();
  const { categories, getFocusForMonth } = useSettings();
  const [schedules, setSchedules]   = useState<any[]>([]);
  const [events,    setEvents]      = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [lastFetch, setLastFetch]   = useState(0);

  const currentYm = new Date().toISOString().slice(0, 7);
  const focusKey      = getFocusForMonth(currentYm);
  const focusCategory = categories.find(c => c.key === focusKey);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [schedRes, eventRes] = await Promise.all([
        supabase.from("kc_schedules").select("*").eq("month", currentYm),
        supabase.from("kc_events").select("*").eq("month", currentYm),
      ]);

      const s = (schedRes.data || [])
        .map((x: any) => ({ ...x, inspectors: x.inspectors || [] }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      const e = (eventRes.data || [])
        .map((x: any) => ({ ...x, attendees: x.attendees || [] }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      setSchedules(s);
      setEvents(e);
      setLastFetch(Date.now());
    } catch (err) {
      console.error("대시보드 데이터 로딩 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentYm]);

  /* 마운트 + 페이지 포커스 시 재패치 (최소 30초 쿨다운) */
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFetch > 30_000) fetchDashboardData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchDashboardData, lastFetch]);

  /* 설정 동기화 실패 알림 */
  useEffect(() => {
    const handler = () => {
      window.dispatchEvent(new CustomEvent("toast", {
        detail: { message: "설정 동기화에 실패했습니다. 이전 설정으로 운영됩니다.", type: "warning" },
      }));
    };
    window.addEventListener("settings-sync-error", handler);
    return () => window.removeEventListener("settings-sync-error", handler);
  }, []);

  return (
    <div className="animate-in fade-in duration-500 flex-1 flex flex-col items-stretch 2xl:min-h-0">

      {/* 이번 달 중점사항 배너 */}
      {focusCategory && (
        <div className="mb-4 flex items-center gap-3 p-4 rounded-xl bg-teal-50 border border-teal-200">
          <span className="text-2xl" aria-hidden>🎯</span>
          <div>
            <p className="text-sm font-bold text-teal-800">
              {new Date().getMonth() + 1}월 중점사항: {focusCategory.name}
            </p>
            <p className="text-xs text-teal-600 mt-0.5">{focusCategory.details}</p>
          </div>
        </div>
      )}

      {/* 모바일 메뉴 */}
      <div className="lg:hidden flex flex-col gap-4">
        <h2 className="text-xl font-bold text-surface-900 border-l-4 border-primary-500 pl-3">메뉴</h2>
        <div className="grid grid-cols-2 gap-4">
          {mobileNavItems.map((item) => (
            <Link key={item.to} to={item.to}
              className="bg-white rounded-xl shadow-sm border border-surface-200 p-4 flex flex-col items-center justify-center gap-3 hover:bg-surface-50 active:scale-95 transition-all">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${item.color}`}>
                {item.icon}
              </div>
              <span className="text-sm font-bold text-surface-700 text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 데스크탑 카드 */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">

        {/* 행사 일정 */}
        <Card className="border-surface-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-pink-500" aria-hidden />
                이번 달 행사 일정
              </CardTitle>
              <button onClick={fetchDashboardData} disabled={isLoading}
                aria-label="새로고침"
                className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <ScheduleSkeleton /> : (
              <div className="space-y-4 pt-2">
                {events.length === 0 ? (
                  <p className="text-sm text-surface-400 py-4 text-center">이번 달 등록된 행사가 없습니다.</p>
                ) : events.map((e, i) => (
                  <div key={i} className="flex flex-col border-b border-surface-50 pb-3 last:border-0 hover:bg-surface-50 p-2 rounded transition-colors">
                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="font-bold text-surface-800 text-base flex items-center gap-2">
                        <span aria-hidden>🤝</span> {e.title}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-surface-600 bg-surface-100 px-3 py-1 rounded-full font-mono">{e.date}</span>
                    </div>
                    <div className="text-sm text-surface-500 mt-2 ml-7">
                      <span className="font-medium mr-1">참석자:</span>
                      {e.attendees?.length > 0 ? e.attendees.join(", ") : "기록 없음"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 점검 스케줄 */}
        <Card className="border-surface-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-green-500" aria-hidden />
              이번 달 점검 스케줄
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <ScheduleSkeleton /> : (
              <div className="space-y-4 pt-2">
                {schedules.length === 0 ? (
                  <p className="text-sm text-surface-400 py-4 text-center">이번 달 등록된 스케줄이 없습니다.</p>
                ) : schedules.map((s, i) => (
                  <div key={i} className="flex flex-col border-b border-surface-50 pb-3 last:border-0 hover:bg-surface-50 p-2 rounded transition-colors">
                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="font-bold text-surface-800 text-base flex items-center gap-2">
                        <span aria-hidden>🗓️</span> {s.turn}차 점검
                      </span>
                      <span className="text-sm font-medium text-surface-600 bg-surface-100 px-3 py-1 rounded-full font-mono">{s.date}</span>
                    </div>
                    <div className="text-sm text-surface-500 mt-2 ml-7">
                      <span className="font-medium mr-1">점검자:</span>
                      {s.inspectors?.length > 0 ? s.inspectors.join(", ") : "미정"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
