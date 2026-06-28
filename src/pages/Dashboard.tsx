import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { supabase } from "@/src/lib/supabase";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import {
  CalendarDays, Users, RefreshCw, Target,
  ClipboardList, Database, Calendar, UserCheck,
  Megaphone, Building2, BarChart3, Settings,
} from "lucide-react";
import { Skeleton } from "@/src/components/ui/Skeleton";

const mobileNavItems = [
  { to: "/monitoring",      Icon: ClipboardList, label: "점검 조회/입력" },
  { to: "/data-management", Icon: Database,       label: "점검 데이터" },
  { to: "/schedule",        Icon: Calendar,       label: "점검 스케줄" },
  { to: "/committee",       Icon: UserCheck,      label: "명단 관리" },
  { to: "/events",          Icon: Megaphone,      label: "월별 행사" },
  { to: "/management",      Icon: Building2,      label: "코드 관리" },
  { to: "/yearly-report",   Icon: BarChart3,      label: "연간 리포트" },
  { to: "/admin",           Icon: Settings,       label: "시스템 설정" },
];

function ScheduleSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex flex-col border-b border-surface-50 pb-3">
          <div className="flex justify-between items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20 rounded" />
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
  const [kpi, setKpi] = useState<{ curCount: number; curAvg: number | null; prevCount: number; prevAvg: number | null } | null>(null);

  const currentYm = new Date().toISOString().slice(0, 7);
  const focusKey      = getFocusForMonth(currentYm);
  const focusCategory = categories.find(c => c.key === focusKey);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    const [curY, curM] = currentYm.split("-").map(Number);
    const prevM = curM === 1 ? 12 : curM - 1;
    const prevY = curM === 1 ? curY - 1 : curY;
    const prevYm = `${prevY}-${String(prevM).padStart(2, "0")}`;
    const nextM = curM === 12 ? 1 : curM + 1;
    const nextY = curM === 12 ? curY + 1 : curY;
    const nextStart = `${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00`;
    try {
      const [schedRes, eventRes, curRecRes, prevRecRes] = await Promise.all([
        supabase.from("kc_schedules").select("*").eq("month", currentYm),
        supabase.from("kc_events").select("*").eq("month", currentYm),
        supabase.from("kc_records").select("total_score").gte("date", `${currentYm}-01T00:00:00`).lt("date", nextStart),
        supabase.from("kc_records").select("total_score").gte("date", `${prevYm}-01T00:00:00`).lt("date", `${currentYm}-01T00:00:00`),
      ]);
      const calcAvg = (rows: any[]) => {
        const valid = (rows || []).filter((r: any) => r.total_score > 0);
        if (!valid.length) return null;
        return Math.round((valid.reduce((s: number, r: any) => s + r.total_score, 0) / valid.length) * 10) / 10;
      };
      setKpi({
        curCount: (curRecRes.data || []).length,
        curAvg: calcAvg(curRecRes.data || []),
        prevCount: (prevRecRes.data || []).length,
        prevAvg: calcAvg(prevRecRes.data || []),
      });

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

      {/* KPI 통계 카드 */}
      {kpi && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded border border-surface-200 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400">이번 달 점검 완료</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-2xl font-bold text-surface-900 font-mono tabular-nums">{kpi.curCount}<span className="text-sm text-surface-400 ml-1 font-sans font-normal">건</span></p>
              {kpi.prevCount > 0 && (
                <span className={`text-xs font-semibold whitespace-nowrap ${kpi.curCount >= kpi.prevCount ? "text-green-600" : "text-amber-600"}`}>
                  {kpi.curCount >= kpi.prevCount ? "▲" : "▼"}&thinsp;{Math.abs(kpi.curCount - kpi.prevCount)} vs 지난달
                </span>
              )}
            </div>
          </div>
          <div className="bg-white rounded border border-surface-200 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400">이번 달 평균 점수</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-2xl font-bold text-primary-600 font-mono tabular-nums">{kpi.curAvg ?? "—"}<span className="text-sm text-surface-400 ml-1 font-sans font-normal">점</span></p>
              {kpi.prevAvg !== null && kpi.curAvg !== null && (
                <span className={`text-xs font-semibold whitespace-nowrap ${kpi.curAvg >= kpi.prevAvg ? "text-green-600" : "text-red-500"}`}>
                  {kpi.curAvg >= kpi.prevAvg ? "▲" : "▼"}&thinsp;{Math.abs(Math.round((kpi.curAvg - kpi.prevAvg) * 10) / 10)} vs 지난달
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 이번 달 중점사항 배너 */}
      {focusCategory && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded border border-teal-200 bg-teal-50">
          <div className="w-8 h-8 rounded bg-teal-100 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-teal-700" aria-hidden />
          </div>
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
        <h2 className="text-base font-bold text-surface-700 uppercase tracking-widest">메뉴</h2>
        <div className="grid grid-cols-2 gap-3">
          {mobileNavItems.map((item) => (
            <Link key={item.to} to={item.to}
              className="bg-white rounded border border-surface-200 p-4 flex flex-col items-center justify-center gap-2.5 hover:bg-surface-50 active:scale-95 transition-all">
              <div className="w-10 h-10 rounded bg-primary-50 flex items-center justify-center">
                <item.Icon className="w-5 h-5 text-primary-600" aria-hidden />
              </div>
              <span className="text-xs font-semibold text-surface-700 text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 데스크탑 카드 */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">

        {/* 행사 일정 */}
        <Card className="border-surface-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-surface-500" aria-hidden />
                이번 달 행사 일정
              </CardTitle>
              <button onClick={fetchDashboardData} disabled={isLoading}
                aria-label="새로고침"
                className="p-1.5 rounded text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary-500">
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
                      <span className="font-bold text-surface-800 text-sm flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-surface-400 shrink-0" aria-hidden />
                        {e.title}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-surface-600 bg-surface-100 px-2.5 py-1 rounded font-mono tabular-nums">{e.date}</span>
                    </div>
                    <div className="text-xs text-surface-500 mt-1.5 ml-[22px]">
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
        <Card className="border-surface-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-surface-500" aria-hidden />
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
                      <span className="font-bold text-surface-800 text-sm flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-surface-400 shrink-0" aria-hidden />
                        {s.turn}차 점검
                      </span>
                      <span className="text-xs font-medium text-surface-600 bg-surface-100 px-2.5 py-1 rounded font-mono tabular-nums">{s.date}</span>
                    </div>
                    <div className="text-xs text-surface-500 mt-1.5 ml-[22px]">
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
