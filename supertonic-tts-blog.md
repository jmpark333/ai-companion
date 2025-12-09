# Supertonic — Lightning Fast, On-Device TTS 완전 구현 가이드

## 기술 소개: 브라우저에서 고품질 AI 음성 합성

<div class="concept-block">
<b>Supertonic TTS</b>는 브라우저에서 직접 실행되는 고품질 텍스트 음성 변환(Text-to-Speech) 라이브러리입니다. 기존의 클라우드 기반 TTS와 달리, <b>온디바이스(on-device)</b>로 작동하여 개인정보 보호와 실시간 성능을 모두 달성한 혁신적인 AI 음성 기술입니다.
</div>

### 🎯 주요 특징
- **온디바이스 실행**: 서버 없이 브라우저에서 직접 처리
- **Lightning Fast**: 기존 TTS보다 10배 빠른 처리 속도
- **고품질 출력**: 실제 사람과 구분되지 않는 자연스러운 음성
- **프라이버시 보장**: 텍스트가 외부로 전송되지 않음
- **플랫폼 독립적**: 모든 주요 브라우저에서 동작

## 구현 과정: 실제 프로젝트 경험담

최근 AI 컴패니온 프로젝트에서 Supertonic TTS를 성공적으로 구현한 경험을 바탕으로, 실무에서 마주친 실제 문제들과 해결 과정을 상세히 공유합니다.

### 초기 설정 문제: Git LFS 대용량 파일

<div class="warning">
⚠️ 첫 번째 마주친 문제는 Git 저장소에 100MB를 초과하는 ONNX 모델 파일들이었습니다.
- vocoder.onnx: 96.73 MB
- vector_estimator.onnx: 126.38 MB
</div>

**해결 과정:**
```bash
# Git LFS 초기화 및 설정
git lfs install
git lfs track "*.onnx"

# 기존 파일들을 LFS로 마이그레이션
git lfs migrate import --include="*.onnx" --everything

# 성공적으로 104개 커밋을 LFS로 변환하여 GitHub에 Push 완료
```

### ONNX 모델 구현: 공식 예제 분석

공식 GitHub 리포지토리인 [supertone-inc/supertonic](https://github.com/supertone-inc/supertonic)에서 브라우저 예제를 분석하여 구현했습니다.

<div class="code-block">
<pre><code class="language-javascript">/**
 * Supertonic TTS 핵심 클래스 구조 (공식 예제 기반)
 */
class SupertonicTTS {
    constructor() {
        this.textToSpeech = null;
        this.cfgs = null;
        this.currentStyle = null;
        this.modelLoaded = false;
        this.config = {
            totalSteps: 5,      // 추론 스텝 수
            speed: 1.05,        // 음성 속도
            voiceStyle: 'F1'    // 음성 스타일
        };
    }

    // ONNX 모델 초기화
    async initialize() {
        const result = await this.loadModels(this.baseUrl, {
            executionProviders: ['webgpu', 'wasm'],
            graphOptimizationLevel: 'all'
        });
        
        this.textToSpeech = new TextToSpeech(
            result.cfgs, 
            result.textProcessor, 
            result.dpOrt, 
            result.textEncOrt, 
            result.vectorEstOrt, 
            result.vocoderOrt
        );
        
        // 음성 스타일 로드
        this.currentStyle = await loadVoiceStyle(['/assets/voice_styles/F1.json']);
        this.modelLoaded = true;
    }
}</code></pre>
</div>

## 스타일 텐서 문제: 가장 어려웠던 기술적 도전

<div class="warning">
⚠️ 가장 오래 걸린 문제는 "input 'style_dp' is missing in 'feeds'" 오류였습니다.
</div>

### 문제 원인 분석
ONNX 모델이 기대하는 스타일 데이터의 형태가 잘못되어 있었습니다:
- **错误的**: `style.dp = []`, `style.ttl = []` (빈 배열)
- **올바른**: `style.dp = ort.Tensor('float32', data, shape)`, `style.ttl = ort.Tensor('float32', data, shape)`

<div class="code-block">
<pre><code class="language-javascript">/**
 * 올바른 스타일 텐서 생성 (공식 예제 기반)
 */
async function loadVoiceStyle(voiceStylePaths) {
    const firstStyle = await fetch(voiceStylePaths[0]).then(r => r.json());
    
    // 텐서 차원 정보 추출
    const ttlDims = firstStyle.style_ttl.dims;    // [1, 10, 768]
    const dpDims = firstStyle.style_dp.dims;      // [1, 5, 256]
    
    // 텐서 데이터 생성
    const ttlFlat = new Float32Array(firstStyle.style_ttl.data.flat(Infinity));
    const dpFlat = new Float32Array(firstStyle.style_dp.data.flat(Infinity));
    
    // 올바른 ORT 텐서 형태 생성
    const ttlTensor = new ort.Tensor('float32', ttlFlat, ttlDims);
    const dpTensor = new ort.Tensor('float32', dpFlat, dpDims);
    
    return new Style(ttlTensor, dpTensor);
}</code></pre>
</div>

### 해결 결과
음성 스타일 파일(F1.json, M1.json)을 Hugging Face에서 다운로드하여 텐서 형태로 처리하니 모든 오류가 해결되었습니다.

## 완전한 웹 구현 예제

### 1단계: 기본 HTML 구조

<div class="code-block">
<pre><code class="language-html"><!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Supertonic TTS Demo</title>
    <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/dist/ort.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>🎤 Supertonic TTS Demo</h1>
        
        <textarea id="textInput" placeholder="텍스트를 입력하세요...">
        안녕하세요. Supertonic TTS로 만든 한국어 음성입니다.
        </textarea>
        
        <button id="generateBtn" onclick="generateSpeech()">
            🔊 음성 생성
        </button>
        
        <audio id="audioPlayer" controls></audio>
    </div>
    
    <script src="supertonic-tts.js"></script>
</body>
</html></code></pre>
</div>

### 2단계: JavaScript 구현

<div class="code-block">
<pre><code class="language-javascript">// 전역 TTS 인스턴스
let ttsEngine = new SupertonicTTS();

// 음성 생성 함수
async function generateSpeech() {
    const text = document.getElementById('textInput').value;
    const btn = document.getElementById('generateBtn');
    const audioPlayer = document.getElementById('audioPlayer');
    
    try {
        btn.disabled = true;
        btn.textContent = '음성 생성 중...';
        
        // TTS 엔진 초기화 (첫 번째 실행 시)
        if (!ttsEngine.modelLoaded) {
            await ttsEngine.initialize();
        }
        
        // 음성 생성
        const result = await ttsEngine.speak(text);
        
        // 오디오 재생 (implementation dependent)
        // 실제 구현에서는 playAudio() 메소드 사용
        audioPlayer.src = 'data:audio/wav;base64,' + result.base64;
        audioPlayer.play();
        
        console.log('✅ 음성 생성 완료!');
        
    } catch (error) {
        console.error('❌ 음성 생성 실패:', error);
        alert('음성 생성에 실패했습니다: ' + error.message);
        
        // 폴백: Web Speech API
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            speechSynthesis.speak(utterance);
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '🔊 음성 생성';
    }
}</code></pre>
</div>

### 3단계: CSS 스타일링

<div class="code-block">
<pre><code class="language-css">/* Supertonic TTS 데모 스타일 */
.container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Noto Sans KR', sans-serif;
}

h1 {
    text-align: center;
    color: #0066cc;
    margin-bottom: 20px;
}

#textInput {
    width: 100%;
    height: 120px;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    resize: vertical;
}

#generateBtn {
    width: 100%;
    padding: 12px;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    margin: 10px 0;
    transition: background 0.3s;
}

#generateBtn:hover:not(:disabled) {
    background: #0052a3;
}

#generateBtn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

#audioPlayer {
    width: 100%;
    margin-top: 10px;
}</code></pre>
</div>

## 성능 비교 및 장단점 분석

<div style="overflow-x: auto;">
<table class="performance-table">
<thead>
<tr>
<th>비교 항목</th>
<th>Supertonic TTS</th>
<th>기존 클라우드 TTS</th>
<th>Web Speech API</th>
</tr>
</thead>
<tbody>
<tr>
<td><b>속도</b></td>
<td>⚡ Lightning Fast (10x)</td>
<td>🌐 네트워크 의존</td>
<td>⚡ 빠름</td>
</tr>
<tr>
<td><b>품질</b></td>
<td>🎯 최상급</td>
<td>🎯 상급</td>
<td>🎯 중급</td>
</tr>
<tr>
<td><b>프라이버시</b></td>
<td>🔒 완전 보호</td>
<td>⚠️ 서버 전송</td>
<td>🔒 완전 보호</td>
</tr>
<tr>
<td><b>비용</b></td>
<td>💰 무료</td>
<td>💸 API 비용</td>
<td>💰 무료</td>
</tr>
<tr>
<td><b>언어 지원</b></td>
<td>🌍 다국어</td>
<td>🌍 최다</td>
<td>🌍 제한적</td>
</tr>
<tr>
<td><b>브라우저 호환</b></td>
<td>✅ 모던 브라우저</td>
<td>✅ 전부</td>
<td>✅ 전부</td>
</tr>
</tbody>
</table>
</div>

## 실제 구현에서 배운 교훈

### 1. 파일 경로 주의사항
```javascript
// ❌ 잘못된 경로
const stylePath = `/assets/tts/voice_styles/${voiceStyle}.json`;

// ✅ 올바른 경로  
const stylePath = `/assets/voice_styles/${voiceStyle}.json`;
```

### 2. 에러 핸들링의 중요성
```javascript
try {
    const result = await ttsEngine.speak(text);
    await audioPlayer.play();
} catch (error) {
    console.warn('Supertonic TTS 실패, Web Speech API 폴백');
    // 폴백 메커니즘 구현
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
}
```

### 3. 모델 초기화 최적화
```javascript
// 처음 한 번만 초기화하고 재사용
class SupertonicTTS {
    constructor() {
        this.modelLoaded = false;
        this.isLoading = false;
    }
    
    async speak(text) {
        if (!this.modelLoaded && !this.isLoading) {
            await this.initialize();
        }
        // 음성 생성 로직...
    }
}
```

## 최적화 팁과 베스트 프랙티스

### 성능 최적화
1. **모델 캐싱**: 초기화 후 인스턴스 재사용
2. **지연 로딩**: 필요할 때만 음성 스타일 로드
3. **메모리 관리**: 큰 텐서 데이터 적절히 처리

### 사용자 경험 개선
1. **로딩 상태 표시**: 사용자에게 진행 상황 피드백
2. **에러 폴백**: Web Speech API로 백업 음성 제공
3. **다양한 음성 스타일**: F1, M1 등 선택 가능

### 개발자 팁
1. **디버깅**: 콘솔에서 모델 로딩 상태 모니터링
2. **테스팅**: 다양한 브라우저에서 호환성 확인
3. **최적화**: WebAssembly vs WebGPU 성능 비교

## 결론: 브라우저 AI 음성 기술의 미래

<div class="info">
💡 Supertonic TTS는 브라우저 기반 AI 음성 기술의 새로운 표준을 제시하고 있습니다. 클라우드 의존 없이도 고품질 음성을 실시간으로 생성할 수 있다는 것은 프라이버시와 성능을 동시에 만족시키는 혁신적 접근입니다.
</div>

Supertonic TTS를 통해 경험한 기술적 도전을 통해, 온디바이스 AI의 가능성을 실제로 확인했습니다. 특히 **Git LFS 처리**, **ONNX 텐서 형태 문제**, **에러 폴백 메커니즘** 등 실무에서 꼭 필요한 기술들을 완벽히 체득했습니다.

<div class="concept-block">
<b>향후 전망</b>: 브라우저의 AI 처리 능력 향상에 따라, 더 많은 AI 모델들이 온디바이스로 이동할 것입니다. Supertonic TTS는 이러한 흐름의 선구자이자, 개발자들이 반드시 주목해야 할 핵심 기술입니다.
</div>

여러분도 한번 Supertonic TTS를 직접 구현해보시면서, 브라우저에서 AI 음성 기술의 가능성을 직접 경험해보시길 추천드립니다. 음성 인터페이스가 더욱 개인화되고 안전해지는 미래를 만드는 것이 바로 이런 기술들입니다!

---

**키워드**: AI 음성, Supertonic TTS, 온디바이스 AI, 웹 TTS, ONNX, 브라우저 음성 합성, 실시간 음성 처리, 개인정보 보호 AI