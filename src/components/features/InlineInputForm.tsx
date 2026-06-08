import React, { useState, useEffect } from "react";
import { KINDNESS_CATEGORIES, CategoryKey } from "@/src/lib/data";
import { supabase } from "@/src/lib/supabase";
import { computeStatus, CategoryScores } from "@/src/lib/db";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";

interface InlineInputFormProps {
  buildingId: string;
  departmentId: string;
  inspectionDate: string;
  defaultInspector?: string;
  defaultFocus?: string;
  members?: {id: string, name: string}[];
  onSuccess: () => void;
  onCancel: () => void;
}

const initialScores: CategoryScores = { greeting: 7, response: 7, phone: 7, appearance: 7, environment: 7 };

export function InlineInputForm({ buildingId, departmentId, inspectionDate, defaultInspector = "", defaultFocus = "", members = [], onSuccess, onCancel }: InlineInputFormProps) {
  const { user } = useAuth();
  const { buildings, departments } = useOrganization();
  const [inspector, setInspector] = useState(defaultInspector);
  const [focusCategory, setFocusCategory] = useState(defaultFocus);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 상위에서 기본 점검자 이름이 변경되면 로컬 상태도 업데이트 (입력된 값이 없을 때만)
  useEffect(() => {
    if (defaultInspector && !inspector) {
      setInspector(defaultInspector);
    }
  }, [defaultInspector]);

  useEffect(() => {
    if (defaultFocus && !focusCategory) setFocusCategory(defaultFocus);
  }, [defaultFocus]);

  const [scores, setScores] = useState<CategoryScores>(initialScores);

  const setScore = (key: CategoryKey, value: number) =>
    setScores(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!inspector) {
      setErrorMessage("점검자 성명을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const deptName = departments.find(d => d.id === departmentId)?.name || "";

      const totalScore =
        scores.greeting + scores.response + scores.phone + scores.appearance + scores.environment;
      const status = computeStatus(scores, notes);

      const recordId = "REC-" + Date.now().toString(36).toUpperCase();
      const nowIso = new Date().toISOString();

      const { error } = await supabase.from("kc_records").insert({
        id: recordId,
        building_id: buildingId,
        department_id: departmentId,
        department_name: deptName,
        inspector,
        date: inspectionDate + "T09:00:00Z",
        greeting: scores.greeting,
        response: scores.response,
        phone: scores.phone,
        appearance: scores.appearance,
        environment: scores.environment,
        focus_category: focusCategory,
        total_score: totalScore,
        notes: notes.trim(),
        status,
        created_at: nowIso,
        updated_at: nowIso,
        user_id: user?.uid || "anonymous",
      });
      if (error) throw error;

      alert(`${inspector}님의 친절점검 결과가 동기화되었습니다. ✅`);
      onSuccess();
    } catch (error) {
      console.error("Error adding document: ", error);
      setErrorMessage("서버 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-4 bg-surface-50 border border-surface-200 rounded-xl space-y-4">
      <div className="text-sm font-bold text-surface-900 border-b border-surface-200 pb-2">친절점검표 입력 ({inspectionDate})</div>

      {errorMessage && (
        <div className="p-3 my-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="space-y-2">
          <label className="font-medium text-surface-700">점검자 성명</label>
          <select
            className="w-full rounded-md border border-surface-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
          >
            <option value="">점검자를 선택하세요</option>
            {members.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="font-medium text-surface-700">이번 달 중점사항</label>
          <select
            className="w-full rounded-md border border-surface-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
            value={focusCategory}
            onChange={(e) => setFocusCategory(e.target.value)}
          >
            <option value="">중점사항 선택 (선택)</option>
            {KINDNESS_CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-5">
        {KINDNESS_CATEGORIES.map(cat => (
          <div key={cat.key} className="flex flex-col space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-surface-800">
                {cat.name}
                {focusCategory === cat.key && (
                  <span className="ml-2 text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">중점</span>
                )}
              </span>
              <span className="text-sm font-bold text-primary-600 font-mono">{scores[cat.key]} / {cat.max}</span>
            </div>
            <p className="text-xs text-surface-400">{cat.details}</p>
            <input
              type="range"
              min={0}
              max={cat.max}
              step={1}
              value={scores[cat.key]}
              onChange={(e) => setScore(cat.key, Number(e.target.value))}
              className="w-full accent-primary-600 cursor-pointer"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 text-sm">
        <label className="font-medium text-surface-700">칭찬 및 지적사항 (특이사항)</label>
        <textarea
          rows={2}
          className="w-full rounded-md border border-surface-300 p-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white resize-none"
          placeholder="만점 또는 지적 시 사유를 꼭 기록해 주세요."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        ></textarea>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm font-bold text-surface-700">
          총점 <span className="text-primary-600 font-mono">{scores.greeting + scores.response + scores.phone + scores.appearance + scores.environment}</span> / 50
        </span>
        <div className="flex space-x-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-surface-300 text-surface-700 font-medium text-sm hover:bg-surface-100 transition-colors" disabled={isSubmitting}>
            취소
          </button>
          <button type="submit" disabled={isSubmitting} className="px-3 py-1.5 rounded-lg bg-surface-900 text-white font-medium text-sm hover:bg-surface-800 transition-colors disabled:opacity-50">
            {isSubmitting ? "전송 중..." : "등록 🚀"}
          </button>
        </div>
      </div>
    </form>
  );
}
