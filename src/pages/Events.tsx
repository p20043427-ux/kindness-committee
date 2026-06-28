import React, { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import { liveQuery } from "@/src/lib/db";
import { CommitteeMember } from "./Committee";
import { useToast } from "@/src/components/ui/Toast";

interface CommitteeEvent {
  id: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  attendees: string[]; // member IDs or Names
  createdAt: string;
}

export function Events() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CommitteeEvent[]>([]);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Default to current month
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<{
    date: string;
    title: string;
    description: string;
    attendees: string[];
  }>({
    date: new Date().toISOString().split("T")[0],
    title: "",
    description: "",
    attendees: []
  });

  useEffect(() => {
    // Fetch members
    const unsubscribeMembers = liveQuery<any>(
      "kc_committee",
      () => supabase.from("kc_committee").select("*"),
      (rows) => {
        setMembers(
          rows
            .map((r) => ({
              id: r.id,
              name: r.name,
              department: r.department || "",
              role: r.role || "",
              isActive: r.is_active !== false,
              createdAt: r.created_at || "",
            }))
            .filter((m) => m.isActive)
        );
      },
      (error) => console.error("Error fetching members:", error)
    );

    // Fetch events
    const unsubscribeEvents = liveQuery<any>(
      "kc_events",
      () =>
        supabase
          .from("kc_events")
          .select("*")
          .eq("month", filterMonth)
          .order("date", { ascending: true }),
      (rows) => {
        setEvents(
          rows.map((r) => ({
            id: r.id,
            month: r.month,
            date: r.date,
            title: r.title || "",
            description: r.description || "",
            attendees: r.attendees || [],
            createdAt: r.created_at || "",
          }))
        );
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching events:", error);
        toast(`행사 정보 조회 오류: ${error.message}`, "error");
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeMembers();
      unsubscribeEvents();
    };
  }, [filterMonth]);

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      title: "",
      description: "",
      attendees: []
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (eventRecord: CommitteeEvent) => {
    setFormData({
      date: eventRecord.date,
      title: eventRecord.title,
      description: eventRecord.description || "",
      attendees: eventRecord.attendees || []
    });
    setEditingId(eventRecord.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("kc_events").delete().eq("id", id);
      if (error) throw error;
      setDeletingId(null);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast("삭제 중 오류가 발생했습니다: " + error.message, "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.title.trim()) {
      toast("일자 및 행사명을 입력해주세요.", "warning");
      return;
    }
    
    const monthStr = formData.date.slice(0, 7);

    setIsSaving(true);
    try {
      const id = editingId || crypto.randomUUID();
      const payload: any = {
        id,
        month: monthStr,
        date: formData.date,
        title: formData.title,
        description: formData.description,
        attendees: formData.attendees,
      };
      if (!editingId) payload.created_at = new Date().toISOString();

      const { error } = await supabase.from("kc_events").upsert(payload);
      if (error) throw error;
      toast(editingId ? "행사 기록이 수정되었습니다." : "행사 기록이 저장되었습니다.", "success");
      resetForm();
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast(`저장 중 오류가 발생했습니다: ${error.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAttendee = (memberName: string) => {
    setFormData(prev => {
      if (prev.attendees.includes(memberName)) {
        return { ...prev, attendees: prev.attendees.filter(n => n !== memberName) };
      } else {
        return { ...prev, attendees: [...prev.attendees, memberName] };
      }
    });
  };

  const displayEvents = events.filter(s => s.month === filterMonth);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-40 bg-surface-200 rounded-lg motion-safe:animate-pulse" />
            <div className="h-4 w-64 bg-surface-100 rounded motion-safe:animate-pulse" />
          </div>
          <div className="h-10 w-28 bg-surface-200 rounded-lg motion-safe:animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden divide-y divide-surface-100">
          {[1,2,3].map(i => (
            <div key={i} className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 bg-surface-100 rounded-md motion-safe:animate-pulse" />
                <div className="h-5 w-40 bg-surface-200 rounded motion-safe:animate-pulse" />
              </div>
              <div className="h-4 w-full bg-surface-100 rounded motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900 border-l-4 border-primary-500 pl-3">월별 행사 관리</h1>
          <p className="text-surface-500 text-sm mt-1">위원회 단위의 행사, 회의 내역 및 참석자를 기록합니다.</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border border-surface-300 rounded-lg px-3 py-2 text-surface-900 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm transition-colors whitespace-nowrap"
          >
            + 행사 기록
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold mb-4">{editingId ? "행사 기록 수정" : "새 행사 기록"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">행사 일자</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">행사명</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500"
                  placeholder="예: 정기 회의, 캠페인 등"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-1">상세 내용</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 h-24 resize-none"
                  placeholder="행사 및 회의 내용을 간략히 기록합니다."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-2">참석 위원 선택</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(member => {
                    const isSelected = formData.attendees.includes(member.name);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleAttendee(member.name)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          isSelected
                            ? 'bg-primary-100 border-primary-500 text-primary-800 font-medium'
                            : 'bg-white border-surface-300 text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        {member.name}{member.department ? ` (${member.department})` : ''}
                      </button>
                    );
                  })}
                  {members.length === 0 && (
                    <span className="text-sm text-surface-500 italic">등록된 활동 위원이 없습니다. 위원회 명단 관리를 먼저 확인해주세요.</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-surface-100 mt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-surface-600 bg-surface-100 hover:bg-surface-200 rounded-md font-medium transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {isSaving ? "저장 중..." : editingId ? "수정완료" : "저장완료"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        {displayEvents.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            해당 월에 등록된 행사/회의가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {displayEvents.map(eventRecord => (
              <div key={eventRecord.id} className="p-4 sm:p-6 hover:bg-surface-50 transition-colors flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-1 bg-surface-100 text-surface-800 text-xs font-semibold rounded-md border border-surface-200">
                      📅 {eventRecord.date}
                    </span>
                    <h3 className="font-bold text-surface-900 text-lg">
                      {eventRecord.title}
                    </h3>
                  </div>
                  
                  {eventRecord.description && (
                    <p className="text-sm text-surface-600 whitespace-pre-wrap mb-4 bg-white p-3 rounded-md border border-surface-100">
                      {eventRecord.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-surface-500">참석자:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {eventRecord.attendees && eventRecord.attendees.length > 0 ? (
                        eventRecord.attendees.map((att, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {att}
                          </span>
                        ))
                      ) : (
                        <span className="text-surface-400 text-xs italic">기록된 참석자가 없습니다.</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 self-start pt-1">
                  {deletingId === eventRecord.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium whitespace-nowrap">삭제할까요?</span>
                      <button
                        onClick={() => handleDelete(eventRecord.id)}
                        className="px-3 py-1.5 text-white bg-red-600 rounded-md text-sm hover:bg-red-700 font-medium transition-colors whitespace-nowrap"
                      >
                        네
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1.5 text-surface-600 bg-surface-100 rounded-md text-sm hover:bg-surface-200 font-medium transition-colors whitespace-nowrap"
                      >
                        아니요
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(eventRecord)}
                        className="px-3 py-1.5 text-surface-600 bg-white border border-surface-200 rounded-md text-sm hover:bg-surface-50 font-medium transition-colors whitespace-nowrap"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => setDeletingId(eventRecord.id)}
                        className="px-3 py-1.5 text-red-600 bg-white border border-surface-200 rounded-md text-sm hover:bg-red-50 font-medium transition-colors whitespace-nowrap"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {displayEvents.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden mt-8">
          <div className="bg-surface-50 px-6 py-4 border-b border-surface-200">
            <h2 className="text-lg font-bold text-surface-900">위원별 참여 현황 <span className="text-sm font-normal text-surface-500 ml-2">({filterMonth})</span></h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-50/50 text-surface-600 border-b border-surface-200">
                <tr>
                  <th className="py-3 px-4 font-semibold sticky left-0 bg-surface-50 z-10 w-48 shadow-[1px_0_0_0_#e5e7eb]">위원명 (소속)</th>
                  {displayEvents.map((evt) => (
                    <th key={evt.id} className="py-3 px-4 font-semibold text-center min-w-[100px]">
                      {evt.date.slice(5)}<br/>
                      <span className="text-[10px] font-normal w-24 inline-block truncate" title={evt.title}>{evt.title}</span>
                    </th>
                  ))}
                  <th className="py-3 px-4 font-semibold text-center bg-surface-50">참석 횟수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {members.map(member => {
                  let attendCount = 0;
                  return (
                    <tr key={member.id} className="hover:bg-surface-50 transition-colors">
                      <td className="py-2 px-4 font-medium text-surface-900 sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#e5e7eb]">
                        {member.name} <span className="text-xs text-surface-500 font-normal">({member.department || '-'})</span>
                      </td>
                      {displayEvents.map(evt => {
                        const attended = evt.attendees?.includes(member.name);
                        if (attended) attendCount++;
                        return (
                          <td key={evt.id} className="py-2 px-4 text-center">
                            {attended ? (
                              <span className="inline-flex w-6 h-6 rounded-full bg-green-100 text-green-600 items-center justify-center font-bold text-xs mx-auto">
                                O
                              </span>
                            ) : (
                              <span className="text-surface-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-4 text-center font-bold text-surface-700 bg-surface-50/30">
                        {attendCount} / {displayEvents.length}
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={displayEvents.length + 2} className="py-8 text-center text-surface-500">등록된 위원이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
