# 🤗 AI Companion - Netlify 배포 버전

> Memory 기능이 포함된 감성적 AI 친구를 Netlify에 배포하는 프로젝트입니다.

[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://app.netlify.com/sites/your-site)

---

## ✨ 특징

- 🤖 **Z.AI API** - GLM-4.6 최신 AI 모델
- 🧠 **Memory 시스템** - Supabase 기반 대화 기억
- 📖 **감정 일기** - 감정 기록 및 관리 기능 ⭐ NEW
- ☁️ **서버리스** - Netlify Functions 사용
- 🎨 **아름다운 UI** - 반응형 디자인
- 📊 **대화 분석** - 감정/주제 자동 감지
- 🔒 **보안** - 환경 변수로 API 키 관리
- 💰 **무료** - Supabase + Netlify 무료 티어

---

## 🚀 빠른 시작

### 방법 1: 빠른 가이드 (18분) ⭐ 추천

**START.md** 파일을 열고 단계별로 따라하세요!

```bash
# 1. Supabase 설정 (5분)
# 2. 코드 수정 (5분)
# 3. GitHub 업로드 (2분)
# 4. Netlify 배포 (3분)
# 5. 환경 변수 설정 (2분)
# 6. 테스트 (1분)
```

### 방법 2: 상세 가이드

**NETLIFY_DEPLOYMENT_GUIDE.md** 파일에서 모든 상세 내용을 확인하세요.

### 방법 3: 체크리스트

**CHECKLIST.md** 파일로 단계별 확인하며 진행하세요.

---

## 📁 프로젝트 구조

```
ai-companion-netlify/
├── index.html                      # 메인 페이지
├── style.css                       # 스타일
├── script.js                       # 메인 로직 (수정 필요!)
├── memory-netlify-client.js       # Memory 클라이언트 ⭐
├── js/
│   └── emotion-diary.js           # 감정 일기 관리 ⭐ NEW
├── netlify.toml                    # Netlify 설정
├── netlify/functions/
│   ├── memory.js                   # Memory API
│   └── package.json                # 의존성
└── 📚 문서들/
    ├── START.md                    # 빠른 시작
    ├── NETLIFY_DEPLOYMENT_GUIDE.md # 상세 가이드
    ├── CHECKLIST.md                # 체크리스트
    ├── EMOTION_DIARY_GUIDE.md      # 감정 일기 가이드 ⭐ NEW
    └── PROJECT_STRUCTURE.md        # 구조 설명
```

자세한 구조는 **PROJECT_STRUCTURE.md** 참고.

---

## ⚠️ 중요: 코드 수정 필요

배포 전에 반드시 2개 파일을 수정해야 합니다:

### 1. script.js 수정

```javascript
// 기존 코드 찾기:
this.memoryClient = new MemoryMCPClient();

// 다음으로 변경:
this.memoryClient = new NetlifyMemoryClient();
```

### 2. index.html 수정

`</body>` 태그 앞에 추가:

```html
<script src="memory-netlify-client.js"></script>
<script src="script.js"></script>
</body>
```

---

## 🔧 필수 설정

### 1. Supabase 설정

1. https://supabase.com 가입
2. 프로젝트 생성
3. SQL 테이블 생성 (NETLIFY_DEPLOYMENT_GUIDE.md의 SQL 사용)
4. API 키 저장

### 2. Netlify 환경 변수

```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGc...
```

---

## 📖 문서

| 파일 | 내용 | 대상 |
|------|------|------|
| **START.md** | 18분 빠른 시작 가이드 | 🔰 초보자 |
| **NETLIFY_DEPLOYMENT_GUIDE.md** | 완전한 배포 가이드 | 📚 상세 설명 필요 |
| **CHECKLIST.md** | 배포 체크리스트 | ✅ 단계별 확인 |
| **PROJECT_STRUCTURE.md** | 프로젝트 구조 설명 | 🏗️ 구조 이해 |
| **README-NETLIFY.md** | Netlify 버전 개요 | 📋 전체 개요 |

---

## 🎯 배포 옵션

### Option 1: Netlify Functions + Supabase (⭐⭐⭐⭐⭐)

**추천 이유:**
- ✅ API 키 서버에서 관리 (보안 강화)
- ✅ 확장 가능
- ✅ 완전 무료

**파일:**
- `memory-netlify-client.js`
- `netlify/functions/memory.js`

### Option 2: Supabase 직접 연결 (⭐⭐⭐⭐)

**장점:**
- ✅ 간단한 설정
- ✅ 빠른 응답

**파일:**
- `memory-supabase-example.js`

### Option 3: Memory 없이 사용 (⭐⭐⭐)

**장점:**
- ✅ 즉시 배포

**단점:**
- ❌ 대화 기억 제한적

---

## 🔍 테스트

배포 후 확인 사항:

1. ✅ 사이트 접속
2. ✅ Console (F12): "✅ Netlify Memory 서버 연결 성공"
3. ✅ 대화 테스트
4. ✅ Console: "💾 대화 저장 성공"
5. ✅ 두 번째 대화에서 맥락 반영 확인

---

## 💰 비용

**완전 무료!** 🎉

- **Supabase**: 500MB (10만+ 대화)
- **Netlify**: 125,000 functions/월
- **총 비용**: $0

---

## 🐛 문제 해결

### Functions 404 오류
→ `netlify.toml` 확인 및 재배포

### Supabase 연결 실패
→ 환경 변수 재확인 (service_role key 사용)

### 대화 저장 안됨
→ Console 오류 확인, Supabase 테이블 확인

자세한 내용은 **NETLIFY_DEPLOYMENT_GUIDE.md** 참고.

---

## 🛠️ 기술 스택

| 분류 | 기술 |
|------|------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **AI** | Z.AI API (GLM-4.6) |
| **Database** | Supabase (PostgreSQL) |
| **Hosting** | Netlify (Static + Functions) |
| **Deployment** | GitHub → Netlify CI/CD |

---

## 📊 아키텍처

```
사용자
  ↓
Netlify (CDN)
  ↓
정적 파일 (HTML/CSS/JS)
  ↓
Netlify Functions ────→ Supabase (PostgreSQL)
  ↓
Z.AI API
```

---

## 🤝 기여

1. Fork this repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

## 📄 라이선스

MIT License - 자유롭게 사용하고 수정할 수 있습니다.

---

## 📞 지원

- 📖 문서: 프로젝트 내 `.md` 파일들 참고
- 🐛 버그 리포트: GitHub Issues
- 💬 질문: GitHub Discussions

---

## 🙏 감사

- [Z.AI](https://z.ai) - AI API 제공
- [Supabase](https://supabase.com) - 데이터베이스 호스팅
- [Netlify](https://netlify.com) - 배포 플랫폼

---

## 🎉 다음 단계

1. ✅ 배포 완료 후
2. 📱 모바일 테스트
3. 🎨 UI 커스터마이징
4. 📊 분석 대시보드 추가
5. 🔔 알림 기능 추가
6. 👥 다중 사용자 지원

---

**즐거운 개발 되세요! 🚀**
