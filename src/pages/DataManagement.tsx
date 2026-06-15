import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { useToast } from "@/src/components/ui/Toast";
import { supabase } from "@/src/lib/supabase";
import { liveQuery, rowToRecord, computeStatus, CategoryScores } from "@/src/lib/db";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import { Download, CalendarDays, BarChart2, ArrowUp, ArrowDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { SkeletonTableRows } from "@/src/components/ui/Skeleton";
import { downloadExcel } from "@/src/lib/excel";

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
  const { categories, categoryName } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allRecords, setAllRecords] = useState<RecordDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"raw" | "aggregate">("raw");

  // Filter State (Raw)
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const [filterType, setFilterType] = useState<"month" | "range">("month");
  const [filterMonth, setFilterMonth] = useState(currentYearMonth);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Filter State (Aggregate)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  // Filter State (Building / Department) — reads from URL params on first load
  const [filterBuildingId, setFilterBuildingId] = useState(() => searchParams.get("building") || "");
  const [filterDepartmentId, setFilterDepartmentId] = useState(() => searchParams.get("dept") || "");

  const handleBuildingFilterChange = (bid: string) => {
    setFilterBuildingId(bid);
    setFilterDepartmentId("");
  };

  // Column visibility
  const [showCategoryColumns, setShowCategoryColumns] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RecordDoc>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sort State (Raw)
  type RawSortKey = 'date' | 'buildingName' | 'departmentName' | 'inspector' | 'greeting' | 'response' | 'phone' | 'appearance' | 'environment' | 'totalScore' | 'status';
  const [rawSortConfig, setRawSortConfig] = useState<{key: RawSortKey, direction: 'asc' | 'desc'} | null>(null);

  const handleRawSort = (key: RawSortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (rawSortConfig && rawSortConfig.key === key && rawSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setRawSortConfig({ key, direction });
  };

  // Sort State (Aggregate)
  type AggSortKey = 'departmentName' | 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'm8' | 'm9' | 'm10' | 'm11' | 'm12' | 'yearlyAvg';
  const [aggSortConfig, setAggSortConfig] = useState<{key: AggSortKey, direction: 'asc' | 'desc'} | null>({key: 'yearlyAvg', direction: 'desc'});

  const handleAggSort = (key: AggSortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (aggSortConfig && aggSortConfig.key === key && aggSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setAggSortConfig({ key, direction });
  };

  useEffect(() => {
    setIsLoading(true);
    let isMounted = true;
    
    let startOfDay = "";
    let endOfDay = "";

    if (activeTab === "aggregate") {
      startOfDay = `${filterYear}-01-01T00:00:00`;
      endOfDay = `${filterYear}-12-31T23:59:59.999Z`;
    } else {
      if (filterType === "month") {
        startOfDay = `${filterMonth}-01T00:00:00`;
        const year = parseInt(filterMonth.split("-")[0]);
        let month = parseInt(filterMonth.split("-")[1]) + 1;
        let nextYear = year;
        if (month > 12) {
          month = 1;
          nextYear = year + 1;
        }
        endOfDay = `${nextYear}-${String(month).padStart(2, "0")}-01T00:00:00`;
      } else {
        startOfDay = `${startDate}T00:00:00`;
        endOfDay = `${endDate}T23:59:59.999Z`;
      }
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
      (rows) => {
        if (isMounted) {
          setAllRecords(rows.map(rowToRecord) as RecordDoc[]);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("데이터 로딩 오류:", error);
        if (isMounted) setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeTab, filterType, filterMonth, startDate, endDate, filterYear]);

  const getBuildingName = (id: string) => buildings.find(b => b.id === id)?.name || id;

  // Computed: Display Records (Raw)
  const displayRecords = useMemo(() => {
    let filtered = allRecords.filter(r => {
      if (hiddenIds.has(r.id)) return false;
      const d = r.date.split("T")[0];
      const inRange = filterType === "month" ? d.startsWith(filterMonth) : d >= startDate && d <= endDate;
      if (!inRange) return false;
      if (filterBuildingId && r.buildingId !== filterBuildingId) return false;
      if (filterDepartmentId && r.departmentId !== filterDepartmentId) return false;
      return true;
    });

    if (rawSortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        if (rawSortConfig.key === 'buildingName') {
          aValue = getBuildingName(a.buildingId);
          bValue = getBuildingName(b.buildingId);
        } else if (['greeting', 'response', 'phone', 'appearance', 'environment'].includes(rawSortConfig.key)) {
          aValue = a.scores?.[rawSortConfig.key as keyof RecordDoc['scores']] ?? 0;
          bValue = b.scores?.[rawSortConfig.key as keyof RecordDoc['scores']] ?? 0;
        } else {
          aValue = a[rawSortConfig.key as keyof RecordDoc];
          bValue = b[rawSortConfig.key as keyof RecordDoc];
        }
        if (aValue < bValue) return rawSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return rawSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // 기본 정렬: 건물 순서 → 부서 순서 → 날짜 내림차순
      filtered.sort((a, b) => {
        const bOrd = buildings.findIndex(x => x.id === a.buildingId) - buildings.findIndex(x => x.id === b.buildingId);
        if (bOrd !== 0) return bOrd;
        const dOrd = departments.findIndex(x => x.id === a.departmentId) - departments.findIndex(x => x.id === b.departmentId);
        if (dOrd !== 0) return dOrd;
        return b.date.localeCompare(a.date);
      });
    }

    return filtered;
  }, [allRecords, filterType, filterMonth, startDate, endDate, filterBuildingId, filterDepartmentId, rawSortConfig, buildings, departments, hiddenIds]);

  // Computed: Aggregate Data
  const aggregateData = useMemo(() => {
    const deptStats: Record<string, { id: string, name: string, months: Record<number, {total: number, count: number}> }> = {};
    
    departments.forEach(d => {
      deptStats[d.id] = { id: d.id, name: d.name, months: {} };
    });
    
    allRecords.forEach(r => {
      if (!r.date.startsWith(filterYear)) return;
      if (!deptStats[r.departmentId]) {
        deptStats[r.departmentId] = { id: r.departmentId, name: r.departmentName, months: {} };
      }
      
      const parts = r.date.split("-");
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10);
        if (!deptStats[r.departmentId].months[m]) {
          deptStats[r.departmentId].months[m] = { total: 0, count: 0 };
        }
        deptStats[r.departmentId].months[m].total += r.totalScore;
        deptStats[r.departmentId].months[m].count += 1;
      }
    });
    
    let resultArr = Object.values(deptStats).map(dept => {
      const result: any = { departmentId: dept.id, departmentName: dept.name };
      let yearlyTotal = 0;
      let yearlyCount = 0;
      for (let i = 1; i <= 12; i++) {
        if (dept.months[i] && dept.months[i].count > 0) {
          const avg = dept.months[i].total / dept.months[i].count;
          result[`m${i}`] = Math.round(avg * 10) / 10;
          yearlyTotal += dept.months[i].total;
          yearlyCount += dept.months[i].count;
        } else {
          result[`m${i}`] = null;
        }
      }
      result.yearlyAvg = yearlyCount > 0 ? Math.round((yearlyTotal / yearlyCount) * 10) / 10 : null;
      return result;
    });

    if (aggSortConfig) {
      resultArr.sort((a, b) => {
        let aValue = a[aggSortConfig.key];
        let bValue = b[aggSortConfig.key];

        if (aValue === null && bValue !== null) return 1;
        if (aValue !== null && bValue === null) return -1;
        if (aValue === null && bValue === null) return 0;

        if (aValue < bValue) {
          return aggSortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return aggSortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return resultArr;
  }, [allRecords, filterYear, departments, aggSortConfig]);

  // Export handlers
  const exportRawCSV = () => {
    const headers = ["점검일", "소속 건물", "부서명", "점검자", ...categories.map(c => c.name), "총점", "상태", "특이사항"];
    const rows = displayRecords.map(r => [
      r.date.split("T")[0],
      getBuildingName(r.buildingId) || "",
      r.departmentName || "",
      r.inspector || "",
      ...categories.map(c => r.scores?.[c.key as keyof typeof r.scores] ?? 0),
      r.totalScore ?? 0,
      r.status || "",
      `"${(r.notes || "").replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `점검데이터_${filterType === 'month' ? filterMonth : `${startDate}_${endDate}`}.csv`;
    link.click();
  };

  const exportRawXLSX = () => {
    const headers = ["점검일", "소속 건물", "부서명", "점검자", ...categories.map(c => c.name), "총점", "상태", "특이사항"];
    const rows = displayRecords.map(r => [
      r.date.split("T")[0],
      getBuildingName(r.buildingId),
      r.departmentName,
      r.inspector,
      ...categories.map(c => r.scores?.[c.key as keyof typeof r.scores] ?? 0),
      r.totalScore,
      r.status,
      r.notes || "",
    ]);
    const label = filterType === "month" ? filterMonth : `${startDate}_${endDate}`;
    downloadExcel([{ headers, rows, sheetName: "점검내역" }], `점검데이터_${label}.xlsx`);
  };

  const exportAggregateXLSX = () => {
    const headers = ["부서명", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월", "연간 평균"];
    const rows = aggregateData.map(row => [
      row.departmentName,
      row.m1, row.m2, row.m3, row.m4, row.m5, row.m6,
      row.m7, row.m8, row.m9, row.m10, row.m11, row.m12,
      row.yearlyAvg,
    ]);
    downloadExcel([{ headers, rows, sheetName: `${filterYear}년 집계` }], `부서별_월별_점수표_${filterYear}년.xlsx`);
  };

  const exportAggregateCSV = () => {
    const headers = ["부서명", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월", "연간 평균"];
    const rows = aggregateData.map(row => [
      row.departmentName,
      row.m1 ?? "", row.m2 ?? "", row.m3 ?? "", row.m4 ?? "", row.m5 ?? "", row.m6 ?? "",
      row.m7 ?? "", row.m8 ?? "", row.m9 ?? "", row.m10 ?? "", row.m11 ?? "", row.m12 ?? "",
      row.yearlyAvg ?? ""
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `부서별_월별_점수표_${filterYear}년.csv`;
    link.click();
  };

  const renderRawSortIcon = (key: RawSortKey) => {
    if (rawSortConfig?.key !== key) return <span className="w-3 inline-block" />;
    return rawSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1 text-primary-500"/> : <ArrowDown className="w-3 h-3 inline ml-1 text-primary-500"/>;
  };

  const renderAggSortIcon = (key: AggSortKey) => {
    if (aggSortConfig?.key !== key) return <span className="w-3 inline-block" />;
    return aggSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1 text-primary-500"/> : <ArrowDown className="w-3 h-3 inline ml-1 text-primary-500"/>;
  };

  // Editing logic
  const startEdit = (record: RecordDoc) => {
    setEditingId(record.id);
    setEditForm({ ...record });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const emptyScores: CategoryScores = { greeting: 0, response: 0, phone: 0, appearance: 0, environment: 0 };

  const handleScoreChange = (type: keyof RecordDoc['scores'], value: string) => {
    const num = parseInt(value) || 0;
    const clamped = Math.min(Math.max(num, 0), 10);

    setEditForm(prev => {
      const newScores = { ...emptyScores, ...prev.scores, [type]: clamped } as CategoryScores;
      const totalScore = newScores.greeting + newScores.response + newScores.phone + newScores.appearance + newScores.environment;
      const status = computeStatus(newScores, prev.notes || "");
      return { ...prev, scores: newScores, totalScore, status };
    });
  };

  const handleNotesChange = (value: string) => {
    setEditForm(prev => {
      const scores = { ...emptyScores, ...prev.scores } as CategoryScores;
      const status = computeStatus(scores, value);
      return { ...prev, notes: value, status };
    });
  };

  const saveEdit = async (id: string) => {
    if (!editForm || !id) return;
    try {
      const s = { ...emptyScores, ...editForm.scores } as CategoryScores;
      const { error } = await supabase
        .from("kc_records")
        .update({
          inspector: editForm.inspector,
          greeting: s.greeting,
          response: s.response,
          phone: s.phone,
          appearance: s.appearance,
          environment: s.environment,
          total_score: editForm.totalScore,
          notes: editForm.notes,
          status: editForm.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      setEditingId(null);
    } catch (error) {
      console.error("저장 오류:", error);
      toast("수정 저장 중 오류가 발생했습니다.", "error");
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase.from("kc_records").delete().eq("id", id);
      if (error) throw error;
    } catch (error) {
      console.error("삭제 오류:", error);
      setHiddenIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast("삭제 중 오류가 발생했습니다.", "error");
    }
  };

  const softDeleteRecord = (id: string) => {
    setPendingDeleteId(null);
    setHiddenIds(prev => new Set([...prev, id]));
    const timer = setTimeout(() => {
      undoTimers.current.delete(id);
      setHiddenIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      deleteRecord(id);
    }, 5000);
    undoTimers.current.set(id, timer);
    toast("점검 기록이 삭제되었습니다.", "success", {
      label: "실행취소",
      onClick: () => {
        const t = undoTimers.current.get(id);
        if (t) { clearTimeout(t); undoTimers.current.delete(id); }
        setHiddenIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      },
    });
  };

  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <div className="h-8 w-56 bg-surface-200 rounded motion-safe:animate-pulse mb-2" />
          <div className="h-4 w-80 bg-surface-100 rounded motion-safe:animate-pulse" />
        </div>
        <div className="flex gap-4 border-b border-surface-200 pb-0">
          <div className="h-10 w-28 bg-surface-100 rounded-t motion-safe:animate-pulse" />
          <div className="h-10 w-36 bg-surface-100 rounded-t motion-safe:animate-pulse" />
        </div>
        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-3">
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-surface-200 rounded-lg motion-safe:animate-pulse" />
            <div className="h-9 w-36 bg-surface-200 rounded-lg motion-safe:animate-pulse" />
          </div>
          <div className="flex gap-2 pt-1 border-t border-surface-200">
            <div className="h-8 w-28 bg-surface-200 rounded-lg motion-safe:animate-pulse" />
            <div className="h-8 w-28 bg-surface-200 rounded-lg motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 border-b border-surface-200">
              <tr>
                {["점검일","건물","부서","점검자","중점사항","총점","상태","특이사항","관리"].map(h => (
                  <th key={h} className="py-3 px-4 font-semibold text-surface-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SkeletonTableRows rows={8} cols={9} />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900 border-l-4 border-primary-500 pl-3">점검 데이터 관리</h1>
          <p className="text-surface-500 text-sm mt-1">상세 점검 내역을 관리하고 연간/월별 점수표를 확인하세요.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-surface-200">
        <button
          onClick={() => setActiveTab("raw")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "raw" ? "border-primary-500 text-primary-600" : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          상세 점검 내역
        </button>
        <button
          onClick={() => setActiveTab("aggregate")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "aggregate" ? "border-primary-500 text-primary-600" : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          부서별 월간/연간 점수표
        </button>
      </div>

      {activeTab === "raw" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 bg-surface-50 p-4 rounded-xl border border-surface-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center flex-wrap gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as "month" | "range")}
                  className="bg-white border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-surface-700 font-medium"
                >
                  <option value="month">월간 조회</option>
                  <option value="range">기간 조회</option>
                </select>

                {filterType === "month" ? (
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="bg-white border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-surface-900 font-medium"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-surface-900"
                    />
                    <span className="text-surface-500">~</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border border-surface-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-surface-900"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportRawCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-surface-300 hover:bg-surface-50 text-surface-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={exportRawXLSX}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
              </div>
            </div>

            {/* 건물/부서 필터 */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-200">
              <span className="text-xs font-semibold text-surface-500 mr-1">필터</span>
              <select
                value={filterBuildingId}
                onChange={(e) => handleBuildingFilterChange(e.target.value)}
                className="bg-white border border-surface-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-surface-700"
              >
                <option value="">전체 건물</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select
                value={filterDepartmentId}
                onChange={(e) => setFilterDepartmentId(e.target.value)}
                className="bg-white border border-surface-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-surface-700"
              >
                <option value="">전체 부서</option>
                {(filterBuildingId
                  ? departments.filter(d => d.buildingId === filterBuildingId)
                  : departments
                ).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {(filterBuildingId || filterDepartmentId) && (
                <button
                  onClick={() => { setFilterBuildingId(""); setFilterDepartmentId(""); }}
                  className="text-xs text-surface-400 hover:text-surface-700 underline"
                >
                  필터 초기화
                </button>
              )}
              <span className="ml-auto text-xs text-surface-400 font-mono">{displayRecords.length}건</span>
            </div>
          </div>

          {/* Mobile Card View (< sm = 640px) */}
          <div className="sm:hidden space-y-3">
            {displayRecords.length === 0 ? (
              <p className="py-8 text-center text-surface-500">선택된 기간에 입력된 점검 데이터가 없습니다.</p>
            ) : displayRecords.map(record => {
              const isEditing = editingId === record.id;
              const focusCat = record.focusCategory ? categories.find(c => c.key === record.focusCategory) : null;
              return (
                <div key={`m-${record.id}`} className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-surface-50 border-b border-surface-100">
                    <div className="flex items-center gap-2 text-xs text-surface-500">
                      <span className="font-mono">{record.date.split("T")[0]}</span>
                      <span>·</span>
                      <span>{getBuildingName(record.buildingId)}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      record.status === '정상' ? 'bg-green-100 text-green-700' :
                      record.status === '주의' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>{record.status}</span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-surface-900">{record.departmentName}</span>
                      <span className="text-xl font-bold text-surface-900 font-mono">
                        {record.totalScore}<span className="text-xs font-normal text-surface-400">/50</span>
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2 pt-2 border-t border-surface-100">
                        <div>
                          <label className="text-xs font-medium text-surface-500">점검자</label>
                          <input
                            type="text"
                            className="w-full mt-0.5 px-3 py-2 text-sm border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={editForm.inspector || ""}
                            onChange={(e) => setEditForm({ ...editForm, inspector: e.target.value })}
                          />
                        </div>
                        {categories.map(c => (
                          <div key={c.key} className="flex items-center justify-between">
                            <label className="text-sm text-surface-600">{c.name}</label>
                            <input
                              type="number" min="0" max="10"
                              className="w-16 px-2 py-1.5 text-center text-sm border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                              value={editForm.scores?.[c.key as keyof RecordDoc['scores']] ?? 0}
                              onChange={(e) => handleScoreChange(c.key as keyof RecordDoc['scores'], e.target.value)}
                            />
                          </div>
                        ))}
                        <div>
                          <label className="text-xs font-medium text-surface-500">특이사항</label>
                          <input
                            type="text"
                            className="w-full mt-0.5 px-3 py-2 text-sm border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={editForm.notes || ""}
                            onChange={(e) => handleNotesChange(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => saveEdit(record.id)} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">저장</button>
                          <button onClick={cancelEdit} className="flex-1 py-2.5 bg-surface-100 text-surface-700 rounded-lg text-sm font-medium hover:bg-surface-200">취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-surface-600">점검자: <span className="font-medium text-surface-900">{record.inspector || "—"}</span></p>
                        {focusCat && (
                          <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-md px-2 py-1">
                            중점: {focusCat.name} · {record.totalScore}/{focusCat.max}점
                          </p>
                        )}
                        {record.notes && (
                          <p className="text-sm text-surface-600 bg-surface-50 rounded-md px-3 py-2 break-words">{record.notes}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          {pendingDeleteId === record.id ? (
                            <>
                              <span className="text-xs text-surface-500 self-center mr-1">삭제할까요?</span>
                              <button onClick={() => softDeleteRecord(record.id)} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">확인</button>
                              <button onClick={() => setPendingDeleteId(null)} className="flex-1 py-2.5 bg-surface-100 text-surface-700 rounded-lg text-sm font-medium hover:bg-surface-200">취소</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(record)}
                                aria-label={`${record.departmentName} 점검 기록 수정`}
                                className="flex-1 py-2.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg text-sm font-medium hover:bg-primary-100"
                              >수정</button>
                              <button
                                onClick={() => setPendingDeleteId(record.id)}
                                aria-label={`${record.departmentName} 점검 기록 삭제`}
                                className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100"
                              >삭제</button>
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

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-50 text-surface-600 border-b border-surface-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap" onClick={() => handleRawSort('date')}>점검일{renderRawSortIcon('date')}</th>
                    <th className="py-3 px-4 font-semibold cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap" onClick={() => handleRawSort('buildingName')}>소속 건물{renderRawSortIcon('buildingName')}</th>
                    <th className="py-3 px-4 font-semibold cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap" onClick={() => handleRawSort('departmentName')}>부서명{renderRawSortIcon('departmentName')}</th>
                    <th className="py-3 px-4 font-semibold cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap" onClick={() => handleRawSort('inspector')}>점검자{renderRawSortIcon('inspector')}</th>
                    <th className="py-3 px-4 font-semibold text-center whitespace-nowrap bg-teal-50 text-teal-700">중점사항</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setShowCategoryColumns(p => !p)}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-surface-400 hover:text-surface-700 transition-colors"
                        title={showCategoryColumns ? "카테고리 점수 숨기기" : "카테고리 점수 펼치기"}
                      >
                        카테고리
                        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${showCategoryColumns ? "rotate-90" : ""}`} />
                      </button>
                    </th>
                    {showCategoryColumns && categories.map(c => (
                      <th key={c.key} className="py-3 px-4 font-semibold text-center cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap" onClick={() => handleRawSort(c.key as RawSortKey)}>{c.name}{renderRawSortIcon(c.key as RawSortKey)}</th>
                    ))}
                    <th className="py-3 px-4 font-semibold text-center cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap" onClick={() => handleRawSort('totalScore')}>총점{renderRawSortIcon('totalScore')}</th>
                    <th className="py-3 px-4 font-semibold text-center cursor-pointer hover:bg-surface-100 select-none whitespace-nowrap" onClick={() => handleRawSort('status')}>상태{renderRawSortIcon('status')}</th>
                    <th className="py-3 px-4 font-semibold min-w-[220px] max-w-[320px]">특이사항</th>
                    <th className="py-3 px-4 font-semibold text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {displayRecords.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-8 text-center text-surface-500">
                        선택된 기간에 입력된 점검 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    displayRecords.map(record => {
                      const isEditing = editingId === record.id;
                      const focusCat = record.focusCategory
                        ? categories.find(c => c.key === record.focusCategory)
                        : null;
                      const hasSubScores = record.subScores && Object.keys(record.subScores).length > 0;
                      return (
                        <tr key={record.id} className="hover:bg-surface-50 group align-top">
                          <td className="py-3 px-4 text-surface-600 whitespace-nowrap">{record.date.split("T")[0]}</td>
                          <td className="py-3 px-4 text-surface-900 whitespace-nowrap">{getBuildingName(record.buildingId)}</td>
                          <td className="py-3 px-4 text-surface-900 font-medium whitespace-nowrap">{record.departmentName}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-20 px-2 py-1 text-sm border border-surface-300 rounded"
                                value={editForm.inspector || ""}
                                onChange={(e) => setEditForm({ ...editForm, inspector: e.target.value })}
                              />
                            ) : record.inspector}
                          </td>
                          {/* 중점사항 + 세부항목 */}
                          <td className="py-3 px-4 bg-teal-50/40 min-w-[180px]">
                            {focusCat ? (
                              <div className={`rounded-lg px-2.5 py-2 space-y-1.5 ${hasSubScores ? "bg-teal-50 border border-teal-100" : "bg-amber-50 border border-amber-200"}`}>
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-700 whitespace-nowrap">
                                    {focusCat.name}
                                  </span>
                                  <span className={`text-xs font-bold font-mono whitespace-nowrap ${hasSubScores ? "text-teal-800" : "text-amber-700"}`}>
                                    {record.totalScore}/{focusCat.max}점
                                  </span>
                                </div>
                                {hasSubScores ? (
                                  focusCat.subCriteria.map(sub => {
                                    const val = record.subScores![`${focusCat.key}_${sub.key}`];
                                    return (
                                      <div key={sub.key} className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-teal-600 w-14 shrink-0 truncate">{sub.name}</span>
                                        <div className="flex-1 h-1.5 bg-teal-100 rounded-full overflow-hidden min-w-[28px]">
                                          <div
                                            className="h-full bg-teal-400 rounded-full"
                                            style={{ width: val != null ? `${(val / sub.max) * 100}%` : "0%" }}
                                          />
                                        </div>
                                        <span className="text-[11px] font-mono text-teal-700 font-semibold whitespace-nowrap">
                                          {val ?? "—"}/{sub.max}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-[11px] text-amber-600">세부항목 없음 — 재입력 필요</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-surface-300 text-xs">—</span>
                            )}
                          </td>
                          {/* 카테고리별 점수 열 — 토글로 표시/숨김 */}
                          <td className="py-3 px-4 text-center text-surface-300 text-xs">
                            {showCategoryColumns ? null : "—"}
                          </td>
                          {showCategoryColumns && (
                            <>
                              <td className="py-3 px-4 text-center">
                                {isEditing ? (
                                  <input type="number" min="0" max="10" className="w-12 px-1 py-1 text-center text-sm border border-surface-300 rounded"
                                    value={editForm.scores?.greeting} onChange={(e) => handleScoreChange('greeting', e.target.value)} />
                                ) : record.scores?.greeting || 0}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isEditing ? (
                                  <input type="number" min="0" max="10" className="w-12 px-1 py-1 text-center text-sm border border-surface-300 rounded"
                                    value={editForm.scores?.response} onChange={(e) => handleScoreChange('response', e.target.value)} />
                                ) : record.scores?.response || 0}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isEditing ? (
                                  <input type="number" min="0" max="10" className="w-12 px-1 py-1 text-center text-sm border border-surface-300 rounded"
                                    value={editForm.scores?.phone} onChange={(e) => handleScoreChange('phone', e.target.value)} />
                                ) : record.scores?.phone || 0}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isEditing ? (
                                  <input type="number" min="0" max="10" className="w-12 px-1 py-1 text-center text-sm border border-surface-300 rounded"
                                    value={editForm.scores?.appearance} onChange={(e) => handleScoreChange('appearance', e.target.value)} />
                                ) : record.scores?.appearance || 0}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isEditing ? (
                                  <input type="number" min="0" max="10" className="w-12 px-1 py-1 text-center text-sm border border-surface-300 rounded"
                                    value={editForm.scores?.environment} onChange={(e) => handleScoreChange('environment', e.target.value)} />
                                ) : record.scores?.environment || 0}
                              </td>
                            </>
                          )}
                          <td className="py-3 px-4 text-center font-bold text-surface-900">
                            {isEditing ? editForm.totalScore : record.totalScore}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isEditing ? (
                              <span className={`px-2 py-1 text-xs font-semibold rounded-md ${
                                editForm.status === '정상' ? 'bg-green-100 text-green-700' :
                                editForm.status === '주의' ? 'bg-orange-100 text-orange-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {editForm.status}
                              </span>
                            ) : (
                              <span className={`px-2 py-1 text-xs font-semibold rounded-md ${
                                record.status === '정상' ? 'bg-green-100 text-green-700' :
                                record.status === '주의' ? 'bg-orange-100 text-orange-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {record.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-normal min-w-[220px] max-w-[320px]">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-full px-2 py-1 text-sm border border-surface-300 rounded"
                                value={editForm.notes || ""}
                                onChange={(e) => handleNotesChange(e.target.value)}
                              />
                            ) : (
                              <span className="break-words text-sm text-surface-700">
                                {record.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <button onClick={() => saveEdit(record.id)} className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700">저장</button>
                                <button onClick={cancelEdit} className="px-2 py-1 bg-surface-200 text-surface-700 rounded text-xs hover:bg-surface-300">취소</button>
                              </div>
                            ) : pendingDeleteId === record.id ? (
                              <div className="flex justify-end gap-1.5 items-center">
                                <span className="text-xs text-surface-400">삭제할까요?</span>
                                <button
                                  onClick={() => softDeleteRecord(record.id)}
                                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                                >확인</button>
                                <button
                                  onClick={() => setPendingDeleteId(null)}
                                  className="px-2 py-1 bg-surface-200 text-surface-700 rounded text-xs hover:bg-surface-300"
                                >취소</button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2 items-center">
                                <button
                                  onClick={() => startEdit(record)}
                                  aria-label={`${record.departmentName} 점검 기록 수정`}
                                  className="px-2 py-1 text-primary-600 bg-primary-50 border border-primary-200 rounded text-xs hover:bg-primary-100"
                                >수정</button>
                                <button
                                  onClick={() => setPendingDeleteId(record.id)}
                                  aria-label={`${record.departmentName} 점검 기록 삭제`}
                                  className="px-2 py-1 text-red-600 bg-red-50 border border-red-200 rounded text-xs hover:bg-red-100"
                                >삭제</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-50 p-4 rounded-xl border border-surface-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-surface-700">조회 연도</span>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-white border border-surface-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = (new Date().getFullYear() - 2 + i).toString();
                  return <option key={y} value={y}>{y}년</option>;
                })}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportAggregateCSV}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-surface-300 hover:bg-surface-50 text-surface-700 text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={exportAggregateXLSX}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-50 text-surface-600 border-b border-surface-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold sticky left-0 bg-surface-50 z-10 w-48 shadow-[1px_0_0_0_#e5e7eb] cursor-pointer hover:bg-surface-100 select-none" onClick={() => handleAggSort('departmentName')}>
                      부서명{renderAggSortIcon('departmentName')}
                    </th>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <th key={m} className="py-3 px-4 font-semibold text-center border-l border-surface-100 cursor-pointer hover:bg-surface-100 select-none" onClick={() => handleAggSort(`m${m}` as AggSortKey)}>
                        {m}월{renderAggSortIcon(`m${m}` as AggSortKey)}
                      </th>
                    ))}
                    <th className="py-3 px-4 font-semibold text-center bg-surface-100 border-l border-surface-200 cursor-pointer hover:bg-surface-200 select-none" onClick={() => handleAggSort('yearlyAvg')}>
                      연간 평균{renderAggSortIcon('yearlyAvg')}
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
                  ) : (
                    aggregateData.map(row => (
                      <tr key={row.departmentId} className="hover:bg-surface-50">
                        <td className="py-2 px-4 font-medium text-surface-900 sticky left-0 bg-white shadow-[1px_0_0_0_#e5e7eb]">
                          {row.departmentName}
                        </td>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                          const val = row[`m${m}`];
                          return (
                            <td key={m} className="py-2 px-4 text-center border-l border-surface-50 font-mono">
                              {val !== null ? (
                                <span className={val >= 45 ? "text-green-600 font-medium" : val < 35 ? "text-red-500 font-medium" : "text-surface-700"}>
                                  {val}
                                </span>
                              ) : (
                                <span className="text-surface-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-4 text-center font-bold text-surface-800 bg-surface-50/50 border-l border-surface-100 shadow-inner block h-full min-h-12 flex items-center justify-center font-mono">
                          {row.yearlyAvg !== null ? row.yearlyAvg : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

