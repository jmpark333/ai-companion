# Git LFS 문제 해결 - 중급 해결책

## 문제 진단 결과
Git LFS는 이미 설정되어 있지만, **이미 커밋된 큰 파일들**이 여전히 일반 파일로 취급되어 Push이 거부됩니다.

## 원인 분석
1. Git LFS 설정이 기존 커밋들보다 **늦게 적용**됨
2. 이미 히스토리에 포함된 파일들(`assets/tts/vocoder.onnx`, `vector_estimator.onnx`)은 여전히 큰 파일로 인식
3. Git은 히스토리에 있는 파일들의 추적 설정을 변경하더라도 기본 파일 크기 제한을 계속 적용

## 해결 방법 1: 히스토리 재작성 (위험하지만 효과적)

⚠️ **주의**: 기존 Commit 히스토리가 변경되며 다른 개발자들과 공유된 경우 문제가 될 수 있습니다.

```bash
# 방법 A: BFG Repo-Cleaner 사용 (더 안전)
# 1. BFG JAR 다운로드
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 2. 큰 파일들을 제거 (히스토리에서 완전 삭제)
java -jar bfg-1.14.0.jar --delete-files "assets/tts/*.onnx"

# 3. 히스토리 정리
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# 4. 리모트에 강제 푸시
git push origin main --force

# 5. 파일 복구 (Git LFS로 추적)
git add .
git commit -m "Restore TTS models with Git LFS tracking"
git lfs track "assets/tts/*.onnx"
git push origin main
```

## 해결 방법 2: 새 Repository 생성 (추천)

안전하고 깔끔한 방법입니다:

```bash
# 1. 새 디렉토리 생성
cd ..
mkdir ai-companion-clean
cd ai-companion-clean

# 2. 새 Git Repository 초기화
git init

# 3. TTS 모델 파일들을 복사하되 Git LFS로 설정
cp -r ../ai-companion-netlify/* ./
rm -rf assets/tts/*.onnx models/tts/*.onnx  # 큰 파일들 제거

# 4. Git LFS 설정
git lfs install
git lfs track "assets/tts/*.onnx"
git lfs track "models/tts/*.onnx"

# 5. 초기 커밋
git add .
git commit -m "Initial commit with Git LFS for TTS models"

# 6. 새 GitHub Repository에 연결
git remote add origin https://github.com/jmpark333/ai-companion-new.git
git push -u origin main

# 7. 원본 파일 복구 (TTS 기능 유지)
# 필요시 CDN이나 외부 저장소에서 다운로드
```

## 해결 방법 3: 외부 저장소 활용 (가장 실용적)

GitHub의 대용량 파일 제한을 우회하는 가장 효과적인 방법:

```bash
# 1. TTS 모델 파일들을 외부 서비스에 업로드
# - Hugging Face Models: https://huggingface.co/
# - Google Drive/Dropbox: 파일 공유 링크 생성
# - Git LFS 호스팅: https://git-lfs.github.io/

# 2. 원본 파일을 .gitignore에 추가
echo "assets/tts/*.onnx" >> .gitignore
echo "models/tts/*.onnx" >> .gitignore

# 3. 다운로드 스크립트 추가
cat > download-tts-models.sh << 'EOF'
#!/bin/bash
# TTS 모델 파일들을 외부에서 다운로드하는 스크립트

MODELS_DIR="assets/tts"
mkdir -p "$MODELS_DIR"

# Hugging Face에서 다운로드 예시 (파일별로 공개 URL 확인 필요)
wget -O "$MODELS_DIR/vocoder.onnx" "https://huggingface.co/[YOUR_USERNAME]/ai-companion/resolve/main/vocoder.onnx"
wget -O "$MODELS_DIR/vector_estimator.onnx" "https://huggingface.co/[YOUR_USERNAME]/ai-companion/resolve/main/vector_estimator.onnx"

# 실행 권한 부여
chmod +x "$MODELS_DIR"/*.onnx
EOF

# 4. 커밋
git add download-tts-models.sh .gitignore
git commit -m "Move TTS models to external storage with download script"
git push origin main
```

## 최종 추천: 혼합 방법

```bash
# 1. 우선 가장 간단한 방법으로 시도
echo "assets/tts/*.onnx" >> .gitignore
echo "models/tts/*.onnx" >> .gitignore

git add .gitignore
git commit -m "Exclude large TTS model files from repository"
git push origin main

# 2. 배포 시 TTS 모델 파일들을 별도로 제공
# - Netlify의 경우, functions에서 외부 CDN 활용
# - 또는 Supabase Storage에 업로드하여 동적 다운로드
```

## 결론
현재 GitHub의 Push 실패는 이미 히스토리에 포함된 큰 파일들 때문입니다. 
가장 안전하고 실용적인 해결책은 **방법 3(외부 저장소 활용)**입니다.