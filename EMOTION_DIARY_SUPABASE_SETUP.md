# 📖 감정일기 Supabase 설정 가이드

> 감정일기를 Supabase에 저장하고 AI가 활용하도록 설정하는 완벽 가이드

---

## 🎯 개요

이 가이드는 감정일기 기능을 Supabase 데이터베이스와 연동하는 방법을 단계별로 안내합니다.

### ✨ 구현 후 얻는 이점

- ✅ **영구 저장**: 브라우저 캐시와 무관하게 데이터 보존
- ✅ **멀티 디바이스**: 어디서나 동일한 일기 접근
- ✅ **AI 활용**: AI가 감정일기를 참고하여 개인화된 상담 제공
- ✅ **검색 최적화**: 강력한 데이터베이스 검색 기능
- ✅ **백업 자동화**: 데이터 손실 걱정 없음

---

## 📋 사전 준비

### 필요한 것

1. ✅ Supabase 계정 ([supabase.com](https://supabase.com))
2. ✅ Netlify 계정 및 배포된 사이트
3. ✅ 기본적인 SQL 이해 (복사-붙여넣기만 하면 됨!)

### 예상 소요 시간

⏱️ **총 10분** (단계별로 천천히 진행)

---

## 🚀 단계별 설정

### 1단계: Supabase 프로젝트 생성 (2분)

#### 1.1 Supabase 접속
1. [https://supabase.com](https://supabase.com) 접속
2. "Start your project" 클릭
3. GitHub 계정으로 로그인

#### 1.2 새 프로젝트 생성
1. "New Project" 클릭
2. 프로젝트 정보 입력:
   ```
   Name: ai-companion-emotion-diary
   Database Password: [강력한 비밀번호 생성 - 꼭 저장하세요!]
   Region: Northeast Asia (Seoul) - 한국에 가장 가까운 지역
   ```
3. "Create new project" 클릭
4. ⏳ 프로젝트 생성 완료까지 1-2분 대기

---

### 2단계: 데이터베이스 테이블 생성 (3분)

#### 2.1 SQL Editor 열기
1. 왼쪽 메뉴에서 **"SQL Editor"** 클릭
2. "New query" 클릭

#### 2.2 테이블 생성 SQL 실행
1. 프로젝트의 `supabase-emotion-diary-setup.sql` 파일 열기
2. **전체 내용 복사** (Ctrl+A → Ctrl+C)
3. Supabase SQL Editor에 **붙여넣기** (Ctrl+V)
4. 우측 하단 **"Run"** 버튼 클릭 ▶️

#### 2.3 성공 확인
콘솔에 다음과 같은 메시지가 표시되면 성공:
```
✅ 감정일기 테이블 및 함수가 성공적으로 생성되었습니다!
📊 테이블: emotion_diaries
🔍 함수: get_recent_diaries, get_diaries_by_tag, search_diaries, get_emotion_summary
🔒 RLS (Row Level Security) 활성화됨
```

#### 2.4 테이블 확인
1. 왼쪽 메뉴에서 **"Table Editor"** 클릭
2. `emotion_diaries` 테이블이 보이면 성공! ✅

---

### 3단계: API 키 가져오기 (1분)

#### 3.1 프로젝트 설정 열기
1. 왼쪽 메뉴 하단 ⚙️ **"Project Settings"** 클릭
2. **"API"** 탭 선택

#### 3.2 필요한 정보 복사
다음 2가지 정보를 **안전한 곳에 복사**하세요:

```plaintext
📋 복사할 정보:

1. Project URL
   예: https://abcdefghijklmnop.supabase.co

2. service_role key (⚠️ 주의: anon key가 아닙니다!)
   예: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ 중요:**
- `anon` key가 아닌 **`service_role`** key를 사용하세요!
- `service_role` key는 절대 클라이언트 코드에 노출하면 안 됩니다
- Netlify 환경 변수로만 사용합니다

---

### 4단계: Netlify 환경 변수 설정 (2분)

#### 4.1 Netlify 사이트 설정 열기
1. [app.netlify.com](https://app.netlify.com) 접속
2. 해당 사이트 선택
3. **"Site settings"** 클릭
4. 왼쪽 메뉴에서 **"Environment variables"** 클릭

#### 4.2 환경 변수 추가

**첫 번째 변수:**
```
Key: SUPABASE_URL
Value: [3단계에서 복사한 Project URL]
```

**두 번째 변수:**
```
Key: SUPABASE_SERVICE_ROLE_KEY
Value: [3단계에서 복사한 service_role key]
```

#### 4.3 저장 및 재배포
1. "Save" 버튼 클릭
2. **"Deploys"** 탭으로 이동
3. **"Trigger deploy"** → **"Clear cache and deploy site"** 클릭
4. ⏳ 배포 완료까지 2-3분 대기

---

### 5단계: 테스트 (2분)

#### 5.1 사이트 접속
배포 완료 후 사이트 접속

#### 5.2 감정일기 작성
1. 상단 **📖 버튼** 클릭
2. 간단한 테스트 일기 작성:
   ```
   감정적 순간: 오늘 테스트 중입니다
   감정 태그: 기쁨 선택
   ```
3. **💾 저장** 클릭

#### 5.3 성공 확인

**브라우저 콘솔 (F12) 확인:**
```
✅ 감정일기 로드 성공: 1개
✅ 일기 생성 성공: [숫자]
```

**Supabase에서 확인:**
1. Supabase → Table Editor
2. `emotion_diaries` 테이블 클릭
3. 방금 작성한 일기가 보이면 **완벽! 🎉**

#### 5.4 AI 연동 테스트
1. AI 친구에게 메시지 입력:
   ```
   내 최근 감정 상태는 어때?
   ```
2. AI가 감정일기를 참고하여 답변하는지 확인

**성공 메시지 예시:**
```
최근 감정일기를 보니 '기쁨'을 자주 느끼셨네요! 😊
테스트를 진행하시면서 좋은 마음이셨던 것 같아요.
```

---

## 🔒 보안 체크리스트

### ✅ 반드시 확인할 사항

- [ ] `service_role` key를 Netlify 환경 변수에만 저장
- [ ] 클라이언트 코드(JS 파일)에 API key 노출 안 됨
- [ ] GitHub에 `.env` 파일 업로드 안 함
- [ ] Supabase RLS (Row Level Security) 활성화 됨

### 🛡️ RLS (Row Level Security) 상태 확인

Supabase에서 확인:
1. Table Editor → `emotion_diaries` 테이블
2. 오른쪽 상단 🔒 아이콘 확인
3. "RLS enabled" 표시되면 안전 ✅

---

## 🎯 API 엔드포인트

Netlify Function이 제공하는 엔드포인트:

```
기본 URL: /.netlify/functions/emotion-diary

POST   /create              - 일기 생성
GET    /list                - 일기 목록 조회
GET    /get/:id             - 단일 일기 조회
PUT    /update/:id          - 일기 수정
DELETE /delete/:id          - 일기 삭제
GET    /search              - 일기 검색
GET    /summary             - 감정 요약
GET    /recent-for-ai       - AI용 최근 일기
```

---

## 📊 데이터 구조

### emotion_diaries 테이블

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | BIGSERIAL | 일기 고유 ID (자동 생성) |
| user_id | TEXT | 사용자 ID (브라우저 지문) |
| emotional_moment | TEXT | 감정적으로 흔들렸던 순간 |
| emotion_cause | TEXT | 감정의 원인 |
| coping_method | TEXT | 대처 방법 |
| self_comfort | TEXT | 자기 위로 |
| tags | TEXT[] | 감정 태그 배열 |
| created_at | TIMESTAMPTZ | 생성 시간 (자동) |
| updated_at | TIMESTAMPTZ | 수정 시간 (자동) |

### 인덱스

- `user_id` - 빠른 사용자별 조회
- `created_at` - 시간순 정렬
- `tags` (GIN) - 태그 검색 최적화
- 전체 텍스트 검색 - 한국어 검색 지원

---

## 🔧 문제 해결

### 일기가 저장되지 않아요

#### 증상
- 저장 버튼 클릭 후 "저장 실패" 메시지

#### 해결 방법
1. **콘솔 확인** (F12):
   ```
   ❌ 일기 생성 오류: ...
   ```

2. **환경 변수 확인**:
   - Netlify → Site settings → Environment variables
   - `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY` 존재 확인

3. **재배포**:
   - 환경 변수 변경 후 반드시 재배포 필요

---

### AI가 일기를 참고하지 않아요

#### 증상
- AI 답변에 일기 내용이 반영되지 않음

#### 해결 방법
1. **콘솔 확인**:
   ```javascript
   // F12 → Console에서 실행
   await window.emotionDiary.getRecentDiariesForAI(5)
   ```
   - 일기 데이터가 나오면 정상
   - `[]` 빈 배열이면 문제

2. **스크립트 로드 확인**:
   - `index.html`에 `<script src="js/emotion-diary.js">` 포함 확인

3. **캐시 삭제**:
   - Ctrl+Shift+R (강력 새로고침)

---

### CORS 오류가 발생해요

#### 증상
```
Access-Control-Allow-Origin 오류
```

#### 해결 방법
- Netlify Functions는 자동으로 CORS 처리됨
- 오류 지속 시:
  1. Netlify → Functions 탭 확인
  2. `emotion-diary` Function 실행 여부 확인
  3. 함수 로그 확인

---

### 환경 변수를 찾을 수 없다는 오류

#### 증상
```
❌ Supabase 환경 변수가 설정되지 않았습니다.
```

#### 해결 방법
1. **변수명 정확히 확인**:
   - `SUPABASE_URL` (대문자, 언더스코어)
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **재배포 필수**:
   - 환경 변수 추가/수정 후 반드시 재배포

3. **함수 로그 확인**:
   - Netlify → Functions → emotion-diary → Logs

---

## 📈 성능 최적화

### 인덱스 활용

이미 생성된 인덱스:
- ✅ `user_id` 인덱스 - 사용자별 조회 빠름
- ✅ `created_at` 인덱스 - 최신순 정렬 빠름
- ✅ `tags` GIN 인덱스 - 태그 검색 빠름
- ✅ 전체 텍스트 검색 인덱스 - 한국어 검색 최적화

### 쿼리 최적화

**좋은 예시:**
```javascript
// 최근 5개만 가져오기
await emotionDiary.getRecentDiariesForAI(5);
```

**피해야 할 예시:**
```javascript
// 전체 데이터를 가져와서 클라이언트에서 필터링 (느림)
const all = await getAllDiaries();
const filtered = all.filter(...);
```

---

## 🔄 백업 및 복원

### 수동 백업

#### Supabase에서 백업
1. Table Editor → `emotion_diaries`
2. 오른쪽 상단 `...` → "Download as CSV"

#### 프로그래밍 방식 백업
```javascript
// 콘솔에서 실행
const diaries = window.emotionDiary.diaries;
const backup = JSON.stringify(diaries, null, 2);
console.log(backup);
// 결과를 복사하여 파일로 저장
```

### 자동 백업 (Supabase 기능)

Supabase는 자동으로 백업합니다:
- 💾 매일 자동 백업
- 📅 7일간 보관 (무료 플랜)
- 🔙 언제든 복원 가능

---

## 📊 통계 및 모니터링

### Supabase 대시보드

1. **Database Usage**:
   - 저장 공간 사용량 확인
   - 무료 플랜: 500MB

2. **API Usage**:
   - API 호출 횟수 모니터링
   - 무료 플랜: 월 50,000회

3. **Table Stats**:
   - 행 수, 크기 등 확인

### 사용자 통계 확인

```javascript
// 브라우저 콘솔에서 실행
const stats = window.emotionDiary.getStatistics();
console.log(stats);

// 결과 예시:
{
  totalDiaries: 15,
  tagCounts: { "불안": 5, "기쁨": 3, ... },
  mostUsedTag: "불안",
  oldestDiary: "2024-01-01T10:00:00Z",
  newestDiary: "2024-01-15T20:30:00Z"
}
```

---

## 🎓 고급 기능

### 커스텀 SQL 함수 추가

감정 패턴 분석 함수 예시:

```sql
CREATE OR REPLACE FUNCTION analyze_emotion_patterns(p_user_id TEXT)
RETURNS TABLE (
    emotion_tag TEXT,
    avg_per_week NUMERIC,
    trend TEXT
) AS $$
BEGIN
    -- 주간 평균 및 추세 분석 로직
    RETURN QUERY
    SELECT 
        unnest(tags) as emotion_tag,
        COUNT(*) / 4.0 as avg_per_week,
        CASE 
            WHEN COUNT(*) > 5 THEN '증가'
            WHEN COUNT(*) < 2 THEN '감소'
            ELSE '안정'
        END as trend
    FROM emotion_diaries
    WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '28 days'
    GROUP BY unnest(tags);
END;
$$ LANGUAGE plpgsql;
```

### 실시간 동기화 (선택사항)

Supabase Realtime 활용:

```javascript
// 실시간 일기 업데이트 구독
const subscription = supabase
  .from('emotion_diaries')
  .on('INSERT', payload => {
    console.log('새 일기 추가됨:', payload.new);
  })
  .subscribe();
```

---

## 💡 팁 & 트릭

### 1. 빠른 검색을 위한 팁

```javascript
// 태그와 키워드를 함께 검색
const results = await fetch(
  `/.netlify/functions/emotion-diary/search?user_id=${userId}&search_term=회사&tag=스트레스`
);
```

### 2. AI 프롬프트 최적화

AI가 더 잘 이해하도록 일기 작성 팁:
- ✅ 구체적으로 작성: "화났다" → "동료가 내 의견을 무시해서 속상했다"
- ✅ 감정 태그 정확히 선택
- ✅ 대처 방법 상세히 기록

### 3. 성능 향상

```javascript
// 페이지 로드 시 미리 일기 로드
window.addEventListener('load', async () => {
  if (window.emotionDiary) {
    await window.emotionDiary.loadDiaries();
  }
});
```

---

## 🆘 추가 지원

### 문서

- [Supabase 공식 문서](https://supabase.com/docs)
- [Netlify Functions 가이드](https://docs.netlify.com/functions/overview/)
- 프로젝트 `EMOTION_DIARY_GUIDE.md`

### 커뮤니티

- GitHub Issues
- Supabase Discord
- Netlify Community Forum

---

## ✅ 완료 체크리스트

설정을 완료했다면 체크하세요:

- [ ] Supabase 프로젝트 생성 완료
- [ ] `emotion_diaries` 테이블 생성 완료
- [ ] Netlify 환경 변수 설정 완료
- [ ] 사이트 재배포 완료
- [ ] 테스트 일기 작성 및 저장 성공
- [ ] Supabase Table Editor에서 데이터 확인
- [ ] AI가 일기 참고하여 답변하는지 확인
- [ ] 브라우저 콘솔에 오류 없음

**모두 체크되었다면 축하합니다! 🎉**

이제 감정일기가 안전하게 Supabase에 저장되고, AI가 당신의 감정을 이해하며 더 나은 상담을 제공할 것입니다.

---

**마음 건강은 가장 소중한 자산입니다. 💝**

꾸준히 감정 일기를 작성하며 자신을 돌보세요!