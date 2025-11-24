# Git LFS 설정 가이드

## 문제 상황
GitHub Push 실패 - TTS 모델 파일들의 크기가 제한을 초과
- `assets/tts/vocoder.onnx`: 96.73 MB (GitHub 권장 50MB 초과)
- `assets/tts/vector_estimator.onnx`: 126.38 MB (GitHub 최대 100MB 초과)

## 해결 방법

### 1단계: Git LFS 설치 확인
```bash
# Git LFS가 설치되어 있는지 확인
git lfs version

# 설치되어 있지 않다면 (이미 프로젝트에 git-lfs 파일들이 있음)
cd git-lfs-3.4.0
./install.sh
```

### 2단계: Git LFS 초기화 및 설정
```bash
# Git LFS 초기화
git lfs install

# 대용량 ONNX 파일들을 Git LFS로 추적 설정
git lfs track "assets/tts/*.onnx"
git lfs track "models/tts/*.onnx"

# .gitattributes 파일이 생성되었는지 확인
cat .gitattributes
```

### 3단계: 변경사항 커밋 및 푸시
```bash
# 변경사항 커밋 (Git LFS 설정 포함)
git add .gitattributes
git commit -m "Setup Git LFS for ONNX model files"

# 다시 Push 시도
git push origin main
```

## 확인 방법
```bash
# Git LFS로 관리되는 파일 확인
git lfs ls-files

# Push 시 Git LFS 파일들이 올바르게 업로드되는지 확인
git push origin main --verbose
```

## 문제 해결

### LFS 설정 후에도 Push 실패할 경우:
1. **GitHub 리포지토리에서 LFS 활성화 확인**
   - Repository Settings > Large File Storage 확인
   - Billing에서 Git LFS 사용량 확인

2. **인증 문제일 경우:**
   ```bash
   # GitHub 인증 재설정
   git remote set-url origin https://github.com/jmpark333/ai-companion.git
   ```

3. **필요시 이전 큰 파일 커밋 제거:**
   ```bash
   # 큰 파일 기록 제거 (주의: 히스토리가 변경됨)
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch assets/tts/vocoder.onnx models/tts/vector_estimator.onnx' --prune-empty --tag-name-filter cat -- --all
   git push origin main --force
   ```

## 비용 정보
- GitHub에서 제공하는 무료 Git LFS 저장소: 1GB
- 초과 시 월 $0.005 per GB
- 현재 두 파일은 총 약 223MB이므로 무료 범위 내

## 참고 링크
- [Git LFS 공식 문서](https://git-lfs.github.io/)
- [GitHub Large File Storage](https://docs.github.com/en/repositories/working-with-files/managing-large-files)