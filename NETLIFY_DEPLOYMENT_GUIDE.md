# 🚀 Netlify 배포 가이드 - Memory 기능 포함

이 가이드는 AI Companion 앱을 Memory MCP 서버와 함께 Netlify에 배포하는 방법을 설명합니다.

## 📋 목차

1. [문제점 이해](#문제점-이해)
2. [해결 방법 비교](#해결-방법-비교)
3. [추천 방법: Supabase + Netlify Functions](#추천-방법-supabase--netlify-functions)
4. [단계별 배포 가이드](#단계별-배포-가이드)
5. [대안: Supabase 직접 연결](#대안-supabase-직접-연결)
6. [대안: Memory 기능 없이 배포](#대안-memory-기능-없이-배포)
7. [문제 해결](#문제-해결)

---

## ❌ 문제점 이해

### Netlify는 정적 호스팅 서비스입니다

```
❌ 불가능한 것:
- Express 서버 같은 지속 실행 서버
- 파일 시스템 쓰기 (memory-data.json 저장)
- WebSocket, Long-running processes
- 포트 리스닝 (app.listen())

✅ 가능한 것:
- HTML, CSS, JS 정적 파일 호스팅
- Netlify Functions (서버리스 함수)
- 외부 API 호출
- 환경 변수 사용
```

### 현재 Memory MCP 서버의 문제

```javascript
// simple-memory-server.js - Netlify에서 작동 불가 ❌
const app = express();
app.listen(PORT, () => { ... });  // 지속 실행 서버 필요
fs.writeFileSync(DATA_FILE, ...);  // 파일 시스템 쓰기 불가
```

---

## 🔄 해결 방법 비교

| 방법 | 난이도 | 비용 | Memory 기능 | 추천도 |
|------|--------|------|-------------|--------|
| **Supabase + Netlify Functions** | ⭐⭐ | 무료 | ✅ 완전 지원 | ⭐⭐⭐⭐⭐ |
| **Supabase 직접 연결** | ⭐ | 무료 | ✅ 완전 지원 | ⭐⭐⭐⭐ |
| **Memory 없이 사용** | ⭐ | 무료 | ⚠️ 제한적 | ⭐⭐⭐ |
| **별도 서버 호스팅** | ⭐⭐⭐ | 유료 | ✅ 완전 지원 | ⭐⭐ |

---

## 🎯 추천 방법: Supabase + Netlify Functions

이 방법이 가장 권장되는 이유:
- ✅ 완전 무료 (Supabase + Netlify 무료 티어)
- ✅ 확장 가능한 데이터베이스
- ✅ 보안 강화 (API 키 서버에서 관리)
- ✅ 자동 백업 및 복구
- ✅ 실시간 쿼리 성능

---

## 📝 단계별 배포 가이드

### 1단계: Supabase 프로젝트 설정

#### 1.1 Supabase 가입 및 프로젝트 생성

1. https://supabase.com 접속
2. "Start your project" 클릭
3. GitHub로 로그인
4. "New Project" 클릭
   - Organization: 개인 계정 선택
   - Project name: `ai-companion-memory`
   - Database Password: 안전한 비밀번호 생성 (저장해두기!)
   - Region: `Northeast Asia (Seoul)` 또는 `Northeast Asia (Tokyo)` 선택
   - Pricing Plan: `Free` (무료)
5. "Create new project" 클릭 (약 2분 소요)

#### 1.2 데이터베이스 테이블 생성

1. 좌측 메뉴에서 **SQL Editor** 클릭
2. "New Query" 클릭
3. 아래 SQL 코드 전체 복사 & 붙여넣기:

```sql
-- conversations 테이블 생성
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    ai_message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    emotion TEXT,
    topic TEXT,
    personality TEXT DEFAULT 'warm',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp DESC);
CREATE INDEX idx_conversations_emotion ON conversations(emotion);
CREATE INDEX idx_conversations_topic ON conversations(topic);

-- Full-Text Search 인덱스 (한국어 검색)
CREATE INDEX idx_conversations_user_message_fts 
    ON conversations USING gin(to_tsvector('simple', user_message));
CREATE INDEX idx_conversations_ai_message_fts 
    ON conversations USING gin(to_tsvector('simple', ai_message));

-- conversation_summaries 테이블 생성
CREATE TABLE conversation_summaries (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    conversation_ids BIGINT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_summaries_user_id ON conversation_summaries(user_id);
CREATE INDEX idx_summaries_created_at ON conversation_summaries(created_at DESC);

-- Row Level Security (RLS) 활성화
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- 보안 정책 설정 (모든 사용자 접근 허용, user_id로 필터링)
CREATE POLICY "Enable all access for conversations"
    ON conversations FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all access for summaries"
    ON conversation_summaries FOR ALL
    USING (true)
    WITH CHECK (true);
```

4. "Run" 버튼 클릭 (또는 Ctrl+Enter)
5. 성공 메시지 확인: `Success. No rows returned`

#### 1.3 API 키 복사

1. 좌측 메뉴에서 **Settings** (⚙️) 클릭
2. **API** 섹션 클릭
3. 다음 정보를 복사해서 메모장에 저장:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (긴 문자열)
   - **service_role key**: `eyJhbGc...` (비밀 키, 안전하게 보관!)

---

### 2단계: GitHub 리포지토리 준비

#### 2.1 로컬 코드 정리

```bash
# 프로젝트 디렉토리로 이동
cd ai-companion

# 불필요한 파일 제거 (선택사항)
rm -rf node_modules
rm memory-data.json

# .gitignore 파일 확인/생성
cat > .gitignore << EOF
node_modules/
.env
.env.local
memory-data.json
*.log
.DS_Store
EOF
```

#### 2.2 GitHub에 푸시

```bash
# Git 초기화 (아직 안 했다면)
git init

# 파일 추가
git add .

# 커밋
git commit -m "Initial commit for Netlify deployment with Memory support"

# GitHub 리포지토리 생성 후 연결
git remote add origin https://github.com/your-username/ai-companion.git

# 푸시
git push -u origin main
```

---

### 3단계: Netlify 배포

#### 3.1 Netlify 계정 생성 및 사이트 생성

1. https://netlify.com 접속
2. "Sign up" → GitHub로 로그인
3. "Add new site" → "Import an existing project" 클릭
4. "Deploy with GitHub" 선택
5. GitHub 리포지토리 검색 및 선택
6. 빌드 설정:
   ```
   Base directory: (비워두기)
   Build command: echo 'No build needed'
   Publish directory: ai-companion
   Functions directory: netlify/functions
   ```
7. "Deploy site" 클릭

#### 3.2 환경 변수 설정

1. Netlify 대시보드에서 사이트 선택
2. **Site settings** → **Environment variables** 클릭
3. "Add a variable" 클릭하여 다음 2개 추가:

```
Key: SUPABASE_URL
Value: https://xxxxx.supabase.co
(Supabase에서 복사한 Project URL)

Key: SUPABASE_SERVICE_KEY
Value: eyJhbGc...
(Supabase에서 복사한 service_role key)
```

4. "Save" 클릭

#### 3.3 재배포

환경 변수 설정 후 재배포 필요:

1. **Deploys** 탭으로 이동
2. "Trigger deploy" → "Deploy site" 클릭
3. 배포 완료 대기 (약 1-2분)

---

### 4단계: Netlify Functions 패키지 설치

Netlify가 자동으로 dependencies를 설치하도록 `package.json` 확인:

```bash
# ai-companion/ 디렉토리에서
cat > package.json << 'EOF'
{
  "name": "ai-companion",
  "version": "1.0.0",
  "description": "AI Companion with Memory",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "cors": "^2.8.5",
    "express": "^5.1.0"
  }
}
EOF

# Git에 추가하고 푸시
git add package.json
git commit -m "Add Supabase dependency for Netlify Functions"
git push
```

---

### 5단계: 프론트엔드 코드 수정

#### 5.1 HTML 수정 (`index.html`)

`</body>` 태그 바로 위에 추가:

```html
<!-- Memory Client 스크립트 추가 -->
<script src="memory-netlify-client.js"></script>
<script src="script.js"></script>
```

#### 5.2 JavaScript 수정 (`script.js`)

`AICompanion` 클래스 생성자 부분 수정:

```javascript
class AICompanion {
    constructor() {
        // 기존 코드...
        
        // MemoryMCPClient 대신 NetlifyMemoryClient 사용
        this.memoryClient = new NetlifyMemoryClient();
        
        // 연결 확인
        this.memoryClient.checkConnection().then(connected => {
            if (connected) {
                console.log('✅ Memory 시스템 활성화');
            } else {
                console.warn('⚠️ Memory 시스템 비활성화 (오프라인 모드)');
            }
        });
        
        // 나머지 코드...
    }
}
```

#### 5.3 변경사항 푸시

```bash
git add index.html script.js
git commit -m "Update to use Netlify Memory Client"
git push
```

Netlify가 자동으로 재배포합니다.

---

### 6단계: 배포 확인 및 테스트

#### 6.1 사이트 접속

1. Netlify 대시보드에서 사이트 URL 확인
2. 브라우저에서 접속 (예: `https://your-site.netlify.app`)

#### 6.2 개발자 콘솔 확인

1. F12 키로 개발자 도구 열기
2. Console 탭에서 확인:
   ```
   ✅ Netlify Memory 서버 연결 성공
   ✅ Memory 시스템 활성화
   ```

#### 6.3 기능 테스트

1. **대화 저장 테스트**:
   ```
   사용자: "오늘 기분이 좋아요"
   AI 응답 대기
   Console: "💾 대화 저장 성공"
   ```

2. **대화 검색 테스트**:
   ```
   사용자: "기분이 안 좋아요"
   AI가 이전 대화를 참고하여 응답
   Console: "🔍 검색 결과: X개 발견"
   ```

3. **통계 확인**:
   - 설정(⚙️) → "📊 사용량 통계" 클릭
   - 대화 횟수, 감정 분포 등 확인

---

## 🔧 대안: Supabase 직접 연결

Netlify Functions 없이 프론트엔드에서 직접 Supabase 연결:

### 장점
- 더 간단한 설정
- 더 빠른 응답 속도

### 단점
- API 키가 클라이언트에 노출 (보안 약화)
- Row Level Security 설정 필요

### 설정 방법

1. `index.html`에 스크립트 추가:

```html
<script src="memory-supabase-example.js"></script>
<script src="script.js"></script>
```

2. `script.js` 수정:

```javascript
// Supabase 설정 (환경 변수 또는 설정에서 가져오기)
const SUPABASE_URL = localStorage.getItem('supabase_url') || 'https://xxxxx.supabase.co';
const SUPABASE_KEY = localStorage.getItem('supabase_key') || 'eyJhbGc...';

class AICompanion {
    constructor() {
        // SupabaseMemoryClient 사용
        this.memoryClient = new SupabaseMemoryClient(SUPABASE_URL, SUPABASE_KEY);
    }
}
```

3. 설정 UI에 Supabase 설정 추가:

```html
<div class="setting-group">
    <label for="supabaseUrl">Supabase URL</label>
    <input type="text" id="supabaseUrl" placeholder="https://xxxxx.supabase.co">
</div>
<div class="setting-group">
    <label for="supabaseKey">Supabase API Key</label>
    <input type="password" id="supabaseKey" placeholder="eyJhbGc...">
</div>
```

---

## 🚫 대안: Memory 기능 없이 배포

가장 간단한 방법 (Memory 기능 비활성화):

### 1. Memory 관련 코드 제거

```javascript
// script.js에서 Memory 클라이언트 비활성화
class AICompanion {
    constructor() {
        // this.memoryClient = new MemoryMCPClient(); // 주석 처리
        this.memoryClient = null; // null로 설정
    }

    async generateAIResponse(message) {
        // Memory 관련 코드 스킵
        if (this.memoryClient) {
            // Memory 검색...
        } else {
            // 로컬 히스토리만 사용
            const recentMessages = this.chatHistory.slice(-10);
        }
    }
}
```

### 2. 배포

```bash
git add script.js
git commit -m "Disable Memory features for simple deployment"
git push
```

### 장점
- ✅ 설정 없이 즉시 배포 가능
- ✅ 추가 비용 없음

### 단점
- ❌ 대화 기억 기능 제한적
- ❌ 브라우저 로컬 스토리지에만 저장

---

## 🐛 문제 해결

### 1. Netlify Functions 오류

**증상**: Console에 `404 Not Found` 또는 `Function invocation failed`

**해결**:

```bash
# 1. netlify.toml 확인
[build]
  functions = "netlify/functions"

# 2. package.json이 올바른 위치에 있는지 확인
ai-companion/
  ├── netlify/
  │   └── functions/
  │       ├── memory.js
  │       └── package.json  # 여기!
  └── ...

# 3. 환경 변수 재확인
Netlify Dashboard → Site settings → Environment variables

# 4. 재배포
Netlify Dashboard → Deploys → Trigger deploy
```

### 2. Supabase 연결 오류

**증상**: `Supabase 오류: Invalid API key`

**해결**:

1. Supabase 대시보드 → Settings → API
2. `anon` 키가 아닌 `service_role` 키 사용 확인 (Functions용)
3. 환경 변수 다시 설정:
   ```
   SUPABASE_SERVICE_KEY=eyJhbGc... (올바른 키)
   ```

### 3. CORS 오류

**증상**: `Access-Control-Allow-Origin` 오류

**해결**:

Supabase에서 CORS 설정:

1. Supabase Dashboard → Settings → API
2. **API Settings** 섹션
3. **CORS Allowed Origins**에 Netlify URL 추가:
   ```
   https://your-site.netlify.app
   ```

### 4. 대화가 저장되지 않음

**증상**: Console에 `💾 대화 저장 성공` 메시지 없음

**해결**:

```javascript
// script.js에서 저장 로직 확인
async sendMessageWithText(text) {
    // AI 응답 받은 후
    const aiResponse = await this.generateAIResponse(text);
    
    // 저장 확인
    if (this.memoryClient) {
        const saved = await this.memoryClient.saveConversation(
            text,
            aiResponse,
            {
                emotion: this.memoryClient.detectEmotion(text),
                topic: this.memoryClient.detectTopic(text)
            }
        );
        console.log('저장 결과:', saved);
    }
}
```

### 5. 느린 응답 속도

**해결**:

1. **Supabase 리전 변경**: Seoul 또는 Tokyo 선택
2. **인덱스 확인**: 위의 SQL에서 인덱스가 생성되었는지 확인
3. **검색 쿼리 최적화**:
   ```javascript
   // 검색 결과 제한
   await this.memoryClient.searchConversations(keywords, 3); // 3개만
   ```

---

## 📊 비용 계산

### 무료 티어 제한

**Supabase (무료)**:
- Database: 500MB
- 대략 10만~50만 대화 저장 가능
- 월 5GB bandwidth

**Netlify (무료)**:
- 100GB bandwidth
- 125,000 function requests/월
- 충분히 개인 사용 가능

### 예상 사용량

일 10회 대화 × 30일 = 300회/월
- Database: ~5MB/월
- Function requests: ~600회/월

**결론**: 개인 사용은 완전 무료! 🎉

---

## 🎓 다음 단계

### 추가 기능 구현

1. **대화 백업**:
   ```javascript
   async exportConversations() {
       const all = await this.memoryClient.getRecentConversations(1000);
       const json = JSON.stringify(all, null, 2);
       // 다운로드...
   }
   ```

2. **대화 분석 대시보드**:
   - Chart.js로 감정/주제 그래프
   - 시간대별 대화 빈도
   - 주간/월간 리포트

3. **알림 기능**:
   - 정기적인 대화 리마인더
   - 감정 변화 알림

4. **다중 사용자 지원**:
   - User 인증 (Supabase Auth)
   - 사용자별 데이터 격리

---

## 📚 참고 자료

- [Netlify Functions 공식 문서](https://docs.netlify.com/functions/overview/)
- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase JavaScript 클라이언트](https://supabase.com/docs/reference/javascript/introduction)

---

## ✅ 체크리스트

배포 전 확인사항:

- [ ] Supabase 프로젝트 생성 완료
- [ ] SQL 테이블 생성 완료
- [ ] Supabase API 키 복사 완료
- [ ] GitHub 리포지토리 생성 및 푸시 완료
- [ ] Netlify 사이트 생성 완료
- [ ] 환경 변수 설정 완료
- [ ] `memory-netlify-client.js` 파일 추가 완료
- [ ] `netlify/functions/memory.js` 파일 추가 완료
- [ ] `netlify/functions/package.json` 파일 추가 완료
- [ ] `netlify.toml` 설정 완료
- [ ] `script.js`에서 NetlifyMemoryClient 사용 설정 완료
- [ ] 배포 후 테스트 완료

---

**축하합니다! 🎉 이제 Memory 기능이 포함된 AI Companion이 Netlify에서 실행됩니다!**

문제가 있으면 위의 "문제 해결" 섹션을 참고하거나, GitHub Issues에 문의하세요.