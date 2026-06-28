import React, { useState, useEffect } from "react";
import { CategoryKey } from "@/src/lib/data";
import { supabase } from "@/src/lib/supabase";
import { CategoryScores } from "@/src/lib/db";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { useOrganization } from "@/src/components/layout/OrganizationProvider";
import { useSettings } from "@/src/components/layout/SettingsProvider";
import { useToast } from "@/src/components/ui/Toast";
import { Button } from "@/src/components/ui/Button";
import { Select } from "@/src/components/ui/Input";

interface InlineInputFormProps {
  buildingId: string;
  departmentId: string;
  inspectionDate: string;
  defaultInspector?: string;
  defaultFocus?: string;
  defaultSubScores?: Record<string, number>;
  defaultNotes?: string;
  isEditing?: boolean;
  members?: {id: string, name: string}[];
  onSuccess: () => void;
  onCancel: () => void;
}

const zeroScores: CategoryScores = { greeting: 0, response: 0, phone: 0, appearance: 0, environment: 0 };

/** 점수만 기준으로 상태 판정 — notes 여부는 상태에 영향 없음 */
function focusStatus(score: number): '정상' | '주의' | '긴급' {
  if (score <= 4) return '긴급';
  if (score < 8)  return '주의';
  return '정상';
}

export function InlineInputForm({ buildingId, departmentId, inspectionDate, defaultInspector = "", defaultFocus = "", defaultSubScores, defaultNotes = "", isEditing = false, members = [], onSuccess, onCancel }: InlineInputFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { departments } = useOrganization();
  const { categories, getFocusForMonth } = useSettings();

  const monthFocus = getFocusForMonth(inspectionDate.slice(0, 7));

  const [inspector, setInspector] = useState(defaultInspector);
  const [focusCategory, setFocusCategory] = useState(defaultFocus || monthFocus);
  const [notes, setNotes] = useState(defaultNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (defaultInspector) setInspector(defaultInspector);
  }, [defaultInspector]);

  useEffect(() => {
    const auto = defaultFocus || monthFocus;
    if (auto && !focusCategory) setFocusCategory(auto);
  }, [defaultFocus, monthFocus]);

  const [subScores, setSubScores] = useState<Record<string, number>>(defaultSubScores ?? {});

  useEffect(() => {
    if (!focusCategory) return;
    const cat = categories.find(c => c.key === focusCategory);
    if (!cat?.subCriteria?.length) return;
    setSubScores(prev => {
      const next = { ...prev };
      cat.subCriteria.forEach(sub => {
        const k = `${cat.key}_${sub.key}`;
        if (!(k in next)) next[k] = sub.max;
      });
      return next;
    });
  }, [focusCategory, categories]);

  const setSubScore = (catKey: string, subKey: string, value: number) =>
    setSubScores(prev => ({ ...prev, [`${catKey}_${subKey}`]: value }));

  const getFocusScore = (): number => {
    if (!focusCategory) return 0;
    const cat = categories.find(c => c.key === focusCategory);
    if (!cat?.subCriteria?.length) return 0;
    return Math.min(
      cat.max,
      cat.subCriteria.reduce((sum, sub) => sum + (subScores[`${cat.key}_${sub.key}`] ?? sub.max), 0)
    );
  };

  const focusScore = getFocusScore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!inspector) {
      setErrorMessage("점검자 성명을 선택해주세요.");
      return;
    }
    if (!focusCategory) {
      setErrorMessage("이번 달 중점사항을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const deptName = departments.find(d => d.id === departmentId)?.name || "";
      const scores: CategoryScores = { ...zeroScores, [focusCategory]: focusScore };
      const status = focusStatus(focusScore);
      const inspectionDateIso = inspectionDate + "T09:00:00Z";
      const nowIso = new Date().toISOString();

      const { data: existing } = await supabase
        .from("kc_records")
        .select("id")
        .eq("department_id", departmentId)
        .eq("date", inspectionDateIso)
        .maybeSingle();

      const payload = {
        building_id: buildingId,
        department_id: departmentId,
        department_name: deptName,
        inspector,
        date: inspectionDateIso,
        greeting: scores.greeting,
        response: scores.response,
        phone: scores.phone,
        appearance: scores.appearance,
        environment: scores.environment,
        focus_category: focusCategory,
        sub_scores: subScores,
        total_score: focusScore,
        notes: notes.trim(),
        status,
        updated_at: nowIso,
        user_id: user?.uid || "anonymous",
      };

      let error;
      if (existing) {
        ({ error } = await supabase.from("kc_records").update(payload).eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("kc_records").insert({
          ...payload,
          id: crypto.randomUUID(),
          created_at: nowIso,
        }));
      }
      if (error) throw error;

      toast(`${inspector}님의 친절점검 결과가 저장되었습니다.`, "success");
      onSuccess();
    } catch (error) {
      console.error("Error adding document: ", error);
      setErrorMessage("서버 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      toast("저장 중 오류가 발생했습니다.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const focusCat = focusCategory ? categories.find(c => c.key === focusCategory) : null;
  const statusLabel = focusStatus(focusScore);
  const statusClass =
    statusLabel === "정상" ? "text-green-700 bg-green-50 border-green-200" :
    statusLabel === "주의" ? "text-amber-700 bg-amber-50 border-amber-200" :
                             "text-red-700 bg-red-50 border-red-200";

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-4 bg-surface-50 border border-surface-200 rounded space-y-4">
      <div className="text-xs font-bold uppercase tracking-widest text-surface-500 border-b border-surface-200 pb-2">
        친절점검표 입력 ({inspectionDate})
      </div>

      {errorMessage && (
        <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-surface-600">점검자 성명</label>
          <Select
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
          >
            <option value="">점검자를 선택하세요</option>
            {members.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-surface-600">이번 달 중점사항</label>
          <Select
            value={focusCategory}
            onChange={(e) => setFocusCategory(e.target.value)}
          >
            <option value="">중점사항 선택</option>
            {categories.map(c => (
              <option key={c.key} value={c.key}>
                {c.name}{monthFocus === c.key ? " (이번 달 중점)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* 중점사항 미선택 안내 */}
      {!focusCat && (
        <div className="py-5 text-center text-xs text-surface-400">
          이번 달 중점사항을 선택하면 평가 항목이 표시됩니다.
        </div>
      )}

      {/* 중점사항 카테고리 세부항목 */}
      {focusCat && (
        <div className="rounded p-4 bg-primary-50 border border-primary-200 space-y-4">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-surface-800">{focusCat.name}</span>
              <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded">중점사항</span>
            </div>
            <span className="text-sm font-bold text-primary-600 font-mono tabular-nums">{focusScore} / {focusCat.max}</span>
          </div>

          <div className="space-y-4">
            {focusCat.subCriteria.map(sub => {
              const subKey = `${focusCat.key}_${sub.key}`;
              const val = subScores[subKey] ?? sub.max;
              return (
                <div key={sub.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-surface-700">{sub.name}</span>
                      <span className="ml-1.5 text-[10px] text-surface-400 font-mono">({sub.max}점)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSubScore(focusCat.key, sub.key, Math.max(0, val - 1))}
                        aria-label={`${sub.name} 점수 감소`}
                        className="w-10 h-10 rounded border border-surface-300 bg-white text-surface-700 hover:bg-surface-100 active:bg-surface-200 font-bold flex items-center justify-center text-lg transition-colors"
                      >−</button>
                      <span
                        className="font-mono font-bold text-sm w-14 text-center tabular-nums"
                        aria-live="polite"
                        aria-label={`${sub.name} ${val}점`}
                      >{val} / {sub.max}</span>
                      <button
                        type="button"
                        onClick={() => setSubScore(focusCat.key, sub.key, Math.min(sub.max, val + 1))}
                        aria-label={`${sub.name} 점수 증가`}
                        className="w-10 h-10 rounded border border-surface-300 bg-white text-surface-700 hover:bg-surface-100 active:bg-surface-200 font-bold flex items-center justify-center text-lg transition-colors"
                      >+</button>
                    </div>
                  </div>
                  <ul className="text-xs text-surface-500 space-y-0.5 pl-1">
                    {sub.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-primary-400 mt-0.5 shrink-0">{i + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="pt-1 border-t border-primary-200">
            <div className="flex justify-between text-xs text-primary-700 font-semibold mb-1">
              <span>소계</span>
              <span className="font-mono tabular-nums">{focusScore} / {focusCat.max}점</span>
            </div>
            <div className="h-1.5 bg-primary-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-300"
                style={{ width: `${(focusScore / focusCat.max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1 text-sm">
        <label className="block text-xs font-medium text-surface-600">칭찬 및 지적사항 (특이사항)</label>
        <textarea
          rows={2}
          className="w-full rounded border border-surface-300 p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white resize-none text-surface-900 placeholder:text-surface-400"
          placeholder="특이사항을 기록해 주세요."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-surface-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-surface-700">
            총점 <span className="text-primary-600 font-mono tabular-nums">{focusScore}</span> / {focusCat?.max ?? 10}
          </span>
          {focusCat && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusClass}`}>
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            {isEditing ? "수정완료" : "등록"}
          </Button>
        </div>
      </div>
    </form>
  );
}
