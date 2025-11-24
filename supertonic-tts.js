// Supertonic TTS 통합 모듈
// ONNX Runtime Web을 사용한 브라우저 기반 TTS

class SupertonicTTS {
    constructor() {
        this.session = null;
        this.modelLoaded = false;
        this.isLoading = false;
        this.audioContext = null;
        
        // Netlify 환경 감지
        this.isNetlify = window.location.hostname.includes('netlify.app') ||
                         window.location.hostname.includes('netlify.com');
        
        // 모델 URL 설정
        this.modelUrl = 'https://huggingface.co/supertone/supertonic/resolve/main/supertonic_v0.1.onnx';
        this.configUrl = 'https://huggingface.co/supertone/supertonic/resolve/main/config.json';
        
        // 기본 설정
        this.config = {
            totalSteps: 4,      // 추론 스텝 수 (높을수록 품질 향상)
            speed: 1.0,         // 속도 (0.9-1.5 권장)
            voiceStyle: 'default' // 음성 스타일
        };
    }

    // ONNX 세션 초기화
    async initialize() {
        if (this.modelLoaded || this.isLoading) {
            console.log('모델이 이미 로드되었거나 로드 중입니다.');
            return this.modelLoaded;
        }

        this.isLoading = true;
        console.log('🎤 Supertonic TTS 모델 로딩 시작...');

        try {
            // Web Audio API 초기화
            if (!window.AudioContext) {
                throw new Error('이 브라우저는 Web Audio API를 지원하지 않습니다.');
            }
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // ONNX Runtime Web 초기화 확인
            if (!window.ort) {
                throw new Error('ONNX Runtime Web이 로드되지 않았습니다.');
            }
            
            // Hugging Face에서 모델 파일 직접 로드
            console.log('📥 모델 파일 다운로드 중...');
            console.log(`🌐 환경: ${this.isNetlify ? 'Netlify' : '로컬'}`);
            
            const [modelResponse, configResponse] = await Promise.all([
                fetch(this.modelUrl),
                fetch(this.configUrl)
            ]);
            
            if (!modelResponse.ok || !configResponse.ok) {
                const modelStatus = modelResponse.status;
                const configStatus = configResponse.status;
                throw new Error(`모델 파일 다운로드 실패 - 모델: ${modelStatus}, 설정: ${configStatus}`);
            }
            
            const modelArrayBuffer = await modelResponse.arrayBuffer();
            const config = await configResponse.json();
            
            // ONNX 세션 생성 및 모델 로드
            this.session = await ort.InferenceSession.create();
            await this.session.loadModel(new Uint8Array(modelArrayBuffer));
            
            // 설정 저장
            this.config = { ...this.config, ...config };
            this.modelLoaded = true;
            this.isLoading = false;
            
            console.log('✅ Supertonic TTS 모델 로딩 완료');
            return true;
            
        } catch (error) {
            this.isLoading = false;
            console.error('❌ TTS 모델 로딩 실패:', error);
            throw new Error(`TTS 모델 로딩 실패: ${error.message}`);
        }
    }

    // 텍스트를 음성으로 변환
    async synthesize(text, options = {}) {
        if (!this.modelLoaded) {
            await this.initialize();
        }

        const config = { ...this.config, ...options };
        console.log('🎵 TTS 변환 시작:', text.substring(0, 50) + '...');
        
        try {
            // 텍스트 전처리
            const processedText = this.preprocessText(text);
            
            // ONNX 모델로 음성 생성
            const audioData = await this.generateSpeech(processedText, config);
            
            // AudioBuffer로 변환
            const audioBuffer = this.convertToAudioBuffer(audioData);
            
            console.log('✅ TTS 변환 완료');
            return audioBuffer;
            
        } catch (error) {
            console.error('❌ TTS 변환 실패:', error);
            throw new Error(`TTS 변환 실패: ${error.message}`);
        }
    }

    // 오디오 재생
    async playAudio(audioBuffer) {
        try {
            const audioBuffer = await this.audioContext.decodeAudioData(audioBuffer);
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            source.connect(this.audioContext.destination);
            source.start(0);
            
            console.log('🔊 오디오 재생 시작');
            
            // 재생 완료 후 정리
            source.onended = () => {
                source.stop();
                source.disconnect();
                console.log('🔇 오디오 재생 완료');
            };
            
        } catch (error) {
            console.error('❌ 오디오 재생 실패:', error);
            throw new Error(`오디오 재생 실패: ${error.message}`);
        }
    }

    // 텍스트 음성으로 변환 후 바로 재생
    async speak(text, options = {}) {
        const audioBuffer = await this.synthesize(text, options);
        await this.playAudio(audioBuffer);
    }

    // 오디오 다운로드 (WAV 형식)
    downloadWav(audioBuffer, filename = 'supertonic_output.wav') {
        try {
            const wavBlob = this.audioBufferToWav(audioBuffer);
            const url = URL.createObjectURL(wavBlob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // URL 정리
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            console.log('💾 WAV 파일 다운로드 완료:', filename);
            
        } catch (error) {
            console.error('❌ WAV 파일 다운로드 실패:', error);
            throw new Error(`WAV 파일 다운로드 실패: ${error.message}`);
        }
    }

    // 텍스트 전처리
    preprocessText(text) {
        // 기본적인 텍스트 정리
        return text
            .trim()
            .replace(/[^\w\s\uAC00-\uD7FF\uF900-\uFAFF\d]/g, '') // 특수문자 제거
            .replace(/\s+/g, ' ') // 여러 공백을 하나로
            .substring(0, 500); // 최대 길이 제한
    }

    // ONNX 모델로 음성 생성 (간단화된 버전)
    async generateSpeech(text, config) {
        try {
            // 텍스트를 토큰화 (간단한 구현)
            const tokens = this.tokenizeText(text);
            
            // 임의 음성 파라미터 생성 (실제로는 더 복잡한 로직 필요)
            const melInputs = this.generateMelSpectrogram(tokens.length, config);
            
            // ONNX 모델 실행
            const outputs = await this.session.run({
                input: melInputs,
                total_steps: config.totalSteps,
                speed: config.speed
            });
            
            // 오디오 데이터 변환
            const audioData = this.postprocessAudio(outputs);
            
            return audioData;
            
        } catch (error) {
            console.error('음성 생성 실패:', error);
            throw error;
        }
    }

    // 텍스트 토큰화 (간단한 구현)
    tokenizeText(text) {
        // 실제로는 어휘 기반 토큰화가 필요하지만,
        // 여기서는 간단하게 문자 단위로 분할
        return text.split('').map(char => char.charCodeAt(0));
    }

    // 멜 스펙트로그램 생성 (간단화된 버전)
    generateMelSpectrogram(tokenCount, config) {
        // 더미 값 생성 (간단한 구현)
        const duration = tokenCount * 0.1; // 문자당 0.1초
        const melLength = Math.ceil(duration * 75); // 75Hz 샘플링
        
        // 간단한 멜 스펙트로그램 (실제로는 더 복잡한 계산 필요)
        const melSpectrogram = new Float32Array(melLength * 80); // 80 멜 채널
        
        // 간단한 패턴 생성 (실제 모델은 더 복잡한 입력 필요)
        for (let i = 0; i < melLength; i++) {
            const time = i / melLength;
            const freq = Math.sin(time * Math.PI * 2 * 440) * 0.5 + 0.5; // 간단한 사인파
            
            for (let j = 0; j < 80; j++) {
                melSpectrogram[i * 80 + j] = freq * (1 - j / 80);
            }
        }
        
        return new ort.Tensor(
            melSpectrogram,
            [1, melLength, 80],
            'float32'
        );
    }

    // 오디오 후처리
    postprocessAudio(outputs) {
        // 간단한 오디오 후처리
        const audioData = outputs[0].data;
        
        // 오디오 정규화
        const normalizedAudio = audioData.map(value => 
            Math.tanh(value) * 0.8 // 간단한 정규화
        );
        
        return normalizedAudio;
    }

    // AudioBuffer를 WAV로 변환
    convertToAudioBuffer(audioData) {
        const sampleRate = 22050; // 샘플링 레이트
        const audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
        
        // 오디오 데이터 복사
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < audioData.length; i++) {
            channelData[i] = audioData[i];
        }
        
        return audioBuffer;
    }

    // AudioBuffer를 WAV Blob으로 변환
    audioBufferToWav(audioBuffer) {
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        const numberOfChannels = audioBuffer.numberOfChannels;
        
        // WAV 헤더 생성
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);
        
        // RIFF 헤더
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true); // 파일 크기
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // fmt 청크 크기
        view.setUint16(20, 1, true); // 오디오 포맷 (PCM)
        view.setUint16(22, 1, true); // 채널 수
        view.setUint32(24, sampleRate, true); // 샘플링 레이트
        view.setUint32(28, sampleRate, true); // 바이트 레이트
        view.setUint16(32, numberOfChannels * 8, true); // 블록 정렬
        view.setUint16(34, 16, true); // 비트 깊이
        writeString(36, 'data');
        view.setUint32(40, length * 2, true); // 데이터 크기
        
        // 오디오 데이터 쓰기
        const channelData = audioBuffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i])); // 클리핑
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
}

// 전역으로 내보내
window.SupertonicTTS = SupertonicTTS;