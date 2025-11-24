// Supertonic TTS 모델 다운로드 스크립트
// 이 스크립트는 필요한 TTS 모델 파일들을 다운로드하여 models/tts 디렉토리에 저장합니다.

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 모델 파일 URLs (Hugging Face에서 가져옴)
const MODEL_FILES = {
    'tts.json': 'https://huggingface.co/Supertone/supertonic/resolve/main/onnx/tts.json',
    'unicode_indexer.json': 'https://huggingface.co/Supertone/supertonic/resolve/main/onnx/unicode_indexer.json',
    'duration_predictor.onnx': 'https://huggingface.co/Supertone/supertonic/resolve/main/onnx/duration_predictor.onnx',
    'text_encoder.onnx': 'https://huggingface.co/Supertone/supertonic/resolve/main/onnx/text_encoder.onnx',
    'vector_estimator.onnx': 'https://huggingface.co/Supertone/supertonic/resolve/main/onnx/vector_estimator.onnx',
    'vocoder.onnx': 'https://huggingface.co/Supertone/supertonic/resolve/main/onnx/vocoder.onnx'
};

// 다운로드 디렉토리
const MODEL_DIR = path.join(__dirname, 'models', 'tts');

// 디렉토리 생성
if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    console.log(`✅ 모델 디렉토리 생성: ${MODEL_DIR}`);
}

// 파일 다운로드 함수 (리디렉션 처리 추가)
function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        const file = fs.createWriteStream(filePath);
        
        console.log(`📥 다운로드 중: ${path.basename(filePath)}`);
        
        const requestOptions = {
            headers: {
                'User-Agent': 'Node.js Download Script'
            }
        };
        
        protocol.get(url, requestOptions, (response) => {
            // 리디렉션 처리 (301, 302, 307, 308)
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`🔄 리디렉션: ${response.statusCode} -> ${response.headers.location}`);
                
                let newUrl = response.headers.location;
                // 상대 경로인 경우 절대 경로로 변환
                if (newUrl.startsWith('/')) {
                    const originalUrl = new URL(url);
                    newUrl = `${originalUrl.protocol}//${originalUrl.host}${newUrl}`;
                }
                
                // 재귀적으로 리디렉션된 URL로 다운로드
                downloadFile(newUrl, filePath)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                const progress = Math.round((downloadedSize / totalSize) * 100);
                process.stdout.write(`\r📊 진행률: ${progress}%`);
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                console.log(`\n✅ 다운로드 완료: ${path.basename(filePath)}`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(filePath, () => {}); // 오류 시 파일 삭제
                reject(err);
            });
        }).on('error', reject);
    });
}

// 메인 다운로드 함수
async function downloadModels() {
    console.log('🚀 Supertonic TTS 모델 다운로드 시작...\n');
    
    try {
        for (const [filename, url] of Object.entries(MODEL_FILES)) {
            const filePath = path.join(MODEL_DIR, filename);
            
            // 파일이 이미 존재하는지 확인
            if (fs.existsSync(filePath)) {
                console.log(`⏭️  건너뛰기 (이미 존재): ${filename}`);
                continue;
            }
            
            await downloadFile(url, filePath);
        }
        
        console.log('\n🎉 모든 모델 파일 다운로드 완료!');
        console.log(`📁 저장 위치: ${MODEL_DIR}`);
        console.log('\n📋 다운로드된 파일:');
        
        Object.keys(MODEL_FILES).forEach(filename => {
            const filePath = path.join(MODEL_DIR, filename);
            const stats = fs.statSync(filePath);
            console.log(`  • ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        });
        
    } catch (error) {
        console.error('❌ 다운로드 중 오류 발생:', error.message);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    downloadModels();
}

module.exports = { downloadModels };