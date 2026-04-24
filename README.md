# ClearDays

피부 트러블 트리거를 찾아주는 일일 추적 앱입니다.  
매일 피부 상태, 식단, 생활습관을 기록하면 어떤 음식·습관이 피부에 영향을 미치는지 자동으로 분석해줍니다.

---

## 주요 기능

### 일일 체크인
- 피부 상태 점수 (0 괜찮음 / 1 조금 / 2 심함)
- 가려움·통증 여부
- 전날 섭취한 음식 카테고리 (정제탄수, 유제품, 튀김, 술, 매운음식, 통곡물)
- 생활습관 (베개커버 교체, 운동, 스트레스 1–5, 수면시간, 수면품질, 수분섭취)

### 인사이트 분석
- **음식 트리거**: 특정 음식 섭취 후 다음날 피부 상태 상관관계 분석
- **습관 분석**: 베개커버 미교체·스트레스·수면 부족과 피부 악화 연관성
- **단계별 공개**: 7일 → 기본 인사이트, 14일 → 상세 분석, 30일 → 개인화 인사이트

### 실험
- 특정 음식을 14일간 제한하는 제거 실험 시작
- 실험 기간 중 섭취 횟수·다음날 피부 반응 실시간 추적
- 프리셋: 정제탄수, 유제품, 알콜, 고지방 음식

### 리포트
- 최근 4주 피부 점수 주간 추이 차트 (꺾은선·막대)
- 트리거 TOP 5 요약
- 리포트 이미지로 저장·공유

### 기타
- 캘린더: 피부 상태별 색상 구간(period) 표시
- 연속 기록 스트릭 / 뱃지 시스템
- 한국어·영어 다국어 지원
- 로컬 알림 (아침·저녁·스마트 리마인더)
- 완전 오프라인 — 서버 없음, 모든 데이터 기기 내 저장

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | React Native (Expo Managed) + TypeScript |
| 라우팅 | Expo Router 6 |
| 로컬 DB | expo-sqlite 16 |
| 상태 | React hooks (useState / useCallback / useMemo) |
| 알림 | expo-notifications |
| 다국어 | expo-localization + i18n-js |
| 캘린더 | react-native-calendars |
| 차트 | react-native-chart-kit |
| 공유 | expo-sharing + react-native-view-shot |
| 설정 저장 | @react-native-async-storage/async-storage |

---

## 화면 구조

```
app/
├── index.tsx              # 온보딩 진입 라우터
├── onboarding.tsx         # 온보딩 슬라이드
├── language.tsx           # 최초 언어 선택
├── (tabs)/
│   ├── index.tsx          # 캘린더 탭
│   ├── insights.tsx       # 인사이트 탭
│   ├── experiments.tsx    # 실험 탭
│   ├── report.tsx         # 리포트 탭
│   ├── report-share.tsx   # 공유용 리포트 (탭바 미노출)
│   └── settings.tsx       # 설정 탭
└── modal/
    └── daily-checkin.tsx  # 날짜별 체크인 모달
```

---

## DB 스키마

```sql
-- 피부 일일 기록
daily_log (date PK, skin_score, itch, pain, note)

-- 음식 섭취 기록
food_entry (date, category, amount, PK(date, category))

-- 생활습관 기록
habit_log (date PK, pillowcase, sleep_hours, sleep_quality,
           stress_level, exercise, water_intake)

-- 제거 실험
experiment (id PK, name, target_food, target_days,
            max_eat_days, start_date, end_date)
```

---

## 로컬 개발 환경

```bash
# 의존성 설치
yarn install

# Expo 개발 서버 실행
yarn start

# iOS 실행
yarn ios

# Android 실행
yarn android
```

Node.js 18+, Expo CLI, Xcode(iOS) 또는 Android Studio(Android) 필요.

---

## 번들 ID

| 플랫폼 | 식별자 |
|--------|--------|
| iOS (미출시) | `kr.simplefunction.cleardays` |
| Android | `kr.simplefunction.cleardays` |
