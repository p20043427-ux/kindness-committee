# 좋은문화병원 친절위원회 점검 관리 시스템

병원 부서별 **친절점검**(인사예절·응대스킬·전화응대·용모복장·병원환경/불만고객)을 기록·모니터링하고,
점검 스케줄·위원회 명단·월별 행사를 관리하는 대시보드입니다. (절약위원회 시스템 기반)

- **Frontend**: React 19 · Vite 6 · Tailwind CSS 4 · React Router 7 · Recharts
- **Backend**: Supabase (PostgreSQL + Realtime + RLS)

## 친절점검 평가 항목 (각 10점, 총 50점)

| 카테고리 | 세부 평가 |
|---|---|
| 인사예절 | 첫인사 · 끝인사 · 먼저인사 (눈맞춤) |
| 응대스킬 | 표정(미소/눈맞춤) · 정확한 설명(호칭) · 쿠션언어 |
| 전화응대 | 3번 이내 받기 · 최초응대(소속) · 끝인사 |
| 용모복장 | 두발 · 유니폼 · 손톱/악세사리 |
| 병원환경/불만고객 | 친절교육책자 · 유인물 비치 · 대기시간 설명 |

> 매월 한 가지 카테고리를 **중점사항**으로 지정해 운영합니다(`focus_category`).

## 주요 기능

| 메뉴 | 설명 |
|------|------|
| 대시보드 | 이번 달 행사/점검 스케줄 요약 |
| 점검 조회/입력 | 부서별 친절점검 상태 조회 및 인라인 점검표 입력 |
| 점검 데이터 관리 | 상세 내역 + 부서별 월간/연간 점수표, CSV 내보내기 |
| 연간 분석 리포트 | 점검일별 추이·카테고리별 차트, 최우수/개선필요 부서 |
| 위원회 명단 / 점검 스케줄 / 월별 행사 | 위원·일정·행사 관리 |
| 코드 관리 / 시스템 설정 | 건물·부서 마스터, 전체 백업 |

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # Supabase URL/KEY (기본값 내장)
npm run dev                  # http://localhost:3000
```

## 환경 변수

| 변수 | 설명 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | publishable/anon 키 (클라이언트 공개용, 접근은 RLS로 제어) |

## 데이터베이스 (Supabase)

`public` 스키마에 `kc_` 접두사 6개 테이블을 사용합니다.

- `kc_buildings` — 건물 마스터 (본관/신관/별관)
- `kc_departments` — 부서 마스터 (57개) → kc_buildings
- `kc_committee` — 위원회 명단
- `kc_records` — 부서별 친절 점검 기록 (5개 카테고리 점수 0~10, 총 0~50, focus_category)
- `kc_schedules` — 점검 스케줄
- `kc_events` — 월별 행사

모든 테이블은 RLS 활성화 + anon/authenticated 전체 허용(내부 도구), `supabase_realtime` publication 등록.

## 배포 (Vercel)

- 빌드: `npm run build` · 출력: `dist` · SPA rewrite: `vercel.json`
- Vercel 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정.
