import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/Card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";

interface RecordData {
  id: string;
  departmentId: string;
  totalScore: number;
  date: string;
  scores: {
    greeting: number;
    response: number;
    phone: number;
    appearance: number;
    environment: number;
  }
}

export function YearlyReport() {
  const { user } = useAuth();
  const { buildings, departments, isLoading: orgLoading } = useOrganization();
  const [selectedDept, setSelectedDept] = useState<string>(""); 
  const [records, setRecords] = useState<RecordData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterType, setFilterType] = useState<"month" | "range">("month");
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (departments.length > 0 && !selectedDept) {
      setSelectedDept(departments[0].id);
    }
  }, [departments]);

  useEffect(() => {
    let isMounted = true;
    const fetchRecords = async () => {
      setIsLoading(true);
      try {
        let startOfDay = "";
        let endOfDay = "";

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

        const { data, error } = await supabase
          .from("kc_records")
          .select("*")
          .gte("date", startOfDay)
          .lt("date", endOfDay);
        if (error) throw error;

        const fetched: RecordData[] = (data || []).map((d: any) => ({
          id: d.id,
          departmentId: d.department_id,
          totalScore: d.total_score,
          date: d.date,
          scores: {
            greeting: d.greeting || 0,
            response: d.response || 0,
            phone: d.phone || 0,
            appearance: d.appearance || 0,
            environment: d.environment || 0,
          },
        }));
        if (isMounted) setRecords(fetched);
      } catch (error) {
        console.error("YearlyReport fetch error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchRecords();
    return () => { isMounted = false; };
  }, [filterType, filterMonth, startDate, endDate]);

  const filteredRecords = records;

  // 전체 부서 일별 가공 & 단일 부서 일별 가공 (해당 기간 내)
  const periodData = useMemo(() => {
    const dayStatsAll: Record<string, { total: number; count: number }> = {};
    const dayStatsDept: Record<string, { total: number; count: number; greeting: number; response: number; phone: number; appearance: number; environment: number }> = {};
    
    filteredRecords.forEach(record => {
      const dayKey = record.date.slice(0, 10); // yyyy-mm-dd
      
      // 전체 부서 통계
      if (!dayStatsAll[dayKey]) dayStatsAll[dayKey] = { total: 0, count: 0 };
      dayStatsAll[dayKey].total += record.totalScore;
      dayStatsAll[dayKey].count += 1;

      // 선택된 부서 통계
      if (record.departmentId === selectedDept) {
        if (!dayStatsDept[dayKey]) dayStatsDept[dayKey] = { total: 0, count: 0, greeting: 0, response: 0, phone: 0, appearance: 0, environment: 0 };
        dayStatsDept[dayKey].total += record.totalScore;
        dayStatsDept[dayKey].greeting += record.scores?.greeting || 0;
        dayStatsDept[dayKey].response += record.scores?.response || 0;
        dayStatsDept[dayKey].phone += record.scores?.phone || 0;
        dayStatsDept[dayKey].appearance += record.scores?.appearance || 0;
        dayStatsDept[dayKey].environment += record.scores?.environment || 0;
        dayStatsDept[dayKey].count += 1;
      }
    });

    const result = Object.keys(dayStatsAll).map(dayKey => {
      const allAvg = dayStatsAll[dayKey].count > 0 
        ? Math.round((dayStatsAll[dayKey].total / dayStatsAll[dayKey].count) * 10) / 10 
        : null;
      
      const deptData = dayStatsDept[dayKey];
      const deptAvg = deptData && deptData.count > 0 
        ? Math.round((deptData.total / deptData.count) * 10) / 10 
        : null;
      
      return {
        date: dayKey,
        shortDate: dayKey.substring(5), // mm-dd
        allAverage: allAvg,
        deptAverage: deptAvg,
        greeting: deptData ? Math.round((deptData.greeting / deptData.count) * 10) / 10 : 0,
        response: deptData ? Math.round((deptData.response / deptData.count) * 10) / 10 : 0,
        phone: deptData ? Math.round((deptData.phone / deptData.count) * 10) / 10 : 0,
        appearance: deptData ? Math.round((deptData.appearance / deptData.count) * 10) / 10 : 0,
        environment: deptData ? Math.round((deptData.environment / deptData.count) * 10) / 10 : 0,
      };
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords, selectedDept]);

  // 기준(filteredRecords)에 대해 점수가 가장 높은 / 낮은 부서 산출
  const extremumStats = useMemo(() => {
    const deptScores: Record<string, { total: number; count: number }> = {};
    
    filteredRecords.forEach(r => {
      if (!deptScores[r.departmentId]) deptScores[r.departmentId] = { total: 0, count: 0 };
      deptScores[r.departmentId].total += r.totalScore;
      deptScores[r.departmentId].count += 1;
    });

    let highestDept = null;
    let lowestDept = null;
    let highestScore = -1;
    let lowestScore = 999;

    departments.forEach(dept => {
      const s = deptScores[dept.id];
      if (s && s.count > 0) {
        const avg = s.total / s.count;
        if (avg > highestScore) {
          highestScore = avg;
          highestDept = dept;
        }
        if (avg < lowestScore) {
          lowestScore = avg;
          lowestDept = dept;
        }
      }
    });

    return {
      highestDept,
      highestScore: highestScore > -1 ? Math.round(highestScore * 10)/10 : null,
      lowestDept,
      lowestScore: lowestScore < 999 ? Math.round(lowestScore * 10)/10 : null
    };
  }, [filteredRecords, departments]);

  if (isLoading || orgLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-surface-500">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
        <p>리포트를 생성하기 위해 점검 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  const selectedDeptInfo = departments.find(d => d.id === selectedDept);
  
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight border-l-4 border-primary-500 pl-3">부서별 기간 리포트</h1>
          <p className="text-surface-500 mt-1">지정된 기간 내의 점검 데이터와 병원 전체 평균을 비교합니다.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 bg-surface-50 p-2 rounded-lg border border-surface-200">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "month" | "range")}
            className="bg-white border border-surface-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="month">월별 조회</option>
            <option value="range">기간 조회</option>
          </select>

          {filterType === "month" ? (
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-white border border-surface-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-surface-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-32"
              />
              <span className="text-surface-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-surface-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-32"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex flex-col justify-center shadow-sm">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2">
               <span className="text-2xl">🏆</span>
               <h3 className="font-bold text-emerald-900 text-lg">해당 기간 최우수 부서</h3>
             </div>
          </div>
          {extremumStats.highestDept ? (
            <div>
              <div className="text-xl font-bold text-emerald-800">{extremumStats.highestDept.name}</div>
              <div className="text-sm text-emerald-600 font-medium">평균 {extremumStats.highestScore}점</div>
            </div>
          ) : (
            <div className="text-sm text-emerald-600/70">데이터가 없습니다.</div>
          )}
        </div>
        
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 flex flex-col justify-center shadow-sm">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2">
               <span className="text-2xl">📉</span>
               <h3 className="font-bold text-rose-900 text-lg">해당 기간 개선 필요 부서</h3>
             </div>
          </div>
          {extremumStats.lowestDept ? (
            <div>
              <div className="text-xl font-bold text-rose-800">{extremumStats.lowestDept.name}</div>
              <div className="text-sm text-rose-600 font-medium">평균 {extremumStats.lowestScore}점</div>
            </div>
          ) : (
            <div className="text-sm text-rose-600/70">데이터가 없습니다.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-surface-200">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <CardTitle>기간 내 점검일별 총점 추이</CardTitle>
            <select 
              className="rounded-lg border border-surface-300 px-4 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white font-medium"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">비교할 부서 선택</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="h-[350px]">
            {periodData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={periodData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="shortDate" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis domain={[0, 50]} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{stroke: '#e2e8f0', strokeWidth: 2}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
                  <Line type="monotone" name="해당일 전체 평균" dataKey="allAverage" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={3} activeDot={{ r: 6 }} connectNulls />
                  <Line type="monotone" name={`${selectedDeptInfo?.name || "-"} 점수`} dataKey="deptAverage" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 8, strokeWidth: 0, fill: '#4f46e5' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-surface-500">해당 기간에 점검 데이터가 없습니다.</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-surface-200">
          <CardHeader>
            <CardTitle>{selectedDeptInfo?.name || "선택된 부서"} 세부 항목별 득점 추이</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {periodData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="shortDate" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                  <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar dataKey="greeting" name="인사예절" fill="#fbbf24" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="response" name="응대스킬" fill="#38bdf8" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="phone" name="전화응대" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="appearance" name="용모복장" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="environment" name="병원환경" fill="#a78bfa" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
             ) : (
               <div className="flex items-center justify-center h-full text-surface-500">데이터가 없습니다.</div>
             )}
          </CardContent>
        </Card>

        <Card className="bg-primary-900 border-none text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center space-x-2">
              <span>🤖</span> <span>AI 종합 분석</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-primary-800/50 p-4 rounded-xl border border-primary-700">
                <p className="text-sm leading-relaxed text-primary-100">
                  <strong className="text-white">성과 요약: </strong>
                  지정된 기간 동안 {selectedDeptInfo?.name} 부서는 
                  {periodData.length > 0 && periodData[periodData.length - 1].deptAverage && periodData[periodData.length - 1].allAverage ? (
                    periodData[periodData.length - 1].deptAverage! >= periodData[periodData.length - 1].allAverage! ? 
                    <span className="text-green-300 font-bold ml-1">전체 병원 평균보다 우수한 성적을 기록</span> : 
                    <span className="text-rose-300 font-bold ml-1">전체 병원 평균 대비 다소 부족한 성과</span>
                  ) : <span>비교 가능한 데이터가 부족합니다.</span>} 하고 있습니다.
                </p>
              </div>
              <div className="flex items-start space-x-3 text-sm">
                <span className="text-orange-400 mt-0.5">💡</span>
                <p className="text-primary-200">
                  {extremumStats.highestDept?.id === selectedDept ? '현재 부서는 최상위 수준의 점검 성과를 유지하고 있습니다. 지속적인 관리가 필요합니다.' : 
                   extremumStats.lowestDept?.id === selectedDept ? '현재 부서의 점검 성과가 가장 저조합니다. 취약 항목 파악 및 개선책 마련이 시급합니다.' : 
                   `분석 기간 내 점수가 가장 저조한 ${extremumStats.lowestDept?.name || '-'} 부서에 우선적인 관리/감독을 집중 배정하시기 바랍니다.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


