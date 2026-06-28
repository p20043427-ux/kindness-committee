import { useEffect, useState, useMemo } from "react";
import { SkeletonBuildingCard } from "@/src/components/ui/Skeleton";
import { useToast } from "@/src/components/ui/Toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Badge } from "@/src/components/ui/Badge";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { Select } from "@/src/components/ui/Input";
import { supabase } from "@/src/lib/supabase";
import { liveQuery } from "@/src/lib/db";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { InlineInputForm } from "@/src/components/features/InlineInputForm";
import { DatePickerWithData } from "@/src/components/features/DatePickerWithData";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import { Download, CheckCircle2, AlertTriangle, AlertOctagon, Clock } from "lucide-react";

interface RecordData {
  departmentId: string;
  status: string;
  totalScore: number;
  date: string;
  inspector?: string;
  notes?: string;
  departmentName?: string;
  createdAt?: string;
  focusCategory?: string;
  subScores?: Record<string, number>;
}

export function Monitoring() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { buildings, departments, isLoading: orgLoading } = useOrganization();
  const { categories, getFocusForMonth, categoryName } = useSettings();
  const [records, setRecords] = useState<RecordData[]>([]);
  const [members, setMembers] = useState<{id: string, name: string}[]>([]);
  
  // Date and Inspector state
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [globalInspector, setGlobalInspector] = useState<string>("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

  const [mobileActiveBuildingId, setMobileActiveBuildingId] = useState<string>("B01");

  useEffect(() => {
    if (buildings.length > 0 && mobileActiveBuildingId === "B01") {
      setMobileActiveBuildingId(buildings[0].id);
    }
  }, [buildings]);

  useEffect(() => {
    // Fetch members (active only)
    const uMembers = liveQuery<any>(
      "kc_committee",
      () => supabase.from("kc_committee").select("id,name,is_active"),
      (rows) => {
        setMembers(rows.filter((d) => d.is_active).map((d) => ({ id: d.id, name: d.name })));
      }
    );

    setIsLoading(true);

    // YYYY-MM-DD 문자열을 기준으로 해당 일자의 시작과 끝에 해당하는 데이터만 조회
    const startOfDay = selectedDate + "T00:00:00";
    const endOfDay = selectedDate + "T23:59:59.999Z";

    const unsubscribe = liveQuery<any>(
      "kc_records",
      () =>
        supabase
          .from("kc_records")
          .select("*")
          .gte("date", startOfDay)
          .lte("date", endOfDay),
      (rows) => {
        const dailyRecords: RecordData[] = rows.map((data) => ({
          departmentId: data.department_id,
          status: data.status,
          totalScore: data.total_score,
          date: data.date,
          inspector: data.inspector,
          notes: data.notes,
          departmentName: data.department_name,
          createdAt: data.created_at || "",
          focusCategory: data.focus_category || "",
          subScores: data.sub_scores ?? undefined,
        }));
        dailyRecords.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setRecords(dailyRecords);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching historical records:", error);
        toast("데이터를 가져오는 중 오류가 발생했습니다. 권한이나 네트워크를 확인해주세요.", "error");
        setIsLoading(false);
      }
    );

    if (expandedDeptId) {
      toast("날짜가 변경되어 입력 중인 점검표가 닫혔습니다.", "warning");
    }
    setExpandedDeptId(null); // 날짜 변경 시 폼 닫기

    return () => {
      unsubscribe();
      uMembers();
    };
  }, [selectedDate]);

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      // 1. 선택된 날짜의 데이터 목록 조회
      const startOfDay = selectedDate + "T00:00:00";
      const endOfDay = selectedDate + "T23:59:59.999Z";
      const { data, error } = await supabase
        .from("kc_records")
        .select("*")
        .gte("date", startOfDay)
        .lte("date", endOfDay);
      if (error) throw error;

      const filteredDocs: any[] = data || [];

      if (filteredDocs.length === 0) {
        toast("해당 일자에 내보낼 점검 데이터가 없습니다.", "info");
        setIsExporting(false);
        return;
      }

      // 2. CSV 헤더 구성 (DB 컬럼명과 카테고리 key가 일치함을 명시적으로 매핑)
      const CAT_DB_COLS: Record<string, string> = {
        greeting:    "greeting",
        response:    "response",
        phone:       "phone",
        appearance:  "appearance",
        environment: "environment",
      };

      const headers = ["점검일자", "건물명", "부서명", "점검자", "상태", "총점", ...categories.map(c => c.name), "특이사항"];
      const csvRows = [headers.join(",")];

      const escapeCSV = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

      filteredDocs.forEach((row) => {
        const bName = buildings.find(b => b.id === row.building_id)?.name || row.building_id || "";
        const dName = row.department_name || departments.find(d => d.id === row.department_id)?.name || "";
        const dDate = (row.date || "").split("T")[0];

        const csvRow = [
          escapeCSV(dDate),
          escapeCSV(bName),
          escapeCSV(dName),
          escapeCSV(row.inspector || ""),
          escapeCSV(row.status || ""),
          escapeCSV(row.total_score ?? 0),
          ...categories.map(c => escapeCSV(row[CAT_DB_COLS[c.key] ?? c.key] ?? 0)),
          escapeCSV(row.notes || ""),
        ];
        csvRows.push(csvRow.join(","));
      });

      // 3. Blob 생성 및 파일 다운로드 유도 (BOM 포함하여 한글 깨짐 방지)
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `점검현황_${selectedDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error("Export error:", error);
      toast("데이터 내보내기 중 오류가 발생했습니다.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const getDepartmentRecord = (deptId: string) => {
    return records.find(r => r.departmentId === deptId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "정상": return "bg-primary-50 border-primary-200 text-primary-700";
      case "주의": return "bg-amber-50 border-amber-200 text-amber-700";
      case "긴급": return "bg-red-50 border-red-200 text-red-700 motion-safe:animate-pulse";
      default: return "bg-surface-50 border-surface-200 text-surface-500 hover:bg-surface-100 cursor-pointer";
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "정상": return <CheckCircle2 className="w-5 h-5 text-primary-500" aria-label="정상" />;
      case "주의": return <AlertTriangle className="w-5 h-5 text-amber-500" aria-label="주의" />;
      case "긴급": return <AlertOctagon className="w-5 h-5 text-red-500" aria-label="긴급" />;
      default:     return <Clock className="w-5 h-5 text-surface-400" aria-label="미점검" />;
    }
  };

  const handleSuccess = () => {
    setExpandedDeptId(null);
  };

  const focusBadge = (() => {
    const fk = getFocusForMonth(selectedDate.slice(0, 7));
    if (!fk) return undefined;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-teal-200 bg-teal-50 text-xs text-teal-700">
        <span aria-hidden>🎯</span>
        <span className="font-medium">{Number(selectedDate.slice(5, 7))}월 중점사항:</span>
        <span className="font-semibold">{categoryName(fk)}</span>
      </span>
    );
  })();

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <PageHeader
        title="일자별 점검 현황"
        description="이전 기록 조회 및 해당 일자 점검표를 개별 입력합니다."
        badge={focusBadge}
      >
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Button
            type="button"
            variant="secondary"
            size="md"
            leftIcon={<Download className="w-3.5 h-3.5" aria-hidden />}
            onClick={exportToCSV}
            isLoading={isExporting}
            className="flex-shrink-0"
          >
            CSV
          </Button>
          <Select
            value={globalInspector}
            onChange={e => setGlobalInspector(e.target.value)}
            className="flex-shrink-0 w-36"
            aria-label="점검자 선택"
          >
            <option value="">점검자 (선택)</option>
            {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </Select>
          <DatePickerWithData
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>
      </PageHeader>

      {isLoading || orgLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBuildingCard key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex lg:hidden space-x-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
            {buildings.map(b => (
              <button
                key={b.id}
                onClick={() => setMobileActiveBuildingId(b.id)}
                className={`flex-shrink-0 px-4 py-2 rounded text-sm font-medium transition-colors ${
                  mobileActiveBuildingId === b.id
                    ? 'bg-surface-900 text-white'
                    : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-50'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {buildings.map(building => {
              const bDepts = departments.filter(d => d.buildingId === building.id);
              return (
                <Card key={building.id} className={`flex-col h-full bg-surface-50/50 border-surface-200 ${mobileActiveBuildingId === building.id ? 'flex' : 'hidden lg:flex'}`}>
                <CardHeader className="pb-3 border-b border-surface-100 bg-white">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{building.name}</CardTitle>
                    <Badge variant="outline" className="bg-surface-50">{bDepts.length}개 부서</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1">
                  <div className="space-y-3">
                    {bDepts.map(dept => {
                      const record = getDepartmentRecord(dept.id);
                      const status = record ? record.status : "미점검";
                      const score = record ? record.totalScore : null;
                      const isExpanded = expandedDeptId === dept.id;

                      return (
                        <div key={dept.id} className="flex flex-col">
                          <div
                            onClick={() => setExpandedDeptId(isExpanded ? null : dept.id)}
                            className={`p-3 rounded border transition-all ${getStatusColor(status)} flex items-center justify-between bg-white bg-opacity-70 backdrop-blur-sm cursor-pointer`}
                          >
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-semibold text-sm break-keep">{dept.name}</span>
                              {score !== null ? (
                                <>
                                  <span className="text-xs mt-0.5 opacity-80 font-mono font-medium break-keep">총점: {score}점 / {score > 10 ? 50 : 10}점</span>
                                  <div className="mt-1.5 h-1 bg-white/40 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-current opacity-70 transition-all duration-500"
                                      style={{ width: `${Math.min(100, (score / (score > 10 ? 50 : 10)) * 100)}%` }}
                                      role="progressbar"
                                      aria-valuenow={score}
                                      aria-valuemax={score > 10 ? 50 : 10}
                                      aria-label={`${dept.name} 점수 ${score}점`}
                                    />
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs mt-0.5 text-primary-500 font-medium break-keep">클릭하여 점검 입력</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium px-2 py-1 bg-white/50 rounded-md whitespace-nowrap">
                                {status}
                              </span>
                              <StatusIcon status={status} />
                            </div>
                          </div>
                          
                          {/* Inline Form Dropdown */}
                          {isExpanded && (
                            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                              <InlineInputForm
                                buildingId={building.id}
                                departmentId={dept.id}
                                inspectionDate={selectedDate}
                                defaultInspector={record?.inspector || globalInspector}
                                defaultFocus={record?.focusCategory || ""}
                                defaultSubScores={record?.subScores}
                                defaultNotes={record?.notes || ""}
                                isEditing={!!record}
                                members={members}
                                onSuccess={handleSuccess}
                                onCancel={() => setExpandedDeptId(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
