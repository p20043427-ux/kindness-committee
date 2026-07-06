import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/Card";
import { supabase } from "@/src/lib/supabase";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import { CategoryKey } from "@/src/lib/data";

interface RecordRow {
  id: string;
  departmentId: string;
  buildingId: string;
  totalScore: number;
  date: string;
  focusCategory: string;
}

const CAT_COLORS: Record<string, string> = {
  greeting:    "#fbbf24",
  response:    "#38bdf8",
  phone:       "#10b981",
  appearance:  "#f43f5e",
  environment: "#a78bfa",
};
const DEFAULT_COLOR = "#94a3b8";

function avg(arr: number[]) {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

export function YearlyReport() {
  const { buildings, departments, isLoading: orgLoading } = useOrganization();
  const { categories, monthlyFocus, getFocusForMonth, categoryName } = useSettings();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  /* ── 점수 스케일 감지 (구 50점 데이터 vs 신 10점 데이터) ── */
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

  /* ── 카테고리 범례 (이 연도에 실제 데이터 있는 것만) ── */
  const usedCats = useMemo(() => {
    const keys = new Set(records.map(r => r.focusCategory).filter(Boolean));
    return categories.filter(c => keys.has(c.key));
  }, [records, categories]);

  if (isLoading || orgLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-surface-500">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4" />
        <p>연간 리포트를 생성하는 중입니다...</p>
      </div>
    );
  }

  const noData = records.length === 0;

  return (
    <div className="animate-in fade-in duration-500 space-y-6 max-w-7xl mx-auto">

      {/* ── 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-200">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight border-l-4 border-primary-500 pl-3">
            연간 분석 리포트
          </h1>
          <p className="text-surface-500 mt-1">연도별 친절점검 성과를 월별·카테고리별·부서별로 분석합니다.</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-xl px-4 py-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="w-8 h-8 rounded-lg border border-surface-300 text-surface-600 hover:bg-surface-100 font-bold"
          >◀</button>
          <span className="font-bold text-surface-900 font-mono text-lg w-16 text-center">{selectedYear}년</span>
          <button
            onClick={() => setSelectedYear(y => Math.min(y + 1, currentYear))}
            disabled={selectedYear >= currentYear}
            className="w-8 h-8 rounded-lg border border-surface-300 text-surface-600 hover:bg-surface-100 font-bold disabled:opacity-30"
          >▶</button>
        </div>
      </div>

      {/* ── KPI 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-surface-200">
          <CardContent className="pt-5">
            <p className="text-xs text-surface-500 font-medium">총 점검 건수</p>
            <p className="text-3xl font-bold text-surface-900 mt-1">{kpi.total}<span className="text-base text-surface-400 ml-1">건</span></p>
            <p className="text-xs text-surface-400 mt-1">{kpi.inspectedDepts}개 부서 점검 완료</p>
          </CardContent>
        </Card>
        <Card className="border-surface-200">
          <CardContent className="pt-5">
            <p className="text-xs text-surface-500 font-medium">전체 평균 점수</p>
            <p className="text-3xl font-bold text-primary-600 mt-1">
              {kpi.totalAvg !== null ? kpi.totalAvg : "—"}<span className="text-base text-surface-400 ml-1">/ {scoreMax}</span>
            </p>
            <p className="text-xs text-surface-400 mt-1">중점사항 카테고리 기준</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50">
          <CardContent className="pt-5">
            <p className="text-xs text-emerald-600 font-medium">🏆 최우수 부서</p>
            <p className="text-lg font-bold text-emerald-800 mt-1 break-keep">
              {kpi.topDept ? kpi.topDept.name : "—"}
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              {kpi.topDept ? `평균 ${kpi.topDept.avg}점 · ${kpi.topDept.count}회` : "데이터 없음"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-rose-100 bg-rose-50">
          <CardContent className="pt-5">
            <p className="text-xs text-rose-600 font-medium">📉 개선 필요 부서</p>
            <p className="text-lg font-bold text-rose-800 mt-1 break-keep">
              {kpi.bottomDept ? kpi.bottomDept.name : "—"}
            </p>
            <p className="text-xs text-rose-600 mt-1">
              {kpi.bottomDept ? `평균 ${kpi.bottomDept.avg}점 · ${kpi.bottomDept.count}회` : "데이터 없음"}
            </p>
          </CardContent>
        </Card>
      </div>

      {noData ? (
        <Card className="border-surface-200">
          <CardContent className="py-20 text-center text-surface-400">
            <p className="text-4xl mb-4">📭</p>
            <p className="font-semibold">{selectedYear}년 점검 데이터가 없습니다.</p>
            <p className="text-sm mt-1">점검 조회/입력 메뉴에서 데이터를 먼저 입력해 주세요.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── 월별 점검 현황 ── */}
          <Card className="border-surface-200 shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle>월별 평균 점수 (중점사항별)</CardTitle>
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
                <BarChart data={monthlyData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                    formatter={(value: any, _name: any, props: any) => [
                      value !== null ? `${value}점` : "데이터 없음",
                      props.payload.focusName,
                    ]}
                    labelFormatter={(label) => {
                      const d = monthlyData.find(m => m.month === label);
                      return `${label}${d?.count ? ` (${d.count}건)` : ""}`;
                    }}
                  />
                  <Bar dataKey="avg" maxBarSize={48} radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="avg"
                      position="top"
                      formatter={(v: any) => (v !== null ? v : "")}
                      style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                    />
                    {monthlyData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.avg !== null ? d.color : "#e2e8f0"}
                        opacity={d.avg !== null ? 1 : 0.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── 카테고리별 성과 ── */}
            {categoryData.length > 0 && (
              <Card className="border-surface-200 shadow-sm">
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
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 13, fontWeight: 600 }} width={80} />
                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                        formatter={(v: any, _: any, p: any) => [`${v}점 (${p.payload.count}건)`, "평균 점수"]}
                      />
                      <Bar dataKey="avg" radius={[0, 4, 4, 0]} maxBarSize={28}>
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
              <Card className="border-surface-200 shadow-sm">
                <CardHeader>
                  <CardTitle>건물별 평균 비교</CardTitle>
                  <p className="text-xs text-surface-400 mt-0.5">건물 내 전체 점검 기록의 평균 점수</p>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buildingData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 13 }} />
                      <YAxis domain={[0, scoreMax]} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                        formatter={(v: any, _: any, p: any) => [`${v}점 (${p.payload.count}건)`, "평균 점수"]}
                      />
                      <Bar dataKey="avg" maxBarSize={64} radius={[4, 4, 0, 0]} fill="#2270B4">
                        <LabelList
                          dataKey="avg"
                          position="top"
                          formatter={(v: any) => `${v}점`}
                          style={{ fontSize: 12, fill: "#0F5DAA", fontWeight: 700 }}
                        />
                        {buildingData.map((_, i) => (
                          <Cell key={i} fill={["#2270B4", "#1E9E5A", "#F78B1E"][i % 3]} />
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
              <Card className="border-surface-200 shadow-sm">
                <CardHeader>
                  <CardTitle>🏆 우수 부서 Top {Math.min(deptData.length, 10)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deptData.slice(0, 10).map((dept, i) => {
                      const building = buildings.find(b => b.id === dept.buildingId);
                      const pct = ((dept.avg! / 10) * 100).toFixed(0);
                      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                      return (
                        <div key={dept.id} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-surface-400 text-right shrink-0">
                            {medal ?? `${i + 1}`}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-semibold text-surface-800 truncate">{dept.name}</span>
                              <span className="text-sm font-bold text-primary-600 ml-2 shrink-0 font-mono">
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
                              <span className="text-[11px] text-surface-400 shrink-0">{dept.count}회</span>
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
                <Card className="border-rose-100 shadow-sm">
                  <CardHeader>
                    <CardTitle>📉 집중 관리 필요 부서 Bottom {Math.min(deptData.length, 10)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[...deptData].reverse().slice(0, 10).map((dept, i) => {
                        const building = buildings.find(b => b.id === dept.buildingId);
                        const pct = Math.min(100, ((dept.avg! / scoreMax) * 100)).toFixed(0);
                        return (
                          <div key={dept.id} className="flex items-center gap-3">
                            <span className="w-6 text-xs font-bold text-rose-300 text-right shrink-0">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-sm font-semibold text-surface-800 truncate">{dept.name}</span>
                                <span className="text-sm font-bold text-rose-600 ml-2 shrink-0 font-mono">
                                  {dept.avg}점
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-rose-50 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-rose-400 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-surface-400 shrink-0">{dept.count}회</span>
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
          <Card className="border-surface-200 shadow-sm">
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
                      className={`rounded-xl p-3 border text-center ${
                        hasData ? "bg-white border-surface-200" : "bg-surface-50 border-surface-100"
                      }`}
                    >
                      <p className="text-xs font-bold text-surface-500">{m.month}</p>
                      {m.focusKey ? (
                        <span
                          className="mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.focusName}
                        </span>
                      ) : (
                        <span className="mt-1.5 inline-block text-[10px] text-surface-300">미지정</span>
                      )}
                      {hasData ? (
                        <p className="text-base font-bold text-surface-900 mt-1 font-mono">{m.avg}점</p>
                      ) : (
                        <p className="text-sm text-surface-300 mt-1">—</p>
                      )}
                      {m.count > 0 && (
                        <p className="text-[10px] text-surface-400">{m.count}건</p>
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
