# CLAUDE.md - ClearDays 프로젝트 AI 에이전트 설정

## 응답 규칙
- 가능한 간결하게 응답하고 불필요한 인사나 부연설명을 줄인다.

## 커밋 규칙
- **파일 단위 또는 버그 단위**로 수정할 때마다 커밋한다.
- 커밋 실행 전에 반드시 사용자에게 진행 여부를 확인한다.
- 커밋 메시지는 한국어로, 변경 이유 중심으로 작성한다.

## 프로젝트 컨텍스트
- React Native (Expo Managed) + TypeScript
- 피부 상태 트래커 앱 (daily_log, food_entry, habit_log, experiment)
- 로컬 SQLite DB 전용, 외부 서버 통신 없음

## 아키텍처
- **app/**: Expo Router 화면 (UI만, 비즈니스 로직 금지)
- **src/db/**: schema.ts(마이그레이션), repo.ts(쿼리)
- **src/notifications/**: 알림 스케줄링 로직
- **src/i18n/**: 다국어 (i18n-js + expo-localization)
- **src/ui/**: 재사용 컴포넌트 (props만 받는 순수 컴포넌트)

## 코드 스타일
- TypeScript strict, any 금지
- 화살표 함수만 사용 (`const fn = () => {}`)
- 함수형 컴포넌트 + hooks
- 한국어 주석

## 기술 스택
- Expo SDK 54 + Expo Router 6
- expo-sqlite (로컬 DB)
- expo-notifications (로컬 알림)
- expo-localization + i18n-js (다국어)
- expo-sharing, react-native-view-shot (리포트 공유)
- react-native-calendars, react-native-chart-kit (캘린더/차트)
- @react-native-async-storage/async-storage

## DB 규칙
- 모든 쿼리는 `repo.ts`에만 작성, 화면 파일에서 직접 SQL 금지
- 컬럼 추가 시 `schema.ts`의 `migrate()` 함수에 PRAGMA + ALTER TABLE 패턴 사용
- 테이블 변경 시 기존 데이터 보존 여부 반드시 확인

## 금지 사항
- `function` 키워드, 클래스 컴포넌트, any 타입
- 인라인 스타일 남용 (StyleSheet.create 사용)
- 화면 파일에 비즈니스 로직/SQL 직접 작성
- 외부 네트워크 요청 추가 (앱 성격상 완전 로컬)

## 보안 규칙

### Git / 파일 관리
- `my-upload-key.keystore`는 **절대 커밋 금지** — .gitignore에 등록 필수
- `android/app/debug.keystore`도 공개 저장소에 커밋 금지
- `.env`, API 키, 인증서 등 민감 파일은 커밋 전 반드시 확인

### SQLite (expo-sqlite)
- 모든 쿼리는 **바인딩 파라미터** 사용 (`db.runAsync('... WHERE id = ?', id)`)
- 사용자 입력을 SQL 문자열에 직접 보간 금지 → SQL Injection 방지
- 쿼리 예외는 `catch` 블록에서 처리하되, 원본 SQL을 로그에 노출하지 않기

### 민감 데이터 처리
- 피부 상태·식단 등 건강 데이터는 기기 로컬에만 저장, 외부 전송 금지
- `expo-sharing` 사용 시 공유 전 사용자 확인 UI 필수 (자동 공유 금지)
- AsyncStorage에 개인 식별 정보(PII) 저장 금지 — 설정값만 허용

### 알림 (expo-notifications)
- 알림 권한 요청은 온보딩 흐름 내에서만 수행
- 알림 payload에 건강 데이터 본문 포함 금지 (잠금 화면 노출 위험)

### 프로덕션 빌드
- `console.log`는 프로덕션 빌드에서 제거 또는 __DEV__ 가드 필수
- 디버깅용 DB 카운트 로그(`schema.ts` 내 마이그레이션 로그)도 릴리즈 전 제거
- Proguard(`proguard-rules.pro`) 설정 변경 시 난독화 범위 확인
