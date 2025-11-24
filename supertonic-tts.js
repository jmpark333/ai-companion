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
        this.baseUrl = 'https://huggingface.co/Supertone/supertonic/resolve/main';
        this.modelUrls = {
            textEncoder: `${this.baseUrl}/onnx/text_encoder.onnx`,
            durationPredictor: `${this.baseUrl}/onnx/duration_predictor.onnx`,
            vectorEstimator: `${this.baseUrl}/onnx/vector_estimator.onnx`,
            vocoder: `${this.baseUrl}/onnx/vocoder.onnx`
        };
        this.configUrl = `${this.baseUrl}/onnx/tts.json`;
        this.voiceStyleUrl = `${this.baseUrl}/voice_styles/F1.json`;
        
        // 기본 설정
        this.config = {
            totalSteps: 4,      // 추론 스텝 수 (높을수록 품질 향상)
            speed: 1.0,         // 속도 (0.9-1.5 권장)
            voiceStyle: 'F1'     // 음성 스타일
        };
        
        // 모델 세션 저장
        this.sessions = {};
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
            
            // 모든 모델 파일과 설정 파일 다운로드
            const [textEncoderResponse, durationPredictorResponse, vectorEstimatorResponse, vocoderResponse, configResponse, voiceStyleResponse] = await Promise.all([
                fetch(this.modelUrls.textEncoder),
                fetch(this.modelUrls.durationPredictor),
                fetch(this.modelUrls.vectorEstimator),
                fetch(this.modelUrls.vocoder),
                fetch(this.configUrl),
                fetch(this.voiceStyleUrl)
            ]);
            
            // 모든 파일 다운로드 확인
            const responses = [textEncoderResponse, durationPredictorResponse, vectorEstimatorResponse, vocoderResponse, configResponse, voiceStyleResponse];
            const responseNames = ['textEncoder', 'durationPredictor', 'vectorEstimator', 'vocoder', 'config', 'voiceStyle'];
            
            for (let i = 0; i < responses.length; i++) {
                if (!responses[i].ok) {
                    throw new Error(`${responseNames[i]} 파일 다운로드 실패: ${responses[i].status}`);
                }
            }
            
            // 모델 데이터 로드
            const [textEncoderArray, durationPredictorArray, vectorEstimatorArray, vocoderArray] = await Promise.all([
                textEncoderResponse.arrayBuffer(),
                durationPredictorResponse.arrayBuffer(),
                vectorEstimatorResponse.arrayBuffer(),
                vocoderResponse.arrayBuffer()
            ]);
            
            const config = await configResponse.json();
            const voiceStyle = await voiceStyleResponse.json();
            
            // ONNX 세션 생성 및 모델 로드
            console.log('🔄 ONNX 세션 생성 중...');
            this.sessions.textEncoder = await ort.InferenceSession.create(new Uint8Array(textEncoderArray));
            
            this.sessions.durationPredictor = await ort.InferenceSession.create(new Uint8Array(durationPredictorArray));
            
            this.sessions.vectorEstimator = await ort.InferenceSession.create(new Uint8Array(vectorEstimatorArray));
            
            this.sessions.vocoder = await ort.InferenceSession.create(new Uint8Array(vocoderArray));
            
            // 설정 저장
            this.config = { ...this.config, ...config };
            this.voiceStyle = voiceStyle;
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
    async playAudio(audioData) {
        try {
            // 오디오 데이터를 AudioBuffer로 변환
            const audioBuffer = this.convertToAudioBuffer(audioData);
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
        const audioData = await this.synthesize(text, options);
        await this.playAudio(audioData);
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

    // ONNX 모델로 음성 생성 (Supertonic 파이프라인)
    async generateSpeech(text, config) {
        try {
            console.log('🎵 텍스트 전처리 중...');
            
            // 1. 텍스트 전처리 및 토큰화
            const textTokens = await this.preprocessText(text);
            console.log('토큰화 완료:', textTokens.length, '토큰');
            
            // 2. 텍스트 인코더 실행
            console.log('🔄 텍스트 인코딩 중...');
            const textEncoderInputs = {
                input_ids: new ort.Tensor(new BigInt64Array(textTokens), [1, textTokens.length], 'int64'),
                style_tokens: new ort.Tensor(new Float32Array(this.voiceStyle.style_tokens), [1, this.voiceStyle.style_tokens.length], 'float32')
            };
            
            const textEncoderOutputs = await this.sessions.textEncoder.run(textEncoderInputs);
            const textEmbeddings = textEncoderOutputs.text_embeddings;
            
            // 3. 지속 시간 예측
            console.log('⏱️ 지속 시간 예측 중...');
            const durationInputs = {
                text_embeddings: textEmbeddings,
                style_tokens: textEncoderInputs.style_tokens
            };
            
            const durationOutputs = await this.sessions.durationPredictor.run(durationInputs);
            const durations = durationOutputs.durations;
            
            // 4. 벡터 추정
            console.log('🔊 벡터 추정 중...');
            const vectorInputs = {
                text_embeddings: textEmbeddings,
                durations: durations,
                style_tokens: textEncoderInputs.style_tokens,
                speed: new ort.Tensor(new Float32Array([config.speed]), [1], 'float32')
            };
            
            const vectorOutputs = await this.sessions.vectorEstimator.run(vectorInputs);
            const latents = vectorOutputs.latents;
            
            // 5. 보코더로 오디오 생성
            console.log('🎶 오디오 생성 중...');
            const vocoderInputs = {
                latents: latents
            };
            
            const vocoderOutputs = await this.sessions.vocoder.run(vocoderInputs);
            const audioWaveform = vocoderOutputs.audio;
            
            console.log('✅ 음성 생성 완료');
            return audioWaveform.data;
            
        } catch (error) {
            console.error('❌ 음성 생성 실패:', error);
            throw error;
        }
    }

    // 텍스트 전처리 및 토큰화
    async preprocessText(text) {
        // 기본적인 텍스트 정리
        const cleanText = text
            .trim()
            .replace(/[^\w\s\uAC00-\uD7FF\uF900-\uFAFF\d.,!?]/g, '') // 특수문자 제거
            .replace(/\s+/g, ' ') // 여러 공백을 하나로
            .substring(0, 500); // 최대 길이 제한
        
        // 간단한 문자 토큰화 (실제로는 더 복잡한 토크나이저 필요)
        const tokens = [];
        for (let char of cleanText) {
            // 영어 소문자로 변환
            const lowerChar = char.toLowerCase();
            // ASCII 코드로 변환 (간단한 구현)
            const charCode = lowerChar.charCodeAt(0);
            if (charCode >= 32 && charCode <= 126) { // 출력 가능한 ASCII 문자
                tokens.push(BigInt(charCode - 32)); // 0부터 시작하도록 조정
            }
        }
        
        // 최소한 하나의 토큰이 있도록 보장
        if (tokens.length === 0) {
            tokens.push(BigInt(0)); // 공백 문자
        }
        
        return tokens;
    }

    // AudioBuffer로 변환
    convertToAudioBuffer(audioData) {
        const sampleRate = 44100; // Supertonic TTS는 44.1kHz 사용
        const audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
        
        // 오디오 데이터 복사 및 정규화
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < audioData.length; i++) {
            // 오디오 데이터 정규화 (-1에서 1 사이로)
            channelData[i] = Math.max(-1, Math.min(1, audioData[i]));
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
        view.setUint32(28, sampleRate * 2, true); // 바이트 레이트 (샘플링 레이트 * 채널 * 비트/8)
        view.setUint16(32, numberOfChannels * 16, true); // 블록 정렬
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