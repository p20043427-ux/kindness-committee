export const MOCK_BUILDINGS = [
  { id: "B01", name: "본관" },
  { id: "B02", name: "신관" },
  { id: "B03", name: "별관" },
];

// 2025년 친절점검표 부서 명단 (신관 / 본관 / 별관)
export const MOCK_DEPARTMENTS = [
  // 신관 (B02)
  { id: "K01", name: "기획총무팀", buildingId: "B02" },
  { id: "K02", name: "재무팀", buildingId: "B02" },
  { id: "K03", name: "심사팀", buildingId: "B02" },
  { id: "K04", name: "영양팀", buildingId: "B02" },
  { id: "K05", name: "교환실", buildingId: "B02" },
  { id: "K06", name: "13병동", buildingId: "B02" },
  { id: "K07", name: "12병동", buildingId: "B02" },
  { id: "K08", name: "11병동", buildingId: "B02" },
  { id: "K09", name: "10병동", buildingId: "B02" },
  { id: "K10", name: "9병동", buildingId: "B02" },
  { id: "K11", name: "8병동", buildingId: "B02" },
  { id: "K12", name: "종합검진센터", buildingId: "B02" },
  { id: "K13", name: "국가검진센터", buildingId: "B02" },
  { id: "K14", name: "내시경실", buildingId: "B02" },
  { id: "K15", name: "NICU", buildingId: "B02" },
  { id: "K16", name: "병리팀", buildingId: "B02" },
  { id: "K17", name: "약제팀", buildingId: "B02" },
  { id: "K18", name: "수술실", buildingId: "B02" },
  { id: "K19", name: "ICU", buildingId: "B02" },
  { id: "K20", name: "3층 원무팀", buildingId: "B02" },
  { id: "K21", name: "외과C센터", buildingId: "B02" },
  { id: "K22", name: "3층 외래(IM,EN,NE)", buildingId: "B02" },
  { id: "K23", name: "산부인과 외래", buildingId: "B02" },
  { id: "K24", name: "원무팀(산부인과)", buildingId: "B02" },
  { id: "K25", name: "응급실", buildingId: "B02" },
  { id: "K26", name: "주사실", buildingId: "B02" },
  { id: "K27", name: "구매관리팀", buildingId: "B02" },
  { id: "K28", name: "중앙공급실", buildingId: "B02" },
  { id: "K29", name: "시설관리팀", buildingId: "B02" },
  // 본관 (B01)
  { id: "K30", name: "진단검사의학팀", buildingId: "B01" },
  { id: "K31", name: "인공신장실", buildingId: "B01" },
  { id: "K32", name: "난임시술 9층", buildingId: "B01" },
  { id: "K33", name: "난임센터 8층", buildingId: "B01" },
  { id: "K34", name: "난임센터 원무팀", buildingId: "B01" },
  { id: "K35", name: "간호부", buildingId: "B01" },
  { id: "K36", name: "세탁실", buildingId: "B01" },
  { id: "K37", name: "전산팀", buildingId: "B01" },
  { id: "K38", name: "신생아실", buildingId: "B01" },
  { id: "K39", name: "분만실", buildingId: "B01" },
  { id: "K40", name: "자출센터", buildingId: "B01" },
  { id: "K41", name: "채혈실", buildingId: "B01" },
  { id: "K42", name: "외과A센터", buildingId: "B01" },
  { id: "K43", name: "외과B센터", buildingId: "B01" },
  { id: "K44", name: "2층 소아과 외래", buildingId: "B01" },
  { id: "K45", name: "2층 소아원무팀", buildingId: "B01" },
  { id: "K46", name: "2층 영상의학팀", buildingId: "B01" },
  { id: "K47", name: "1층 원무팀", buildingId: "B01" },
  { id: "K48", name: "의료정보팀", buildingId: "B01" },
  // 별관 (B03)
  { id: "K49", name: "QPS감염보건", buildingId: "B03" },
  { id: "K50", name: "별관(9) 예약콜센터", buildingId: "B03" },
  { id: "K51", name: "별관(7) PS,DM 외래", buildingId: "B03" },
  { id: "K52", name: "별관(3) 재활치료(도수)", buildingId: "B03" },
  { id: "K53", name: "별관 2층 원무팀(NS)", buildingId: "B03" },
  { id: "K54", name: "별관 2층 외래(NS)", buildingId: "B03" },
  { id: "K55", name: "별관 1층 원무팀", buildingId: "B03" },
  { id: "K56", name: "별관 1층 외래", buildingId: "B03" },
  { id: "K57", name: "별관 지하1층 영상", buildingId: "B03" },
];

// 친절점검표 5개 카테고리 (각 10점 만점, 총 50점). 월별로 중점사항으로 운영됨.
export type CategoryKey = "greeting" | "response" | "phone" | "appearance" | "environment";

export interface SubCriterion {
  key: string;
  name: string;
  max: number;     // 이 세부항목의 배점
  items: string[]; // 체크리스트 안내문
}

export interface InspectionCategory {
  key: CategoryKey;
  name: string;
  max: number;
  details: string;
  subCriteria: SubCriterion[];
}

export const KINDNESS_CATEGORIES: InspectionCategory[] = [
  {
    key: "greeting",
    name: "인사예절",
    max: 10,
    details: "첫인사 · 끝인사 · 먼저인사 (눈맞춤)",
    subCriteria: [
      { key: "first",     name: "첫인사",   max: 3, items: ["맞이 인사를 잘 하는가", "눈맞춤 잘 하는가"] },
      { key: "last",      name: "끝인사",   max: 4, items: ["배웅 인사를 잘 하는가", "눈맞춤을 잘 하는가"] },
      { key: "proactive", name: "먼저 인사", max: 3, items: ["눈이 마주쳤을 때 먼저 인사 하는가"] },
    ],
  },
  {
    key: "response",
    name: "응대스킬",
    max: 10,
    details: "표정(미소/눈맞춤) · 정확한 설명(호칭) · 쿠션언어",
    subCriteria: [
      { key: "expression",  name: "표정",          max: 4, items: ["온화한 미소", "눈맞춤"] },
      { key: "explanation", name: "정확한 설명",    max: 4, items: ["호칭사용/상세설명"] },
      { key: "cushion",     name: "쿠션언어 사용",  max: 2, items: ["쿠션화법사용"] },
    ],
  },
  {
    key: "phone",
    name: "전화응대",
    max: 10,
    details: "3번 이내 받기 · 최초응대(소속) · 끝인사",
    subCriteria: [
      { key: "pickup",  name: "바로 받기",  max: 4, items: ["3번 이내 받는다", "정확히 소속 밝힘"] },
      { key: "initial", name: "최초 응대",  max: 4, items: ["감사합니다", "소속 또박또박"] },
      { key: "closing", name: "끝인사",     max: 2, items: ["먼저 끊지 않기", "끝인사하기"] },
    ],
  },
  {
    key: "appearance",
    name: "용모복장",
    max: 10,
    details: "두발 · 유니폼 · 손톱/악세사리",
    subCriteria: [
      { key: "hair",    name: "두발상태", max: 4, items: ["청결하고 단정한가", "업무방해 유무"] },
      { key: "uniform", name: "유니폼",   max: 3, items: ["단정한 복장", "구겨지거나 신발구겨짐"] },
      { key: "nails",   name: "손톱",     max: 3, items: ["손톱길이 적당", "젤네일 화려한가", "화려한 악세사리"] },
    ],
  },
  {
    key: "environment",
    name: "병원환경/불만고객",
    max: 10,
    details: "친절교육책자 · 유인물 비치 · 대기시간 설명",
    subCriteria: [
      { key: "booklet",   name: "친절교육책자",   max: 4, items: ["친절교육책자 비치", "불만고객응대매뉴얼", "VOC 불편사항 안내게시물"] },
      { key: "materials", name: "유인물비치상태", max: 4, items: ["대기실내 유인물유무", "정리정돈"] },
      { key: "waiting",   name: "대기시간 설명",  max: 2, items: ["대기시간 설명", "고객배려표현(기다려주셔서 감사합니다)"] },
    ],
  },
];

export const MAX_TOTAL_SCORE = 50; // 5개 카테고리 × 10점

export interface InspectionRecord {
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
  totalScore: number;
  notes: string;
  status: "정상" | "주의" | "긴급";
}
