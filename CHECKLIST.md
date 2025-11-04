# ✅ Netlify 배포 체크리스트

배포 전에 모든 항목을 확인하세요!

## 📋 사전 준비

- [ ] Supabase 계정 생성 완료
- [ ] Supabase 프로젝트 생성 완료
- [ ] SQL 테이블 생성 완료 (conversations, conversation_summaries)
- [ ] Supabase API 키 저장 완료 (Project URL, service_role key)
- [ ] GitHub 계정 준비 완료
- [ ] Netlify 계정 준비 완료

---

## 🔧 코드 수정

- [ ] `script.js` 수정 완료
  - [ ] `new MemoryMCPClient()` → `new NetlifyMemoryClient()` 변경
- [ ] `index.html` 수정 완료
  - [ ] `<script src="memory-netlify-client.js"></script>` 추가
  - [ ] `<script src="script.js"></script>` 순서 확인
- [ ] 로컬에서 기본 동작 테스트 완료

---

## 📦 파일 확인

프로젝트에 다음 파일이 있는지 확인:

- [ ] `index.html` (수정됨)
- [ ] `style.css`
- [ ] `script.js` (수정됨)
- [ ] `memory-netlify-client.js` ⭐
- [ ] `memory-supabase-example.js`
- [ ] `netlify.toml` ⭐
- [ ] `netlify/functions/memory.js` ⭐
- [ ] `netlify/functions/package.json` ⭐
- [ ] `package.json`
- [ ] `.gitignore`
- [ ] `README-NETLIFY.md`
- [ ] `NETLIFY_DEPLOYMENT_GUIDE.md`
- [ ] `START.md`
- [ ] `CHECKLIST.md` (이 파일)

---

## 🔐 보안 확인

- [ ] `.gitignore`에 `.env` 포함 확인
- [ ] 실제 API 키가 코드에 하드코딩되지 않았는지 확인
- [ ] `service_role` 키를 안전하게 보관했는지 확인
- [ ] GitHub에 비밀 키가 업로드되지 않았는지 확인

---

## 🚀 GitHub 업로드

- [ ] Git 초기화 완료 (`git init`)
- [ ] 모든 파일 추가 완료 (`git add .`)
- [ ] 첫 커밋 완료 (`git commit -m "..."`)
- [ ] GitHub 리포지토리 생성 완료
- [ ] Remote 추가 완료 (`git remote add origin ...`)
- [ ] 푸시 완료 (`git push -u origin main`)

---

## 🌐 Netlify 설정

- [ ] Netlify 사이트 생성 완료
- [ ] GitHub 리포지토리 연결 완료
- [ ] 빌드 설정 완료:
  - [ ] Build command: `echo 'No build needed'`
  - [ ] Publish directory: `.`
  - [ ] Functions directory: `netlify/functions`
- [ ] 첫 배포 완료 (자동)

---

## 🔑 환경 변수 설정

Netlify Dashboard → Site settings → Environment variables:

- [ ] `SUPABASE_URL` 추가 완료
- [ ] `SUPABASE_SERVICE_KEY` 추가 완료
- [ ] 환경 변수 저장 완료
- [ ] 재배포 트리거 완료

---

## ✅ 배포 테스트

- [ ] 사이트 URL 접속 가능
- [ ] 페이지 정상 로드
- [ ] F12 → Console 확인:
  - [ ] 오류 없음
  - [ ] "✅ Netlify Memory 서버 연결 성공" 메시지 표시
- [ ] Z.AI API 키 설정 완료
- [ ] 대화 테스트:
  - [ ] "안녕하세요!" 입력
  - [ ] AI 응답 정상
  - [ ] Console에 "💾 대화 저장 성공" 표시
- [ ] 대화 검색 테스트:
  - [ ] 두 번째 대화 입력
  - [ ] 이전 대화 맥락 반영 확인
- [ ] 설정 메뉴 확인:
  - [ ] 설정 열림
  - [ ] 각종 옵션 작동
  - [ ] 저장 가능

---

## 🔍 추가 테스트

- [ ] 모바일 반응형 확인
- [ ] 다크 모드 작동 확인 (있는 경우)
- [ ] 다양한 브라우저 테스트:
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari (가능한 경우)
  - [ ] Edge
- [ ] 네트워크 속도 확인:
  - [ ] F12 → Network 탭
  - [ ] Functions 응답 시간 확인 (<2초)
- [ ] 대화 삭제 기능 확인
- [ ] 통계 기능 확인

---

## 📊 Supabase 데이터 확인

Supabase Dashboard에서:

- [ ] Table Editor → conversations 테이블 열기
- [ ] 테스트 대화가 저장되었는지 확인
- [ ] 필드 확인:
  - [ ] `user_id` 채워짐
  - [ ] `user_message` 채워짐
  - [ ] `ai_message` 채워짐
  - [ ] `timestamp` 정상
  - [ ] `emotion` / `topic` 채워짐 (감지된 경우)

---

## 🎨 선택적 개선사항

- [ ] 커스텀 도메인 설정 (Netlify)
- [ ] HTTPS 강제 적용
- [ ] 메타 태그 추가 (SEO)
- [ ] 파비콘 추가
- [ ] 로딩 애니메이션 추가
- [ ] 오류 페이지 커스터마이징
- [ ] 분석 도구 추가 (Google Analytics 등)

---

## 📈 성능 최적화

- [ ] 이미지 최적화
- [ ] CSS 압축
- [ ] JavaScript 압축
- [ ] 캐싱 설정 확인
- [ ] Lighthouse 점수 확인 (>90)

---

## 📚 문서화

- [ ] README 업데이트
- [ ] 사용 방법 스크린샷 추가
- [ ] 라이선스 파일 추가
- [ ] 기여 가이드 작성 (필요시)

---

## 🎉 완료!

모든 체크리스트 완료 시:

1. ✅ 배포 성공!
2. 🌐 사이트 URL 공유
3. 📱 친구들에게 테스트 요청
4. 🚀 기능 추가 계획 수립

---

## 🆘 문제 발생 시

체크하지 못한 항목이 있다면:

1. `NETLIFY_DEPLOYMENT_GUIDE.md`의 해당 섹션 참고
2. Console 오류 메시지 확인
3. Netlify Deploy 로그 확인
4. Supabase 로그 확인
5. GitHub Issues 생성하여 질문

---

**Good luck! 🍀**
