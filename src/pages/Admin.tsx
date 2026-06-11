import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Badge } from "@/src/components/ui/Badge";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings, MonthlyFocusMap } from "@/src/components/layout/SettingsProvider";
import { InspectionCategory, CategoryKey, MAX_TOTAL_SCORE } from "@/src/lib/data";
import { supabase } from "@/src/lib/supabase";

export function Admin() {
  const { buildings, departments } = useOrganization();
  const { categories, monthlyFocus, saveCategories, saveMonthlyFocus, categoryName } = useSettings();
  const [isExporting, setIsExporting] = useState(false);

  // 점검 항목 설정 편집 상태
  const [editSection, setEditSection] = useState<null | "categories" | "focus">(null);
  const [catDraft, setCatDraft] = useState<InspectionCategory[]>([]);
  const [focusDraft, setFocusDraft] = useState<MonthlyFocusMap>({});
  const [focusYear, setFocusYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);

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
      alert("카테고리 이름은 비워둘 수 없습니다.");
      return;
    }
    setIsSaving(true);
    try {
      await saveCategories(catDraft.map(c => ({ ...c, name: c.name.trim(), details: c.details.trim() })));
      alert("친절점검 카테고리가 저장되었습니다. ✅");
      setEditSection(null);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
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
      alert("월별 중점사항이 저장되었습니다. ✅");
      setEditSection(null);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportAllData = async () => {
    setIsExporting(true);
    try {
      const { data: records, error } = await supabase.from("kc_records").select("*");
      if (error) throw error;

      const headers = ["점검일시", "건물명", "부서명", "점검자", "상태", "총점", ...categories.map(c => c.name), "중점사항", "특이사항"];
      const csvRows = [headers.join(",")];

      (records || []).forEach((data: any) => {
        const bName = buildings.find(b => b.id === data.building_id)?.name || data.building_id || "";
        const dName = data.department_name || departments.find(d => d.id === data.department_id)?.name || "";
        const dDate = data.created_at ? new Date(data.created_at).toLocaleString('ko-KR') : "";

        const escapeCSV = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

        const row = [
          escapeCSV(dDate),
          escapeCSV(bName),
          escapeCSV(dName),
          escapeCSV(data.inspector || ""),
          escapeCSV(data.status || ""),
          escapeCSV(data.total_score || 0),
          ...categories.map(c => escapeCSV(data[c.key] || 0)),
          escapeCSV(data.focus_category ? categoryName(data.focus_category) : ""),
          escapeCSV(data.notes || "")
        ];
        csvRows.push(row.join(","));
      });

      const bom = "\uFEFF";
      const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `시스템전체백업_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert("백업 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return { ym: `${focusYear}-${mm}`, label: `${i + 1}월` };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">시스템 설정</h1>
        <p className="text-surface-500 mt-1">마스터 데이터 관리 및 시스템 구성을 변경합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🏢</span> <span>건물 마스터 관리</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {buildings.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 border border-surface-200 rounded-lg bg-surface-50">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📋</span> <span>점검 항목 설정</span>
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
                    <span key={c.key} className="text-xs px-2 py-1 rounded-md bg-primary-50 text-primary-700 font-medium">
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
                  <div key={c.key} className="grid grid-cols-1 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,2fr)_3.5rem] gap-2 items-center p-3 border border-surface-200 rounded-lg bg-surface-50">
                    <span className="text-xs font-bold text-surface-400 font-mono">{idx + 1}</span>
                    <input
                      type="text"
                      value={c.name}
                      onChange={e => setCatField(c.key, "name", e.target.value)}
                      placeholder="카테고리 이름"
                      className="rounded-md border border-surface-300 px-3 py-2 text-sm font-semibold focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                    />
                    <input
                      type="text"
                      value={c.details}
                      onChange={e => setCatField(c.key, "details", e.target.value)}
                      placeholder="세부 평가 항목 (예: 첫인사 · 끝인사 · 먼저인사)"
                      className="rounded-md border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                    />
                    <span className="text-xs text-surface-500 font-mono text-center">{c.max}점</span>
                  </div>
                ))}
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setEditSection(null)}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg border border-surface-300 text-surface-700 font-medium text-sm hover:bg-surface-100 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveCategories}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg bg-surface-900 text-white font-medium text-sm hover:bg-surface-800 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {editSection === "focus" && (
          <Card className="md:col-span-2 border-teal-200 animate-in slide-in-from-top-2 fade-in duration-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">월별 중점사항 운영</CardTitle>
                  <p className="text-xs text-surface-500 mt-1">
                    매월 한 가지 카테고리를 중점사항으로 지정합니다. 점검표 입력 시 해당 월의 중점사항이 자동 선택됩니다.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setFocusYear(y => y - 1)}
                    className="w-8 h-8 rounded-lg border border-surface-300 text-surface-600 hover:bg-surface-100 font-bold"
                  >
                    ◀
                  </button>
                  <span className="font-bold text-surface-900 font-mono">{focusYear}년</span>
                  <button
                    onClick={() => setFocusYear(y => y + 1)}
                    className="w-8 h-8 rounded-lg border border-surface-300 text-surface-600 hover:bg-surface-100 font-bold"
                  >
                    ▶
                  </button>
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
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isCurrent ? "border-teal-300 bg-teal-50" : "border-surface-200 bg-surface-50"
                      }`}
                    >
                      <span className={`text-sm font-bold ${isCurrent ? "text-teal-700" : "text-surface-700"}`}>
                        {m.label}
                        {isCurrent && <span className="ml-1 text-[10px] font-medium text-teal-500">이번 달</span>}
                      </span>
                      <select
                        value={focusDraft[m.ym] || ""}
                        onChange={e => setMonthFocus(m.ym, e.target.value)}
                        className="rounded-md border border-surface-300 px-2 py-1.5 text-sm bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none max-w-[60%]"
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
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => setEditSection(null)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg border border-surface-300 text-surface-700 font-medium text-sm hover:bg-surface-100 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveFocus}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-surface-900 text-white font-medium text-sm hover:bg-surface-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <span>⚠️</span> <span>보안 및 고급 설정</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-4 border-b border-surface-100">
              <div>
                <p className="font-medium text-sm text-surface-900">데이터 백업</p>
                <p className="text-xs text-surface-500 mt-1">모든 점검 기록 및 마스터 데이터를 CSV 파일로 내보냅니다.</p>
              </div>
              <button
                onClick={exportAllData}
                disabled={isExporting}
                className="px-4 py-2 bg-surface-100 text-surface-700 text-sm font-medium rounded-lg hover:bg-surface-200 disabled:opacity-50"
              >
                {isExporting ? "추출 중..." : "내보내기"}
              </button>
            </div>
            <div className="flex items-center justify-between py-4 border-b border-surface-100">
              <div>
                <p className="font-medium text-sm text-surface-900">알림 설정</p>
                <p className="text-xs text-surface-500 mt-1">'긴급' 상태 발생 시 원무팀(내선 1000)으로 자동 SMS를 발송합니다.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-sm text-red-600">시스템 초기화</p>
                <p className="text-xs text-surface-500 mt-1">모든 설정과 데이터를 초기 상태로 되돌립니다. (복구 불가)</p>
              </div>
              <button className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors">
                초기화 진행
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
