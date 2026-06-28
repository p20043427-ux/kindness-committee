import React, { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import { liveQuery } from "@/src/lib/db";
import { useToast } from "@/src/components/ui/Toast";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Badge } from "@/src/components/ui/Badge";
import { Search, UserPlus } from "lucide-react";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", department: "", role: "", isActive: true });

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  useEffect(() => {
    const unsubscribe = liveQuery<any>(
      "kc_committee",
      () => supabase.from("kc_committee").select("*").order("created_at", { ascending: false }),
      (rows) => {
        setMembers(rows.map(r => ({
          id: r.id,
          name: r.name,
          department: r.department || "",
          role: r.role || "",
          isActive: r.is_active !== false,
          createdAt: r.created_at || "",
        })));
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", department: "", role: "", isActive: true });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (member: CommitteeMember) => {
    setFormData({ name: member.name, department: member.department, role: member.role, isActive: member.isActive });
    setEditingId(member.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast("이름을 입력해주세요.", "warning"); return; }
    setIsSaving(true);
    try {
      const row = { name: formData.name, department: formData.department, role: formData.role, is_active: formData.isActive };
      if (editingId) {
        const { error } = await supabase.from("kc_committee").update(row).eq("id", editingId);
        if (error) throw error;
        toast("위원 정보를 수정했습니다.", "success");
      } else {
        const { error } = await supabase.from("kc_committee").insert({ id: crypto.randomUUID(), ...row, created_at: new Date().toISOString() });
        if (error) throw error;
        toast("새 위원을 추가했습니다.", "success");
      }
      resetForm();
    } catch (error: any) {
      toast("저장 중 오류: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("kc_committee").delete().eq("id", id);
      if (error) throw error;
      setDeletingId(null);
      toast("위원을 삭제했습니다.", "success");
    } catch (error: any) {
      toast("삭제 중 오류: " + error.message, "error");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300 max-w-4xl mx-auto">
        <div className="flex justify-between items-center pb-4" style={{ borderBottom: "1px solid #D1D9E6" }}>
          <div className="flex gap-3"><div className="w-0.5 h-8 bg-surface-200 rounded-full motion-safe:animate-pulse" /><div className="h-6 w-40 bg-surface-200 rounded motion-safe:animate-pulse" /></div>
          <div className="h-8 w-24 bg-surface-200 rounded motion-safe:animate-pulse" />
        </div>
        <div className="bg-white rounded border border-surface-200 overflow-hidden">
          <div className="h-10 bg-surface-50 border-b border-surface-200" />
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-surface-100">
              <div className="h-3.5 w-20 bg-surface-200 rounded motion-safe:animate-pulse" />
              <div className="h-3.5 w-28 bg-surface-100 rounded motion-safe:animate-pulse" />
              <div className="h-3.5 w-20 bg-surface-100 rounded motion-safe:animate-pulse" />
              <div className="h-5 w-14 bg-surface-200 rounded motion-safe:animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-4xl mx-auto">

      <PageHeader
        title="위원회 명단 관리"
        description="환경/에너지 관리 위원회 명단을 관리합니다."
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" aria-hidden />
          <Input
            type="search"
            placeholder="이름·소속·역할..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-7 w-44"
            aria-label="위원 검색"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<UserPlus className="w-3.5 h-3.5" aria-hidden />}
          onClick={() => setIsFormOpen(true)}
        >
          위원 추가
        </Button>
      </PageHeader>

      {/* Form panel */}
      {isFormOpen && (
        <div className="bg-white rounded border border-surface-200 overflow-hidden">
          <div className="bg-surface-50 border-b border-surface-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-surface-700">
              {editingId ? "위원 정보 수정" : "새 위원 추가"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-surface-600">이름 *</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 홍길동"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-surface-600">소속 부서/직책</label>
                <Input
                  type="text"
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  placeholder="예: 총무팀장"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-surface-600">위원회 역할</label>
                <Input
                  type="text"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  placeholder="예: 점검위원"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-xs font-medium text-surface-700">활동 중 (현재 위원)</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-surface-100">
              <Button type="button" variant="secondary" size="md" onClick={resetForm} disabled={isSaving}>취소</Button>
              <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
                {editingId ? "수정완료" : "추가완료"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="py-2.5 px-4 text-[10px] font-bold text-surface-500 uppercase tracking-widest">이름</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-surface-500 uppercase tracking-widest">소속/직책</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-surface-500 uppercase tracking-widest">역할</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-surface-500 uppercase tracking-widest">상태</th>
                <th className="py-2.5 px-4 text-[10px] font-bold text-surface-500 uppercase tracking-widest text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-surface-400">
                    {searchQuery ? `"${searchQuery}"에 해당하는 위원이 없습니다.` : "등록된 위원이 없습니다."}
                  </td>
                </tr>
              ) : filteredMembers.map(member => (
                <tr key={member.id} className="hover:bg-surface-50 transition-colors">
                  <td className="py-2.5 px-4 text-xs font-semibold text-surface-900">{member.name}</td>
                  <td className="py-2.5 px-4 text-xs text-surface-600">{member.department}</td>
                  <td className="py-2.5 px-4 text-xs text-surface-600">{member.role}</td>
                  <td className="py-2.5 px-4">
                    <Badge variant={member.isActive ? "success" : "secondary"}>
                      {member.isActive ? "활동 중" : "비활동"}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {deletingId === member.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-red-600 font-medium">삭제할까요?</span>
                        <Button type="button" variant="danger" size="sm" onClick={() => handleDelete(member.id)}>네</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDeletingId(null)}>아니요</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(member)}>수정</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDeletingId(member.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50">삭제</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-surface-100 bg-surface-50">
          <span className="text-[10px] text-surface-400 font-mono tabular-nums">
            총 {members.length}명
            {searchQuery ? ` · 검색결과 ${filteredMembers.length}명` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
