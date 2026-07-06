import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
  LineChart, Line, ReferenceLine, Area, AreaChart,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/Card";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { supabase } from "@/src/lib/supabase";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import { CategoryKey } from "@/src/lib/data";
import { CATEGORY_COLORS, BUILDING_COLORS, CHART_COLORS } from "@/src/lib/designTokens";
import { Printer, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

const TOOLTIP_STYLE = {
  borderRadius: "4px",
  border: "1px solid #E3E9F0",
  fontSize: "12px",
  padding: "8px 12px",
} as const;

const GRID_COLOR = "#EEF2F7";

function avg(arr: number[]) {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

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

function TrendChip({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-[10px] text-surface-300">전월 없음</span>;
  if (Math.abs(delta) < 0.1) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-surface-400">
      <Minus className="w-3 h-3" /> 전월 동일
    </span>
  );
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{delta.toFixed(1)}점
    </span>
  );
}

export function YearlyReport() {
  const { buildings, departments, isLoading: orgLoading } = useOrganization();
  const { categories, monthlyFocus, getFocusForMonth, categoryName } = useSettings();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartType, setChartType] = useState<"bar" | "area">("area");

  useEffect(() => {
    let mounted = true;
    const doFetch = async () => {
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
    doFetch();
    return () => { mounted = false; };
  }, [selectedYear]);

  /* ── 점수 스케일 ── */
  const scoreMax = useMemo(() => {
    const valid = records.filter(r => r.totalScore > 0);
    if (!valid.length) return 10;
    return Math.max(...valid.map(r => r.totalScore)) > 10 ? 50 : 10;
  }, [records]);

  /* ── 월별 집계 (전월 델타 포함) ── */
  const monthlyData = useMemo(() => {
    const map: Record<string, number[]> = {};
    records.forEach(r => {
      const ym = r.date.slice(0, 7);
      if (!map[ym]) map[ym] = [];
      if (r.totalScore > 0) map[ym].push(r.totalScore);
    });

    const base = Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const ym = `${selectedYear}-${mm}`;
      const scores = map[ym] || [];
      const focusKey = getFocusForMonth(ym) as string;
      return {
        month: `${i + 1}월`,
        shortMonth: `${i + 1}`,
        ym,
        avg: avg(scores),
        count: scores.length,
        focusKey,
        focusName: focusKey ? categoryName(focusKey) : "미지정",
        color: focusKey ? (CAT_COLORS[focusKey] ?? DEFAULT_COLOR) : DEFAULT_COLOR,
        delta: null as number | null,
      };
    });

    for (let i = 1; i < 12; i++) {
      const prev = base[i - 1].avg;
      const curr = base[i].avg;
      if (prev !== null && curr !== null) {
        base[i].delta = Math.round((curr - prev) * 10) / 10;
      }
    }
    return base;
  }, [records, selectedYear, monthlyFocus, categories]);

  /* ── 카테고리별 집계 ── */
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
        pct: Math.round((avg(map[c.key])! / scoreMax) * 100),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [records, categories, scoreMax]);

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

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const valid = records.filter(r => r.totalScore > 0);
    const totalAvg = avg(valid.map(r => r.totalScore));
    const inspectedDepts = new Set(valid.map(r => r.departmentId)).size;
    const achieveRate = totalAvg !== null ? Math.round((totalAvg / scoreMax) * 100) : null;
    // 상반기/하반기
    const h1 = valid.filter(r => parseInt(r.date.slice(5, 7)) <= 6);
    const h2 = valid.filter(r => parseInt(r.date.slice(5, 7)) >= 7);
    return {
      total: records.length,
      totalAvg,
      achieveRate,
      inspectedDepts,
      topDept: deptData[0] ?? null,
      bottomDept: deptData[deptData.length - 1] ?? null,
      h1Avg: avg(h1.map(r => r.totalScore)),
      h2Avg: avg(h2.map(r => r.totalScore)),
    };
  }, [records, deptData, scoreMax]);

  /* ── 중점사항 범례 ── */
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
  const refScore = Math.round(scoreMax * 0.8);

  return (
    <div className="animate-in fade-in duration-500 space-y-6 max-w-7xl mx-auto">

      {/* 헤더 */}
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

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="총 점검 건수" accentColor={CHART_COLORS.primary}>
          <p className="text-2xl font-bold text-surface-900 mt-2 font-mono tabular-nums">
            {kpi.total}<span className="text-sm text-surface-400 ml-1 font-sans font-normal">건</span>
          </p>
          <p className="text-xs text-surface-400 mt-1">{kpi.inspectedDepts}개 부서 완료</p>
        </KpiCard>
        <KpiCard label="전체 평균 점수" accentColor={CHART_COLORS.primary}>
          <p className="text-2xl font-bold text-primary-600 mt-2 font-mono tabular-nums">
            {kpi.totalAvg !== null ? kpi.totalAvg : "—"}
            <span className="text-sm text-surface-400 ml-1 font-sans font-normal">/ {scoreMax}</span>
          </p>
          {kpi.achieveRate !== null && (
            <p className="text-xs mt-1">
              <span className={`font-bold ${kpi.achieveRate >= 80 ? "text-green-600" : kpi.achieveRate >= 70 ? "text-amber-600" : "text-red-500"}`}>
                달성률 {kpi.achieveRate}%
              </span>
              <span className="text-surface-400 ml-1">(기준 {refScore}점)</span>
            </p>
          )}
        </KpiCard>
        <KpiCard label="상반기 평균" accentColor={CHART_COLORS.secondary}>
          <p className="text-2xl font-bold text-surface-900 mt-2 font-mono tabular-nums">
            {kpi.h1Avg !== null ? kpi.h1Avg : "—"}
            <span className="text-sm text-surface-400 ml-1 font-sans font-normal">점</span>
          </p>
          {kpi.h1Avg !== null && kpi.h2Avg !== null && (
            <p className="text-xs mt-1">
              하반기 {kpi.h2Avg}점{" "}
              <span className={`font-semibold ${kpi.h2Avg >= kpi.h1Avg ? "text-green-600" : "text-red-500"}`}>
                ({kpi.h2Avg >= kpi.h1Avg ? "▲" : "▼"}{Math.abs(Math.round((kpi.h2Avg - kpi.h1Avg) * 10) / 10)})
              </span>
            </p>
          )}
        </KpiCard>
        <KpiCard label="최우수 / 집중관리" accentColor={CHART_COLORS.warning}>
          <p className="text-sm font-bold text-surface-900 mt-2 break-keep leading-snug">
            {kpi.topDept ? kpi.topDept.name : "—"}
          </p>
          <p className="text-xs text-surface-400 mt-0.5 font-mono">
            {kpi.topDept ? `avg ${kpi.topDept.avg}점` : "데이터 없음"}
          </p>
          {kpi.bottomDept && kpi.bottomDept.id !== kpi.topDept?.id && (
            <p className="text-xs text-amber-600 font-semibold mt-1 break-keep leading-snug">
              ↓ {kpi.bottomDept.name} ({kpi.bottomDept.avg}점)
            </p>
          )}
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
          {/* 월별 점수 추이 */}
          <Card className="border-surface-200">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle>월별 평균 점수 추이</CardTitle>
                  <div className="flex rounded border border-surface-200 overflow-hidden text-xs">
                    {(["area", "bar"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setChartType(t)}
                        className={`px-2.5 h-7 font-medium transition-colors ${
                          chartType === t ? "bg-primary-600 text-white" : "bg-white text-surface-600 hover:bg-surface-50"
                        }`}
                      >
                        {t === "area" ? "추이" : "막대"}
                      </button>
                    ))}
                  </div>
                </div>
                {usedCats.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {usedCats.map(c => (
                      <span key={c.key} className="flex items-center gap-1 text-xs font-medium text-surface-600">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: CAT_COLORS[c.key] }} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "area" ? (
                  <AreaChart data={monthlyData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                    <XAxis dataKey="shortMonth" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={v => `${v}월`} />
                    <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: any, _: any, p: any) => [v !== null ? `${v}점` : "—", p.payload.focusName]}
                      labelFormatter={(label) => {
                        const d = monthlyData.find(m => m.shortMonth === String(label));
                        return `${label}월${d?.count ? ` (${d.count}건)` : ""}`;
                      }}
                    />
                    <ReferenceLine
                      y={refScore}
                      stroke={CHART_COLORS.secondary}
                      strokeDasharray="4 4"
                      label={{ value: `기준 ${refScore}점`, fill: CHART_COLORS.secondary, fontSize: 11, position: "right" }}
                    />
                    <Area
                      dataKey="avg"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2.5}
                      fill="url(#scoreGrad)"
                      dot={(props: any) => {
                        if (props.payload.avg === null) return <g key={props.key} />;
                        return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill={props.payload.color} stroke="#fff" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 6, fill: CHART_COLORS.primary }}
                      connectNulls={false}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={monthlyData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                    <XAxis dataKey="shortMonth" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={v => `${v}월`} />
                    <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "#F6F8FB" }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: any, _: any, p: any) => [v !== null ? `${v}점` : "—", p.payload.focusName]}
                      labelFormatter={(label) => {
                        const d = monthlyData.find(m => m.shortMonth === String(label));
                        return `${label}월${d?.count ? ` (${d.count}건)` : ""}`;
                      }}
                    />
                    <ReferenceLine y={refScore} stroke={CHART_COLORS.secondary} strokeDasharray="4 4" />
                    <Bar dataKey="avg" maxBarSize={44} radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey="avg"
                        position="top"
                        formatter={(v: any) => (v !== null ? v : "")}
                        style={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                      />
                      {monthlyData.map((d, i) => (
                        <Cell key={i} fill={d.avg !== null ? d.color : "#E3E9F0"} opacity={d.avg !== null ? 1 : 0.4} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 카테고리별 성과 */}
            {categoryData.length > 0 && (
              <Card className="border-surface-200">
                <CardHeader>
                  <CardTitle>카테고리별 평균 성과</CardTitle>
                  <p className="text-xs text-surface-400 mt-0.5">해당 카테고리가 중점사항이었던 달의 기록 기준</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoryData.map((c) => (
                      <div key={c.key}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-full self-stretch rounded-full inline-block shrink-0" style={{ backgroundColor: c.color, minHeight: "14px" }} />
                            <span className="text-sm font-semibold text-surface-800">{c.name}</span>
                            <span className="text-xs text-surface-400 tabular-nums">{c.count}건</span>
                          </div>
                          <span className="text-sm font-bold font-mono tabular-nums" style={{ color: c.color }}>
                            {c.avg}점 <span className="text-xs text-surface-400 font-normal">({c.pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 건물별 비교 */}
            {buildingData.length > 0 && (
              <Card className="border-surface-200">
                <CardHeader>
                  <CardTitle>건물별 평균 비교</CardTitle>
                  <p className="text-xs text-surface-400 mt-0.5">건물 내 전체 점검 기록의 평균</p>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buildingData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 13 }} />
                      <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: "#F6F8FB" }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: any, _: any, p: any) => [`${v}점 (${p.payload.count}건)`, "평균 점수"]}
                      />
                      <ReferenceLine y={refScore} stroke={CHART_COLORS.secondary} strokeDasharray="4 4" />
                      <Bar dataKey="avg" maxBarSize={64} radius={[3, 3, 0, 0]}>
                        <LabelList
                          dataKey="avg"
                          position="top"
                          formatter={(v: any) => `${v}`}
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

          {/* 부서 순위 */}
          {deptData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-surface-200">
                <CardHeader>
                  <CardTitle>우수 부서 Top {Math.min(deptData.length, 10)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deptData.slice(0, 10).map((dept, i) => {
                      const building = buildings.find(b => b.id === dept.buildingId);
                      const pct = Math.min(100, (dept.avg! / scoreMax) * 100);
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
                                <div className="h-full rounded-full bg-primary-400 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] text-surface-400 shrink-0 tabular-nums">{dept.count}회</span>
                            </div>
                          </div>
                          {building && <span className="text-[10px] text-surface-400 shrink-0 hidden sm:block">{building.name}</span>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {deptData.length > 3 && (
                <Card className="border-surface-200">
                  <CardHeader>
                    <CardTitle>집중 관리 필요 Bottom {Math.min(deptData.length, 10)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[...deptData].reverse().slice(0, 10).map((dept, i) => {
                        const building = buildings.find(b => b.id === dept.buildingId);
                        const pct = Math.min(100, (dept.avg! / scoreMax) * 100);
                        return (
                          <div key={dept.id} className="flex items-center gap-3">
                            <span className="w-6 text-xs font-bold text-amber-400 text-right shrink-0 tabular-nums">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-sm font-semibold text-surface-800 truncate">{dept.name}</span>
                                <span className="text-sm font-bold text-amber-600 ml-2 shrink-0 font-mono tabular-nums">{dept.avg}점</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] text-surface-400 shrink-0 tabular-nums">{dept.count}회</span>
                              </div>
                            </div>
                            {building && <span className="text-[10px] text-surface-400 shrink-0 hidden sm:block">{building.name}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 월별 중점사항 현황표 — HIS 준수 (배경색 없음) */}
          <Card className="border-surface-200">
            <CardHeader>
              <CardTitle>월별 중점사항 운영 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-surface-200">
                      <th className="text-left py-2 pr-3 text-xs font-semibold text-surface-500 w-12">월</th>
                      <th className="text-left py-2 pr-3 text-xs font-semibold text-surface-500">중점사항</th>
                      <th className="text-right py-2 pr-3 text-xs font-semibold text-surface-500 w-16">평균</th>
                      <th className="text-right py-2 pr-3 text-xs font-semibold text-surface-500 w-14">건수</th>
                      <th className="text-right py-2 text-xs font-semibold text-surface-500 w-20">전월 대비</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(m => (
                      <tr key={m.ym} className="border-b border-surface-100 hover:bg-surface-50 transition-colors">
                        <td className="py-2.5 pr-3 font-bold text-surface-700 tabular-nums">{m.month}</td>
                        <td className="py-2.5 pr-3">
                          {m.focusKey ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0 inline-block" style={{ backgroundColor: m.color }} />
                              <span className="font-medium text-surface-800">{m.focusName}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-surface-300">미지정</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-bold font-mono tabular-nums">
                          {m.avg !== null ? (
                            <span className={m.avg / scoreMax >= 0.8 ? "text-green-700" : m.avg / scoreMax >= 0.7 ? "text-amber-700" : "text-red-600"}>
                              {m.avg}점
                            </span>
                          ) : (
                            <span className="text-surface-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-xs text-surface-500 tabular-nums">
                          {m.count > 0 ? `${m.count}건` : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          <TrendChip delta={m.delta} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
