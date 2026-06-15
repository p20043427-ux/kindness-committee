import React, { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import { liveQuery } from "@/src/lib/db";
import { CommitteeMember } from "./Committee";
import { useToast } from "@/src/components/ui/Toast";

interface InspectionSchedule {
  id: string;
  month: string; // YYYY-MM
  turn: 1 | 2; // 1차 or 2차
  date: string; // YYYY-MM-DD
  inspectors: string[]; // member IDs or Names
  note: string;
  createdAt: string;
}

export function Schedule() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([]);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Default to current month
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    turn: 1 | 2;
    date: string;
    inspectors: string[];
    note: string;
  }>({
    turn: 1,
    date: new Date().toISOString().split("T")[0],
    inspectors: [],
    note: ""
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

    // Fetch schedules
    const unsubscribeSchedules = liveQuery<any>(
      "kc_schedules",
      () =>
        supabase
          .from("kc_schedules")
          .select("*")
          .eq("month", filterMonth)
          .order("date", { ascending: true }),
      (rows) => {
        setSchedules(
          rows.map((r) => ({
            id: r.id,
            month: r.month,
            turn: r.turn,
            date: r.date,
            inspectors: r.inspectors || [],
            note: r.note || "",
            createdAt: r.created_at || "",
          }))
        );
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching schedules:", error);
        toast(`스케줄 조회 오류: ${error.message}`, "error");
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeMembers();
      unsubscribeSchedules();
    };
  }, [filterMonth]);

  const resetForm = () => {
    setFormData({
      turn: 1,
      date: new Date().toISOString().split("T")[0],
      inspectors: [],
      note: ""
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (sched: InspectionSchedule) => {
    setFormData({
      turn: sched.turn,
      date: sched.date,
      inspectors: sched.inspectors || [],
      note: sched.note || ""
    });
    setEditingId(sched.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("kc_schedules").delete().eq("id", id);
      if (error) throw error;
      setDeletingId(null);
    } catch (error: any) {
      console.error("Error deleting member:", error);
      toast("삭제 중 오류가 발생했습니다: " + error.message, "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date) return;
    
    // Extract YYYY-MM from date to ensure they match logically
    const monthStr = formData.date.slice(0, 7);

    try {
      const id = editingId || Date.now().toString();
      const payload: any = {
        id,
        month: monthStr,
        turn: formData.turn,
        date: formData.date,
        inspectors: formData.inspectors,
        note: formData.note,
      };
      if (!editingId) {
        payload.created_at = new Date().toISOString();
      }

      const { error } = await supabase.from("kc_schedules").upsert(payload);
      if (error) throw error;
      resetForm();
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast(`저장 중 오류가 발생했습니다.`, "error");
    }
  };

  const toggleInspector = (memberName: string) => {
    setFormData(prev => {
      if (prev.inspectors.includes(memberName)) {
        return { ...prev, inspectors: prev.inspectors.filter(n => n !== memberName) };
      } else {
        if (prev.inspectors.length >= 2) {
          toast("한 회차당 점검자는 최대 2명까지만 선택할 수 있습니다.", "warning");
          return prev;
        }
        return { ...prev, inspectors: [...prev.inspectors, memberName] };
      }
    });
  };

  // Filter schedules explicitly for the selected month
  const displaySchedules = schedules.filter(s => s.month === filterMonth);

  if (isLoading) {
    return <div className="p-8 text-center text-surface-500">스케줄을 불러오는 중입니다...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900 border-l-4 border-primary-500 pl-3">점검 스케줄</h1>
          <p className="text-surface-500 text-sm mt-1">월별 점검 1차, 2차 스케줄과 배정 인원을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="rounded-lg border-surface-300 text-surface-900 font-semibold focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm transition-colors whitespace-nowrap"
          >
            + 스케줄 추가
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold mb-4">{editingId ? "스케줄 수정" : "새 스케줄 추가"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">점검 일자</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">구분</label>
                <select
                  value={formData.turn}
                  onChange={(e) => setFormData({ ...formData, turn: Number(e.target.value) as 1 | 2 })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500"
                >
                  <option value={1}>1차 점검</option>
                  <option value={2}>2차 점검</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-2">점검자 배정 (최대 2명 선택)</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(member => {
                    const isSelected = formData.inspectors.includes(member.name);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleInspector(member.name)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          isSelected 
                            ? 'bg-primary-100 border-primary-500 text-primary-800 font-medium' 
                            : 'bg-white border-surface-300 text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        {member.name} {member.department ? `(${member.department})` : ''}
                      </button>
                    );
                  })}
                  {members.length === 0 && (
                    <span className="text-sm text-surface-500 italic">등록된 활동 위원이 없습니다. 위원회 명단 관리를 먼저 확인해주세요.</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-1">비고 (특이사항)</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500"
                  placeholder="예: 시간 변동 등 안내사항"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-surface-600 bg-surface-100 hover:bg-surface-200 rounded-md font-medium transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors"
              >
                {editingId ? "수정완료" : "추가완료"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        {displaySchedules.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            해당 월에 등록된 점검 스케줄이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {displaySchedules.map(sched => (
              <div key={sched.id} className="p-4 sm:p-6 hover:bg-surface-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="bg-primary-50 text-primary-700 font-bold px-4 py-2 rounded-lg text-center min-w-[80px]">
                    <div className="text-xs uppercase opacity-80 mb-0.5">{sched.month}</div>
                    <div className="text-lg">{sched.turn}차</div>
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-900 text-lg sm:text-xl flex items-center gap-2">
                      📅 {sched.date}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-surface-600">
                      <span className="font-medium">점검자:</span>
                      {sched.inspectors && sched.inspectors.length > 0 ? (
                        sched.inspectors.map((ins, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-100 text-surface-800">
                            {ins}
                          </span>
                        ))
                      ) : (
                        <span className="text-surface-400 italic">미정</span>
                      )}
                    </div>
                    {sched.note && (
                      <p className="mt-2 text-sm text-surface-500 flex items-center gap-1">
                        <span className="opacity-70">💬</span> {sched.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                  {deletingId === sched.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">정말 삭제할까요?</span>
                      <button
                        onClick={() => handleDelete(sched.id)}
                        className="px-3 py-1.5 text-white bg-red-600 rounded-md text-sm hover:bg-red-700 font-medium transition-colors"
                      >
                        네, 삭제
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1.5 text-surface-600 bg-surface-100 rounded-md text-sm hover:bg-surface-200 font-medium transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(sched)}
                        className="px-3 py-1.5 text-surface-600 bg-white border border-surface-200 rounded-md text-sm hover:bg-surface-50 font-medium transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => setDeletingId(sched.id)}
                        className="px-3 py-1.5 text-red-600 bg-white border border-surface-200 rounded-md text-sm hover:bg-red-50 font-medium transition-colors"
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
    </div>
  );
}
