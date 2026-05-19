# 감정 체크인 (Emotion Check-in)

**2026 KIT 바이브코딩 공모전 출품작**  
주제: **AI 활용 차세대 교육 솔루션**에 맞춘, 학급 단위 **감정 체크인·교사 가시성**을 위한 웹 애플리케이션입니다. (본 출품본은 **데이터 수집·UI·교사 대시보드**에 역점을 두었고, **모델 추론 API는 미연동**이며 향후 집계 데이터 기반 인사이트·AI 연동을 염두에 두었습니다.)

---

## 프로젝트 개요

학생은 스마트폰 형태의 UI에서 하루 감정을 기록하고, 지난 기록·통계·설정을 이용합니다. 교사는 별도 대시보드에서 같은 브라우저에 저장된 데이터를 바탕으로 학생별·학급 전체 현황을 보고, 전체 공지·학급 코드·명단 관리 등을 할 수 있습니다.

| 구분 | 설명 |
|------|------|
| **교사 인증코드 (데모)** | **`5678`** — `teacher.html` 로그인·회원가입 시 「교사 인증코드」란에 입력 (코드 상수: `js/teacher/teacher-auth.js`의 `TEACHER_AUTH_CODE`) |
| **학생 앱** | `index.html` — 로컬 계정 로그인, 감정 기록, 기록 목록, 통계·달력, 알림 시간·다크/라이트 테마, 학급 코드 연결 |
| **교사 대시보드** | `teacher.html` — 교사 전용 로그인, 학생별 목록·상세, 학급 분포, 공지, 설정(테마·학급·명단) |
| **데이터 저장** | **현재:** 브라우저 **localStorage** + 시연용 **`data/students.json`**. **계획:** **Firebase**(Authentication, Firestore 등)로 계정·감정 기록·학급 정보를 서버에 두고 기기 간 동기화·백업을 구현하려 했으나, **시간 관계상** 우선 로컬만으로 완성했습니다. |
| **동기화** | 같은 브라우저에서 학생 탭과 교사 탭을 열어두면 **저장소 이벤트 + BroadcastChannel**으로 화면이 갱신되도록 구성 (Firebase 도입 시 실시간 리스너로 대체 가능한 구조를 지향) |

**HTML / CSS / 바닐라 JavaScript**만으로 동작하며, 이후 Firebase·백엔드로 옮기기 쉽게 키 이름과 JSON 필드(`emo`, `label`, `note`, `date` 등)를 맞춰 두었습니다.

---

## 기술 스택

- **HTML5 / CSS3 / JavaScript (ES5+ 호환 위주, 모듈 번들러 없음)**
- **localStorage** — 출품본: 학생·교사 계정, 세션, 감정 기록, 학급 방, 교사 메시지 등 (Firebase 연동 시 대체 예정)
- **Web Crypto API** — 비밀번호 SHA-256 해시 (`student-accounts.js`, `teacher-auth.js`)
- **`fetch`** — `data/students.json` 명단 로드 (`teacher-data.js`)
- **BroadcastChannel + storage 이벤트** — 탭 간 반영 (`cross-tab.js` 등)
- **Google Fonts** — Nunito (교사 화면)
- **(계획)** **Firebase** — Auth·Firestore·호스팅으로 계정·데이터 영속화 및 다중 기기 지원 (시간 관계상 미연동)

---

## 디렉터리·파일 구조

```
emotion-checkin-app/
├── index.html                 # 학생 앱 진입점
├── teacher.html               # 교사 대시보드 진입점
├── README.md                  # 본 문서 (공모전 제출용 개요)
├── .gitignore
│
├── scripts/
│   └── generate-students-json.js # data/students.json 대량 샘플 재생성 (node 실행)
│
├── data/
│   └── students.json          # 학급 명단·감정 기록 샘플 (12명·약 한 달 평일 위주, meta.generatedAt으로 재생성 시각 확인)
│
├── css/
│   ├── style.css              # 학생 앱: 폰 목업·레이아웃·상태바
│   ├── components.css         # 학생·공통 UI (버튼, 카드, 로그인 폼 등)
│   ├── theme-light.css        # 학생 앱 라이트 테마
│   ├── animations.css         # 전환·모달 등 애니메이션
│   ├── teacher-base.css       # 교사: 리셋·헤더·요약·목록·상세 기본
│   ├── teacher-responsive.css # 교사: 미디어쿼리·모바일 시트
│   ├── teacher-insight.css    # 교사: 감정 그래프·달력 모달
│   ├── teacher-auth.css       # 교사: 로그인 게이트·헤더 액션
│   ├── teacher-shell.css      # 교사: 탭·패널·설정·명단·학급·하단 네비
│   └── teacher-theme-light.css # 교사 라이트 테마 오버라이드
│
└── js/
    ├── core/
    │   ├── paths.js           # 상대 경로 → 절대 URL (Live Server·하위 폴더 배포 대비)
    │   ├── storage.js         # 감정 CRUD, 교사 메시지, 알림 시각, 날짜 포맷 등 공통 저장소
    │   ├── student-accounts.js # 학생 계정 생성·검증·JSON 명단 연동
    │   └── cross-tab.js       # 탭 간 브로드캐스트·가시성 시 새로고침 트리거
    │
    ├── student/
    │   ├── app.js             # DOMContentLoaded, 화면 전환, 교사 배너 등
    │   ├── auth.js            # 학생 로그인·회원가입·세션
    │   ├── ui.js              # 모달, 홈/기록 목록, 상태바 시계, 알림 설정 UI
    │   ├── charts.js          # 통계·학생용 감정 달력
    │   ├── theme.js           # 다크/라이트 전환
    │   └── student-class-link.js # 학급 코드 입력·연결 UI
    │
    └── teacher/
        ├── teacher-app.js     # 대시보드 메인 로직, 필터, 상세 패널, 인사이트 모달
        ├── teacher-auth.js    # 교사 로그인·가입·세션 (출품용 고정 인증코드)
        ├── teacher-data.js    # students.json 로드·학생 목록 병합
        ├── teacher-roster.js  # 명단·수동 추가 등
        ├── teacher-class-room.js # 학급 코드 생성·카드 표시
        └── teacher-theme.js   # 교사 라이트/다크 테마 전환
```

스크립트는 각 HTML 하단에서 **`js/core/*` → 도메인별 `js/student/*` 또는 `js/teacher/*`** 순으로 로드됩니다.

`teacher.html`의 스타일은 **`teacher-base.css` → `teacher-responsive.css` → `teacher-insight.css` → `teacher-auth.css` → `teacher-shell.css` → `teacher-theme-light.css`** 순으로 로드합니다. (라이트 테마는 마지막에 덮어씀)

---

## 실행 방법 (심사·데모)

**교사 인증코드:** `5678` (교사 화면 로그인·회원가입 폼에 그대로 입력)

1. **반드시 로컬 HTTP 서버**로 루트 폴더를 연다.  
   - 예: VS Code **Live Server**, `npx serve`, Python `http.server` 등  
   - `index.html`만 파일 프로토콜로 연면 `fetch('data/students.json')`이 동작하지 않을 수 있습니다.
2. **학생**: 브라우저에서 `index.html` → 회원가입 또는 로그인 → 감정 기록·기록·통계 이용.
3. **교사**: 같은 브라우저에서 `teacher.html`을 새 탭으로 연 뒤, 교사 인증코드·계정으로 로그인 → 학생 데이터·공지·설정 확인.  
   - 학생 앱과 **동일 origin**이면 localStorage가 공유되어 연동이 됩니다.

**데모용 교사 인증코드**는 `js/teacher/teacher-auth.js`에 정의되어 있으며, 기본값은 **`5678`** 입니다. (로그인·회원가입 시 동일하게 입력)  
Firebase Auth 등으로 전환 시 이 고정값 검증은 서버·보안 규칙으로 대체됩니다.

---

## 주요 기능 요약

**학생**

- 이모지·라벨·메모와 함께 감정 저장, 홈·기록 목록·통계, 달력에서 일별 상세
- 계정(아이디·비밀번호·이름 등) 로컬 저장, 로그아웃, **설정에서 계정 영구 삭제**(비밀번호 확인·이 기기 저장 데이터 삭제)
- 매일 알림 시각 설정(24시간 형식), 다크/라이트 테마
- 교사가 보낸 **한 줄 공지** 배너(같은 브라우저 저장소 기준)
- 학급 코드로 교사가 만든 **학급 방**과 연결(설정 화면)

**교사**

- 학생별 목록·필터·상세(오늘 감정, 주간, 최근 기록), 감정 분포·달력 인사이트 모달
- 학급 전체 보기(차트·요약), **전체 공지** 입력
- 설정: 화면 모드(라이트/다크), 학급 만들기·코드, 명단(JSON 가져오기·수동 편집 등), **교사 계정 영구 삭제**(비밀번호 확인·이 브라우저의 학급·명단 덮어쓰기·공지 등 교사용 로컬 데이터 정리)
- 모바일·PC 레이아웃 분기(하단 탭 등)

**공통**

- 기록 시각은 **24시간제**, 날짜+분 단위 표기(`storage.js`의 `formatRecordDateTime` 등)
- 기록·프로필 변경 시 **다른 탭에 반영**되도록 설계

---

## 제출 시 참고

- 본 프로젝트는 **교육 현장 데모·프로토타입**입니다. **데이터는 출품 범위상 localStorage에만** 두었으며, **원래는 Firebase로 영속화·다기기 동기화**를 염두에 두고 설계했습니다.
- 실제 운영 시에는 **Firebase 또는 자체 서버**에서 인증·저장소·HTTPS·개인정보 처리방침을 갖추는 것이 필요합니다.
- `data/students.json`은 **시연용 샘플**이며, 필드 구조는 앱 내부 저장 형식과 맞춰져 있습니다.

문의·버전 정보는 교사 설정 화면의 앱 정보 영역을 참고하면 됩니다.

---

## 향후 확장 메모

- **Firebase**: Firestore에 `users` / `emotions` / `classRooms` 컬렉션 등으로 옮기고, 클라이언트는 SDK로 구독·쓰기만 하도록 바꾸면 됩니다.
- **교사 인증코드**: 출품용으로 클라이언트에만 두었습니다. Firebase Auth의 Custom Claims·Cloud Functions로 검증하는 방식이 적합합니다.
