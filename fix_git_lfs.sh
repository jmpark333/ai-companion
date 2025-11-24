#!/bin/bash

# Git LFS 설정 및 문제 해결 스크립트
echo "🔧 Git LFS 대용량 파일 Push 문제 해결"
echo "========================================"

# 1단계: Git LFS가 설치되어 있는지 확인
echo "1단계: Git LFS 설치 상태 확인..."
if ! command -v git-lfs &> /dev/null; then
    echo "Git LFS가 설치되어 있지 않습니다. 설치 중..."
    
    # git-lfs 디렉토리가 존재하는지 확인
    if [ -d "git-lfs-3.4.0" ]; then
        echo "git-lfs-3.4.0 디렉토리를 찾았습니다. 설치 중..."
        cd git-lfs-3.4.0
        sudo ./install.sh
        cd ..
    else
        echo "Git LFS를 다운로드하여 설치합니다..."
        wget https://github.com/git-lfs/git-lfs/releases/download/v3.4.0/git-lfs-linux-amd64-v3.4.0.tar.gz
        tar -xzf git-lfs-linux-amd64-v3.4.0.tar.gz
        cd git-lfs-3.4.0
        sudo ./install.sh
        cd ..
    fi
fi

echo "Git LFS 버전:"
git-lfs version

# 2단계: Git LFS 초기화
echo ""
echo "2단계: Git LFS 초기화..."
git lfs install

# 3단계: 대용량 ONNX 파일들을 LFS로 추적 설정
echo ""
echo "3단계: ONNX 파일들을 Git LFS로 추적 설정..."
git lfs track "assets/tts/*.onnx"
git lfs track "models/tts/*.onnx"

# .gitattributes 확인
echo ""
echo "4단계: .gitattributes 파일 내용 확인..."
if [ -f ".gitattributes" ]; then
    echo ".gitattributes 파일 내용:"
    cat .gitattributes
else
    echo ".gitattributes 파일이 없습니다."
fi

# 5단계: 현재 상태 확인
echo ""
echo "5단계: Git LFS 관리 파일 확인..."
git lfs ls-files

# 6단계: 변경사항 커밋
echo ""
echo "6단계: Git LFS 설정을 커밋합니다..."
git add .gitattributes
git commit -m "Setup Git LFS for large ONNX model files"

# 7단계: 재시도 Push
echo ""
echo "7단계: GitHub에 Push 재시도..."
echo "Push 명령어: git push origin main"
echo "수동으로 실행하거나, 다음 명령어를 사용하세요:"
echo "git push origin main --verbose"