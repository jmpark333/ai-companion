// AI Companion Main Application
// 모듈화된 메인 애플리케이션 파일

import { Environment, Config } from './config.js';
import { ZAIAPIClient } from './modules/api-client.js';
import { Cache, apiCache, withCache } from './modules/cache.js';
import { UIManager } from './modules/ui-manager.js';

class AICompanion {
    constructor() {
        // 환경 설정
        this.environment = Environment;
        this.config = Config;

        // 핵심 모듈 초기화
        this.apiClient = new ZAIAPIClient();
        this.ui = new UIManager();
        this.cache = apiCache;

        // 상태 관리
        this.state = {
            isInitialized: false,
            currentTheme: 'light',
            messages: [],
            ttsEnabled: false,
            memoryClient: null,
            ttsEngine: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('AI Companion 초기화 중...');

            // 테마 로드
            this.ui.loadTheme();

            // 이벤트 위임 설정
            this.ui.setupEventDelegation();

            // 스크립트 동적 로드
            await this.loadScripts();

            // API 설정
            await this.setupAPI();

            // TTS 초기화
            if (this.config.tts.enabled) {
                await this.initTTS();
            }

            // 이벤트 핸들러 설정
            this.setupEventHandlers();

            // 상태 업데이트
            this.state.isInitialized = true;

            console.log('AI Companion 초기화 완료');
        } catch (error) {
            console.error('초기화 실패:', error);
            this.ui.showMessage('초기화에 실패했습니다. 새로고침해주세요.', 'error');
        }
    }

    // 스크립트 동적 로드
    async loadScripts() {
        const scripts = [
            this.environment.getAssetPaths().memoryClient,
            this.environment.getAssetPaths().emotionDiary,
            this.environment.getAssetPaths().supertonicTTS
        ];

        const loadPromises = scripts.map(src => this.loadScript(src));
        await Promise.all(loadPromises);
    }

    // 단일 스크립트 로드
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // API 설정
    async setupAPI() {
        // API 키 로드
        const apiKey = localStorage.getItem('zai_api_key') ||
                      sessionStorage.getItem('zai_api_key');

        if (apiKey) {
            await this.apiClient.setAuthMethod('apikey', apiKey);
        }
    }

    // TTS 초기화
    async initTTS() {
        try {
            if (typeof SupertonicTTS !== 'undefined') {
                this.state.ttsEngine = new SupertonicTTS();
                this.state.ttsEnabled = true;
                console.log('TTS 엔진 초기화 완료');
            } else {
                console.warn('SupertonicTTS를 찾을 수 없습니다');
            }
        } catch (error) {
            console.error('TTS 초기화 실패:', error);
        }
    }

    // 이벤트 핸들러 설정
    setupEventHandlers() {
        const chatInput = this.ui.get('chatInput');
        const sendButton = this.ui.get('sendButton');
        const themeToggle = this.ui.get('themeToggle');

        // 메시지 전송
        if (sendButton) {
            this.ui.addListener(sendButton, 'click', () => this.sendMessage());
        }

        if (chatInput) {
            this.ui.addListener(chatInput, 'keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // 테마 전환
        if (themeToggle) {
            this.ui.addListener(themeToggle, 'click', () => {
                this.ui.toggleTheme();
            });
        }

        // 모달 이벤트
        this.ui.on('modal:close', ({ modal }) => {
            if (modal) {
                modal.classList.remove('active', 'with-backdrop');
            }
        });

        // 다이어리 아이템 클릭
        this.ui.on('diary:item:click', ({ diaryId }) => {
            this.showDiaryDetail(diaryId);
        });
    }

    // 메시지 전송
    async sendMessage() {
        const chatInput = this.ui.get('chatInput');
        const message = chatInput.value.trim();

        if (!message) return;

        // 메시지 추가
        this.addMessage('user', message);
        chatInput.value = '';

        try {
            this.ui.showLoading('응답 생성 중...');

            // 메모리 컨텍스트 가져오기
            let context = [];
            if (this.state.memoryClient) {
                context = await this.state.memoryClient.getRecentContext(5);
            }

            // API 요청
            const messages = [
                ...context,
                { role: 'user', content: message }
            ];

            const response = await withCache(
                'chat',
                () => this.apiClient.chat(messages),
                60000 // 1분 캐시
            )(message);

            // 응답 처리
            const assistantMessage = response.choices[0].message.content;
            this.addMessage('assistant', assistantMessage);

            // TTS 재생
            if (this.state.ttsEnabled && this.state.ttsEngine) {
                this.playTTS(assistantMessage);
            }

            // 메모리에 저장
            if (this.state.memoryClient) {
                await this.state.memoryClient.saveConversation(message, assistantMessage);
            }

        } catch (error) {
            console.error('메시지 전송 실패:', error);
            this.ui.showMessage('메시지 전송에 실패했습니다.', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    // 메시지 추가
    addMessage(role, content) {
        const chatMessages = this.ui.get('chatMessages');
        if (!chatMessages) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}-message`;
        messageEl.innerHTML = `
            <div class="message-content">${this.formatMessage(content)}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;

        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 상태 업데이트
        this.state.messages.push({ role, content, timestamp: Date.now() });
    }

    // 메시지 포맷팅
    formatMessage(content) {
        // 마크다운 기본 포맷팅
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    // TTS 재생
    async playTTS(text) {
        if (!this.state.ttsEngine) return;

        try {
            await this.state.ttsEngine.speak(text);
        } catch (error) {
            console.error('TTS 재생 실패:', error);
        }
    }

    // 다이어리 상세 보기
    async showDiaryDetail(diaryId) {
        if (!this.state.memoryClient) return;

        try {
            this.ui.showLoading('다이어리 로딩 중...');
            const diary = await this.state.memoryClient.getDiaryDetail(diaryId);

            if (diary) {
                // 다이어리 상세 모달 표시
                this.ui.showModal('diaryDetailModal');
                // ... 상세 내용 렌더링
            }
        } catch (error) {
            console.error('다이어리 로딩 실패:', error);
            this.ui.showMessage('다이어리를 불러올 수 없습니다.', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    // 설정 저장
    saveSettings(settings) {
        localStorage.setItem('ai_companion_settings', JSON.stringify(settings));
        Object.assign(this.config, settings);
    }

    // 설정 로드
    loadSettings() {
        const saved = localStorage.getItem('ai_companion_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            Object.assign(this.config, settings);
        }
    }

    // 앱 종료
    destroy() {
        this.ui.cleanup();
        this.cache.clear();
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AICompanion();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});