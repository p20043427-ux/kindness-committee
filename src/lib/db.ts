import { supabase } from './supabase';

/**
 * Firestore onSnapshot 을 대체하는 경량 실시간 구독 헬퍼.
 * 1) build() 로 만든 쿼리를 즉시 1회 실행해 초기 데이터를 전달하고
 * 2) 해당 테이블의 변경 이벤트가 오면 build() 를 다시 실행해 최신 데이터를 전달한다.
 * 반환값은 구독 해제 함수.
 */
let channelSeq = 0;

export function liveQuery<T = any>(
  table: string,
  build: () => PromiseLike<{ data: T[] | null; error: any }>,
  onData: (rows: T[]) => void,
  onError?: (error: any) => void
): () => void {
  let active = true;

  const run = async () => {
    const { data, error } = await build();
    if (!active) return;
    if (error) {
      onError?.(error);
      return;
    }
    onData(data || []);
  };

  run();

  const channel = supabase
    .channel(`live_${table}_${++channelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      run();
    })
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ *
 * 매퍼: DB 행(snake_case) <-> 앱 도메인 객체 (친절점검 5개 카테고리)
 * ------------------------------------------------------------------ */

export interface RecordRow {
  id: string;
  building_id: string;
  department_id: string;
  department_name: string;
  inspector: string;
  date: string;
  greeting: number;
  response: number;
  phone: number;
  appearance: number;
  environment: number;
  focus_category: string;
  sub_scores?: Record<string, number>;
  total_score: number;
  notes: string;
  status: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
}

export interface AppRecord {
  id: string;
  buildingId: string;
  departmentId: string;
  departmentName: string;
  inspector: string;
  date: string;
  scores: {
    greeting: number;
    response: number;
    phone: number;
    appearance: number;
    environment: number;
  };
  focusCategory: string;
  subScores?: Record<string, number>;
  totalScore: number;
  notes: string;
  status: string;
  userId: string;
  createdAt: string;
}

export function rowToRecord(r: RecordRow): AppRecord {
  return {
    id: r.id,
    buildingId: r.building_id,
    departmentId: r.department_id,
    departmentName: r.department_name || '',
    inspector: r.inspector || '',
    date: r.date || '',
    scores: {
      greeting: r.greeting || 0,
      response: r.response || 0,
      phone: r.phone || 0,
      appearance: r.appearance || 0,
      environment: r.environment || 0,
    },
    focusCategory: r.focus_category || '',
    subScores: r.sub_scores ?? undefined,
    totalScore: r.total_score || 0,
    notes: r.notes || '',
    status: r.status || '정상',
    userId: r.user_id || '',
    createdAt: r.created_at || '',
  };
}

export interface CategoryScores {
  greeting: number;
  response: number;
  phone: number;
  appearance: number;
  environment: number;
}

/** 친절 점검 점수 → 상태 판정 (총 50점 만점 기준). 통합 로직. */
export function computeStatus(scores: CategoryScores, notes: string): '정상' | '주의' | '긴급' {
  const vals = [scores.greeting, scores.response, scores.phone, scores.appearance, scores.environment];
  const total = vals.reduce((a, b) => a + (b || 0), 0);
  const minScore = Math.min(...vals.map((v) => v || 0));
  if (total < 30 || minScore <= 4) return '긴급';
  if (total < 40 || (notes && notes.trim().length > 1)) return '주의';
  return '정상';
}
