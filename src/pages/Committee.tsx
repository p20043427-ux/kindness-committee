import React, { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import { liveQuery } from "@/src/lib/db";
import { useToast } from "@/src/components/ui/Toast";

export interface CommitteeMember {
  id: string;
  name: string;
  department: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export function Committee() {
  const { toast } = useToast();
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", department: "", role: "", isActive: true });

  useEffect(() => {
    const unsubscribe = liveQuery<any>(
      "kc_committee",
      () => supabase.from("kc_committee").select("*").order("created_at", { ascending: false }),
      (rows) => {
        setMembers(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            department: r.department || "",
            role: r.role || "",
            isActive: r.is_active !== false,
            createdAt: r.created_at || "",
          }))
        );
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching members:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", department: "", role: "", isActive: true });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (member: CommitteeMember) => {
    setFormData({
      name: member.name,
      department: member.department,
      role: member.role,
      isActive: member.isActive !== false,
    });
    setEditingId(member.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast("이름을 입력해주세요.", "warning");
      return;
    }

    try {
      const row = {
        name: formData.name,
        department: formData.department,
        role: formData.role,
        is_active: formData.isActive,
      };
      if (editingId) {
        const { error } = await supabase.from("kc_committee").update(row).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kc_committee").insert({
          id: Date.now().toString(),
          ...row,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      resetForm();
    } catch (error: any) {
      console.error("Error saving member:", error);
      toast("저장 중 오류가 발생했습니다: " + error.message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("kc_committee").delete().eq("id", id);
      if (error) throw error;
      setDeletingId(null);
    } catch (error: any) {
      console.error("Error deleting member:", error);
      toast("삭제 중 오류가 발생했습니다: " + error.message, "error");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-surface-500">명단을 불러오는 중입니다...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900 border-l-4 border-primary-500 pl-3">위원회 명단 관리</h1>
          <p className="text-surface-500 text-sm mt-1">환경/에너지 관리 위원회 명단을 관리합니다.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm transition-colors"
        >
          + 위원 추가
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold mb-4">{editingId ? "위원 정보 수정" : "새 위원 추가"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">이름</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="예: 홍길동"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">소속 부서/직책</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="예: 총무팀장"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">위원회 역할</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-md border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="예: 점검위원"
                />
              </div>
              <div className="flex items-center mt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-surface-700">활동 중 (현재 위원)</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-surface-50 text-surface-600 border-b border-surface-200">
            <tr>
              <th className="py-3 px-4 font-semibold">이름</th>
              <th className="py-3 px-4 font-semibold">소속/직책</th>
              <th className="py-3 px-4 font-semibold">위원회 역할</th>
              <th className="py-3 px-4 font-semibold">상태</th>
              <th className="py-3 px-4 font-semibold text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-surface-500">
                  등록된 위원이 없습니다.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="hover:bg-surface-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-surface-900">{member.name}</td>
                  <td className="py-3 px-4 text-surface-600">{member.department}</td>
                  <td className="py-3 px-4 text-surface-600">{member.role}</td>
                  <td className="py-3 px-4 text-surface-600">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-md ${member.isActive ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-600'}`}>
                      {member.isActive ? '활동 중' : '비활동'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {deletingId === member.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-red-600 font-medium">삭제할까요?</span>
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="px-2 py-1 text-white bg-red-600 rounded text-xs hover:bg-red-700 transition-colors"
                        >
                          네
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 text-surface-600 bg-surface-100 rounded text-xs hover:bg-surface-200 transition-colors"
                        >
                          아니요
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(member)}
                          className="px-2 py-1 text-primary-600 bg-primary-50 rounded text-xs hover:bg-primary-100 mr-2 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => setDeletingId(member.id)}
                          className="px-2 py-1 text-red-600 bg-red-50 rounded text-xs hover:bg-red-100 transition-colors"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
