// UI Management Module
export class UIManager {
    constructor() {
        this.elements = new Map();
        this.eventListeners = new Map();
        this.init();
    }

    init() {
        // 자주 사용하는 요소들 캐싱
        this.cacheElements();
    }

    // 요소 캐싱
    cacheElements() {
        const selectors = {
            chatInput: '#chatInput',
            sendButton: '#sendButton',
            chatMessages: '#chatMessages',
            themeToggle: '#themeToggle',
            settingsModal: '#settingsModal',
            memoryModal: '#memoryModal',
            emotionDiaryModal: '#emotionDiaryModal',
            diaryContainer: '#diaryContainer',
            loadingIndicator: '.loading-indicator'
        };

        for (const [name, selector] of Object.entries(selectors)) {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(name, element);
            }
        }
    }

    // 요소 가져오기
    get(name) {
        return this.elements.get(name) || null;
    }

    // 이벤트 리스너 추가
    addListener(element, event, handler, options = {}) {
        const elementId = typeof element === 'string' ? element : element.id || element.className;
        const key = `${elementId}:${event}`;

        // 기존 리스너 제거
        if (this.eventListeners.has(key)) {
            const { element: el, handler: h } = this.eventListeners.get(key);
            el.removeEventListener(event, h);
        }

        // 새 리스너 추가
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.addEventListener(event, handler, options);
            this.eventListeners.set(key, { element: el, event, handler });
        }
    }

    // 이벤트 위임 설정
    setupEventDelegation() {
        document.addEventListener('click', (e) => {
            // 다이어리 아이템 클릭
            if (e.target.closest('.diary-item')) {
                const item = e.target.closest('.diary-item');
                const diaryId = parseInt(item.dataset.diaryId);
                this.emit('diary:item:click', { diaryId });
            }

            // 모달 닫기
            if (e.target.classList.contains('modal-close')) {
                this.emit('modal:close', { modal: e.target.closest('.modal') });
            }
        });

        document.addEventListener('keydown', (e) => {
            // ESC 키로 모달 닫기
            if (e.key === 'Escape') {
                this.emit('modal:close', { modal: document.querySelector('.modal.active') });
            }
        });
    }

    // 커스텀 이벤트 시스템
    on(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
    }

    emit(event, data) {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    // 로딩 표시
    showLoading(message = '로딩 중...') {
        const indicator = this.get('loadingIndicator');
        if (indicator) {
            indicator.textContent = message;
            indicator.style.display = 'block';
        }
    }

    // 로딩 숨기기
    hideLoading() {
        const indicator = this.get('loadingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // 메시지 표시
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;

        document.body.appendChild(messageEl);

        // 애니메이션
        requestAnimationFrame(() => {
            messageEl.classList.add('show');
        });

        // 자동 제거
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    // 모달 표시
    showModal(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            if (options.backdrop !== false) {
                modal.classList.add('with-backdrop');
            }
            this.emit('modal:show', { modal: modalId });
        }
    }

    // 모달 숨기기
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active', 'with-backdrop');
            this.emit('modal:hide', { modal: modalId });
        }
    }

    // 테마 전환
    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.emit('theme:changed', { theme: isDark ? 'dark' : 'light' });
    }

    // 테마 로드
    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }

    // 정리
    cleanup() {
        // 모든 이벤트 리스너 제거
        for (const [key, { element, event, handler }] of this.eventListeners.entries()) {
            if (typeof element !== 'string') {
                element.removeEventListener(event, handler);
            }
        }
        this.eventListeners.clear();
        this.elements.clear();
    }
}