# 🎼 ContiNote (콘티노트)

> **찬양 인도자와 연주자를 위한 스마트 예배 콘티 관리 및 악보 리더 웹 애플리케이션**  
> 모바일, 태블릿, PC 어디서나 브라우저만으로 즉시 구동되며, 오프라인 초고속 로딩(PWA & IndexedDB)과 Google Drive 클라우드 동기화를 동시에 지원하는 올인원 워십 플랫폼입니다.

---

## 🌟 주요 핵심 기능

### 1. 📂 3계층 워크플로우 (3-Tier Hierarchy)
- **1단계: 콘티 목록 뷰 (`Conti List View`)**  
  - 주일 1부/2부 예배, 금요 기도회, 청년부 등 일자별 콘티 카드를 관리합니다.
  - 작성자 계정 식별, 팀원 이메일 공유, 총 곡 수 및 요약 메모를 한눈에 확인합니다.
- **2단계: 곡 목록 뷰 (`Song List View`)**  
  - 선택한 콘티에 포함된 악보 목록을 표시합니다.
  - 곡별 코드(Key), 템포(♩BPM), 송폼 진행 요약 배지를 한 줄로 깔끔하게 제공합니다.
  - 카드 좌측의 **3선 아이콘(☰ 핸들)**을 잡고 위아래로 끌어다 놓는 드래그 앤 드롭 순서 변경을 지원합니다.
  - 콘티 내에서 추가한 악보는 해당 콘티에만 독립 보존되어 보관함과 안전하게 분리됩니다.
- **3단계: 악보 뷰어 (`Viewer Section`)**  
  - 찬양 연주와 인도에 집중할 수 있는 3중 레이어 뷰어로, 좌우 핫스팟 터치 및 스와이프로 부드러운 곡 넘김을 지원합니다.
- **마스터 악보 보관함 (`Song Library`)**  
  - 등록된 모든 악보를 한곳에 영구 보관하며, 실시간 검색과 `#은혜`, `#찬양`, `#결단` 등 주제 태그 필터링을 지원합니다.
  - 상단 헤더의 반응형 **「곡 목록에 추가」** 버튼(모바일: 아이콘만 / 태블릿 이상: 텍스트 포함)을 통해 보관함 전용 악보를 즉시 등록할 수 있습니다.
  - 보관함 악보 카드는 긴 곡명을 시원하게 표시하며, 주제 태그 우측에 코드/박자/템포 메타데이터가 정렬되고 **`내 콘티에 추가`** 버튼으로 원하는 예배 콘티에 즉시 담을 수 있습니다.

---

### 2. ☁️ Google Drive 2단계 지연 동기화 (Lazy Sync)
로컬 스토리지의 초고속성과 클라우드의 기기간 연속성을 결합한 하이브리드 아키텍처입니다:
- **[1단계] 콘티 목록 선행 동기화 (`contis_index.json`)**  
  - 앱 시작 및 로그인 시, 수십~수백 MB의 악보 이미지를 받느라 기다릴 필요 없이 가벼운 콘티 목록 메타데이터만 0.1초 만에 가져옵니다.
- **[2단계] 콘티 진입 시 악보 지연 로딩 (`conti_{id}.json`)**  
  - 사용자가 특정 콘티를 클릭했을 때만 해당 콘티의 악보 이미지와 송폼/스티커 데이터를 Google Drive의 `Continote/` 전용 폴더에서 동기화합니다.
- **오프라인 캐시 우선 (IndexedDB)**  
  - 한 번 내려받은 콘티는 로컬 IndexedDB에 안전하게 캐시되어, 지하 연습실이나 인터넷이 불안정한 환경에서도 즉시 열립니다.

---

### 3. 🎨 3단계 악보 등록 파이프라인 (3-Step Registration)
새로운 악보를 업로드할 때 최상의 가독성을 확보하는 독립 파이프라인을 제공합니다:
1. **[1단계] 여백 자르기 (`Auto/Manual Crop`)**  
   - 단색 배경을 분석하여 불필요한 테두리를 자동 제거(Auto)하거나, 4개 모서리 핸들과 **상·하·좌·우 4개 변 중앙 조절 핸들**을 통해 원하는 영역만 수동으로 정밀하게 자릅니다.
   - 모바일 환경에서 화면 가장자리 제스처 간섭을 원천 방지하기 위해 이미지를 화면 안쪽에 여유 있게 배치하고, **44×44px 터치 히트박스**를 적용하여 손가락으로 부드럽게 조절할 수 있습니다.
2. **[2단계] 가로·세로 비율 미세 조정 (`Ratio Scaling`)**  
   - 악보 테두리의 **4개 변 중앙 핸들**을 직접 드래그하여 가로·세로 폭을 직관적으로 조절합니다.
   - 조절 시 화면이나 악보가 떨리는 현상을 원천 방지하는 **중앙축 기준 GPU Transform(`scale`)** 스케일링 엔진을 적용하여 1픽셀의 흔들림도 없는 부드러운 드래그를 제공합니다.
   - 하단에 가로 배율, 세로 배율, 화면 비율을 보기 편한 수직 카드로 실시간 표시합니다.
   - **인도자 악보 편집 화면에서도 상시 [비율 편집] 지원**: 신규 등록 시뿐만 아니라 언제든지 인도자 툴바에서 [비율 편집] 버튼을 눌러 등록된 곡의 비율을 재조정하고 즉시 저장할 수 있습니다.
3. **[3단계] 곡 메타데이터 입력 (`Metadata`)**  
   - 곡명, Key(코드), 박자(4/4, 6/8, 3/4 등), 템포(BPM), 주제 태그를 지정하여 등록을 완료합니다.

---

### 4. 🧩 3중 레이어 캔버스 & 동적 송폼 스티커
- **Layer 1: Base Canvas (악보 이미지)**  
  - 화면 비율에 맞추어 선명하게 렌더링되며, 다크 모드 시 악보 이미지만 선택적으로 흑백 반전(`invert`) 처리하여 눈부심을 방지합니다.
- **Layer 2: Sticker DOM Layer (송폼 칩 & 텍스트 메모)**  
  - 악보 위에 `[A]`, `[B]`, `[Chorus]` 등의 송폼 파트 칩과 텍스트 메모를 자유롭게 드래그하여 배치합니다.
  - **반응형 스케일링**: 화면 너비가 넓어져 악보가 커지면 스티커와 메모 크기도 비례하여 자동 확대(`--sheet-scale`)됩니다.
- **Layer 3: User Drawing Canvas (개인 펜 필기)**  
  - 형광펜, 일반 펜, 굵기/색상 조절, 지우개 기능을 지원하여 곡별 연주 메모를 영구 보존합니다.

---

### 5. 🎹 송폼 진행 순서(Flow) 키패드 기능
- 상단 송폼 바를 통해 곡의 연주 순서(`I > V1 > C > C×2 > B > Out`)를 시각적으로 표시하며, 악보 보관함 및 곡 목록 카드에서도 각 파트가 개별 칩(`A{칩} > A×2{칩} > ...`)으로 깔끔하게 렌더링됩니다.
- 순서 직접 입력란에 **`[×]` 라운드 키패드 버튼**을 제공하여, `C` 입력 후 클릭 시 공백 없이 즉시 **`C×2`**, **`Chorus×3`** 등 반복 배수를 편리하게 구성할 수 있습니다.

---

### 6. 📱 모바일 UX & 메뉴별 세션 보존
- **모바일 툴바 컴팩트화**: 좁은 모바일 화면에서도 버튼이 잘리거나 넘치지 않도록 아이콘 전용 컴팩트 모드(`hidden sm:inline`)가 적용되어 가로 스크롤 없이 쾌적하게 조작할 수 있습니다.
- **독립 세션 복원 (`menuSessions`)**: 인도자 도구, 연주자 뷰어, 악보 보관함 탭 간을 이동하더라도 작업 중이던 곡이나 뷰 상태가 초기화되지 않고 안전하게 유지됩니다.
- **독립적인 환경설정 페이지**: 팝업 모달 대신 상단 헤더와 하단 메뉴가 그대로 유지되는 정식 페이지(`settingsView`)로 구성되어, 화면 테마·곡 넘김 방향·송폼 파트 칩·주제 태그·Google Drive 연동을 일관되고 편리하게 관리할 수 있습니다.
- **테마별 시각적 정체성**:
  - 인도자 모드: 활력 있는 오렌지 테마 (`#EA580C`)
  - 사용자 및 설정 모드: 차분한 퍼플 테마 (`#6B5B95`)
  - 악보 보관함: 신뢰감 있는 블루 테마 (`#2563EB`)
  - 헤더 글래스모피즘 틴트 및 시스템/라이트/다크 테마 완벽 연동

---

## 📁 프로젝트 구조

```text
continote/
├── index.html          # 메인 UI 마크업 (3계층 뷰, 모달, 반응형 툴바)
├── css/
│   └── style.css       # 테마 토큰, 캔버스 레이어, 스티커 스케일링, 모달 스타일
├── js/
│   ├── app.js          # 메인 오케스트레이터 (이벤트, 뷰 라우팅, 모달 흐름)
│   ├── canvas.js       # Base 악보 및 User Drawing 캔버스 렌더링 & 스티커 스케일
│   ├── crop.js         # Auto-Crop 여백 감지 알고리즘 & 수동 크롭 8개 핸들 및 비율 뱃지 연동
│   ├── db.js           # IndexedDB 비동기 영구 저장소 (콘티, 곡, 라이브러리, 필기)
│   ├── drive.js        # Google Drive v3 REST API 2단계 지연 동기화 서비스
│   ├── sample.js       # 첫 방문자를 위한 고품질 체험용 샘플 악보 자동 생성기
│   ├── state.js        # 전역 상태 관리 및 사용자 설정 (세션 및 로컬스토리지)
│   ├── stickers.js     # 송폼 스티커 DOM 레이어 생성, 터치/마우스 드래그 & 삭제
│   └── zoom.js         # 편집 모드 줌/팬 엔진 (3중 레이어 동기화 스케일링)
├── manifest.json       # PWA 웹 앱 매니페스트 (홈 화면 추가, 독립 앱 구동)
├── sw.js               # Service Worker 오프라인 캐싱 지원
├── server.js           # 제로 의존성 초경량 로컬 개발 서버 (Node.js 기본 모듈)
├── package.json        # 프로젝트 메타데이터 및 실행 스크립트
└── README.md           # 프로젝트 문서
```

---

## 🚀 빠른 시작 (로컬 실행)

별도의 외부 패키지 설치(`npm install`) 없이 순수 Node.js만으로 즉시 실행 가능합니다.

```bash
# 1. 로컬 개발 서버 실행
npm start
# 또는
node server.js

# 2. 브라우저에서 접속
# http://localhost:3000
```

---

## 🌐 배포 가이드

ContiNote는 순수 클라이언트 사이드 웹 애플리케이션(SPA & PWA)이므로 정적 호스팅 서비스에 즉시 배포할 수 있습니다.

### 1. GitHub Pages 배포
1. 저장소의 `main` 브랜치에 코드를 푸시합니다.
2. GitHub 저장소의 **Settings > Pages** 메뉴로 이동합니다.
3. **Build and deployment > Branch**에서 `main` 브랜치 및 `/ (root)`를 선택하고 저장합니다.
4. 수초 내에 `https://<username>.github.io/<repo>/` 주소로 배포됩니다.

### 2. Netlify 배포
1. [Netlify](https://www.netlify.com/)에 로그인 후 저장소를 연결합니다.
2. Build Command는 비워두고, Publish directory를 `.` (현재 디렉토리)로 설정하여 배포합니다.

---

## ☁️ Google Drive API & OAuth 설정 가이드

ContiNote는 브라우저에서 직접 Google Drive v3 REST API를 호출하여 콘티와 악보, 송폼/필기 데이터를 기기간에 안전하게 동기화합니다.

### 1. Google Cloud Console 설정

1. **Google Drive API 활성화**:
   - [Google Cloud Console](https://console.cloud.google.com/) 접속 후 프로젝트 선택
   - **[API 및 서비스] → [라이브러리]**에서 `Google Drive API` 검색 후 **[사용]** 클릭

2. **OAuth 동의 화면 (OAuth Consent Screen)**:
   - **[API 및 서비스] → [OAuth 동의 화면]** 메뉴로 이동
   - **사용자 유형(User Type) 선택**:
     - **내부(Internal)** (Google Workspace 조직 도메인: 예 `changdae.cc`):
       - 해당 조직 도메인 계정만 로그인 가능
       - 구글 검수(Verification) 및 별도 [테스트 사용자] 등록 없이 즉시 무제한 사용 가능
       - 찬양팀 전원이 조직 계정을 사용할 때 가장 편리하고 안전한 구성
     - **외부(External)** (일반 `@gmail.com` 개인 계정 포함 시):
       - 외부 일반 구글 계정도 로그인 가능
       - '테스트 중(Testing)' 상태일 때는 **[테스트 사용자(Test users)]** 목록에 로그인할 이메일을 반드시 등록해야 로그인 차단(403 Access Denied) 오류가 발생하지 않음
   - **범위(Scopes)**:
     - `https://www.googleapis.com/auth/drive.file` (앱에서 직접 생성한 파일만 접근하는 안전한 최소 권한)
     - `.../auth/userinfo.email`, `.../auth/userinfo.profile`

3. **OAuth 2.0 클라이언트 ID 생성**:
   - **[API 및 서비스] → [사용자 인증 정보]** → **[+ 사용자 인증 정보 만들기]** → **[OAuth 클라이언트 ID]**
   - 애플리케이션 유형: **웹 애플리케이션 (Web application)**
   - **승인된 자바스크립트 원본 (Authorized JavaScript origins)** 등록:
     - 로컬 개발 환경: `http://localhost:3000` *(끝에 슬래시 `/` 제외)*
     - 실서버 배포 주소: `https://<당신의-배포-주소>.netlify.app` 또는 GitHub Pages 주소
   - **참고**: ContiNote는 순수 클라이언트 정적 웹앱(SPA)으로 백엔드 서버가 없으므로 `Client Secret`은 사용하지 않으며, Netlify Secret(환경변수)에 등록할 필요가 없습니다.

### 2. 코드 적용 및 동기화 동작

- 발급된 클라이언트 ID를 [`js/app.js`](js/app.js) 상단의 `GOOGLE_CLIENT_ID`에 지정합니다:
  ```javascript
  const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
  ```
- 브라우저에서 Google 로그인 시:
  - 본인 Google Drive의 루트에 **`Continote/`** 전용 폴더가 자동 생성됩니다.
  - 콘티 메타데이터(`contis_index.json`) 및 콘티 상세 악보/필기(`conti_{id}.json`)가 2단계 지연 동기화(Lazy Sync) 구조로 자동 백업됩니다.

---

## 🛠️ 기술 스택

- **Frontend**: HTML5, Vanilla JavaScript (ES Modules), Vanilla CSS3
- **Styling & UI**: Tailwind CSS (CDN), Custom CSS Variables (Design Tokens)
- **Typography**: Google Fonts (Noto Sans KR, Playfair Display)
- **Cloud & Sync**: Google Identity Services (GIS), Google Drive v3 REST API
- **Local Storage**: IndexedDB API (`continote_v3_db`), Web Storage API (`localStorage`)
- **Graphics**: HTML5 Canvas 2D Context API, CSS Transform 3D
- **Server**: Zero-dependency Node.js HTTP Server

---

## 📄 라이선스

This project is licensed under the MIT License.
