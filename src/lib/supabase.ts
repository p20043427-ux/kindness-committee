import { createClient } from '@supabase/supabase-js';

// Vite 환경변수(VITE_ 접두사) 우선, 없으면 빌드 기본값 사용.
// publishable/anon 키는 클라이언트 공개용으로 설계된 키이며 RLS로 접근을 제어합니다.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://qwogqeigyjwcpguiezgk.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qqXkm_GNxVSvFqcSv0--vQ_osrej6m5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
