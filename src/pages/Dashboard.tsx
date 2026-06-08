import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";

export function Dashboard() {
  const { user } = useAuth();
  const { isLoading: orgLoading } = useOrganization();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch schedules & events for the current month
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Schedules
        const { data: schedData } = await supabase
          .from("kc_schedules")
          .select("*")
          .eq("month", currentMonth);
        const fetchedSchedules = (schedData || []).map((s: any) => ({
          ...s,
          inspectors: s.inspectors || [],
        }));
        fetchedSchedules.sort((a, b) => a.date.localeCompare(b.date));
        setSchedules(fetchedSchedules);

        // Events
        const { data: eventData } = await supabase
          .from("kc_events")
          .select("*")
          .eq("month", currentMonth);
        const fetchedEvents = (eventData || []).map((e: any) => ({
          ...e,
          attendees: e.attendees || [],
        }));
        fetchedEvents.sort((a, b) => a.date.localeCompare(b.date));
        setEvents(fetchedEvents);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading || orgLoading) {
    return <div className="p-8 text-center text-surface-500">데이터를 불러오는 중입니다...</div>;
  }

  const mobileNavItems = [
    { to: "/monitoring", icon: "📅", label: "점검 조회/입력", color: "bg-blue-100 text-blue-700" },
    { to: "/data-management", icon: "📋", label: "점검 데이터", color: "bg-purple-100 text-purple-700" },
    { to: "/schedule", icon: "🗓️", label: "점검 스케줄", color: "bg-green-100 text-green-700" },
    { to: "/committee", icon: "👥", label: "명단 관리", color: "bg-orange-100 text-orange-700" },
    { to: "/events", icon: "🤝", label: "월별 행사", color: "bg-pink-100 text-pink-700" },
    { to: "/management", icon: "🏢", label: "코드 관리", color: "bg-indigo-100 text-indigo-700" },
    { to: "/yearly-report", icon: "📈", label: "연간 리포트", color: "bg-teal-100 text-teal-700" },
    { to: "/admin", icon: "⚙️", label: "시스템 설정", color: "bg-slate-100 text-slate-700" },
  ];

  return (
    <div className="animate-in fade-in duration-500 flex-1 flex flex-col items-stretch 2xl:min-h-0">
      
      {/* Mobile Menu View */}
      <div className="lg:hidden flex flex-col gap-4">
        <h2 className="text-xl font-bold text-surface-900 px-1 border-l-4 border-primary-500 pl-3">메뉴</h2>
        <div className="grid grid-cols-2 gap-4">
          {mobileNavItems.map((item, idx) => (
            <Link key={idx} to={item.to} className="bg-white rounded-xl shadow-sm border border-surface-200 p-4 flex flex-col items-center justify-center gap-3 hover:bg-surface-50 active:scale-95 transition-all">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${item.color}`}>
                {item.icon}
              </div>
              <span className="text-sm font-bold text-surface-700 text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop Dashboard View */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        
        {/* Monthly Events */}
        <Card className="border-surface-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>이번 달 행사 일정</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4 pt-2">
              {events.length === 0 && (
                <div className="text-sm text-surface-400 py-4 border-b border-surface-50 text-center">이번 달 등록된 행사가 없습니다.</div>
              )}
              {events.map((e, i) => (
                <div key={i} className="flex flex-col border-b border-surface-50 pb-3 last:border-0 hover:bg-surface-50 p-2 rounded transition-colors">
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="font-bold text-surface-800 text-base flex items-center gap-2">
                      <span className="text-pink-500">🤝</span> {e.title}
                    </span>
                    <span className="flex-shrink-0 text-sm font-medium text-surface-600 bg-surface-100 px-3 py-1 rounded-full">{e.date}</span>
                  </div>
                  <div className="text-sm text-surface-500 mt-2 ml-7">
                    <span className="font-medium mr-1">참석자:</span> {e.attendees && e.attendees.length > 0 ? e.attendees.join(", ") : "기록 없음"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Schedules */}
        <Card className="border-surface-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>이번 달 점검 스케줄</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4 pt-2">
              {schedules.length === 0 && (
                <div className="text-sm text-surface-400 py-4 border-b border-surface-50 text-center">이번 달 등록된 스케줄이 없습니다.</div>
              )}
              {schedules.map((s, i) => (
                <div key={i} className="flex flex-col border-b border-surface-50 pb-3 last:border-0 hover:bg-surface-50 p-2 rounded transition-colors">
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="font-bold text-surface-800 text-base flex items-center gap-2">
                      <span className="text-green-500">🗓️</span> {s.turn}차 점검
                    </span>
                    <span className="text-sm font-medium text-surface-600 bg-surface-100 px-3 py-1 rounded-full">{s.date}</span>
                  </div>
                  <div className="text-sm text-surface-500 mt-2 ml-7">
                    <span className="font-medium mr-1">점검자:</span> {s.inspectors && s.inspectors.length > 0 ? s.inspectors.join(", ") : "미정"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
