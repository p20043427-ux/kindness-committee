import { useRef, useState } from "react";
import { useToast } from "@/src/components/ui/Toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings, MonthlyFocusMap } from "@/src/components/layout/SettingsProvider";
import { InspectionCategory, CategoryKey, MAX_TOTAL_SCORE } from "@/src/lib/data";
import { supabase } from "@/src/lib/supabase";
import { downloadExcel } from "@/src/lib/excel";
import { Building2, ClipboardList, AlertTriangle, Download, FileSpreadsheet, ArchiveRestore, HardDriveDownload } from "lucide-react";

export function Admin() {
  const { buildings, departments } = useOrganization();
  const { categories, monthlyFocus, saveCategories, saveMonthlyFocus, categoryName } = useSettings();
  const { toast } = useToast();

  const [editSection, setEditSection] = useState<null | "categories" | "focus">(null);
  const [catDraft, setCatDraft] = useState<InspectionCategory[]>([]);
  const [focusDraft, setFocusDraft] = useState<MonthlyFocusMap>({});
  const [focusYear, setFocusYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);

  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingXLSX, setIsExportingXLSX] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  /* ── 점검 항목 설정 ─────────────────────────────────────────────── */
  const openCategoryEditor = () => {
    setCatDraft(categories.map(c => ({ ...c })));
    setEditSection(editSection === "categories" ? null : "categories");
  };
  const openFocusEditor = () => {
    setFocusDraft({ ...monthlyFocus });
    setEditSection(editSection === "focus" ? null : "focus");
  };
  const setCatField = (key: CategoryKey, field: "name" | "details", value: string) =>
    setCatDraft(prev => prev.map(c => (c.key === key ? { ...c, [field]: value } : c)));

  const handleSaveCategories = async () => {
    if (catDraft.some(c => !c.name.trim())) {
      toast("카테고리 이름은 비워둘 수 없습니다.", "warning");
      return;
    }
    setIsSaving(true);
    try {
      await saveCategories(catDraft.map(c => ({ ...c, name: c.name.trim(), details: c.details.trim() })));
      toast("친절점검 카테고리가 저장되었습니다.", "success");
      setEditSection(null);
    } catch (e) {
      console.error(e);
      toast("저장 중 오류가 발생했습니다.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const setMonthFocus = (yearMonth: string, key: string) =>
    setFocusDraft(prev => {
      const next = { ...prev };
      if (key) next[yearMonth] = key as CategoryKey;
      else delete next[yearMonth];
      return next;
    });

  const handleSaveFocus = async () => {
    setIsSaving(true);
    try {
      await saveMonthlyFocus(focusDraft);
      toast("월별 중점사항이 저장되었습니다.", "success");
      setEditSection(null);
    } catch (e) {
      console.error(e);
      toast("저장 중 오류가 발생했습니다.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── 공통: 레코드 로딩 ─────────────────────────────────────────── */
  const fetchAllRecords = async () => {
    const { data, error } = await supabase.from("kc_records").select("*").order("date", { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const buildingName = (id: string) => buildings.find(b => b.id === id)?.name || id || "";
  const today = () => new Date().toISOString().split("T")[0];

  const recordHeaders = ["점검일시", "건물명", "부서명", "점검자", "상태", "총점", ...categories.map(c => c.name), "중점사항", "특이사항"];
  const recordToRow = (r: any): (string | number)[] => [
    r.date ? new Date(r.date).toLocaleDateString("ko-KR") : "",
    buildingName(r.building_id),
    r.department_name || "",
    r.inspector || "",
    r.status || "",
    r.total_score ?? 0,
    ...categories.map(c => r[c.key] ?? 0),
    r.focus_category ? categoryName(r.focus_category) : "",
    r.notes || "",
  ];

  /* ── CSV 내보내기 ───────────────────────────────────────────────── */
  const exportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const records = await fetchAllRecords();
      const escapeCSV = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const rows = [recordHeaders.map(escapeCSV).join(",")];
      records.forEach(r => rows.push(recordToRow(r).map(escapeCSV).join(",")));
      const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
      triggerDownload(blob, `친절점검_${today()}.csv`);
      toast(`CSV 내보내기 완료 (${records.length}건)`, "success");
    } catch (e) {
      console.error(e);
      toast("CSV 내보내기 중 오류가 발생했습니다.", "error");
    } finally {
      setIsExportingCSV(false);
    }
  };

  /* ── Excel 내보내기 ─────────────────────────────────────────────── */
  const exportExcel = async () => {
    setIsExportingXLSX(true);
    try {
      const records = await fetchAllRecords();
      downloadExcel(
        [{ headers: recordHeaders, rows: records.map(recordToRow), sheetName: "점검기록" }],
        `친절점검_${today()}.xlsx`
      );
      toast(`Excel 내보내기 완료 (${records.length}건)`, "success");
    } catch (e) {
      console.error(e);
      toast("Excel 내보내기 중 오류가 발생했습니다.", "error");
    } finally {
      setIsExportingXLSX(false);
    }
  };

  /* ── JSON 전체 백업 ─────────────────────────────────────────────── */
  const backupJSON = async () => {
    setIsBackingUp(true);
    try {
      const records = await fetchAllRecords();
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: { categories, monthlyFocus },
        records,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      triggerDownload(blob, `친절점검_백업_${today()}.json`);
      toast(`전체 백업 완료 (레코드 ${records.length}건)`, "success");
    } catch (e) {
      console.error(e);
      toast("백업 중 오류가 발생했습니다.", "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  /* ── JSON 복구 ──────────────────────────────────────────────────── */
  const restoreJSON = async (file: File) => {
    setIsRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload.records || !Array.isArray(payload.records)) {
        toast("올바른 백업 파일이 아닙니다. (records 필드 없음)", "error");
        return;
      }
      const { error } = await supabase.from("kc_records").upsert(payload.records, { onConflict: "id" });
      if (error) throw error;
      toast(`복구 완료: ${payload.records.length}건 가져왔습니다. 페이지를 새로고침하세요.`, "success");
    } catch (e: any) {
      console.error(e);
      toast(`복구 실패: ${e.message || "파일을 확인해주세요."}`, "error");
    } finally {
      setIsRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  /* ── 유틸 ──────────────────────────────────────────────────────── */
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return { ym: `${focusYear}-${mm}`, label: `${i + 1}월` };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <PageHeader
        title="시스템 설정"
        description="마스터 데이터 관리 및 시스템 구성을 변경합니다."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 건물 마스터 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-surface-500" aria-hidden /> 건물 마스터 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {buildings.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 border border-surface-200 rounded bg-surface-50">
                  <div>
                    <p className="font-semibold text-sm">{b.name} ({b.id})</p>
                    <p className="text-xs text-surface-500 mt-1">
                      부서 {departments.filter(d => d.buildingId === b.id).length}개 · 사용중
                    </p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-surface-400">건물/부서 추가·수정은 [코드 관리] 메뉴에서 진행합니다.</p>
            </div>
          </CardContent>
        </Card>

        {/* 점검 항목 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-surface-500" aria-hidden /> 점검 항목 설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-surface-700">친절점검 카테고리 ({categories.length}개)</span>
                  <button onClick={openCategoryEditor}>
                    <Badge variant={editSection === "categories" ? "default" : "outline"} className="cursor-pointer">
                      {editSection === "categories" ? "닫기" : "수정"}
                    </Badge>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => (
                    <span key={c.key} className="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 font-medium">
                      {c.name} <span className="text-primary-400">{c.max}점</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-surface-700">월별 중점사항 운영</span>
                  <button onClick={openFocusEditor}>
                    <Badge variant={editSection === "focus" ? "default" : "outline"} className="cursor-pointer">
                      {editSection === "focus" ? "닫기" : "수정"}
                    </Badge>
                  </button>
                </div>
                <p className="text-xs text-surface-500">
                  이번 달({new Date().getMonth() + 1}월) 중점사항:{" "}
                  {monthlyFocus[new Date().toISOString().slice(0, 7)] ? (
                    <span className="font-bold text-teal-600">
                      {categoryName(monthlyFocus[new Date().toISOString().slice(0, 7)])}
                    </span>
                  ) : (
                    <span className="text-surface-400">미지정</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 카테고리 편집 */}
        {editSection === "categories" && (
          <Card className="md:col-span-2 border-primary-200 animate-in slide-in-from-top-2 fade-in duration-200">
            <CardHeader>
              <CardTitle className="text-base">친절점검 카테고리 설정</CardTitle>
              <p className="text-xs text-surface-500 mt-1">
                카테고리 이름과 세부 평가 항목을 수정합니다. 점수 체계는 각 10점 만점 · 총 {MAX_TOTAL_SCORE}점으로 고정됩니다.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {catDraft.map((c, idx) => (
                  <div key={c.key} className="grid grid-cols-1 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,2fr)_3.5rem] gap-2 items-center p-3 border border-surface-200 rounded bg-surface-50">
                    <span className="text-xs font-bold text-surface-400 font-mono">{idx + 1}</span>
                    <input
                      type="text"
                      value={c.name}
                      onChange={e => setCatField(c.key, "name", e.target.value)}
                      placeholder="카테고리 이름"
                      className="rounded border border-surface-300 px-3 py-2 text-sm font-semibold focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                    />
                    <input
                      type="text"
                      value={c.details}
                      onChange={e => setCatField(c.key, "details", e.target.value)}
                      placeholder="세부 평가 항목 (예: 첫인사 · 끝인사 · 먼저인사)"
                      className="rounded border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                    />
                    <span className="text-xs text-surface-500 font-mono text-center">{c.max}점</span>
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="md" onClick={() => setEditSection(null)} disabled={isSaving}>취소</Button>
                  <Button variant="primary" size="md" onClick={handleSaveCategories} isLoading={isSaving}>저장</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 월별 중점사항 편집 */}
        {editSection === "focus" && (
          <Card className="md:col-span-2 border-teal-200 animate-in slide-in-from-top-2 fade-in duration-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">월별 중점사항 운영</CardTitle>
                  <p className="text-xs text-surface-500 mt-1">
                    매월 한 가지 카테고리를 중점사항으로 지정합니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFocusYear(y => y - 1)}
                    className="w-8 h-8 rounded border border-surface-300 text-surface-600 hover:bg-surface-100 font-bold"
                  >◀</button>
                  <span className="font-bold text-surface-900 font-mono">{focusYear}년</span>
                  <button
                    onClick={() => setFocusYear(y => y + 1)}
                    className="w-8 h-8 rounded border border-surface-300 text-surface-600 hover:bg-surface-100 font-bold"
                  >▶</button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {months.map(m => {
                  const isCurrent = m.ym === new Date().toISOString().slice(0, 7);
                  return (
                    <div
                      key={m.ym}
                      className={`flex items-center justify-between p-3 border rounded ${
                        isCurrent ? "border-primary-300 bg-primary-50/30" : "border-surface-200 bg-surface-50"
                      }`}
                    >
                      <span className={`text-sm font-bold ${isCurrent ? "text-primary-700" : "text-surface-700"}`}>
                        {m.label}
                        {isCurrent && <span className="ml-1 text-[10px] font-medium text-primary-500">이번 달</span>}
                      </span>
                      <select
                        value={focusDraft[m.ym] || ""}
                        onChange={e => setMonthFocus(m.ym, e.target.value)}
                        className="rounded border border-surface-300 px-2 py-1.5 text-sm bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none max-w-[60%]"
                      >
                        <option value="">미지정</option>
                        {categories.map(c => (
                          <option key={c.key} value={c.key}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" size="md" onClick={() => setEditSection(null)} disabled={isSaving}>취소</Button>
                <Button variant="primary" size="md" onClick={handleSaveFocus} isLoading={isSaving}>저장</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 데이터 내보내기 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-surface-500" aria-hidden /> 데이터 내보내기 / 백업 / 복구
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CSV */}
              <div className="flex items-start justify-between gap-4 p-4 border border-surface-200 rounded-lg bg-surface-50">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-surface-900 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 shrink-0 text-surface-500" /> CSV 내보내기
                  </p>
                  <p className="text-xs text-surface-500 mt-1">모든 점검 기록을 엑셀 호환 CSV 파일로 저장합니다.</p>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={exportCSV}
                  isLoading={isExportingCSV}
                  className="shrink-0"
                >
                  CSV
                </Button>
              </div>

              {/* Excel */}
              <div className="flex items-start justify-between gap-4 p-4 border border-surface-200 rounded-lg bg-surface-50">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-surface-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-green-600" /> Excel 내보내기
                  </p>
                  <p className="text-xs text-surface-500 mt-1">서식이 적용된 .xlsx 파일로 다운로드합니다.</p>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={exportExcel}
                  isLoading={isExportingXLSX}
                  className="shrink-0"
                >
                  Excel
                </Button>
              </div>

              {/* JSON 백업 */}
              <div className="flex items-start justify-between gap-4 p-4 border border-primary-200 rounded-lg bg-primary-50/40">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-surface-900 flex items-center gap-1.5">
                    <HardDriveDownload className="w-3.5 h-3.5 shrink-0 text-primary-600" /> 전체 백업 (JSON)
                  </p>
                  <p className="text-xs text-surface-500 mt-1">점검 기록 + 설정 전체를 JSON으로 백업합니다. 복구 시 사용합니다.</p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={backupJSON}
                  isLoading={isBackingUp}
                  className="shrink-0"
                >
                  백업
                </Button>
              </div>

              {/* JSON 복구 */}
              <div className="flex items-start justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-amber-50/40">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-surface-900 flex items-center gap-1.5">
                    <ArchiveRestore className="w-3.5 h-3.5 shrink-0 text-amber-600" /> 백업 복구 (JSON)
                  </p>
                  <p className="text-xs text-surface-500 mt-1">백업 파일을 불러와 데이터를 복원합니다. 기존 레코드는 덮어씁니다.</p>
                </div>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) restoreJSON(file);
                  }}
                />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => restoreInputRef.current?.click()}
                  isLoading={isRestoring}
                  className="shrink-0"
                >
                  복구
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 보안 및 고급 설정 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" aria-hidden /> 보안 및 고급 설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-sm text-red-600">시스템 초기화</p>
                <p className="text-xs text-surface-500 mt-1">모든 설정과 데이터를 초기 상태로 되돌립니다. (복구 불가)</p>
              </div>
              <Button variant="danger" size="md">초기화 진행</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
