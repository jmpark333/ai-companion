# 📁 프로젝트 구조 설명

```
ai-companion-netlify/
│
├── 📄 index.html                          # 메인 HTML 페이지
│   └── UI 구조, 채팅 인터페이스
│
├── 🎨 style.css                           # 스타일시트
│   └── 반응형 디자인, 테마, 애니메이션
│
├── 💻 script.js                           # 메인 JavaScript
│   ├── ZAIAPIClient 클래스 (Z.AI API 통신)
│   ├── AICompanion 클래스 (챗봇 로직)
│   └── ⚠️ 수정 필요: NetlifyMemoryClient 사용
│
├── 🧠 Memory 클라이언트 (2가지 옵션)
│   │
│   ├── 💾 memory-netlify-client.js       # ⭐ 추천: Netlify Functions 사용
│   │   ├── NetlifyMemoryClient 클래스
│   │   ├── 대화 저장/검색/분석
│   │   ├── 감정/주제 자동 감지
│   │   └── 통계 및 리포트 생성
│   │
│   └── 🗄️ memory-supabase-example.js     # 대안: Supabase 직접 연결
│       └── SupabaseMemoryClient 클래스
│
├── ☁️ Netlify 설정
│   │
│   ├── 📋 netlify.toml                   # Netlify 빌드/배포 설정
│   │   ├── Functions 디렉토리 지정
│   │   ├── 리다이렉트 규칙
│   │   └── 헤더 설정 (보안/성능)
│   │
│   └── netlify/functions/                # 서버리스 함수
│       │
│       ├── 🔧 memory.js                  # Memory API 엔드포인트
│       │   ├── /save - 대화 저장
│       │   ├── /search - 대화 검색
│       │   ├── /recent - 최근 대화
│       │   ├── /stats/emotion - 감정 통계
│       │   ├── /stats/topic - 주제 통계
│       │   ├── /clear - 대화 삭제
│       │   └── /summary/* - 요약 관리
│       │
│       └── 📦 package.json               # Functions 의존성
│           └── @supabase/supabase-js
│
├── 📦 설정 파일
│   │
│   ├── package.json                      # 프로젝트 메타데이터
│   │   ├── 의존성: @supabase/supabase-js
│   │   └── 스크립트: dev, build, deploy
│   │
│   ├── .gitignore                        # Git 무시 파일
│   │   ├── node_modules/
│   │   ├── .env
│   │   └── memory-data.json
│   │
│   └── .env.example                      # 환경 변수 예제
│       ├── SUPABASE_URL
│       └── SUPABASE_SERVICE_KEY
│
└── 📚 문서
    │
    ├── 📖 README-NETLIFY.md              # 프로젝트 개요
    │   ├── 배포 방법 선택
    │   ├── 빠른 시작
    │   └── 문제 해결
    │
    ├── 📘 NETLIFY_DEPLOYMENT_GUIDE.md    # 상세 배포 가이드
    │   ├── Supabase 설정 (SQL 포함)
    │   ├── GitHub 업로드
    │   ├── Netlify 배포
    │   ├── 환경 변수 설정
    │   └── 완전한 문제 해결 가이드
    │
    ├── 🚀 START.md                       # 빠른 시작 가이드
    │   ├── 단계별 가이드 (18분)
    │   └── 각 단계 상세 설명
    │
    ├── ✅ CHECKLIST.md                   # 배포 체크리스트
    │   └── 모든 단계 확인 항목
    │
    └── 📁 PROJECT_STRUCTURE.md           # 이 파일
        └── 프로젝트 구조 설명
```

---

## 🔄 데이터 흐름

### 1️⃣ 사용자 메시지 입력

```
사용자 입력
    ↓
index.html (UI)
    ↓
script.js (AICompanion.sendMessage)
    ↓
script.js (generateAIResponse)
```

### 2️⃣ Memory 검색 (맥락 분석)

```
generateAIResponse
    ↓
NetlifyMemoryClient.analyzeContext()
    ↓
Netlify Functions (/search)
    ↓
Supabase (PostgreSQL)
    ↓
관련 대화 반환
```

### 3️⃣ AI 응답 생성

```
맥락 + 사용자 메시지
    ↓
ZAIAPIClient.chatCompletionStream()
    ↓
Z.AI API (GLM-4.6)
    ↓
실시간 스트리밍 응답
    ↓
화면에 표시
```

### 4️⃣ 대화 저장

```
AI 응답 완료
    ↓
NetlifyMemoryClient.saveConversation()
    ↓
감정/주제 자동 감지
    ↓
Netlify Functions (/save)
    ↓
Supabase 저장
```

---

## 🗄️ Supabase 데이터베이스 구조

### conversations 테이블

```sql
┌─────────────┬──────────────────────┬──────────┐
│ 필드        │ 타입                 │ 설명     │
├─────────────┼──────────────────────┼──────────┤
│ id          │ BIGSERIAL PRIMARY    │ 고유 ID  │
│ user_id     │ TEXT                 │ 사용자   │
│ user_message│ TEXT                 │ 사용자   │
│ ai_message  │ TEXT                 │ AI 응답  │
│ timestamp   │ TIMESTAMPTZ          │ 시간     │
│ emotion     │ TEXT                 │ 감정     │
│ topic       │ TEXT                 │ 주제     │
│ personality │ TEXT                 │ AI 성격  │
│ created_at  │ TIMESTAMPTZ          │ 생성시간 │
└─────────────┴──────────────────────┴──────────┘
```

### conversation_summaries 테이블

```sql
┌─────────────────┬──────────────┬──────────┐
│ 필드            │ 타입         │ 설명     │
├─────────────────┼──────────────┼──────────┤
│ id              │ BIGSERIAL    │ 고유 ID  │
│ user_id         │ TEXT         │ 사용자   │
│ summary_text    │ TEXT         │ 요약     │
│ conversation_ids│ BIGINT[]     │ 대화 IDs │
│ created_at      │ TIMESTAMPTZ  │ 생성시간 │
└─────────────────┴──────────────┴──────────┘
```

---

## 🔧 수정 필요한 파일

### ⚠️ script.js

**변경 전:**
```javascript
class AICompanion {
    constructor() {
        this.memoryClient = new MemoryMCPClient();
        // ...
    }
}
```

**변경 후:**
```javascript
class AICompanion {
    constructor() {
        this.memoryClient = new NetlifyMemoryClient();
        // ...
    }
}
```

### ⚠️ index.html

**변경 전:**
```html
<script src="script.js"></script>
</body>
```

**변경 후:**
```html
<script src="memory-netlify-client.js"></script>
<script src="script.js"></script>
</body>
```

---

## 🌐 배포 환경 변수

Netlify Dashboard → Environment variables:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
```

---

## 📊 주요 클래스

### 1. ZAIAPIClient
- Z.AI API 통신 관리
- JWT 토큰 생성
- 재시도 로직
- 스트리밍 지원

### 2. AICompanion
- 채팅 UI 관리
- 메시지 송수신
- 설정 관리
- 대화 기록 관리

### 3. NetlifyMemoryClient
- Memory 시스템 인터페이스
- Netlify Functions 호출
- 대화 분석
- 통계 생성

### 4. SupabaseMemoryClient (대안)
- Supabase 직접 연결
- REST API 사용
- 간단한 구조

---

## 🚀 배포 흐름

```
1. 코드 작성
   ↓
2. GitHub 푸시
   ↓
3. Netlify 자동 감지
   ↓
4. 빌드 (정적 파일)
   ↓
5. Functions 빌드
   ↓
6. CDN 배포
   ↓
7. HTTPS 제공
   ↓
8. 사용 가능! 🎉
```

---

## 📱 사용자 경험 흐름

```
1. 사이트 접속
   ↓
2. API 키 설정
   ↓
3. 대화 시작
   ↓
4. AI 응답 (실시간 스트리밍)
   ↓
5. 대화 자동 저장
   ↓
6. 다음 대화 시 맥락 활용
   ↓
7. 통계 확인 가능
```

---

## 💡 핵심 특징

✅ **완전 무료** (Supabase + Netlify 무료 티어)
✅ **자동 확장** (서버리스)
✅ **전 세계 CDN** (빠른 속도)
✅ **HTTPS 기본** (보안)
✅ **CI/CD 자동화** (Git push → 자동 배포)
✅ **Memory 기능** (대화 기억)
✅ **감정 분석** (자동 감지)
✅ **주제 분류** (자동 태깅)

---

**이제 배포 시작! 🚀**
