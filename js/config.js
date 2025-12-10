// AI Companion Configuration
// 환경에 따라 다른 설정을 적용합니다

export const Environment = {
    isNetlify: () => {
        return typeof window !== 'undefined' &&
               (window.location.hostname.includes('netlify.app') ||
                window.location.hostname.includes('netlify.com'));
    },

    getAPIEndpoints: () => {
        const isNetlify = Environment.isNetlify();
        return {
            memory: isNetlify ? '/.netlify/functions/memory' : '/api/memory',
            emotionDiary: isNetlify ? '/.netlify/functions/emotion-diary' : '/api/emotion-diary',
            tts: isNetlify ? '/.netlify/functions/tts' : '/api/tts'
        };
    },

    getAssetPaths: () => {
        const isNetlify = Environment.isNetlify();
        return {
            memoryClient: isNetlify ? './memory-netlify-client.js' : './local/memory-netlify-client.js',
            emotionDiary: isNetlify ? './js/emotion-diary.js' : './local/js/emotion-diary.js',
            supertonicTTS: './supertonic-tts.js',
            emotionUtils: './utils/emotion-topic-utils.js'
        };
    }
};

export const Config = {
    // API 설정
    api: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
    },

    // TTS 설정
    tts: {
        enabled: true,
        autoDownload: false,
        modelPath: './models/tts',
        voiceStyle: 'F1'
    },

    // UI 설정
    ui: {
        theme: 'light',
        autoSave: true,
        animations: true
    },

    // 캐시 설정
    cache: {
        enabled: true,
        ttl: 5 * 60 * 1000, // 5분
        maxSize: 100
    }
};