import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { liveQuery } from '@/src/lib/db';
import { KINDNESS_CATEGORIES, InspectionCategory, CategoryKey } from '@/src/lib/data';

/** 월별 중점사항 맵: "YYYY-MM" -> 카테고리 key ("greeting" 등) */
export type MonthlyFocusMap = Record<string, CategoryKey>;

interface SettingsContextType {
  categories: InspectionCategory[];
  monthlyFocus: MonthlyFocusMap;
  isLoading: boolean;
  /** 해당 월("YYYY-MM")의 중점사항 카테고리 key. 미지정이면 "" */
  getFocusForMonth: (yearMonth: string) => CategoryKey | '';
  /** key로 카테고리 이름 조회 (없으면 key 그대로) */
  categoryName: (key: string) => string;
  saveCategories: (cats: InspectionCategory[]) => Promise<void>;
  saveMonthlyFocus: (focus: MonthlyFocusMap) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const VALID_KEYS = KINDNESS_CATEGORIES.map((c) => c.key);

/** DB 값과 기본값을 병합 — key/max(점수 체계)는 고정, 이름/세부항목만 덮어씀 */
function mergeCategories(stored: any): InspectionCategory[] {
  if (!Array.isArray(stored)) return KINDNESS_CATEGORIES;
  return KINDNESS_CATEGORIES.map((def) => {
    const s = stored.find((x: any) => x && x.key === def.key);
    return s
      ? { ...def, name: String(s.name || def.name), details: String(s.details ?? def.details) }
      : def;
  });
}

function sanitizeFocus(stored: any): MonthlyFocusMap {
  if (!stored || typeof stored !== 'object') return {};
  const out: MonthlyFocusMap = {};
  for (const [ym, key] of Object.entries(stored)) {
    if (/^\d{4}-\d{2}$/.test(ym) && VALID_KEYS.includes(key as CategoryKey)) {
      out[ym] = key as CategoryKey;
    }
  }
  return out;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<InspectionCategory[]>(KINDNESS_CATEGORIES);
  const [monthlyFocus, setMonthlyFocus] = useState<MonthlyFocusMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = liveQuery<any>(
      'kc_settings',
      () => supabase.from('kc_settings').select('key,value'),
      (rows) => {
        const catRow = rows.find((r) => r.key === 'categories');
        const focusRow = rows.find((r) => r.key === 'monthly_focus');
        setCategories(mergeCategories(catRow?.value));
        setMonthlyFocus(sanitizeFocus(focusRow?.value));
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching settings:', error);
        setIsLoading(false);
        window.dispatchEvent(new CustomEvent('settings-sync-error', { detail: error }));
      }
    );
    return unsubscribe;
  }, []);

  const getFocusForMonth = (yearMonth: string): CategoryKey | '' =>
    monthlyFocus[yearMonth] || '';

  const categoryName = (key: string): string =>
    categories.find((c) => c.key === key)?.name || key;

  const saveCategories = async (cats: InspectionCategory[]) => {
    const merged = mergeCategories(cats);
    const { error } = await supabase.from('kc_settings').upsert({
      key: 'categories',
      value: merged,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setCategories(merged);
  };

  const saveMonthlyFocus = async (focus: MonthlyFocusMap) => {
    const cleaned = sanitizeFocus(focus);
    const { error } = await supabase.from('kc_settings').upsert({
      key: 'monthly_focus',
      value: cleaned,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setMonthlyFocus(cleaned);
  };

  return (
    <SettingsContext.Provider
      value={{
        categories,
        monthlyFocus,
        isLoading,
        getFocusForMonth,
        categoryName,
        saveCategories,
        saveMonthlyFocus,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};
