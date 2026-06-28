import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
  LineChart, Line, ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/Card";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { supabase } from "@/src/lib/supabase";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import { CategoryKey } from "@/src/lib/data";
import { CATEGORY_COLORS, BUILDING_COLORS, CHART_COLORS } from "@/src/lib/designTokens";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";

interface RecordRow {
  id: string;
  departmentId: string;
  buildingId: string;
  totalScore: number;
  date: string;
  focusCategory: string;
}

const CAT_COLORS = CATEGORY_COLORS;
const DEFAULT_COLOR = CHART_COLORS.neutral;

/** Shared tooltip visual style — consistent with rounded (4px) HIS rule */
const TOOLTIP_STYLE = {
  borderRadius: "4px",
  border: "1px solid #D1D9E6",
  fontSize: "12px",
  padding: "8px 12px",
} as const;

const GRID_COLOR = "#E7ECF3";

function avg(arr: number[]) {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

/** White card with thin colored top-accent strip. Replaces colored backgrounds. */
function KpiCard({ label, accentColor, children }: {
  label: string; accentColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-surface-200 rounded overflow-hidden">
      <div className="h-[3px]" style={{ backgroundColor: accentColor }} />
      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function YearlyReport() {
  const { buildings, departments, isLoading: orgLoading } = useOrganization();
  const { categories, monthlyFocus, getFocusForMonth, categoryName } = useSettings();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyChartType, setMonthlyChartType] = useState<"bar" | "line">("bar");

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("kc_records")
          .select("id,department_id,building_id,total_score,date,focus_category")
          .gte("date", `${selectedYear}-01-01T00:00:00`)
          .lt("date", `${selectedYear + 1}-01-01T00:00:00`);
        if (error) throw error;
        if (mounted) {
          setRecords(
            (data || []).map((d: any) => ({
              id: d.id,
              departmentId: d.department_id,
              buildingId: d.building_id,
              totalScore: d.total_score ?? 0,
              date: d.date,
              focusCategory: d.focus_category || "",
            }))
          );
        }
      } catch (e) {
        console.error("YearlyReport fetch error:", e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, [selectedYear]);

  /* ── 월별 집계 ── */
  const monthlyData = useMemo(() => {
    const map: Record<string, number[]> = {};
    records.forEach(r => {
      const ym = r.date.slice(0, 7);
      if (!map[ym]) map[ym] = [];
      if (r.totalScore > 0) map[ym].push(r.totalScore);
    });

    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const ym = `${selectedYear}-${mm}`;
      const scores = map[ym] || [];
      const focusKey = getFocusForMonth(ym) as string;
      return {
        month: `${i + 1}월`,
        ym,
        avg: avg(scores),
        count: scores.length,
        focusKey,
        focusName: focusKey ? categoryName(focusKey) : "미지정",
        color: focusKey ? (CAT_COLORS[focusKey] ?? DEFAULT_COLOR) : DEFAULT_COLOR,
      };
    });
  }, [records, selectedYear, monthlyFocus, categories]);

  /* ── 카테고리별 집계 (해당 카테고리가 중점사항이었던 달의 기록만) ── */
  const categoryData = useMemo(() => {
    const map: Record<string, number[]> = {};
    records.forEach(r => {
      if (!r.focusCategory) return;
      if (!map[r.focusCategory]) map[r.focusCategory] = [];
      if (r.totalScore > 0) map[r.focusCategory].push(r.totalScore);
    });
    return categories
      .filter(c => map[c.key]?.length)
      .map(c => ({
        key: c.key,
        name: c.name,
        avg: avg(map[c.key])!,
        count: map[c.key].length,
        color: CAT_COLORS[c.key] ?? DEFAULT_COLOR,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [records, categories]);

  /* ── 건물별 집계 ── */
  const buildingData = useMemo(() => {
    const map: Record<string, number[]> = {};
    records.forEach(r => {
      if (!r.buildingId) return;
      if (!map[r.buildingId]) map[r.buildingId] = [];
      if (r.totalScore > 0) map[r.buildingId].push(r.totalScore);
    });
    return buildings
      .map(b => ({
        id: b.id,
        name: b.name,
        avg: avg(map[b.id] || []),
        count: (map[b.id] || []).length,
      }))
      .filter(b => b.avg !== null)
      .sort((a, b) => b.avg! - a.avg!);
  }, [records, buildings]);

  /* ── 부서별 집계 ── */
  const deptData = useMemo(() => {
    const map: Record<string, number[]> = {};
    records.forEach(r => {
      if (!map[r.departmentId]) map[r.departmentId] = [];
      if (r.totalScore > 0) map[r.departmentId].push(r.totalScore);
    });
    return departments
      .map(d => ({
        id: d.id,
        name: d.name,
        buildingId: d.buildingId,
        avg: avg(map[d.id] || []),
        count: (map[d.id] || []).length,
      }))
      .filter(d => d.avg !== null)
      .sort((a, b) => b.avg! - a.avg!);
  }, [records, departments]);

  /* ── 점수 스케일 감지 ── */
  const scoreMax = useMemo(() => {
    const valid = records.filter(r => r.totalScore > 0);
    if (!valid.length) return 10;
    const max = Math.max(...valid.map(r => r.totalScore));
    return max > 10 ? 50 : 10;
  }, [records]);

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const valid = records.filter(r => r.totalScore > 0);
    const totalAvg = avg(valid.map(r => r.totalScore));
    const inspectedDepts = new Set(valid.map(r => r.departmentId)).size;
    return {
      total: records.length,
      totalAvg,
      inspectedDepts,
      topDept: deptData[0] ?? null,
      bottomDept: deptData[deptData.length - 1] ?? null,
    };
  }, [records, deptData]);

  /* ── 카테고리 범례 ── */
  const usedCats = useMemo(() => {
    const keys = new Set(records.map(r => r.focusCategory).filter(Boolean));
    return categories.filter(c => keys.has(c.key));
  }, [records, categories]);

  if (isLoading || orgLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-surface-500">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4" />
        <p className="text-sm">연간 리포트를 생성하는 중입니다...</p>
      </div>
    );
  }

  const noData = records.length === 0;

  return (
    <div className="animate-in fade-in duration-500 space-y-6 max-w-7xl mx-auto">

      {/* ── 헤더 ── */}
      <PageHeader
        title="연간 분석 리포트"
        description={`${selectedYear}년도 친절점검 성과를 월별·카테고리별·부서별로 분석합니다.`}
      >
        <div className="flex items-center gap-2 print-hidden">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden />}
            onClick={() => window.print()}
          >
            인쇄
          </Button>
          {/* 연도 네비게이터 */}
          <div className="flex items-center border border-surface-200 rounded overflow-hidden">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="h-8 w-7 flex items-center justify-center hover:bg-surface-100 transition-colors border-r border-surface-200 text-surface-600"
              aria-label="이전 연도"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            </button>
            <span className="px-3 h-8 flex items-center font-bold text-surface-900 font-mono text-sm w-16 justify-center">
              {selectedYear}년
            </span>
            <button
              onClick={() => setSelectedYear(y => Math.min(y + 1, currentYear))}
              disabled={selectedYear >= currentYear}
              className="h-8 w-7 flex items-center justify-center hover:bg-surface-100 transition-colors border-l border-surface-200 text-surface-600 disabled:opacity-30"
              aria-label="다음 연도"
            >
              <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </PageHeader>

      {/* ── KPI 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="총 점검 건수" accentColor={CHART_COLORS.primary}>
          <p className="text-2xl font-bold text-surface-900 mt-2 font-mono tabular-nums">
            {kpi.total}<span className="text-sm text-surface-400 ml-1 font-sans font-normal">건</span>
          </p>
          <p className="text-xs text-surface-400 mt-1">{kpi.inspectedDepts}개 부서 점검 완료</p>
        </KpiCard>
        <KpiCard label="전체 평균 점수" accentColor={CHART_COLORS.primary}>
          <p className="text-2xl font-bold text-primary-600 mt-2 font-mono tabular-nums">
            {kpi.totalAvg !== null ? kpi.totalAvg : "—"}
            <span className="text-sm text-surface-400 ml-1 font-sans font-normal">/ {scoreMax}</span>
          </p>
          <p className="text-xs text-surface-400 mt-1">중점사항 카테고리 기준</p>
        </KpiCard>
        <KpiCard label="최우수 부서" accentColor={CHART_COLORS.secondary}>
          <p className="text-sm font-bold text-surface-900 mt-2 break-keep leading-snug">
            {kpi.topDept ? kpi.topDept.name : "—"}
          </p>
          <p className="text-xs text-surface-400 mt-1 font-mono">
            {kpi.topDept ? `avg ${kpi.topDept.avg}점 · ${kpi.topDept.count}회` : "데이터 없음"}
          </p>
        </KpiCard>
        <KpiCard label="집중 관리 필요" accentColor={CHART_COLORS.warning}>
          <p className="text-sm font-bold text-surface-900 mt-2 break-keep leading-snug">
            {kpi.bottomDept ? kpi.bottomDept.name : "—"}
          </p>
          <p className="text-xs text-surface-400 mt-1 font-mono">
            {kpi.bottomDept ? `avg ${kpi.bottomDept.avg}점 · ${kpi.bottomDept.count}회` : "데이터 없음"}
          </p>
        </KpiCard>
      </div>

      {noData ? (
        <Card className="border-surface-200">
          <CardContent className="py-20 text-center text-surface-400">
            <p className="text-sm font-medium text-surface-500">{selectedYear}년 점검 데이터가 없습니다.</p>
            <p className="text-xs mt-1">점검 조회/입력 메뉴에서 데이터를 먼저 입력해 주세요.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── 월별 점검 현황 ── */}
          <Card className="border-surface-200">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle>월별 평균 점수 (중점사항별)</CardTitle>
                  {/* 차트 타입 토글 */}
                  <div className="flex rounded border border-surface-200 overflow-hidden text-xs">
                    {(["bar", "line"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setMonthlyChartType(t)}
                        className={`px-2.5 h-7 font-medium transition-colors ${
                          monthlyChartType === t
                            ? "bg-primary-600 text-white"
                            : "bg-white text-surface-600 hover:bg-surface-50"
                        }`}
                      >
                        {t === "bar" ? "막대" : "추이"}
                      </button>
                    ))}
                  </div>
                </div>
                {usedCats.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {usedCats.map(c => (
                      <span key={c.key} className="flex items-center gap-1 text-xs font-medium text-surface-600">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: CAT_COLORS[c.key] }} />
                        {c.name}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 text-xs font-medium text-surface-400">
                      <span className="w-3 h-3 rounded-sm inline-block bg-surface-300" />
                      미지정
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {monthlyChartType === "bar" ? (
                  <BarChart data={monthlyData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "#F4F6F9" }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any, _name: any, props: any) => [
                        value !== null ? `${value}점` : "데이터 없음",
                        props.payload.focusName,
                      ]}
                      labelFormatter={(label) => {
                        const d = monthlyData.find(m => m.month === label);
                        return `${label}${d?.count ? ` (${d.count}건)` : ""}`;
                      }}
                    />
                    <Bar dataKey="avg" maxBarSize={48} radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey="avg"
                        position="top"
                        formatter={(v: any) => (v !== null ? v : "")}
                        style={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                      />
                      {monthlyData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.avg !== null ? d.color : "#D1D9E6"}
                          opacity={d.avg !== null ? 1 : 0.5}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <LineChart data={monthlyData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: any, _: any, p: any) => [v !== null ? `${v}점` : "데이터 없음", p.payload.focusName]}
                      labelFormatter={(label) => {
                        const d = monthlyData.find(m => m.month === label);
                        return `${label}${d?.count ? ` (${d.count}건)` : ""}`;
                      }}
                    />
                    <ReferenceLine
                      y={Math.round(scoreMax * 0.8)}
                      stroke={CHART_COLORS.secondary}
                      strokeDasharray="4 4"
                      label={{ value: `기준 ${Math.round(scoreMax * 0.8)}점`, fill: CHART_COLORS.secondary, fontSize: 11, position: "right" }}
                    />
                    <Line
                      dataKey="avg"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2.5}
                      dot={(props: any) => {
                        if (props.payload.avg === null) return <g key={props.key} />;
                        return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill={props.payload.color} stroke="#fff" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 6, fill: CHART_COLORS.primary }}
                      connectNulls={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── 카테고리별 성과 ── */}
            {categoryData.length > 0 && (
              <Card className="border-surface-200">
                <CardHeader>
                  <CardTitle>카테고리별 평균 성과</CardTitle>
                  <p className="text-xs text-surface-400 mt-0.5">해당 카테고리가 중점사항이었던 달의 점검 기록 기준</p>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_COLOR} />
                      <XAxis type="number" domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 13, fontWeight: 600 }} width={80} />
                      <Tooltip
                        cursor={{ fill: "#F4F6F9" }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: any, _: any, p: any) => [`${v}점 (${p.payload.count}건)`, "평균 점수"]}
                      />
                      <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={28}>
                        <LabelList
                          dataKey="avg"
                          position="right"
                          formatter={(v: any) => `${v}점`}
                          style={{ fontSize: 12, fill: "#475569", fontWeight: 700 }}
                        />
                        {categoryData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* ── 건물별 비교 ── */}
            {buildingData.length > 0 && (
              <Card className="border-surface-200">
                <CardHeader>
                  <CardTitle>건물별 평균 비교</CardTitle>
                  <p className="text-xs text-surface-400 mt-0.5">건물 내 전체 점검 기록의 평균 점수</p>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buildingData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 13 }} />
                      <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: "#F4F6F9" }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: any, _: any, p: any) => [`${v}점 (${p.payload.count}건)`, "평균 점수"]}
                      />
                      <Bar dataKey="avg" maxBarSize={64} radius={[3, 3, 0, 0]}>
                        <LabelList
                          dataKey="avg"
                          position="top"
                          formatter={(v: any) => `${v}점`}
                          style={{ fontSize: 12, fill: CHART_COLORS.primary, fontWeight: 700 }}
                        />
                        {buildingData.map((_, i) => (
                          <Cell key={i} fill={BUILDING_COLORS[i % BUILDING_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── 부서 순위 ── */}
          {deptData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 상위 부서 */}
              <Card className="border-surface-200">
                <CardHeader>
                  <CardTitle>우수 부서 Top {Math.min(deptData.length, 10)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deptData.slice(0, 10).map((dept, i) => {
                      const building = buildings.find(b => b.id === dept.buildingId);
                      const pct = Math.min(100, ((dept.avg! / scoreMax) * 100)).toFixed(0);
                      return (
                        <div key={dept.id} className="flex items-center gap-3">
                          <span className={`w-6 text-xs font-bold text-right shrink-0 tabular-nums ${i < 3 ? "text-amber-500" : "text-surface-400"}`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-semibold text-surface-800 truncate">{dept.name}</span>
                              <span className="text-sm font-bold text-primary-600 ml-2 shrink-0 font-mono tabular-nums">
                                {dept.avg}점
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary-400 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-surface-400 shrink-0 tabular-nums">{dept.count}회</span>
                            </div>
                          </div>
                          {building && (
                            <span className="text-[10px] text-surface-400 shrink-0">{building.name}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* 하위 부서 */}
              {deptData.length > 3 && (
                <Card className="border-surface-200">
                  <CardHeader>
                    <CardTitle>집중 관리 필요 부서 Bottom {Math.min(deptData.length, 10)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[...deptData].reverse().slice(0, 10).map((dept, i) => {
                        const building = buildings.find(b => b.id === dept.buildingId);
                        const pct = Math.min(100, ((dept.avg! / scoreMax) * 100)).toFixed(0);
                        return (
                          <div key={dept.id} className="flex items-center gap-3">
                            <span className="w-6 text-xs font-bold text-amber-400 text-right shrink-0 tabular-nums">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-sm font-semibold text-surface-800 truncate">{dept.name}</span>
                                <span className="text-sm font-bold text-amber-600 ml-2 shrink-0 font-mono tabular-nums">
                                  {dept.avg}점
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-amber-300 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-surface-400 shrink-0 tabular-nums">{dept.count}회</span>
                              </div>
                            </div>
                            {building && (
                              <span className="text-[10px] text-surface-400 shrink-0">{building.name}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── 월별 중점사항 현황표 ── */}
          <Card className="border-surface-200">
            <CardHeader>
              <CardTitle>월별 중점사항 운영 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {monthlyData.map(m => {
                  const hasData = m.avg !== null;
                  return (
                    <div
                      key={m.ym}
                      className={`rounded p-3 border text-center ${
                        hasData ? "bg-white border-surface-200" : "bg-surface-50 border-surface-100"
                      }`}
                    >
                      <p className="text-xs font-bold text-surface-500">{m.month}</p>
                      {m.focusKey ? (
                        <span
                          className="mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.focusName}
                        </span>
                      ) : (
                        <span className="mt-1.5 inline-block text-[10px] text-surface-300">미지정</span>
                      )}
                      {hasData ? (
                        <p className="text-base font-bold text-surface-900 mt-1 font-mono tabular-nums">{m.avg}점</p>
                      ) : (
                        <p className="text-sm text-surface-300 mt-1">—</p>
                      )}
                      {m.count > 0 && (
                        <p className="text-[10px] text-surface-400 tabular-nums">{m.count}건</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
