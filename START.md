# 🚀 빠른 시작 가이드

## 1️⃣ 사전 준비 (5분)

### Supabase 설정

1. **가입**: https://supabase.com
2. **프로젝트 생성**:
   - 이름: `ai-companion-memory`
   - 리전: Seoul 또는 Tokyo
3. **SQL 실행**:
   - SQL Editor 열기
   - `NETLIFY_DEPLOYMENT_GUIDE.md`의 SQL 스키마 복사
   - "Run" 클릭
4. **API 키 저장**:
   - Settings → API
   - `Project URL` 복사
   - `service_role key` 복사 (비밀!)

---

## 2️⃣ 코드 수정 (5분)

### script.js 수정

파일을 열고 `AICompanion` 클래스 생성자 부분 찾기:

```javascript
class AICompanion {
    constructor() {
        // ...기존 코드...
        
        // 이 부분을 찾아서:
        // this.memoryClient = new MemoryMCPClient();
        
        // 이렇게 변경:
        this.memoryClient = new NetlifyMemoryClient();
        
        // ...나머지 코드...
    }
}
```

### index.html 수정

`</body>` 태그 바로 위에 추가:

```html
<!-- Memory 클라이언트 추가 -->
<script src="memory-netlify-client.js"></script>
<script src="script.js"></script>
</body>
```

---

## 3️⃣ GitHub 업로드 (2분)

```bash
# 터미널에서 실행
cd ai-companion-netlify

# Git 초기화
git init

# 모든 파일 추가
git add .

# 커밋
git commit -m "Initial commit for Netlify deployment"

# GitHub 리포지토리 생성 후 연결
git remote add origin https://github.com/당신의유저명/ai-companion-netlify.git

# 푸시
git push -u origin main
```

---

## 4️⃣ Netlify 배포 (3분)

1. **Netlify 로그인**: https://netlify.com
2. **사이트 생성**:
   - "Add new site" 클릭
   - "Import an existing project" 선택
   - GitHub 연결
   - 리포지토리 선택
3. **빌드 설정**:
   ```
   Build command: echo 'No build needed'
   Publish directory: .
   Functions directory: netlify/functions
   ```
4. **Deploy** 클릭!

---

## 5️⃣ 환경 변수 설정 (2분)

Netlify Dashboard에서:

1. **Site settings** 클릭
2. **Environment variables** 선택
3. **Add a variable** 클릭
4. 2개 추가:

```
Key: SUPABASE_URL
Value: https://xxxxx.supabase.co

Key: SUPABASE_SERVICE_KEY  
Value: eyJhbGc...
```

5. **재배포**:
   - Deploys 탭
   - "Trigger deploy"
   - "Deploy site"

---

## 6️⃣ 테스트 (1분)

1. **사이트 접속**: `https://당신의사이트.netlify.app`
2. **Console 확인** (F12):
   ```
   ✅ Netlify Memory 서버 연결 성공
   ✅ Memory 시스템 활성화
   ```
3. **대화 테스트**:
   - "안녕하세요!" 입력
   - AI 응답 확인
   - Console: "💾 대화 저장 성공"

---

## ✅ 완료!

이제 Memory 기능이 포함된 AI Companion이 Netlify에서 실행됩니다! 🎉

---

## 🆘 문제 발생 시

1. **Functions 404 오류**:
   - `netlify.toml` 확인
   - Functions directory 설정 확인
   - 재배포

2. **Supabase 연결 실패**:
   - 환경 변수 다시 확인
   - `service_role` 키 사용 확인
   - API URL 확인

3. **대화가 저장 안됨**:
   - Console 오류 확인
   - Supabase 테이블 생성 확인
   - SQL 스키마 재실행

---

## 📖 상세 가이드

모든 상세 내용은 **`NETLIFY_DEPLOYMENT_GUIDE.md`** 참고!

---

**총 소요 시간**: 약 18분 ⏱️
**난이도**: ⭐⭐ (중급)
**비용**: 🎉 **완전 무료!**
