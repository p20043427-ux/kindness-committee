import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Badge } from "@/src/components/ui/Badge";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { supabase } from "@/src/lib/supabase";

export function Admin() {
  const { buildings, departments } = useOrganization();
  const [isExporting, setIsExporting] = useState(false);

  const exportAllData = async () => {
    setIsExporting(true);
    try {
      const { data: records, error } = await supabase.from("kc_records").select("*");
      if (error) throw error;

      const headers = ["점검일시", "건물명", "부서명", "점검자", "상태", "총점", "인사예절", "응대스킬", "전화응대", "용모복장", "병원환경/불만고객", "특이사항"];
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
          escapeCSV(data.greeting || 0),
          escapeCSV(data.response || 0),
          escapeCSV(data.phone || 0),
          escapeCSV(data.appearance || 0),
          escapeCSV(data.environment || 0),
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
              <div className="flex items-center justify-between p-3 border border-surface-200 rounded-lg bg-surface-50">
                <div>
                  <p className="font-semibold text-sm">본관 (B01)</p>
                  <p className="text-xs text-surface-500 mt-1">사용중</p>
                </div>
                <button className="text-surface-400 hover:text-primary-600">수정</button>
              </div>
              <div className="flex items-center justify-between p-3 border border-surface-200 rounded-lg bg-surface-50">
                <div>
                  <p className="font-semibold text-sm">신관 (B02)</p>
                  <p className="text-xs text-surface-500 mt-1">사용중</p>
                </div>
                <button className="text-surface-400 hover:text-primary-600">수정</button>
              </div>
              <button className="w-full py-2 border-2 border-dashed border-surface-300 text-surface-500 rounded-lg text-sm font-medium hover:border-primary-400 hover:text-primary-600 transition-colors">
                + 신규 건물 등록
              </button>
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
                  <span className="font-medium text-surface-700">친절점검 카테고리 (5개)</span>
                  <Badge variant="outline">수정</Badge>
                </div>
                <div className="h-2 w-full bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 w-full"></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-surface-700">월별 중점사항 운영</span>
                  <Badge variant="outline">수정</Badge>
                </div>
                <div className="h-2 w-full bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-400 w-full"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
