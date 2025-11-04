# 🚀 AI Companion - Netlify 배포 버전

이 프로젝트는 Memory MCP 서버를 Netlify에서 사용 가능하도록 수정한 버전입니다.

## 📁 프로젝트 구조

```
ai-companion-netlify/
├── index.html                      # 메인 HTML 페이지
├── style.css                       # 스타일시트
├── script.js                       # 기존 JavaScript (변경 필요)
├── memory-supabase-example.js     # Supabase 직접 연결 클라이언트
├── memory-netlify-client.js       # Netlify Functions 클라이언트 (추천)
├── netlify.toml                    # Netlify 설정
├── netlify/
│   └── functions/
│       ├── memory.js               # Memory API 서버리스 함수
│       └── package.json            # Functions 의존성
├── package.json                    # 프로젝트 의존성
├── .gitignore                      # Git 무시 파일
├── README-NETLIFY.md              # 이 파일
└── NETLIFY_DEPLOYMENT_GUIDE.md    # 상세 배포 가이드
```

## 🎯 배포 방법 선택

### 방법 1: Netlify Functions + Supabase (⭐⭐⭐⭐⭐ 추천)

**장점:**
- ✅ 완전 무료
- ✅ API 키 보안 강화 (서버에서 관리)
- ✅ 확장 가능
- ✅ 자동 백업

**사용 파일:**
- `memory-netlify-client.js`
- `netlify/functions/memory.js`

**설정 가이드:** `NETLIFY_DEPLOYMENT_GUIDE.md` 참고

---

### 방법 2: Supabase 직접 연결 (⭐⭐⭐⭐ 간단함)

**장점:**
- ✅ 간단한 설정
- ✅ 빠른 응답

**단점:**
- ⚠️ API 키 클라이언트 노출

**사용 파일:**
- `memory-supabase-example.js`

---

### 방법 3: Memory 기능 없이 사용 (⭐⭐⭐ 최소)

**장점:**
- ✅ 즉시 배포

**단점:**
- ❌ 대화 기억 제한적

---

## 🚀 빠른 시작 (방법 1 - 추천)

### 1단계: Supabase 설정

1. https://supabase.com 가입
2. 새 프로젝트 생성
3. SQL Editor에서 테이블 생성:

```sql
-- NETLIFY_DEPLOYMENT_GUIDE.md의 SQL 스키마 복사하여 실행
```

4. API 키 복사:
   - Project URL
   - service_role key (비밀 키)

### 2단계: GitHub 업로드

```bash
cd ai-companion-netlify
git init
git add .
git commit -m "Initial commit for Netlify deployment"
git remote add origin https://github.com/your-username/ai-companion-netlify.git
git push -u origin main
```

### 3단계: Netlify 배포

1. https://netlify.com 로그인
2. "Add new site" → "Import an existing project"
3. GitHub 리포지토리 선택
4. 빌드 설정:
   - Build command: `echo 'No build needed'`
   - Publish directory: `.` (현재 디렉토리)
   - Functions directory: `netlify/functions`

### 4단계: 환경 변수 설정

Netlify Dashboard → Site settings → Environment variables:

```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGc...
```

### 5단계: script.js 수정

`script.js`의 `AICompanion` 생성자에서:

```javascript
// 기존:
// this.memoryClient = new MemoryMCPClient();

// 변경:
this.memoryClient = new NetlifyMemoryClient();
```

### 6단계: index.html 수정

`</body>` 태그 앞에 추가:

```html
<!-- Memory Client 추가 -->
<script src="memory-netlify-client.js"></script>
<script src="script.js"></script>
```

### 7단계: 변경사항 푸시

```bash
git add script.js index.html
git commit -m "Use NetlifyMemoryClient"
git push
```

Netlify가 자동으로 재배포합니다!

---

## ✅ 배포 확인

1. Netlify URL 접속 (예: `https://your-site.netlify.app`)
2. F12 → Console 확인:
   ```
   ✅ Netlify Memory 서버 연결 성공
   ```
3. 대화 테스트:
   - "오늘 기분이 좋아요" 입력
   - AI 응답 확인
   - Console에 "💾 대화 저장 성공" 표시

---

## 🐛 문제 해결

### Functions 404 오류

```bash
# netlify.toml 확인
[build]
  functions = "netlify/functions"

# 재배포
```

### Supabase 연결 오류

- 환경 변수 재확인
- `service_role` 키 사용 확인 (anon 키 아님)

### 대화 저장 안됨

- Console에서 오류 메시지 확인
- Supabase 테이블 생성 확인

---

## 📚 상세 문서

모든 상세한 설정 방법은 **`NETLIFY_DEPLOYMENT_GUIDE.md`** 를 참고하세요.

---

## 💰 비용

- **Supabase**: 무료 (500MB, 10만+ 대화)
- **Netlify**: 무료 (125,000 functions/월)
- **총 비용**: 🎉 **완전 무료!**

---

## 📞 지원

문제가 있으면:
1. `NETLIFY_DEPLOYMENT_GUIDE.md`의 "문제 해결" 섹션 참고
2. GitHub Issues 생성
3. Console 오류 메시지와 함께 문의

---

**Happy Coding! 🚀**
