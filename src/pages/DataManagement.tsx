import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router";
import { useToast } from "@/src/components/ui/Toast";
import { supabase } from "@/src/lib/supabase";
import { liveQuery, rowToRecord, computeStatus, CategoryScores } from "@/src/lib/db";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import {
  Download, CalendarDays, BarChart2,
  ArrowUp, ArrowDown, ChevronRight, ChevronLeft,
  FileSpreadsheet, Loader2,
} from "lucide-react";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { SkeletonTableRows } from "@/src/components/ui/Skeleton";
import { downloadExcel } from "@/src/lib/excel";
import { scoreBand } from "@/src/lib/designTokens";

/* ── 날짜 입력 debounce ─────────────────────────────────────────────────── */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 50;

export interface RecordDoc {
  id: string;
  buildingId: string;
  departmentId: string;
  departmentName: string;
  inspector: string;
  date: string;
  scores: {
    greeting: number;
    response: number;
    phone: number;
    appearance: number;
    environment: number;
  };
  focusCategory?: string;
  subScores?: Record<string, number>;
  totalScore: number;
  notes: string;
  status: string;
  userId: string;
  createdAt: string;
}


export function DataManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { buildings, departments, isLoading: orgLoading } = useOrganization();
  const { categories } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── URL-driven 필터 상태 ───────────────────────────────────────────── */
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const today            = new Date().toISOString().split("T")[0];
  const firstOfMonth     = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; })();
  const prevYearMonth    = (() => { const [y, m] = currentYearMonth.split("-").map(Number); return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`; })();

  const updateParams = useCallback((updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === "") next.delete(k); else next.set(k, v);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const activeTab          = (searchParams.get("tab")     || "raw")                  as "raw" | "aggregate";
  const filterType         = (searchParams.get("type")    || "month")                as "month" | "range";
  const filterMonth        = searchParams.get("month")    || currentYearMonth;
  const filterYear         = searchParams.get("year")     || new Date().getFullYear().toString();
  const filterBuildingId   = searchParams.get("building")  || "";
  const filterDepartmentId = searchParams.get("dept")      || "";
  const filterInspector    = searchParams.get("inspector") || "";
  const rawPage            = Math.max(0, parseInt(searchParams.get("page") || "0", 10));

  /* 날짜 범위: 로컬 state → debounce → URL 동기화 */
  const [startDateLocal, setStartDateLocal] = useState(searchParams.get("from") || firstOfMonth);
  const [endDateLocal,   setEndDateLocal]   = useState(searchParams.get("to")   || today);
  const startDate = useDebounce(startDateLocal, 300);
  const endDate   = useDebounce(endDateLocal,   300);

  useEffect(() => {
    if (filterType === "range") updateParams({ from: startDate, to: endDate });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filterType]);

  /* ── 로컬 상태 ─────────────────────────────────────────────────────── */
  const [allRecords,      setAllRecords]      = useState<RecordDoc[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showCategoryColumns, setShowCategoryColumns] = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [editForm,        setEditForm]        = useState<Partial<RecordDoc>>({});
  const [isExporting,     setIsExporting]     = useState(false);
  const [hiddenIds,       setHiddenIds]       = useState<Set<string>>(new Set());
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /* ── 정렬 상태 ─────────────────────────────────────────────────────── */
  type RawSortKey = "date" | "buildingName" | "departmentName" | "inspector"
    | "greeting" | "response" | "phone" | "appearance" | "environment"
    | "totalScore" | "status";
  const [rawSortConfig, setRawSortConfig] = useState<{ key: RawSortKey; direction: "asc" | "desc" } | null>(null);

  const handleRawSort = (key: RawSortKey) => {
    setRawSortConfig(prev =>
      prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
    updateParams({ page: "0" });
  };

  type AggSortKey = "departmentName" | "m1" | "m2" | "m3" | "m4" | "m5" | "m6"
    | "m7" | "m8" | "m9" | "m10" | "m11" | "m12" | "yearlyAvg";
  const [aggSortConfig, setAggSortConfig] = useState<{ key: AggSortKey; direction: "asc" | "desc" } | null>(
    { key: "yearlyAvg", direction: "desc" }
  );
  const handleAggSort = (key: AggSortKey) =>
    setAggSortConfig(prev =>
      prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );

  /* ── 데이터 패치 ────────────────────────────────────────────────────── */
  useEffect(() => {
    setIsLoading(true);
    let isMounted = true;

    let startOfDay: string;
    let endOfDay: string;

    if (activeTab === "aggregate") {
      startOfDay = `${filterYear}-01-01T00:00:00`;
      endOfDay   = `${filterYear}-12-31T23:59:59.999Z`;
    } else if (filterType === "month") {
      startOfDay = `${filterMonth}-01T00:00:00`;
      const [y, m] = filterMonth.split("-").map(Number);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      endOfDay = `${ny}-${String(nm).padStart(2, "0")}-01T00:00:00`;
    } else {
      startOfDay = `${startDate}T00:00:00`;
      endOfDay   = `${endDate}T23:59:59.999Z`;
    }

    const unsubscribe = liveQuery<any>(
      "kc_records",
      () =>
        supabase
          .from("kc_records")
          .select("*")
          .gte("date", startOfDay)
          .lt("date", endOfDay)
          .order("date", { ascending: false }),
      rows => {
        if (isMounted) { setAllRecords(rows.map(rowToRecord) as RecordDoc[]); setIsLoading(false); }
      },
      err => { console.error("데이터 로딩 오류:", err); if (isMounted) setIsLoading(false); }
    );

    return () => { isMounted = false; unsubscribe(); };
  }, [activeTab, filterType, filterMonth, startDate, endDate, filterYear]);

  /* 필터 변경 시 첫 페이지 복귀 */
  useEffect(() => {
    updateParams({ page: "0" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterType, startDate, endDate, filterBuildingId, filterDepartmentId, filterInspector]);

  /* ── 헬퍼 ──────────────────────────────────────────────────────────── */
  const getBuildingName = useCallback(
    (id: string) => buildings.find(b => b.id === id)?.name || id,
    [buildings]
  );

  const handleBuildingFilterChange = (bid: string) =>
    updateParams({ building: bid, dept: "", page: "0" });

  /* 점수 스케일 감지 (구 50점 vs 신 10점) */
  const scoreMaxForBand = useMemo(() => {
    const valid = allRecords.filter(r => r.totalScore > 0);
    if (!valid.length) return 10;
    return Math.max(...valid.map(r => r.totalScore)) > 10 ? 50 : 10;
  }, [allRecords]);

  /* 점검자 목록: 현재 조회된 레코드에서 유일값 추출 */
  const inspectorOptions = useMemo(() => {
    const names = new Set(allRecords.map(r => r.inspector).filter(Boolean));
    return Array.from(names).sort();
  }, [allRecords]);

  /* ── 가공 데이터 ─────────────────────────────────────────────────────── */
  const displayRecords = useMemo(() => {
    let filtered = allRecords.filter(r => {
      if (hiddenIds.has(r.id)) return false;
      const d = r.date.split("T")[0];
      const inRange = filterType === "month"
        ? d.startsWith(filterMonth)
        : d >= startDate && d <= endDate;
      if (!inRange) return false;
      if (filterBuildingId   && r.buildingId   !== filterBuildingId)   return false;
      if (filterDepartmentId && r.departmentId !== filterDepartmentId) return false;
      if (filterInspector    && r.inspector    !== filterInspector)    return false;
      return true;
    });

    if (rawSortConfig) {
      filtered.sort((a, b) => {
        let av: any, bv: any;
        if (rawSortConfig.key === "buildingName") {
          av = getBuildingName(a.buildingId); bv = getBuildingName(b.buildingId);
        } else if (["greeting","response","phone","appearance","environment"].includes(rawSortConfig.key)) {
          av = a.scores?.[rawSortConfig.key as keyof RecordDoc["scores"]] ?? 0;
          bv = b.scores?.[rawSortConfig.key as keyof RecordDoc["scores"]] ?? 0;
        } else {
          av = a[rawSortConfig.key as keyof RecordDoc];
          bv = b[rawSortConfig.key as keyof RecordDoc];
        }
        if (av < bv) return rawSortConfig.direction === "asc" ? -1 : 1;
        if (av > bv) return rawSortConfig.direction === "asc" ?  1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => {
        const bo = buildings.findIndex(x => x.id === a.buildingId) - buildings.findIndex(x => x.id === b.buildingId);
        if (bo !== 0) return bo;
        const dor = departments.findIndex(x => x.id === a.departmentId) - departments.findIndex(x => x.id === b.departmentId);
        if (dor !== 0) return dor;
        return b.date.localeCompare(a.date);
      });
    }
    return filtered;
  }, [allRecords, filterType, filterMonth, startDate, endDate, filterBuildingId, filterDepartmentId, filterInspector, rawSortConfig, buildings, departments, hiddenIds, getBuildingName]);

  const totalPages       = Math.max(1, Math.ceil(displayRecords.length / PAGE_SIZE));
  const safePage         = Math.min(rawPage, totalPages - 1);
  const paginatedRecords = useMemo(
    () => displayRecords.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [displayRecords, safePage]
  );

  const aggregateData = useMemo(() => {
    const stats: Record<string, { id: string; name: string; months: Record<number, { total: number; count: number }> }> = {};
    departments.forEach(d => { stats[d.id] = { id: d.id, name: d.name, months: {} }; });

    allRecords.forEach(r => {
      if (!r.date.startsWith(filterYear)) return;
      if (!stats[r.departmentId]) stats[r.departmentId] = { id: r.departmentId, name: r.departmentName, months: {} };
      const m = parseInt(r.date.split("-")[1], 10);
      if (!stats[r.departmentId].months[m]) stats[r.departmentId].months[m] = { total: 0, count: 0 };
      stats[r.departmentId].months[m].total += r.totalScore;
      stats[r.departmentId].months[m].count += 1;
    });

    let rows = Object.values(stats).map(dept => {
      const row: any = { departmentId: dept.id, departmentName: dept.name };
      let yt = 0, yc = 0;
      for (let i = 1; i <= 12; i++) {
        if (dept.months[i]?.count > 0) {
          row[`m${i}`] = Math.round((dept.months[i].total / dept.months[i].count) * 10) / 10;
          yt += dept.months[i].total; yc += dept.months[i].count;
        } else { row[`m${i}`] = null; }
      }
      row.yearlyAvg = yc > 0 ? Math.round((yt / yc) * 10) / 10 : null;
      return row;
    });

    if (aggSortConfig) {
      rows.sort((a, b) => {
        const av = a[aggSortConfig.key], bv = b[aggSortConfig.key];
        if (av === null && bv !== null) return 1;
        if (av !== null && bv === null) return -1;
        if (av === null && bv === null) return 0;
        if (av < bv) return aggSortConfig.direction === "asc" ? -1 : 1;
        if (av > bv) return aggSortConfig.direction === "asc" ?  1 : -1;
        return 0;
      });
    }
    return rows;
  }, [allRecords, filterYear, departments, aggSortConfig]);

  /* ── 내보내기 ────────────────────────────────────────────────────────── */
  const exportRawCSV = () => {
    const headers = ["점검일","소속 건물","부서명","점검자",...categories.map(c => c.name),"총점","상태","특이사항"];
    const rows = displayRecords.map(r => [
      r.date.split("T")[0], getBuildingName(r.buildingId), r.departmentName, r.inspector,
      ...categories.map(c => r.scores?.[c.key as keyof typeof r.scores] ?? 0),
      r.totalScore, r.status, `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csv = "﻿" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `점검데이터_${filterType === "month" ? filterMonth : `${startDate}_${endDate}`}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportRawXLSX = async () => {
    setIsExporting(true);
    try {
      const headers = ["점검일","소속 건물","부서명","점검자",...categories.map(c => c.name),"총점","상태","특이사항"];
      const rows = displayRecords.map(r => [
        r.date.split("T")[0], getBuildingName(r.buildingId), r.departmentName, r.inspector,
        ...categories.map(c => r.scores?.[c.key as keyof typeof r.scores] ?? 0),
        r.totalScore, r.status, r.notes || "",
      ]);
      const label = filterType === "month" ? filterMonth : `${startDate}_${endDate}`;
      downloadExcel([{ headers, rows, sheetName: "점검내역" }], `점검데이터_${label}.xlsx`);
    } finally { setIsExporting(false); }
  };

  const exportAggregateCSV = () => {
    const headers = ["부서명","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월","연간 평균"];
    const rows = aggregateData.map(r => [
      r.departmentName,
      ...[1,2,3,4,5,6,7,8,9,10,11,12].map(m => r[`m${m}`] ?? ""),
      r.yearlyAvg ?? "",
    ]);
    const csv = "﻿" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `부서별_월별_점수표_${filterYear}년.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportAggregateXLSX = async () => {
    setIsExporting(true);
    try {
      const headers = ["부서명","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월","연간 평균"];
      const rows = aggregateData.map(r => [
        r.departmentName,
        r.m1, r.m2, r.m3, r.m4, r.m5, r.m6, r.m7, r.m8, r.m9, r.m10, r.m11, r.m12,
        r.yearlyAvg,
      ]);
      downloadExcel([{ headers, rows, sheetName: `${filterYear}년 집계` }], `부서별_월별_점수표_${filterYear}년.xlsx`);
    } finally { setIsExporting(false); }
  };

  /* ── ARIA 정렬 속성 ──────────────────────────────────────────────────── */
  const rawSortAttr = (k: RawSortKey): "ascending" | "descending" | "none" =>
    rawSortConfig?.key === k ? (rawSortConfig.direction === "asc" ? "ascending" : "descending") : "none";
  const aggSortAttr = (k: AggSortKey): "ascending" | "descending" | "none" =>
    aggSortConfig?.key === k ? (aggSortConfig.direction === "asc" ? "ascending" : "descending") : "none";

  const RawSortIcon = ({ k }: { k: RawSortKey }) =>
    rawSortConfig?.key === k
      ? rawSortConfig.direction === "asc"
        ? <ArrowUp   className="w-3 h-3 inline ml-1 text-primary-500" aria-hidden />
        : <ArrowDown className="w-3 h-3 inline ml-1 text-primary-500" aria-hidden />
      : <span className="w-3 inline-block" aria-hidden />;

  const AggSortIcon = ({ k }: { k: AggSortKey }) =>
    aggSortConfig?.key === k
      ? aggSortConfig.direction === "asc"
        ? <ArrowUp   className="w-3 h-3 inline ml-1 text-primary-500" aria-hidden />
        : <ArrowDown className="w-3 h-3 inline ml-1 text-primary-500" aria-hidden />
      : <span className="w-3 inline-block" aria-hidden />;

  /* ── 편집 ────────────────────────────────────────────────────────────── */
  const startEdit  = (r: RecordDoc) => { setEditingId(r.id); setEditForm({ ...r }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const updateSubScore = (key: string, val: number) =>
    setEditForm(prev => ({ ...prev, subScores: { ...prev.subScores, [key]: val } }));

  const saveEdit = async (id: string) => {
    if (!id) return;
    try {
      const focusCat = editForm.focusCategory
        ? categories.find(c => c.key === editForm.focusCategory) : null;
      const newTotal = focusCat && editForm.subScores
        ? focusCat.subCriteria.reduce((sum, sub) =>
            sum + (editForm.subScores![`${focusCat.key}_${sub.key}`] ?? 0), 0)
        : (editForm.totalScore ?? 0);

      const { error } = await supabase.from("kc_records").update({
        inspector:   editForm.inspector,
        notes:       editForm.notes,
        total_score: newTotal,
        sub_scores:  editForm.subScores ?? null,
        updated_at:  new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      setEditingId(null);
      toast("수정이 저장되었습니다.", "success");
    } catch {
      toast("수정 저장 중 오류가 발생했습니다.", "error");
    }
  };

  /* ── 삭제 ────────────────────────────────────────────────────────────── */
  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase.from("kc_records").delete().eq("id", id);
      if (error) throw error;
    } catch {
      setHiddenIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast("삭제 중 오류가 발생했습니다.", "error");
    }
  };

  const softDeleteRecord = (id: string) => {
    setPendingDeleteId(null);
    setHiddenIds(prev => new Set([...prev, id]));
    const timer = setTimeout(() => {
      undoTimers.current.delete(id);
      setHiddenIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      deleteRecord(id);
    }, 5000);
    undoTimers.current.set(id, timer);
    toast("점검 기록이 삭제되었습니다.", "success", {
      label: "실행취소",
      onClick: () => {
        const t = undoTimers.current.get(id);
        if (t) { clearTimeout(t); undoTimers.current.delete(id); }
        setHiddenIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      },
    });
  };

  /* ── 동적 colSpan ────────────────────────────────────────────────────── */
  // 고정 열: 점검일, 소속 건물, 부서명, 점검자, 중점사항, 카테고리(토글), 총점, 상태, 특이사항, 관리 = 10
  const rawColCount = 10 + (showCategoryColumns ? categories.length : 0);

  /* ── 공통 ────────────────────────────────────────────────────────────── */
  const focusRing = "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500";

  const StatusBadge = ({ status }: { status?: string }) => (
    <span className={`px-2 py-1 text-xs font-semibold rounded ${
      status === "정상" ? "bg-green-100 text-green-700" :
      status === "주의" ? "bg-orange-100 text-orange-700" :
                          "bg-red-100 text-red-700"
    }`}>{status}</span>
  );

  /* ── 로딩 ────────────────────────────────────────────────────────────── */
  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <div className="h-8 w-56 bg-surface-200 rounded motion-safe:animate-pulse mb-2" />
          <div className="h-4 w-80 bg-surface-100 rounded motion-safe:animate-pulse" />
        </div>
        <div className="flex gap-4 border-b border-surface-200">
          <div className="h-10 w-28 bg-surface-100 rounded-t motion-safe:animate-pulse" />
          <div className="h-10 w-36 bg-surface-100 rounded-t motion-safe:animate-pulse" />
        </div>
        <div className="bg-surface-50 p-4 rounded border border-surface-200 space-y-3">
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-surface-200 rounded motion-safe:animate-pulse" />
            <div className="h-9 w-36 bg-surface-200 rounded motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded border border-surface-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 border-b border-surface-200">
              <tr>
                {["점검일","건물","부서","점검자","중점사항","총점","상태","특이사항","관리"].map(h => (
                  <th key={h} className="py-3 px-4 font-semibold text-surface-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody><SkeletonTableRows rows={8} cols={9} /></tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="점검 데이터 관리"
        description="상세 점검 내역을 관리하고 연간/월별 점수표를 확인하세요."
      />

      {/* ── 탭 ── */}
      <div role="tablist" aria-label="데이터 보기 방식" className="flex space-x-1 border-b border-surface-200">
        {(["raw", "aggregate"] as const).map(tab => (
          <button
            key={tab}
            role="tab"
            id={`tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            onClick={() => updateParams({ tab, page: "0" })}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${focusRing} ${
              activeTab === tab
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
            }`}
          >
            {tab === "raw"
              ? <CalendarDays className="w-4 h-4" aria-hidden />
              : <BarChart2    className="w-4 h-4" aria-hidden />}
            {tab === "raw" ? "상세 점검 내역" : "부서별 월간/연간 점수표"}
          </button>
        ))}
      </div>

      {/* ════════════════ RAW 탭 ════════════════ */}
      {activeTab === "raw" ? (
        <div id="panel-raw" role="tabpanel" aria-labelledby="tab-raw" className="space-y-4">

          {/* 필터 카드 */}
          <div className="bg-white border border-surface-200 rounded">
            {/* 섹션 1: 조회 기간 */}
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
              {/* 조회 방식 select — 모바일 전체 폭 */}
              <label htmlFor="filter-type" className="sr-only">조회 방식</label>
              <select id="filter-type" value={filterType}
                onChange={e => updateParams({ type: e.target.value, page: "0" })}
                className="w-full sm:w-auto bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-700 font-medium">
                <option value="month">월간 조회</option>
                <option value="range">기간 조회</option>
              </select>

              {filterType === "month" ? (
                /* 월 선택 + 빠른 버튼: 한 줄 flex, 버튼 그룹이 함께 이동 */
                <div className="flex items-center gap-2">
                  <label htmlFor="filter-month" className="sr-only">조회 월</label>
                  <input id="filter-month" type="month" value={filterMonth}
                    onChange={e => updateParams({ month: e.target.value, page: "0" })}
                    className="flex-1 sm:flex-none bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-900 font-semibold min-w-0" />
                  <div className="flex gap-1.5 shrink-0">
                    {[{ label: "이번 달", value: currentYearMonth }, { label: "지난 달", value: prevYearMonth }].map(p => (
                      <button key={p.label} onClick={() => updateParams({ month: p.value, page: "0" })}
                        className={`text-xs px-2.5 py-2 rounded border transition-colors whitespace-nowrap ${focusRing} ${filterMonth === p.value ? "bg-primary-600 text-white border-primary-600" : "bg-surface-50 border-surface-300 text-surface-600 hover:bg-surface-100"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label htmlFor="start-date" className="sr-only">시작일</label>
                  <input id="start-date" type="date" value={startDateLocal}
                    onChange={e => setStartDateLocal(e.target.value)}
                    className="flex-1 sm:flex-none bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-900 min-w-0" />
                  <span aria-hidden className="text-surface-400 text-xs font-medium shrink-0">~</span>
                  <label htmlFor="end-date" className="sr-only">종료일</label>
                  <input id="end-date" type="date" value={endDateLocal}
                    onChange={e => setEndDateLocal(e.target.value)}
                    className="flex-1 sm:flex-none bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-900 min-w-0" />
                </div>
              )}

              {/* 데스크탑 내보내기 (우측 정렬) */}
              <div className="hidden sm:flex items-center gap-2 ml-auto">
                <button onClick={exportRawCSV} disabled={isExporting}
                  aria-label="현재 데이터를 CSV로 내보내기"
                  className={`flex items-center gap-1.5 px-3 py-2 bg-white border border-surface-300 hover:bg-surface-50 text-surface-700 text-sm font-medium rounded transition-colors disabled:opacity-50 ${focusRing}`}>
                  <Download className="w-3.5 h-3.5" aria-hidden />CSV
                </button>
                <button onClick={exportRawXLSX} disabled={isExporting}
                  aria-label="현재 데이터를 Excel로 내보내기"
                  className={`flex items-center gap-1.5 px-3 py-2 bg-surface-700 hover:bg-surface-800 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-surface-500`}>
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden />}
                  Excel
                </button>
              </div>
            </div>

            {/* 섹션 2: 필터 */}
            <div className="border-t border-surface-100 px-3 sm:px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:items-center">
                <span className="sr-only">필터</span>
                <label htmlFor="filter-building" className="sr-only">건물 필터</label>
                <select id="filter-building" value={filterBuildingId}
                  onChange={e => handleBuildingFilterChange(e.target.value)}
                  className="bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-700 w-full sm:w-auto">
                  <option value="">전체 건물</option>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <label htmlFor="filter-dept" className="sr-only">부서 필터</label>
                <select id="filter-dept" value={filterDepartmentId}
                  onChange={e => updateParams({ dept: e.target.value, page: "0" })}
                  className="bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-700 w-full sm:w-auto">
                  <option value="">전체 부서</option>
                  {(filterBuildingId ? departments.filter(d => d.buildingId === filterBuildingId) : departments)
                    .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {inspectorOptions.length > 0 && (
                  <>
                    <label htmlFor="filter-inspector" className="sr-only">점검자 필터</label>
                    <select id="filter-inspector" value={filterInspector}
                      onChange={e => updateParams({ inspector: e.target.value, page: "0" })}
                      className="bg-white border border-surface-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-surface-700 w-full sm:w-auto col-span-2 sm:col-span-1">
                      <option value="">전체 점검자</option>
                      {inspectorOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </>
                )}
                {(filterBuildingId || filterDepartmentId || filterInspector) && (
                  <button onClick={() => updateParams({ building: "", dept: "", inspector: "", page: "0" })}
                    className={`text-xs text-primary-500 hover:text-primary-700 font-medium col-span-2 sm:col-span-1 text-left ${focusRing}`}>
                    필터 초기화
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-surface-400" aria-hidden>조회 결과</span>
                <span className="text-xs text-surface-500 font-mono tabular-nums font-medium" aria-live="polite">
                  {displayRecords.length}건{totalPages > 1 ? ` / ${safePage + 1}/${totalPages} 페이지` : ""}
                </span>
              </div>
            </div>

            {/* 섹션 3: 모바일 내보내기 */}
            <div className="sm:hidden border-t border-surface-100 px-4 py-3 flex gap-2">
              <button onClick={exportRawCSV} disabled={isExporting}
                aria-label="현재 데이터를 CSV로 내보내기"
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-surface-300 hover:bg-surface-50 text-surface-700 text-sm font-medium rounded transition-colors disabled:opacity-50 ${focusRing}`}>
                <Download className="w-4 h-4" aria-hidden />CSV
              </button>
              <button onClick={exportRawXLSX} disabled={isExporting}
                aria-label="현재 데이터를 Excel로 내보내기"
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface-700 hover:bg-surface-800 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-surface-500`}>
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="w-4 h-4" aria-hidden />}
                Excel
              </button>
            </div>
          </div>

          {/* ── 모바일 카드 뷰 ─────────────────────────────────────────── */}
          <div className="sm:hidden space-y-3">
            {paginatedRecords.length === 0 ? (
              <p className="py-8 text-center text-surface-500">선택된 기간에 입력된 점검 데이터가 없습니다.</p>
            ) : paginatedRecords.map(record => {
              const isEditing = editingId === record.id;
              const focusCat  = record.focusCategory ? categories.find(c => c.key === record.focusCategory) : null;
              return (
                <div key={`m-${record.id}`} className="bg-white rounded border border-surface-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-surface-50 border-b border-surface-100">
                    <div className="flex items-center gap-2 text-xs text-surface-500">
                      <span className="font-mono">{record.date.split("T")[0]}</span>
                      <span aria-hidden>·</span>
                      <span>{getBuildingName(record.buildingId)}</span>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-surface-900">{record.departmentName}</span>
                      <span className="text-xl font-bold text-surface-900 font-mono">
                        {record.totalScore}<span className="text-xs font-normal text-surface-400">/{scoreMaxForBand}</span>
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="space-y-3 pt-3 border-t border-surface-100">
                        {/* 점검자 */}
                        <div>
                          <label htmlFor={`m-insp-${record.id}`} className="block text-xs font-medium text-surface-500 mb-1">점검자</label>
                          <input id={`m-insp-${record.id}`} type="text"
                            className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            value={editForm.inspector || ""} onChange={e => setEditForm({ ...editForm, inspector: e.target.value })} />
                        </div>
                        {/* 중점사항 점수 편집 */}
                        {focusCat && (
                          <div className="rounded border border-surface-200 overflow-hidden">
                            <div className="bg-surface-50 px-3 py-2 flex items-center justify-between border-b border-surface-100">
                              <span className="text-xs font-semibold text-surface-600">{focusCat.name}</span>
                              <span className="text-xs font-mono font-bold text-primary-600">
                                {focusCat.subCriteria.reduce((s, sub) =>
                                  s + (editForm.subScores?.[`${focusCat.key}_${sub.key}`] ?? 0), 0)}/{focusCat.max}점
                              </span>
                            </div>
                            <div className="px-3 py-2 space-y-2">
                              {focusCat.subCriteria.map(sub => {
                                const scoreKey = `${focusCat.key}_${sub.key}`;
                                const val = editForm.subScores?.[scoreKey] ?? record.subScores?.[scoreKey] ?? 0;
                                return (
                                  <div key={sub.key} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-surface-600 flex-1">{sub.name}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <input type="number" min={0} max={sub.max}
                                        className="w-12 px-1.5 py-1 text-xs font-mono border border-surface-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-center"
                                        value={val}
                                        onChange={e => updateSubScore(scoreKey, Math.min(sub.max, Math.max(0, Number(e.target.value))))}
                                      />
                                      <span className="text-xs text-surface-400">/{sub.max}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {/* 특이사항 */}
                        <div>
                          <label htmlFor={`m-notes-${record.id}`} className="block text-xs font-medium text-surface-500 mb-1">칭찬 및 지적사항</label>
                          <textarea id={`m-notes-${record.id}`} rows={2}
                            className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                            value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(record.id)}
                            className={`flex-1 py-2.5 bg-primary-600 text-white rounded text-sm font-semibold hover:bg-primary-700 ${focusRing}`}>저장</button>
                          <button onClick={cancelEdit}
                            className={`flex-1 py-2.5 bg-surface-100 text-surface-700 rounded text-sm font-medium hover:bg-surface-200 ${focusRing}`}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-surface-600">점검자: <span className="font-medium text-surface-900">{record.inspector || "—"}</span></p>
                        {focusCat && (
                          <p className="text-xs text-surface-600 bg-surface-50 border border-surface-200 rounded px-2 py-1">
                            중점: {focusCat.name} · {record.totalScore}/{focusCat.max}점
                          </p>
                        )}
                        {record.notes && (
                          <p className="text-sm text-surface-600 bg-surface-50 rounded px-3 py-2 break-words">{record.notes}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          {pendingDeleteId === record.id ? (
                            <>
                              <span className="text-xs text-surface-500 self-center mr-1" role="status">삭제할까요?</span>
                              <button onClick={() => softDeleteRecord(record.id)}
                                aria-label={`${record.departmentName} 점검 기록 삭제 확인`}
                                className={`flex-1 py-2.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500`}>확인</button>
                              <button onClick={() => setPendingDeleteId(null)}
                                className={`flex-1 py-2.5 bg-surface-100 text-surface-700 rounded text-sm font-medium hover:bg-surface-200 ${focusRing}`}>취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(record)}
                                aria-label={`${record.departmentName} 점검 기록 수정`}
                                className={`flex-1 py-2.5 bg-white text-surface-700 border border-surface-200 rounded text-sm font-medium hover:bg-surface-50 ${focusRing}`}>수정</button>
                              <button onClick={() => setPendingDeleteId(record.id)}
                                aria-label={`${record.departmentName} 점검 기록 삭제`}
                                className={`flex-1 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400`}>삭제</button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 데스크탑 테이블 ────────────────────────────────────────── */}
          <div className="hidden sm:block bg-white rounded border border-surface-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-50 text-surface-600 border-b border-surface-200 sticky top-0 z-10">
                  <tr>
                    {([
                      { key: "date",           label: "점검일" },
                      { key: "buildingName",   label: "소속 건물" },
                      { key: "departmentName", label: "부서명" },
                      { key: "inspector",      label: "점검자" },
                    ] as { key: RawSortKey; label: string }[]).map(col => (
                      <th key={col.key} scope="col"
                        aria-sort={rawSortAttr(col.key)}
                        onClick={() => handleRawSort(col.key)}
                        className="py-3 px-4 font-semibold cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap">
                        {col.label}<RawSortIcon k={col.key} />
                      </th>
                    ))}
                    <th scope="col" className="py-3 px-4 font-semibold text-center whitespace-nowrap bg-teal-50 text-teal-700">중점사항</th>
                    <th scope="col" className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setShowCategoryColumns(p => !p)}
                        aria-expanded={showCategoryColumns}
                        aria-controls="category-cols"
                        title={showCategoryColumns ? "카테고리 점수 숨기기" : "카테고리 점수 펼치기"}
                        className={`inline-flex items-center gap-0.5 text-xs font-semibold text-surface-400 hover:text-surface-700 transition-colors rounded ${focusRing}`}>
                        카테고리
                        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${showCategoryColumns ? "rotate-90" : ""}`} aria-hidden />
                      </button>
                    </th>
                    {showCategoryColumns && categories.map(c => (
                      <th key={c.key} scope="col" id={`col-${c.key}`}
                        aria-sort={rawSortAttr(c.key as RawSortKey)}
                        onClick={() => handleRawSort(c.key as RawSortKey)}
                        className="py-3 px-4 font-semibold text-center cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap">
                        {c.name}<RawSortIcon k={c.key as RawSortKey} />
                      </th>
                    ))}
                    {([
                      { key: "totalScore", label: "총점" },
                      { key: "status",     label: "상태" },
                    ] as { key: RawSortKey; label: string }[]).map(col => (
                      <th key={col.key} scope="col"
                        aria-sort={rawSortAttr(col.key)}
                        onClick={() => handleRawSort(col.key)}
                        className="py-3 px-4 font-semibold text-center cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap">
                        {col.label}<RawSortIcon k={col.key} />
                      </th>
                    ))}
                    <th scope="col" className="py-3 px-4 font-semibold min-w-[220px] max-w-[320px]">특이사항</th>
                    <th scope="col" className="py-3 px-4 font-semibold text-right">관리</th>
                  </tr>
                </thead>
                <tbody id="category-cols" className="divide-y divide-surface-100">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={rawColCount} className="py-8 text-center text-surface-500">
                        선택된 기간에 입력된 점검 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : paginatedRecords.map(record => {
                    const isEditing    = editingId === record.id;
                    const focusCat     = record.focusCategory ? categories.find(c => c.key === record.focusCategory) : null;
                    const hasSubScores = record.subScores && Object.keys(record.subScores).length > 0;
                    return (
                      <tr key={record.id} className="hover:bg-surface-50 group align-top">
                        <td className="py-3 px-4 text-surface-600 whitespace-nowrap">{record.date.split("T")[0]}</td>
                        <td className="py-3 px-4 text-surface-900 whitespace-nowrap">{getBuildingName(record.buildingId)}</td>
                        <td className="py-3 px-4 text-surface-900 font-medium whitespace-nowrap">{record.departmentName}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <label htmlFor={`td-insp-${record.id}`} className="sr-only">점검자</label>
                              <input id={`td-insp-${record.id}`} type="text"
                                className="w-24 px-2 py-1 text-sm border border-surface-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                value={editForm.inspector || ""} onChange={e => setEditForm({ ...editForm, inspector: e.target.value })} />
                            </>
                          ) : record.inspector}
                        </td>

                        {/* 중점사항 */}
                        <td className="py-3 px-4 min-w-[200px]">
                          {focusCat ? (
                            <div className="rounded border border-surface-200 overflow-hidden">
                              <div className="flex items-center justify-between px-2.5 py-1.5 bg-surface-50 border-b border-surface-100">
                                <span className="text-[11px] font-semibold text-surface-700 whitespace-nowrap">{focusCat.name}</span>
                                <span className="text-[11px] font-bold font-mono text-primary-600 whitespace-nowrap">
                                  {isEditing
                                    ? (focusCat.subCriteria.reduce((s, sub) =>
                                        s + (editForm.subScores?.[`${focusCat.key}_${sub.key}`] ?? 0), 0))
                                    : record.totalScore}/{focusCat.max}점
                                </span>
                              </div>
                              <div className="px-2.5 py-2 space-y-1.5">
                                {hasSubScores ? (
                                  focusCat.subCriteria.map(sub => {
                                    const scoreKey = `${focusCat.key}_${sub.key}`;
                                    const val = record.subScores![scoreKey];
                                    return (
                                      <div key={sub.key} className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-surface-500 w-14 shrink-0 truncate">{sub.name}</span>
                                        {isEditing ? (
                                          <>
                                            <input type="number" min={0} max={sub.max}
                                              className="w-10 px-1 py-0.5 text-[11px] font-mono border border-surface-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-center"
                                              value={editForm.subScores?.[scoreKey] ?? val ?? 0}
                                              onChange={e => updateSubScore(scoreKey, Math.min(sub.max, Math.max(0, Number(e.target.value))))}
                                            />
                                            <span className="text-[11px] text-surface-400">/{sub.max}</span>
                                          </>
                                        ) : (
                                          <>
                                            <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden min-w-[28px]"
                                              role="progressbar" aria-valuenow={val} aria-valuemin={0} aria-valuemax={sub.max} aria-label={`${sub.name} 점수`}>
                                              <div className="h-full bg-primary-400 rounded-full"
                                                style={{ width: val != null ? `${(val / sub.max) * 100}%` : "0%" }} />
                                            </div>
                                            <span className="text-[11px] font-mono text-surface-600 font-semibold whitespace-nowrap">{val ?? "—"}/{sub.max}</span>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-[11px] text-surface-400">세부항목 없음 — 재입력 필요</p>
                                )}
                              </div>
                            </div>
                          ) : <span className="text-surface-300 text-xs" aria-label="중점사항 없음">—</span>}
                        </td>

                        {/* 카테고리 토글 placeholder */}
                        <td className="py-3 px-4 text-center text-surface-300 text-xs" aria-hidden>
                          {showCategoryColumns ? null : "—"}
                        </td>

                        {/* 카테고리 점수 열 — 편집 중에도 읽기 전용 표시 */}
                        {showCategoryColumns && categories.map(c => (
                          <td key={c.key} className="py-3 px-4 text-center" headers={`col-${c.key}`}>
                            <span className={scoreBand(record.scores?.[c.key as keyof RecordDoc["scores"]], 10)}>
                              {record.scores?.[c.key as keyof RecordDoc["scores"]] || 0}
                            </span>
                          </td>
                        ))}

                        <td className="py-3 px-4 text-center font-mono">
                          <span className={scoreBand(record.totalScore, scoreMaxForBand)}>
                            {record.totalScore}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="py-3 px-4 whitespace-normal min-w-[220px] max-w-[320px]">
                          {isEditing ? (
                            <>
                              <label htmlFor={`td-notes-${record.id}`} className="sr-only">특이사항</label>
                              <input id={`td-notes-${record.id}`} type="text"
                                className="w-full px-2 py-1 text-sm border border-surface-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                            </>
                          ) : <span className="break-words text-sm text-surface-700">{record.notes}</span>}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => saveEdit(record.id)}
                                className={`px-3 py-1.5 min-h-[36px] bg-primary-600 text-white rounded text-xs hover:bg-primary-700 ${focusRing}`}>저장</button>
                              <button onClick={cancelEdit}
                                className={`px-3 py-1.5 min-h-[36px] bg-surface-200 text-surface-700 rounded text-xs hover:bg-surface-300 ${focusRing}`}>취소</button>
                            </div>
                          ) : pendingDeleteId === record.id ? (
                            <div className="flex justify-end gap-1.5 items-center">
                              <span className="text-xs text-surface-400" role="status">삭제할까요?</span>
                              <button onClick={() => softDeleteRecord(record.id)}
                                aria-label={`${record.departmentName} 점검 기록 삭제 확인`}
                                className={`px-3 py-1.5 min-h-[36px] bg-red-600 text-white rounded text-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500`}>확인</button>
                              <button onClick={() => setPendingDeleteId(null)}
                                className={`px-3 py-1.5 min-h-[36px] bg-surface-200 text-surface-700 rounded text-xs hover:bg-surface-300 ${focusRing}`}>취소</button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2 items-center">
                              <button onClick={() => startEdit(record)}
                                aria-label={`${record.departmentName} 점검 기록 수정`}
                                className={`px-3 py-1.5 min-h-[36px] text-surface-700 bg-white border border-surface-200 rounded text-xs hover:bg-surface-50 ${focusRing}`}>수정</button>
                              <button onClick={() => setPendingDeleteId(record.id)}
                                aria-label={`${record.departmentName} 점검 기록 삭제`}
                                className={`px-3 py-1.5 min-h-[36px] text-red-600 bg-white border border-surface-200 rounded text-xs hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400`}>삭제</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 페이지네이션 ───────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-surface-400 font-mono" aria-live="polite">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, displayRecords.length)} / {displayRecords.length}건
              </span>
              <nav aria-label="페이지 탐색" className="flex items-center gap-1">
                <button onClick={() => updateParams({ page: String(safePage - 1) })}
                  disabled={safePage === 0} aria-label="이전 페이지"
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-surface-200 text-surface-600 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`}>
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i)
                  .slice(Math.max(0, safePage - 2), Math.min(totalPages, safePage + 3))
                  .map(i => (
                    <button key={i} onClick={() => updateParams({ page: String(i) })}
                      aria-label={`${i + 1}페이지`} aria-current={safePage === i ? "page" : undefined}
                      className={`min-h-[44px] min-w-[44px] rounded text-xs font-medium ${focusRing} ${
                        safePage === i
                          ? "bg-primary-600 text-white"
                          : "border border-surface-200 text-surface-600 hover:bg-surface-100"
                      }`}>{i + 1}</button>
                  ))}
                <button onClick={() => updateParams({ page: String(safePage + 1) })}
                  disabled={safePage >= totalPages - 1} aria-label="다음 페이지"
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-surface-200 text-surface-600 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`}>
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </button>
              </nav>
            </div>
          )}
        </div>

      /* ════════════════ AGGREGATE 탭 ════════════════ */
      ) : (
        <div id="panel-aggregate" role="tabpanel" aria-labelledby="tab-aggregate" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-50 p-4 rounded border border-surface-200">
            <div className="flex items-center gap-3">
              <label htmlFor="filter-year" className="text-sm font-semibold text-surface-700">조회 연도</label>
              <select id="filter-year" value={filterYear}
                onChange={e => updateParams({ year: e.target.value })}
                className="bg-white border border-surface-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold">
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = (new Date().getFullYear() - 2 + i).toString();
                  return <option key={y} value={y}>{y}년</option>;
                })}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportAggregateCSV} disabled={isExporting}
                aria-label="집계 데이터를 CSV로 내보내기"
                className={`flex items-center gap-2 px-3 py-2 bg-white border border-surface-300 hover:bg-surface-50 text-surface-700 text-sm font-medium rounded transition-colors disabled:opacity-50 ${focusRing}`}>
                <Download className="w-4 h-4" aria-hidden />CSV
              </button>
              <button onClick={exportAggregateXLSX} disabled={isExporting}
                aria-label="집계 데이터를 Excel로 내보내기"
                className={`flex items-center gap-2 px-3 py-2 bg-surface-700 hover:bg-surface-800 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-surface-500`}>
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="w-4 h-4" aria-hidden />}
                Excel
              </button>
            </div>
          </div>

          {/* 집계 모바일 카드 */}
          <div className="sm:hidden space-y-2">
            {aggregateData.length === 0 ? (
              <p className="py-8 text-center text-surface-500 bg-white rounded border border-surface-200">
                {filterYear}년에 등록된 점검 데이터가 없습니다.
              </p>
            ) : aggregateData.map(row => (
              <div key={row.departmentId} className="bg-white rounded border border-surface-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-surface-50 border-b border-surface-100">
                  <span className="font-semibold text-surface-900 text-sm">{row.departmentName}</span>
                  <span className={`font-bold font-mono text-sm ${scoreBand(row.yearlyAvg, scoreMaxForBand)}`}>
                    연평균 {row.yearlyAvg ?? "—"}
                  </span>
                </div>
                <div className="grid grid-cols-4 divide-x divide-y divide-surface-100">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                    const val = row[`m${m}`];
                    return (
                      <div key={m} className="px-2 py-2 text-center">
                        <p className="text-[10px] text-surface-400 mb-0.5">{m}월</p>
                        {val !== null
                          ? <span className={`text-xs font-mono font-semibold ${scoreBand(val, scoreMaxForBand)}`}>{val}</span>
                          : <span className="text-xs text-surface-300">-</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 집계 데스크탑 테이블 */}
          <div className="hidden sm:block bg-white rounded border border-surface-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-50 text-surface-600 border-b border-surface-200 sticky top-0 z-10">
                  <tr>
                    <th scope="col"
                      aria-sort={aggSortAttr("departmentName")}
                      onClick={() => handleAggSort("departmentName")}
                      className="py-3 px-4 font-semibold sticky left-0 bg-surface-50 z-10 w-48 shadow-[1px_0_0_0_#e5e7eb] cursor-pointer hover:bg-surface-100 select-none">
                      부서명<AggSortIcon k="departmentName" />
                    </th>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <th key={m} scope="col"
                        aria-sort={aggSortAttr(`m${m}` as AggSortKey)}
                        onClick={() => handleAggSort(`m${m}` as AggSortKey)}
                        className="py-3 px-4 font-semibold text-center border-l border-surface-100 cursor-pointer hover:bg-surface-100 select-none">
                        {m}월<AggSortIcon k={`m${m}` as AggSortKey} />
                      </th>
                    ))}
                    <th scope="col"
                      aria-sort={aggSortAttr("yearlyAvg")}
                      onClick={() => handleAggSort("yearlyAvg")}
                      className="py-3 px-4 font-semibold text-center bg-surface-100 border-l border-surface-200 cursor-pointer hover:bg-surface-200 select-none">
                      연간 평균<AggSortIcon k="yearlyAvg" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {aggregateData.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-8 text-center text-surface-500">
                        {filterYear}년에 등록된 점검 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : aggregateData.map(row => (
                    <tr key={row.departmentId} className="hover:bg-surface-50">
                      <td className="py-2 px-4 font-medium text-surface-900 sticky left-0 bg-white shadow-[1px_0_0_0_#e5e7eb]">
                        {row.departmentName}
                      </td>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                        const val = row[`m${m}`];
                        return (
                          <td key={m} className="py-2 px-4 text-center border-l border-surface-50 font-mono">
                            {val !== null ? (
                              <span className={scoreBand(val, scoreMaxForBand)}>
                                {val}
                              </span>
                            ) : <span className="text-surface-300" aria-label="데이터 없음">-</span>}
                          </td>
                        );
                      })}
                      {/* CSS 버그 수정: block/flex/min-h 제거 */}
                      <td className="py-2 px-4 text-center font-bold text-surface-800 bg-surface-50/50 border-l border-surface-100 font-mono">
                        {row.yearlyAvg !== null ? row.yearlyAvg : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

