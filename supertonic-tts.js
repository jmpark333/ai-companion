// Supertonic TTS 통합 모듈
// ONNX Runtime Web을 사용한 브라우저 기반 TTS
// 공식 Supertonic Web Example 기반 구현

// ONNX Runtime Web은 CDN에서 전역 변수로 로드됨
const ort = window.ort;

/**
 * Unicode Text Processor (공식 예제 기반)
 */
class UnicodeProcessor {
    constructor(indexer) {
        this.indexer = indexer;
    }

    call(textList) {
        const processedTexts = textList.map(text => this.preprocessText(text));
        
        const textIdsLengths = processedTexts.map(text => text.length);
        const maxLen = Math.max(...textIdsLengths);
        
        const textIds = processedTexts.map(text => {
            const row = new Array(maxLen).fill(0);
            for (let j = 0; j < text.length; j++) {
                const codePoint = text.codePointAt(j);
                row[j] = (codePoint < this.indexer.length) ? this.indexer[codePoint] : -1;
            }
            return row;
        });
        
        const textMask = this.getTextMask(textIdsLengths);
        return { textIds, textMask };
    }

    preprocessText(text) {
        text = text.normalize('NFKD');

        // 이모지 제거
        const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
        text = text.replace(emojiPattern, '');

        // 다양한 대시와 기호 교체
        const replacements = {
            '–': '-',
            '‑': '-',
            '—': '-',
            '¯': ' ',
            '_': ' ',
            '"': '"',
            '"': '"',
            '\u2018': "'",
            '\u2019': "'",
            '´': "'",
            '`': "'",
            '[': ' ',
            ']': ' ',
            '|': ' ',
            '/': ' ',
            '#': ' ',
            '→': ' ',
            '←': ' ',
        };
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replaceAll(k, v);
        }

        // 특수 기호 제거
        text = text.replace(/[♥☆♡©\\]/g, '');

        return text;
    }

    getTextMask(textIdsLengths) {
        const maxLen = Math.max(...textIdsLengths);
        return this.lengthToMask(textIdsLengths, maxLen);
    }

    lengthToMask(lengths, maxLen = null) {
        const actualMaxLen = maxLen || Math.max(...lengths);
        return lengths.map(len => {
            const row = new Array(actualMaxLen).fill(0.0);
            for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
                row[j] = 1.0;
            }
            return [row];
        });
    }
}

/**
 * Style class to hold TTL and DP tensors (공식 예제 기반)
 */
class Style {
    constructor(ttlTensor, dpTensor) {
        this.ttl = ttlTensor;
        this.dp = dpTensor;
    }
}

/**
 * Text-to-Speech class (공식 예제 기반)
 */
class TextToSpeech {
    constructor(cfgs, textProcessor, dpOrt, textEncOrt, vectorEstOrt, vocoderOrt) {
        this.cfgs = cfgs;
        this.textProcessor = textProcessor;
        this.dpOrt = dpOrt;
        this.textEncOrt = textEncOrt;
        this.vectorEstOrt = vectorEstOrt;
        this.vocoderOrt = vocoderOrt;
        this.sampleRate = cfgs.ae.sample_rate;
    }

    async _infer(textList, style, totalStep, speed = 1.05, progressCallback = null) {
        const bsz = textList.length;
        
        // Process text
        const { textIds, textMask } = this.textProcessor.call(textList);
        
        const textIdsFlat = new BigInt64Array(textIds.flat().map(x => BigInt(x)));
        const textIdsShape = [bsz, textIds[0].length];
        const textIdsTensor = new ort.Tensor('int64', textIdsFlat, textIdsShape);
        
        const textMaskFlat = new Float32Array(textMask.flat(2));
        const textMaskShape = [bsz, 1, textMask[0][0].length];
        const textMaskTensor = new ort.Tensor('float32', textMaskFlat, textMaskShape);
        
        // Predict duration
        const dpOutputs = await this.dpOrt.run({
            text_ids: textIdsTensor,
            style_dp: style.dp,
            text_mask: textMaskTensor
        });
        const duration = Array.from(dpOutputs.duration.data);
        
        // Apply speed factor to duration
        for (let i = 0; i < duration.length; i++) {
            duration[i] /= speed;
        }
        
        // Encode text
        const textEncOutputs = await this.textEncOrt.run({
            text_ids: textIdsTensor,
            style_ttl: style.ttl,
            text_mask: textMaskTensor
        });
        const textEmb = textEncOutputs.text_emb;
        
        // Sample noisy latent
        let { xt, latentMask } = this.sampleNoisyLatent(
            duration,
            this.sampleRate,
            this.cfgs.ae.base_chunk_size,
            this.cfgs.ttl.chunk_compress_factor,
            this.cfgs.ttl.latent_dim
        );
        
        const latentMaskFlat = new Float32Array(latentMask.flat(2));
        const latentMaskShape = [bsz, 1, latentMask[0][0].length];
        const latentMaskTensor = new ort.Tensor('float32', latentMaskFlat, latentMaskShape);
        
        // Prepare constant arrays
        const totalStepArray = new Float32Array(bsz).fill(totalStep);
        const totalStepTensor = new ort.Tensor('float32', totalStepArray, [bsz]);
        
        // Denoising loop
        for (let step = 0; step < totalStep; step++) {
            if (progressCallback) {
                progressCallback(step + 1, totalStep);
            }
            
            const currentStepArray = new Float32Array(bsz).fill(step);
            const currentStepTensor = new ort.Tensor('float32', currentStepArray, [bsz]);
            
            const xtFlat = new Float32Array(xt.flat(2));
            const xtShape = [bsz, xt[0].length, xt[0][0].length];
            const xtTensor = new ort.Tensor('float32', xtFlat, xtShape);
            
            const vectorEstOutputs = await this.vectorEstOrt.run({
                noisy_latent: xtTensor,
                text_emb: textEmb,
                style_ttl: style.ttl,
                latent_mask: latentMaskTensor,
                text_mask: textMaskTensor,
                current_step: currentStepTensor,
                total_step: totalStepTensor
            });
            
            const denoised = Array.from(vectorEstOutputs.denoised_latent.data);
            
            // Reshape to 3D
            const latentDim = xt[0].length;
            const latentLen = xt[0][0].length;
            xt = [];
            let idx = 0;
            for (let b = 0; b < bsz; b++) {
                const batch = [];
                for (let d = 0; d < latentDim; d++) {
                    const row = [];
                    for (let t = 0; t < latentLen; t++) {
                        row.push(denoised[idx++]);
                    }
                    batch.push(row);
                }
                xt.push(batch);
            }
        }
        
        // Generate waveform
        const finalXtFlat = new Float32Array(xt.flat(2));
        const finalXtShape = [bsz, xt[0].length, xt[0][0].length];
        const finalXtTensor = new ort.Tensor('float32', finalXtFlat, finalXtShape);
        
        const vocoderOutputs = await this.vocoderOrt.run({
            latent: finalXtTensor
        });
        
        const wav = Array.from(vocoderOutputs.wav_tts.data);
        
        return { wav, duration };
    }

    async call(text, style, totalStep, speed = 1.05, silenceDuration = 0.3, progressCallback = null) {
        if (style.ttl.dims[0] !== 1) {
            throw new Error('Single speaker text to speech only supports single style');
        }
        const textList = chunkText(text);
        let wavCat = [];
        let durCat = 0;
        
        for (const chunk of textList) {
            const { wav, duration } = await this._infer([chunk], style, totalStep, speed, progressCallback);
            
            if (wavCat.length === 0) {
                wavCat = wav;
                durCat = duration[0];
            } else {
                const silenceLen = Math.floor(silenceDuration * this.sampleRate);
                const silence = new Array(silenceLen).fill(0);
                wavCat = [...wavCat, ...silence, ...wav];
                durCat += duration[0] + silenceDuration;
            }
        }
        
        return { wav: wavCat, duration: [durCat] };
    }

    sampleNoisyLatent(duration, sampleRate, baseChunkSize, chunkCompress, latentDim) {
        const bsz = duration.length;
        const maxDur = Math.max(...duration);
        
        const wavLenMax = Math.floor(maxDur * sampleRate);
        const wavLengths = duration.map(d => Math.floor(d * sampleRate));
        
        const chunkSize = baseChunkSize * chunkCompress;
        const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
        const latentDimVal = latentDim * chunkCompress;
        
        const xt = [];
        for (let b = 0; b < bsz; b++) {
            const batch = [];
            for (let d = 0; d < latentDimVal; d++) {
                const row = [];
                for (let t = 0; t < latentLen; t++) {
                    // Box-Muller transform
                    const u1 = Math.max(0.0001, Math.random());
                    const u2 = Math.random();
                    const val = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                    row.push(val);
                }
                batch.push(row);
            }
            xt.push(batch);
        }
        
        const latentLengths = wavLengths.map(len => Math.floor((len + chunkSize - 1) / chunkSize));
        const latentMask = this.lengthToMask(latentLengths, latentLen);
        
        // Apply mask
        for (let b = 0; b < bsz; b++) {
            for (let d = 0; d < latentDimVal; d++) {
                for (let t = 0; t < latentLen; t++) {
                    xt[b][d][t] *= latentMask[b][0][t];
                }
            }
        }
        
        return { xt, latentMask };
    }

    lengthToMask(lengths, maxLen = null) {
        const actualMaxLen = maxLen || Math.max(...lengths);
        return lengths.map(len => {
            const row = new Array(actualMaxLen).fill(0.0);
            for (let j = 0; j < Math.min(len, actualMaxLen); j++) {
                row[j] = 1.0;
            }
            return [row];
        });
    }
}

/**
 * Load voice style from JSON files (공식 예제 기반)
 */
async function loadVoiceStyle(voiceStylePaths, verbose = false) {
    const bsz = voiceStylePaths.length;
    
    // Read first file to get dimensions
    const firstResponse = await fetch(voiceStylePaths[0]);
    const firstStyle = await firstResponse.json();
    
    const ttlDims = firstStyle.style_ttl.dims;
    const dpDims = firstStyle.style_dp.dims;
    
    const ttlDim1 = ttlDims[1];
    const ttlDim2 = ttlDims[2];
    const dpDim1 = dpDims[1];
    const dpDim2 = dpDims[2];
    
    // Pre-allocate arrays with full batch size
    const ttlSize = bsz * ttlDim1 * ttlDim2;
    const dpSize = bsz * dpDim1 * dpDim2;
    const ttlFlat = new Float32Array(ttlSize);
    const dpFlat = new Float32Array(dpSize);
    
    // Fill in the data
    for (let i = 0; i < bsz; i++) {
        const response = await fetch(voiceStylePaths[i]);
        const voiceStyle = await response.json();
        
        // Flatten TTL data
        const ttlData = voiceStyle.style_ttl.data.flat(Infinity);
        const ttlOffset = i * ttlDim1 * ttlDim2;
        ttlFlat.set(ttlData, ttlOffset);
        
        // Flatten DP data
        const dpData = voiceStyle.style_dp.data.flat(Infinity);
        const dpOffset = i * dpDim1 * dpDim2;
        dpFlat.set(dpData, dpOffset);
    }
    
    const ttlShape = [bsz, ttlDim1, ttlDim2];
    const dpShape = [bsz, dpDim1, dpDim2];
    
    const ttlTensor = new ort.Tensor('float32', ttlFlat, ttlShape);
    const dpTensor = new ort.Tensor('float32', dpFlat, dpShape);
    
    if (verbose) {
        console.log(`Loaded ${bsz} voice styles`);
    }
    
    return new Style(ttlTensor, dpTensor);
}

/**
 * Chunk text into manageable segments (공식 예제 기반)
 */
function chunkText(text, maxLen = 300) {
    if (typeof text !== 'string') {
        throw new Error(`chunkText expects a string, got ${typeof text}`);
    }
    
    // Split by paragraph (two or more newlines)
    const paragraphs = text.trim().split(/\n\s*\n+/).filter(p => p.trim());
    
    const chunks = [];
    
    for (let paragraph of paragraphs) {
        paragraph = paragraph.trim();
        if (!paragraph) continue;
        
        // Split by sentence boundaries
        const sentences = paragraph.split(/(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|Ph\.D\.|etc\.|e\.g\.|i\.e\.|vs\.|Inc\.|Ltd\.|Co\.|Corp\.|St\.|Ave\.|Blvd\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/);
        
        let currentChunk = "";
        
        for (let sentence of sentences) {
            if (currentChunk.length + sentence.length + 1 <= maxLen) {
                currentChunk += (currentChunk ? " " : "") + sentence;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
    }
    
    return chunks;
}

class SupertonicTTS {
    constructor() {
        this.textToSpeech = null;
        this.cfgs = null;
        this.currentStyle = null;
        this.audioContext = null;
        this.modelLoaded = false;
        this.isLoading = false;
        
        // Netlify 환경 감지
        this.isNetlify = window.location.hostname.includes('netlify.app') ||
                         window.location.hostname.includes('netlify.com');
        
        // 기본 설정
        this.config = {
            totalSteps: 5,      // 추론 스텝 수 (높을수록 품질 향상)
            speed: 1.05,         // 속도 (0.9-1.5 권장)
            voiceStyle: 'F1'     // 음성 스타일
        };

        // 모델 URL 설정
        this.baseUrl = '/assets/tts';
            
        console.log(`🔊 Supertonic TTS 설정: 기본 모드`);
        console.log(`📂 모델 경로: ${this.baseUrl}`);
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
            
            // 모델 로드
            console.log('📥 모델 파일 다운로드 중...');
            
            const result = await this.loadModels(this.baseUrl, {
                executionProviders: ['webgpu', 'wasm'],
                graphOptimizationLevel: 'all'
            }, (modelName, current, total) => {
                console.log(`🔄 모델 로딩 중 (${current}/${total}): ${modelName}`);
            });
            
            this.textToSpeech = new TextToSpeech(result.cfgs, result.textProcessor, result.dpOrt, result.textEncOrt, result.vectorEstOrt, result.vocoderOrt);
            this.cfgs = result.cfgs;
            
            // 기본 음성 스타일 로드 (공식 예제 기반)
            try {
                const stylePath = `/assets/tts/voice_styles/${this.config.voiceStyle}.json`;
                this.currentStyle = await loadVoiceStyle([stylePath], true);
                console.log('✅ 음성 스타일 로드 성공:', this.config.voiceStyle);
            } catch (styleError) {
                console.warn('⚠️ 음성 스타일 로드 실패:', styleError.message);
                // 폴백: 기본 스타일 생성
                this.currentStyle = await this.createDefaultStyle();
            }
            
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

    // 기본 스타일 생성 (공식 예제와 일치하는 형태)
    async createDefaultStyle() {
        try {
            // 기본 F1 스타일 파일 경로
            const stylePath = '/assets/tts/voice_styles/F1.json';
            const style = await loadVoiceStyle([stylePath]);
            return style;
        } catch (error) {
            console.error('기본 스타일 생성 실패:', error);
            throw error;
        }
    }

    // 모델 로드 헬퍼 메서드
    async loadModels(onnxDir, options, progressCallback) {
        try {
            // 설정 파일 로드
            console.log('📥 설정 파일 다운로드 중...');
            const cfgs = await this.loadCfgs(onnxDir);
            
            // 텍스트 프로세서 로드
            console.log('📝 텍스트 프로세서 로드 중...');
            const textProcessor = await this.loadTextProcessor(onnxDir);
            
            // 모델 파일들 로드
            const models = [
                { name: 'duration_predictor.onnx', path: `${onnxDir}/duration_predictor.onnx` },
                { name: 'text_encoder.onnx', path: `${onnxDir}/text_encoder.onnx` },
                { name: 'vector_estimator.onnx', path: `${onnxDir}/vector_estimator.onnx` },
                { name: 'vocoder.onnx', path: `${onnxDir}/vocoder.onnx` }
            ];
            
            const loadedModels = {};
            let current = 0;
            
            for (const model of models) {
                if (progressCallback) {
                    progressCallback(current + 1, models.length, model.name);
                }
                
                console.log(`🔄 모델 로딩 중 (${current + 1}/${models.length}): ${model.name}`);
                loadedModels[model.name.replace('.onnx', '')] = await this.loadOnnx(model.path, options);
                current++;
            }
            
            return {
                cfgs,
                textProcessor: new UnicodeProcessor(textProcessor),
                dpOrt: loadedModels.duration_predictor,
                textEncOrt: loadedModels.text_encoder,
                vectorEstOrt: loadedModels.vector_estimator,
                vocoderOrt: loadedModels.vocoder
            };
            
        } catch (error) {
            console.error('모델 로드 중 오류:', error);
            throw error;
        }
    }

    // 설정 로드
    async loadCfgs(onnxDir) {
        const response = await fetch(`${onnxDir}/tts.json`);
        if (!response.ok) {
            throw new Error(`설정 파일 로드 실패: ${response.status}`);
        }
        const cfgs = await response.json();
        return cfgs;
    }

    // 텍스트 프로세서 로드
    async loadTextProcessor(onnxDir) {
        const response = await fetch(`${onnxDir}/unicode_indexer.json`);
        if (!response.ok) {
            throw new Error(`유니코드 인덱서 파일 로드 실패: ${response.status}`);
        }
        const indexer = await response.json();
        return indexer;
    }

    // ONNX 모델 로드
    async loadOnnx(onnxPath, options) {
        const session = await ort.InferenceSession.create(onnxPath, options);
        return session;
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

    // 텍스트를 음성으로 변환하고 재생
    async speak(text, options = {}) {
        try {
            // 모델이 로드되지 않았으면 초기화
            if (!this.modelLoaded) {
                console.log('TTS 모델이 초기화되지 않았습니다. 초기화 중...');
                await this.initialize();
            }

            if (!this.textToSpeech) {
                throw new Error('TTS 엔진이 초기화되지 않았습니다.');
            }

            if (!this.currentStyle) {
                throw new Error('음성 스타일이 초기화되지 않았습니다.');
            }

            console.log('TTS 변환 시작:', text.substring(0, 50) + '...');

            // 기본 옵션 설정
            const defaultOptions = {
                totalStep: this.config.totalSteps,
                speed: this.config.speed,
                silenceDuration: 0.3,
                progressCallback: null
            };

            const mergedOptions = { ...defaultOptions, ...options };

            // 텍스트를 음성으로 변환
            const result = await this.textToSpeech.call(
                text,
                this.currentStyle,
                mergedOptions.totalStep,
                mergedOptions.speed,
                mergedOptions.silenceDuration,
                mergedOptions.progressCallback
            );

            console.log('TTS 변환 완료:', result);

            // 오디오 재생
            if (result.wav && result.wav.length > 0) {
                await this.playAudio(result.wav);
                console.log('TTS 음성 재생 완료');
            } else {
                throw new Error('음성 데이터가 생성되지 않았습니다.');
            }

            return true;
        } catch (error) {
            console.error('TTS 변환 및 재생 실패:', error);
            throw new Error(`TTS 재생 실패: ${error.message}`);
        }
    }

    // 오디오 재생
    async playAudio(audioData) {
        try {
            // AudioBuffer 생성
            const audioBuffer = this.convertToAudioBuffer(audioData);

            // 오디오 재생
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 오디오 소스 생성 및 재생
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start();

            // 재생 완료를 기다림
            return new Promise((resolve, reject) => {
                source.onended = () => {
                    console.log('오디오 재생 완료');
                    resolve();
                };
                source.onerror = (error) => {
                    console.error('오디오 재생 오류:', error);
                    reject(error);
                };
            });
        } catch (error) {
            console.error('오디오 재생 실패:', error);
            throw new Error(`오디오 재생 실패: ${error.message}`);
        }
    }

    // AudioBuffer를 WAV Blob으로 변환
    audioBufferToWav(audioData) {
        const sampleRate = 44100;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;
        const dataSize = audioData.length * 2;
        
        // WAV 헤더 생성
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        
        // RIFF 헤더
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // 채널 수
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true); // 비트 깊이
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);
        
        // 오디오 데이터 쓰기
        let offset = 44;
        for (let i = 0; i < audioData.length; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
}

// 전역으로 내보내
window.SupertonicTTS = SupertonicTTS;