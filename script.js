// AI 친구 - 감성적 동반자 JavaScript
// Z.AI API 완벽 통합 버전

class ZAIAPIClient {
    constructor() {
        this.baseURL = "https://api.z.ai/api/paas/v4/";
        this.apiKey = null;
        this.jwtToken = null;
        this.tokenExpiry = null;
        this.authMethod = "apikey"; // 'apikey' or 'jwt'
        this.requestTimeout = 30000; // 30초
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1초

        // API 사용량 모니터링
        this.usageStats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokens: 0,
            lastRequestTime: null,
            averageResponseTime: 0,
        };
    }

    // JWT 토큰 생성 (PyJWT 라이브러리 없이 순수 JavaScript로 구현)
    async generateJWTToken(apiKey, expSeconds = 3600) {
        try {
            const [id, secret] = apiKey.split(".");
            if (!id || !secret) {
                throw new Error("잘못된 API 키 형식입니다.");
            }

            const header = {
                alg: "HS256",
                sign_type: "SIGN",
            };

            const payload = {
                api_key: id,
                exp: Math.floor(Date.now() / 1000) + expSeconds,
                timestamp: Date.now(),
                iat: Math.floor(Date.now() / 1000),
            };

            // Base64URL 인코딩 함수
            const base64UrlEncode = (str) => {
                return btoa(str)
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=/g, "");
            };

            // 헤더와 페이로드 인코딩
            const encodedHeader = base64UrlEncode(JSON.stringify(header));
            const encodedPayload = base64UrlEncode(JSON.stringify(payload));

            // 서명 생성 (HMAC-SHA256)
            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const signature = await this.generateHMACSHA256(
                signatureInput,
                secret,
            );

            this.jwtToken = `${signatureInput}.${signature}`;
            this.tokenExpiry = payload.exp * 1000; // 밀리초로 변환

            return this.jwtToken;
        } catch (error) {
            console.error("JWT 토큰 생성 오류:", error);
            throw error;
        }
    }

    // HMAC-SHA256 서명 생성
    async generateHMACSHA256(message, secret) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(message);

        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );

        const signature = await crypto.subtle.sign("HMAC", key, messageData);

        return btoa(String.fromCharCode(...new Uint8Array(signature)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }

    // 인증 방식 설정
    async setAuthMethod(method, apiKey) {
        this.authMethod = method;
        this.apiKey = apiKey;

        if (method === "jwt" && apiKey) {
            await this.generateJWTToken(apiKey);
        }
    }

    // 인증 헤더 생성
    async getAuthHeaders() {
        const headers = {
            "Content-Type": "application/json",
            "Accept-Language": "ko-KR,ko",
        };

        if (this.authMethod === "jwt" && this.jwtToken) {
            // 토큰 만료 확인
            if (Date.now() >= this.tokenExpiry) {
                await this.generateJWTToken(this.apiKey);
            }
            headers["Authorization"] = `Bearer ${this.jwtToken}`;
        } else if (this.authMethod === "apikey" && this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    // 지수 백오프 재시도 로직
    async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // API 호출 with 재시도 로직
    async makeRequest(endpoint, payload, options = {}) {
        const startTime = Date.now();
        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.usageStats.totalRequests++;
                this.usageStats.lastRequestTime = new Date();

                const response = await fetch(`${this.baseURL}${endpoint}`, {
                    method: "POST",
                    headers: await this.getAuthHeaders(),
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(this.requestTimeout),
                    ...options,
                });

                const responseTime = Date.now() - startTime;
                this.updateAverageResponseTime(responseTime);

                if (response.ok) {
                    this.usageStats.successfulRequests++;
                    const data = await response.json();

                    // 토큰 사용량 추적
                    if (data.usage) {
                        this.usageStats.totalTokens +=
                            data.usage.total_tokens || 0;
                    }

                    return { success: true, data, response };
                } else {
                    const errorText = await response.text();
                    lastError = new Error(
                        `API 오류 ${response.status}: ${errorText}`,
                    );

                    // 재시도 가능한 오류인지 확인
                    if (
                        this.shouldRetry(response.status) &&
                        attempt < this.maxRetries
                    ) {
                        const delay =
                            this.retryDelay * Math.pow(2, attempt - 1);
                        console.warn(
                            `API 호출 실패, ${delay}ms 후 재시도 (${attempt}/${this.maxRetries})`,
                        );
                        await this.sleep(delay);
                        continue;
                    }

                    throw lastError;
                }
            } catch (error) {
                lastError = error;
                this.usageStats.failedRequests++;

                if (attempt < this.maxRetries && this.shouldRetryError(error)) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.warn(
                        `네트워크 오류, ${delay}ms 후 재시도 (${attempt}/${this.maxRetries}):`,
                        error.message,
                    );
                    await this.sleep(delay);
                    continue;
                }

                throw error;
            }
        }

        throw lastError;
    }

    shouldRetry(statusCode) {
        // 5xx 서버 오류와 429 속도 제한은 재시도
        return statusCode >= 500 || statusCode === 429;
    }

    shouldRetryError(error) {
        // 네트워크 오류나 타임아웃은 재시도
        return error.name === "TypeError" || error.name === "AbortError";
    }

    updateAverageResponseTime(responseTime) {
        const total =
            this.usageStats.averageResponseTime *
            (this.usageStats.successfulRequests +
                this.usageStats.failedRequests -
                1);
        this.usageStats.averageResponseTime =
            (total + responseTime) /
            (this.usageStats.successfulRequests +
                this.usageStats.failedRequests);
    }

    // 채팅 완성 API 호출
    async chatCompletion(messages, options = {}) {
        const payload = {
            model: options.model || "glm-4.6",
            messages: messages,
            max_tokens: options.maxTokens || 8192,
            temperature: options.temperature || 0.8,
            stream: options.stream || false,
        };

        // thinking 설정이 있으면 추가
        if (options.thinking) {
            payload.thinking = options.thinking;
        }

        return this.makeRequest("chat/completions", payload);
    }

    // 스트리밍 채팅 완성 - Z.AI API에 최적화
    async *chatCompletionStream(messages, options = {}) {
        const payload = {
            model: options.model || "glm-4.6",
            messages: messages,
            max_tokens: options.maxTokens || 8192,
            temperature: options.temperature || 0.8,
            stream: true,
        };

        // thinking 설정이 있으면 추가
        if (options.thinking) {
            payload.thinking = options.thinking;
        }

        const response = await fetch(`${this.baseURL}chat/completions`, {
            method: "POST",
            headers: await this.getAuthHeaders(),
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.requestTimeout),
        });

        if (!response.ok) {
            throw new Error(`스트리밍 API 오류: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let totalBytes = 0;
        let chunksProcessed = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 스트림이 끝나면 루프를 중단합니다.
                    break;
                }

                totalBytes += value.byteLength;
                chunksProcessed++;

                // 수신된 데이터를 버퍼에 추가합니다.
                buffer += decoder.decode(value, { stream: true });

                // 버퍼에서 한 줄씩 처리합니다.
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.substring(0, newlineIndex).trim();
                    buffer = buffer.substring(newlineIndex + 1);

                    if (line.startsWith("data:")) {
                        const dataPart = line.substring(5).trim();

                        if (dataPart === "[DONE]") {
                            console.log("스트리밍 완료 [DONE]:", {
                                chunksProcessed,
                                totalBytes,
                            });
                            return; // 스트림 종료
                        }

                        if (dataPart && dataPart !== "[DONE]") {
                            try {
                                const jsonData = JSON.parse(dataPart);
                                yield jsonData;
                            } catch (parseError) {
                                console.warn(
                                    "JSON 파싱 실패 (버퍼에서 건너뛰기):",
                                    parseError.message,
                                );
                                // 파싱 실패는 전체 스트림을 중단하지 않음
                            }
                        }
                    }
                }

                if (chunksProcessed % 100 === 0) {
                    console.log(
                        `스트리밍 진행: ${chunksProcessed} 청크, ${totalBytes} 바이트`,
                    );
                }
            }

            // 스트림이 모두 끝난 후 버퍼에 남아있는 데이터 처리
            if (buffer.trim()) {
                console.log(
                    "스트림 종료 후 남은 버퍼 처리:",
                    buffer.length,
                    "자",
                );

                // 여러 줄의 남은 데이터 처리
                const remainingLines = buffer.trim().split("\n");
                for (const line of remainingLines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith("data:")) {
                        const dataPart = trimmedLine.substring(5).trim();
                        if (dataPart && dataPart !== "[DONE]") {
                            try {
                                const jsonData = JSON.parse(dataPart);
                                yield jsonData;
                            } catch (e) {
                                console.warn(
                                    "마지막 버퍼 JSON 파싱 실패 (건너뛰기):",
                                    e.message,
                                );
                                // 파싱 실패는 전체 프로세스를 중단하지 않음
                            }
                        }
                    }
                }
            }

            console.log("스트리밍 최종 완료:", { chunksProcessed, totalBytes });
        } catch (streamError) {
            console.error("스트리밍 읽기 오류:", streamError);
            throw streamError;
        } finally {
            reader.releaseLock();
        }
    }

    // 사용량 통계 가져오기
    getUsageStats() {
        return { ...this.usageStats };
    }

    // 사용량 통계 초기화
    resetUsageStats() {
        this.usageStats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokens: 0,
            lastRequestTime: null,
            averageResponseTime: 0,
        };
    }
}

class AICompanion {
    constructor() {
        this.messages = [];
        this.isTyping = false;
        this.isProcessingMessage = false; // 메시지 처리 중 상태 추가

        // 기본 상황 정보 로드 (비동기 초기화)
        this.basicSituation = null;
        this.initializeBasicSituation();

        this.settings = {
            personality: "warm",
            theme: "warm",
            soundEnabled: true,
            authMethod: "apikey", // 'apikey' or 'jwt'
            model: "glm-4.6",
            maxTokens: 2000, // 스트리밍 및 일반 응답의 기본 최대 토큰을 2000으로 설정
            temperature: 0.8,
            streamingEnabled: true,
        };

        // EXA MCP 서버 연결 상태
        this.exaAvailable = false;

        // Memory 서버 연결 상태 (Supabase + Netlify Functions)
        this.memoryMCPAvailable = false;
        this.memoryClient = new NetlifyMemoryClient();

        // 연결 확인 및 자동 활성화
        this.memoryClient.checkConnection().then((connected) => {
            if (connected) {
                console.log(
                    "✅ Memory 시스템 활성화 - 대화 기억 기능 사용 가능",
                );
                this.memoryMCPAvailable = true;

                // 사용자에게 Memory 활성화 알림 (첫 실행시에만)
                const memoryNotified = localStorage.getItem("memory_notified");
                if (!memoryNotified) {
                    setTimeout(() => {
                        this.showNotification(
                            "🧠 대화 기억 기능이 활성화되었습니다!",
                        );
                        localStorage.setItem("memory_notified", "true");
                    }, 2000);
                }
            } else {
                console.warn("⚠️ Memory 시스템 연결 실패 - 기본 대화 모드");
                this.memoryMCPAvailable = false;
            }
        });

        // 사용자 ID (로컬 스토리지에서 가져오거나 새로 생성)
        this.userId = this.getUserId();

        // Z.AI API 클라이언트 초기화
        this.apiClient = new ZAIAPIClient();

        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.loadChatHistory(); // 대화 기록 로드
        this.initializeChat();
        this.checkMemoryMCPServer(); // Memory MCP 서버 상태 확인
        this.initializeContextManagement(); // 개인 컨텍스트 관리 초기화
    }

    // 개인 컨텍스트 관리 초기화
    initializeContextManagement() {
        // 컨텍스트 관리 버튼 이벤트 리스너 설정
        setTimeout(() => {
            const saveContextBtn = document.getElementById('saveContextBtn');
            const loadContextBtn = document.getElementById('loadContextBtn');
            const clearContextBtn = document.getElementById('clearContextBtn');
            const personalContext = document.getElementById('personalContext');
            const contextCharCount = document.getElementById('contextCharCount');

            if (saveContextBtn) {
                saveContextBtn.addEventListener('click', () => {
                    this.savePersonalContext();
                });
            }

            if (loadContextBtn) {
                loadContextBtn.addEventListener('click', () => {
                    this.loadPersonalContext();
                });
            }

            if (clearContextBtn) {
                clearContextBtn.addEventListener('click', () => {
                    this.clearPersonalContext();
                });
            }

            // 컨텍스트 입력 시 문자 카운트 업데이트
            if (personalContext && contextCharCount) {
                personalContext.addEventListener('input', () => {
                    const text = personalContext.value;
                    const charCount = text.length;
                    contextCharCount.textContent = `${charCount}/2000`;
                    
                    // 문자 수에 따라 색상 변경
                    if (charCount > 1800) {
                        contextCharCount.style.color = '#e74c3c'; // 빨간색
                    } else if (charCount > 1500) {
                        contextCharCount.style.color = '#f39c12'; // 주황색
                    } else {
                        contextCharCount.style.color = '#666'; // 기본 색상
                    }
                });

                // 초기 문자 카운트 설정
                const initialCharCount = personalContext.value.length;
                contextCharCount.textContent = `${initialCharCount}/2000`;
            }

            // 자동 저장 기능 (30초마다 변경사항 확인)
            let lastSavedContent = personalContext ? personalContext.value : '';
            setInterval(() => {
                if (personalContext && personalContext.value !== lastSavedContent) {
                    // 변경사항이 있으면 자동 저장
                    this.savePersonalContextSilent();
                    lastSavedContent = personalContext.value;
                }
            }, 30000); // 30초마다 확인
        }, 100); // DOM 로드 대기

        // 설정 모달이 열릴 때마다 현재 컨텍스트 불러오기
        const originalOpenSettings = this.openSettings.bind(this);
        this.openSettings = function() {
            originalOpenSettings();
            // 현재 컨텍스트를 textarea에 표시
            this.loadPersonalContextToUI();
        };
    }

    // 개인 컨텍스트 저장
    async savePersonalContext() {
        const contextTextarea = document.getElementById('personalContext');
        const contextData = contextTextarea ? contextTextarea.value.trim() : '';

        if (!contextData) {
            this.showContextStatus('저장할 컨텍스트 내용이 없습니다.', 'warning');
            return;
        }

        try {
            // Netlify Functions를 통해 Supabase에 컨텍스트 저장
            const response = await fetch('/.netlify/functions/memory/context/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.getUserId(),
                    contextType: 'basic_situation',
                    contextData: contextData
                })
            });

            const result = await response.json();

            if (result.success) {
                this.basicSituation = contextData; // 메모리에도 저장
                this.showContextStatus('✅ 개인 컨텍스트가 성공적으로 저장되었습니다.', 'success');
                console.log('개인 컨텍스트 저장 성공:', contextData);
                
                // AI에게 컨텍스트 업데이트 알림
                this.addMessage('✅ 개인 컨텍스트가 업데이트되었습니다. 이제부터 이 정보를 바탕으로 더 개인화된 대화를 나눌 수 있습니다.', 'ai');
            } else {
                this.showContextStatus('❌ 컨텍스트 저장에 실패했습니다: ' + result.error, 'error');
                console.error('컨텍스트 저장 실패:', result.error);
            }
        } catch (error) {
            this.showContextStatus('❌ 저장 중 오류가 발생했습니다: ' + error.message, 'error');
            console.error('컨텍스트 저장 오류:', error);
        }
    }

    // 개인 컨텍스트 불러오기
    async loadPersonalContext() {
        try {
            // Netlify Functions를 통해 Supabase에서 컨텍스트 조회
            const response = await fetch('/.netlify/functions/memory/context/get', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.getUserId(),
                    contextType: 'basic_situation'
                })
            });

            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                const contextData = result.data[0].context_data;
                this.basicSituation = contextData; // 메모리에도 저장
                this.showContextStatus('✅ 개인 컨텍스트가 성공적으로 불러왔습니다.', 'success');
                console.log('개인 컨텍스트 로드 성공:', contextData);

                // UI에도 표시
                this.loadPersonalContextToUI();
                
                // AI에게 컨텍스트 로드 알림
                this.addMessage('✅ 개인 컨텍스트를 불러왔습니다. 이제부터 이 정보를 바탕으로 대화하겠습니다.', 'ai');
            } else {
                this.showContextStatus('📄 저장된 컨텍스트가 없습니다.', 'info');
                console.log('저장된 컨텍스트 없음');
                
                // AI에게 컨텍스트 없음 알림
                this.addMessage('📄 저장된 개인 컨텍스트가 없습니다. 설정에서 컨텍스트를 추가하면 더 개인화된 대화를 나눌 수 있습니다.', 'ai');
            }
        } catch (error) {
            this.showContextStatus('❌ 불러오기 중 오류가 발생했습니다: ' + error.message, 'error');
            console.error('컨텍스트 로드 오류:', error);
        }
    }

    // 개인 컨텍스트 삭제
    async clearPersonalContext() {
        if (!confirm('정말로 개인 컨텍스트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            // Netlify Functions를 통해 Supabase에서 컨텍스트 삭제
            const response = await fetch('/.netlify/functions/memory/context/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.getUserId(),
                    contextType: 'basic_situation'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.basicSituation = ''; // 메모리에서도 삭제
                this.showContextStatus('✅ 개인 컨텍스트가 삭제되었습니다.', 'success');
                console.log('개인 컨텍스트 삭제 성공');

                // UI에서도 삭제
                const contextTextarea = document.getElementById('personalContext');
                if (contextTextarea) {
                    contextTextarea.value = '';
                }
                
                // AI에게 컨텍스트 삭제 알림
                this.addMessage('✅ 개인 컨텍스트가 삭제되었습니다. 이제부터 일반적인 대화를 나누게 됩니다.', 'ai');
            } else {
                this.showContextStatus('❌ 컨텍스트 삭제에 실패했습니다: ' + result.error, 'error');
                console.error('컨텍스트 삭제 실패:', result.error);
            }
        } catch (error) {
            this.showContextStatus('❌ 삭제 중 오류가 발생했습니다: ' + error.message, 'error');
            console.error('컨텍스트 삭제 오류:', error);
        }
    }

    // 개인 컨텍스트를 UI에 불러오기
    loadPersonalContextToUI() {
        const contextTextarea = document.getElementById('personalContext');
        if (contextTextarea && this.basicSituation) {
            contextTextarea.value = this.basicSituation;
        }
    }

    // 컨텍스트 상태 메시지 표시
    showContextStatus(message, type = 'info') {
        const statusDiv = document.getElementById('contextStatus');
        if (!statusDiv) return;

        statusDiv.textContent = message;
        statusDiv.style.display = 'block';

        // 상태 타입에 따른 스타일
        statusDiv.className = '';
        switch (type) {
            case 'success':
                statusDiv.style.backgroundColor = '#d4edda';
                statusDiv.style.color = '#155724';
                statusDiv.style.border = '1px solid #c3e6cb';
                break;
            case 'error':
                statusDiv.style.backgroundColor = '#f8d7da';
                statusDiv.style.color = '#721c24';
                statusDiv.style.border = '1px solid #f5c6cb';
                break;
            case 'warning':
                statusDiv.style.backgroundColor = '#fff3cd';
                statusDiv.style.color = '#856404';
                statusDiv.style.border = '1px solid #ffeaa7';
                break;
            default: // info
                statusDiv.style.backgroundColor = '#d1ecf1';
                statusDiv.style.color = '#0c5460';
                statusDiv.style.border = '1px solid #bee5eb';
                break;
        }

        // 3초 후 자동으로 사라짐
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    // 조용한 컨텍스트 저장 (알림 없이)
    async savePersonalContextSilent() {
        const contextTextarea = document.getElementById('personalContext');
        const contextData = contextTextarea ? contextTextarea.value.trim() : '';

        if (!contextData) {
            return; // 내용이 없으면 저장하지 않음
        }

        try {
            // Netlify Functions를 통해 Supabase에 컨텍스트 저장
            const response = await fetch('/.netlify/functions/memory/context/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.getUserId(),
                    contextType: 'basic_situation',
                    contextData: contextData
                })
            });

            const result = await response.json();

            if (result.success) {
                this.basicSituation = contextData; // 메모리에도 저장
                console.log('개인 컨텍스트 자동 저장 성공:', contextData);
            } else {
                console.error('컨텍스트 자동 저장 실패:', result.error);
            }
        } catch (error) {
            console.error('컨텍스트 자동 저장 오류:', error);
        }
    }

    // 기본 상황 정보 비동기 초기화
    async initializeBasicSituation() {
        try {
            await this.loadBasicSituation();
        } catch (error) {
            console.warn('⚠️ 기본 상황 정보 로드 오류:', error);
        }
    }

    // 데이터베이스에서 사용자 컨텍스트 로드
    async loadBasicSituation() {
        try {
            // Netlify Functions를 통해 Supabase에서 컨텍스트 조회
            const response = await fetch('/.netlify/functions/memory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getUserContext',
                    userId: this.getUserId(),
                    contextType: 'basic_situation'
                }),
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                    // 가장 최근 컨텍스트 사용
                    const latestContext = result.data[0];
                    this.basicSituation = latestContext.context_data;
                    console.log('✅ 기본 상황 컨텍스트 로드 완료 (데이터베이스)');
                    return this.basicSituation;
                }
            }

            // 컨텍스트가 없으면 빈 문자열 반환
            this.basicSituation = '';
            return '';
        } catch (error) {
            console.warn('⚠️ 기본 상황 컨텍스트 로드 실패:', error);
            this.basicSituation = '';
            return '';
        }
    }

    initializeElements() {
        // 메시지 관련 요소
        this.chatMessages = document.getElementById("chatMessages");
        this.messageInput = document.getElementById("messageInput");
        this.sendBtn = document.getElementById("sendBtn");
        this.charCount = document.getElementById("charCount");
        this.typingIndicator = document.getElementById("typingIndicator");

        // 빠른 응답 버튼
        this.quickResponses = document.getElementById("quickResponses");
        this.quickBtns = document.querySelectorAll(".quick-btn");

        // 설정 관련 요소
        this.settingsBtn = document.getElementById("settingsBtn");
        this.modalOverlay = document.getElementById("modalOverlay");
        this.settingsModal = document.getElementById("settingsModal");
        this.closeModalBtn = document.getElementById("closeModal");
        this.saveSettingsBtn = document.getElementById("saveSettings");

        // 설정 폼 요소
        this.personalitySelect = document.getElementById("personality");
        this.themeSelect = document.getElementById("theme");
        this.modelSelect = document.getElementById("model");
        this.authMethodSelect = document.getElementById("authMethod");
        this.apiKeyInput = document.getElementById("apiKey");
        this.maxTokensSlider = document.getElementById("maxTokens");
        this.temperatureSlider = document.getElementById("temperature");
        this.streamingCheckbox = document.getElementById("streamingEnabled");
        this.soundEnabledCheckbox = document.getElementById("soundEnabled");

        // 표시 요소
        this.tokenValue = document.getElementById("tokenValue");
        this.tempValue = document.getElementById("tempValue");
    }

    bindEvents() {
        // 메시지 입력 이벤트
        this.messageInput.addEventListener(
            "input",
            this.handleInput.bind(this),
        );
        this.messageInput.addEventListener(
            "keypress",
            this.handleKeyPress.bind(this),
        );

        // 전송 버튼 이벤트
        this.sendBtn.addEventListener("click", this.sendMessage.bind(this));

        // السريع
        this.quickBtns.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const message = e.target.getAttribute("data-message");
                this.sendMessageWithText(message);
            });
        });

        // 설정 모달 이벤트
        this.settingsBtn.addEventListener(
            "click",
            this.openSettings.bind(this),
        );
        this.closeModalBtn.addEventListener(
            "click",
            this.closeSettings.bind(this),
        );
        this.saveSettingsBtn.addEventListener(
            "click",
            this.saveSettings.bind(this),
        );

        // 모달 외부 클릭 시 닫기
        this.modalOverlay.addEventListener("click", (e) => {
            if (e.target === this.modalOverlay) {
                this.closeSettings();
            }
        });

        // 테마 변경 이벤트
        this.themeSelect.addEventListener(
            "change",
            this.changeTheme.bind(this),
        );

        // 슬라이더 이벤트
        this.maxTokensSlider.addEventListener("input", (e) => {
            this.tokenValue.textContent = e.target.value;
        });

        this.temperatureSlider.addEventListener("input", (e) => {
            this.tempValue.textContent = e.target.value;
        });

        // Enter 키로 메시지 전송 (Shift+Enter는 줄바꿈)
        this.messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // "계속해" 자동 입력 처리를 위한 Enter 키 이벤트 추가
        this.messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                const message = this.messageInput.value.trim();

                // "계속해" 입력 감지 시 자동으로 처리
                if (message === "계속해") {
                    e.preventDefault();
                    this.handleContinueInput();
                }
            }
        });

        // 브라우저 종료 시 대화 기록 저장
        window.addEventListener("beforeunload", () => {
            this.saveChatHistoryToFile(this.messages);
        });
    }

    handleInput() {
        const text = this.messageInput.value.trim();
        const charCount = text.length;

        // 문자 카운트 업데이트
        this.charCount.textContent = `${charCount}/500`;

        // 전송 버튼 활성화/비활성화
        this.sendBtn.disabled = charCount === 0 || this.isTyping;

        // 자동 높이 조절
        this.messageInput.style.height = "auto";
        this.messageInput.style.height =
            Math.min(this.messageInput.scrollHeight, 100) + "px";
    }

    handleKeyPress(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isTyping) return;

        this.sendMessageWithText(message);
    }

    async sendMessageWithText(message) {
        // 이미 처리 중인 메시지가 있는지 확인
        if (this.isProcessingMessage) {
            console.log("이전 메시지가 처리 중입니다. 잠시 기다려주세요.");
            return;
        }

        // 처리 중 상태 설정
        this.isProcessingMessage = true;

        // Memory 관련 명령어인지 확인
        const isMemoryCommand = await this.handleMemoryCommand(message);

        // Memory 명령어가 아닌 경우에만 AI 응답 생성
        if (!isMemoryCommand) {
            // 사용자 메시지 추가
            this.addMessage(message, "user");

            // 입력창 초기화
            this.messageInput.value = "";
            this.handleInput();

            // 타이핑 인디케이터 표시
            this.showTypingIndicator();

            try {
                // AI 응답 생성
                const response = await this.generateAIResponse(message);
                this.hideTypingIndicator();

                // 스트리밍 모드가 아닌 경우에만 메시지 추가
                // 스트리밍 모드에서는 generateStreamingResponse에서 이미 메시지가 추가됨
                if (!this.settings.streamingEnabled) {
                    this.addMessage(response, "ai");
                }

                // 알림 소리 재생
                if (this.settings.soundEnabled) {
                    this.playNotificationSound();
                }
            } catch (error) {
                console.error("AI 응답 생성 오류:", error);
                this.hideTypingIndicator();
                this.addMessage(
                    "죄송해요, 지금은 응답하기 어렵네요. 잠시 후 다시 이야기해주세요. 🙏",
                    "ai",
                );
            }
        }

        // 처리 중 상태 해제
        this.isProcessingMessage = false;
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${sender}-message`;

        const content = document.createElement("div");
        content.className = "message-content";

        // 텍스트를 단락으로 분리
        const paragraphs = text.split("\n").filter((p) => p.trim());
        paragraphs.forEach((paragraph) => {
            const p = document.createElement("p");
            p.textContent = paragraph;
            content.appendChild(p);
        });

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = this.getCurrentTime();

        // AI 메시지는 세로 구조 (말풍선 + 시간)
        if (sender === "ai") {
            messageDiv.appendChild(content);
            messageDiv.appendChild(time);
        } else {
            // 사용자 메시지는 기존 구조 (아바타 + 말풍선)
            const avatar = document.createElement("div");
            avatar.className = "message-avatar";
            avatar.textContent = "😊";

            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
            messageDiv.appendChild(time);
        }

        this.chatMessages.appendChild(messageDiv);

        // 스크롤 to bottom
        this.scrollToBottom();

        // 메시지 객체 생성
        const message = {
            text,
            sender,
            timestamp: new Date(),
        };

        // 메시지 배열에 저장
        this.messages.push(message);

        // 대화 기록 저장 (AI 응답과 사용자 메시지만 저장, 시스템 메시지는 제외)
        if (
            sender === "user" ||
            (sender === "ai" &&
                !text.includes("처음 사용하시는군요") &&
                !text.includes("만나서 반가워요"))
        ) {
            this.saveChatHistory();

            // Memory 서버가 연결되어 있으면 메모리에 자동 저장 (사용자 메시지와 AI 응답 모두)
            if (this.memoryMCPAvailable) {
                // AI 응답일 때는 마지막 사용자 메시지와 함께 저장
                if (sender === "ai") {
                    // Memory 관련 시스템 메시지(조회, 삭제 등)는 저장하지 않음
                    if (
                        !text.includes("Memory") &&
                        !text.includes("기록") &&
                        !text.includes("대화") &&
                        !text.includes("저장") &&
                        !text.includes("삭제") &&
                        !text.includes("조회") &&
                        !text.includes("검색")
                    ) {
                        const lastUserMessage = [...this.messages]
                            .reverse()
                            .find((msg) => msg.sender === "user");

                        if (lastUserMessage) {
                            this.saveConversationPair(lastUserMessage, message).catch((err) => {
                                console.warn("Memory 대화 쌍 저장 실패:", err);
                            });
                        }
                    } else {
                        console.log("📚 Memory 시스템 명령어 응답이므로 저장하지 않음");
                    }
                } else {
                    // 사용자 메시지는 Memory 명령어가 아닌 경우에만 저장 (AI 응답을 기다림)
                    const userMessage = message.text.toLowerCase();
                    const isMemoryCommand = userMessage.includes("memory") ||
                                            userMessage.includes("기록") ||
                                            userMessage.includes("삭제") ||
                                            userMessage.includes("지워") ||
                                            userMessage.includes("비워") ||
                                            userMessage.includes("초기화") ||
                                            userMessage.includes("검색") ||
                                            userMessage.includes("보여줘") ||
                                            userMessage.includes("봐줘") ||
                                            userMessage.includes("전체");

                    if (!isMemoryCommand) {
                        this.saveMessageToMemory(message).catch((err) => {
                            console.warn("Memory 저장 실패:", err);
                        });
                    } else {
                        console.log("📚 Memory 명령어 사용자 입력이므로 저장하지 않음");
                    }
                }
            }
        }

        // AI 응답 후에만 요약 실행 (사용자 요청 시에만 실행하도록 주석 처리)
        // if (sender === 'ai') {
        //     this.summarizeConversation();
        // }
    }

    async generateAIResponse(userMessage) {
        // Memory에서 관련 이전 대화 검색 - 더 적극적으로 활용
        let memoryContext = "";
        if (this.memoryMCPAvailable) {
            try {
                // 최근 대화 5개 가져오기
                const recentConvs = await this.getRecentConversations(5);

                if (recentConvs.length > 0) {
                    memoryContext = "\n\n**최근 대화 기록 (참고용):**\n";
                    recentConvs.forEach((conv, index) => {
                        memoryContext += `${index + 1}. 사용자: "${conv.user_message}"\n`;
                        memoryContext += `   AI: "${conv.ai_message.substring(0, 80)}..."\n`;
                    });
                }

                // 추가로 키워드 기반 검색
                const keywords = this.extractKeywords(userMessage);
                if (keywords.length > 0) {
                    const relatedConversations =
                        await this.searchConversationsInMemory(
                            keywords.join(" "),
                        );
                    if (relatedConversations.length > 0) {
                        memoryContext += "\n**관련 이전 대화:**\n";
                        relatedConversations
                            .slice(0, 2)
                            .forEach((conv, index) => {
                                memoryContext += `${index + 1}. 사용자: "${conv.user_message}"\n`;
                                memoryContext += `   AI: "${conv.ai_message.substring(0, 80)}..."\n`;
                            });
                    }
                }

                console.log(
                    "🧠 Memory 컨텍스트 로드 완료:",
                    memoryContext ? "있음" : "없음",
                );
            } catch (error) {
                console.warn("Memory 컨텍스트 로딩 실패:", error);
            }
        }

        // 감정일기 컨텍스트 로드
        let diaryContext = "";
        if (window.emotionDiary) {
            try {
                // 최근 5개의 일기 가져오기
                const recentDiaries =
                    await window.emotionDiary.getRecentDiariesForAI(5);

                if (recentDiaries && recentDiaries.length > 0) {
                    diaryContext =
                        "\n\n**사용자의 최근 감정 일기 (참고용):**\n";
                    diaryContext +=
                        "사용자가 작성한 감정 일기를 바탕으로 더욱 개인화된 조언을 제공하세요.\n\n";

                    recentDiaries.forEach((diary, index) => {
                        const date = new Date(
                            diary.created_at,
                        ).toLocaleDateString("ko-KR");
                        diaryContext += `[${date}의 감정 일기]\n`;

                        if (diary.emotional_moment) {
                            diaryContext += `• 감정적 순간: ${diary.emotional_moment}\n`;
                        }
                        if (diary.emotion_cause) {
                            diaryContext += `• 감정의 원인: ${diary.emotion_cause}\n`;
                        }
                        if (diary.tags && diary.tags.length > 0) {
                            diaryContext += `• 감정 태그: ${diary.tags.join(", ")}\n`;
                        }
                        diaryContext += "\n";
                    });
                }

                // 감정 요약 정보 추가
                const summary = await window.emotionDiary.getEmotionSummary(7);
                if (summary && summary.total_diaries > 0) {
                    diaryContext += `**최근 7일 감정 요약:**\n`;
                    diaryContext += `- 총 일기 수: ${summary.total_diaries}개\n`;
                    if (summary.tag_counts && summary.tag_counts.length > 0) {
                        diaryContext += `- 주요 감정: ${summary.tag_counts.map((t) => `${t.tag}(${t.count}회)`).join(", ")}\n`;
                    }
                    if (summary.most_common_tag) {
                        diaryContext += `- 가장 자주 느낀 감정: ${summary.most_common_tag.tag}\n`;
                    }
                    diaryContext += "\n";
                }

                console.log(
                    "📖 감정일기 컨텍스트 로드 완료:",
                    diaryContext ? "있음" : "없음",
                );
            } catch (error) {
                console.warn("감정일기 컨텍스트 로딩 실패:", error);
            }
        }

        // 사용자 기본 컨텍스트 정보 준비
        const basicContext = this.basicSituation ? `\n\n**사용자 기본 컨텍스트 정보:**\n${this.basicSituation}` : '';
        
        // 컨텍스트가 없으면 사용자에게 알림
        if (!this.basicSituation) {
            // 설정 모달이 열려있지 않을 때만 알림 표시
            const settingsModal = document.getElementById('settingsModal');
            if (!settingsModal || settingsModal.style.display === 'none') {
                // AI 응답에 컨텍스트 설정 안내 메시지 추가 (10번 대화마다 한 번만)
                const messageCount = this.messages.filter(m => m.sender === 'user').length;
                if (messageCount % 10 === 0 && messageCount > 0) {
                    basicContext += '\n\n**참고:** 사용자에 대한 더 개인화된 응답을 위해 설정에서 "개인 컨텍스트 관리"를 통해 기본 정보를 입력해주세요.';
                }
            }
        }

        // 성격에 따른 시스템 프롬프트 설정
        const systemPrompts = {
            warm:
                "당신은 따뜻하고 다정한 AI 친구입니다. 사용자의 감정을 공감하고 위로해주며, 항상 긍정적이고 따뜻한 말을 건네세요. 이모티콘을 적절히 사용해서 친근하게 대화하세요." +
                basicContext +
                memoryContext +
                diaryContext,
            cheerful:
                "당신은 쾌활하고 긍정적인 AI 친구입니다. 사용자를 항상 격려하고 즐거운 분위기를 만들어주세요. 밝고 에너지 넘치는 대화를 나누세요." +
                basicContext +
                memoryContext +
                diaryContext,
            wise:
                "당신은 현명하고 조언해주는 AI 친구입니다. 사용자의 문제에 깊이 있게 생각하고 현실적인 조언을 제공하세요. 신중하고 지혜로운 말을 건네세요." +
                basicContext +
                memoryContext +
                diaryContext,
            humorous:
                "당신은 유머러스한 AI 친구입니다. 적절한 유머와 재치 있는 말로 사용자를 웃게 만들어주세요. 가벼운 농담도 좋지만, 상황을 잘 파악해서 적절한 유머를 사용하세요." +
                basicContext +
                memoryContext +
                diaryContext,
            counselor: `당신은 가정 문제, 부부 관계, 자녀 교육 등 가정 상담 전문가입니다. 15년 이상의 임상 경험을 가진 심리 상담 전문가로서, 다음과 같은 전문성을 갖추고 사용자를 도와주세요.

**전문 분야:**
- 부부 관계 갈등 해결 및 커뮤니케이션 개선
- 자녀 교육 및 양육 문제 (영유아부터 청소년기까지)
- 가족 시스템 치료 및 관계 개선
- 심리적 정서 지원 및 스트레스 관리
- 가정 폭력 및 중독 문제 상담

**상담 철학:**
1. 인본주의적 접근: 카를 로저스의 인간 중심 치료법을 바탕으로 무조건적 긍정적 관심과 공감 제공
2. 인지행동치료(CBT): 부정적 사고 패턴을 파악하고 긍정적 대안 제시
3. 가족 시스템 이론: 개인 문제를 가족 전체의 맥락에서 이해하고 해결책 모색
4. 정서중심치료(EFT): 부부 관계에서 정서적 유대감 강화 및 애착 안정성 증진

**상담 기술:**
- 적극적 경청과 공감적 이해
- 개방형 질문을 통한 자기 탐색 유도
- 문제 재구성화 및 긍정적 시각 전환
- 구체적이고 실천 가능한 해결책 제시
- 단계별 접근법으로 문제 해결 능력 강화

**응답 원칙:**
1. 항상 공감과 이해로 시작하기: "그런 상황이셨군요", "마음이 많이 힘드셨겠어요"
2. 감정 정당화하기: 사용자의 감정을 존중하고 정당화하기
3. 문제의 핵심 파악하기: 표면적 문제背后의 근본적 원인 탐색
4. 전문적 지식 제공하기: 심리학 이론과 최신 연구 결과 바탕으로 설명
5. 구체적 행동 계획 제시하기: 당장 실천할 수 있는 작은 단계부터 제안
6. 긍정적 미래 비전 제시하기: 변화 가능성에 대한 희망과 동기 부여

**주의사항:**
- 절대 사용자를 판단하거나 비판하지 않기
- 전문 용어는 쉽게 풀어서 설명하기
- 심각한 경우(우울증, 자살 충동 등)에는 전문가 상담 권유하기
- 모든 조언은 사용자의 상황과 가치관을 존중하며 제공하기
- 필요시 추가 정보를 요청하여 더 정확한 진단과 조언 제공하기
- **가장 중요한 원칙: 절대 정보를 지어내지 마세요.** 대화 기록(Memory), 검색 결과, 또는 제공된 컨텍스트에 없는 내용에 대한 질문을 받으면, 반드시 "제가 확인할 수 없는 내용입니다" 또는 "기록에 없는 내용입니다"라고만 답변해야 합니다. 특히, 사용자가 과거의 대화나 상담 내용에 대해 물었을 때, 실제 기록이 없다면 절대 추측하거나 일반적인 상담 내용을 꾸며서 답변하지 마세요. 이것은 가장 중요한 규칙입니다.

                basicContext +
                당신은 단순한 조언자가 아니라, 사용자의 마음을 치유하고 관계를 회복시키는 전문가입니다. 따뜻하면서도 전문적인 태도로 사용자를 도와주세요.` +
                memoryContext +
                diaryContext,
        };

        const systemPrompt =
            systemPrompts[this.settings.personality] || systemPrompts.warm;

        // 대화 컨텍스트 구성 (기억력 향상을 위해 최근 20개 메시지 사용)
        const recentMessages = this.messages.slice(-20).map((msg) => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.text,
        }));

        let messages = [
            { role: "system", content: systemPrompt },
            ...recentMessages,
            { role: "user", content: userMessage },
        ];

        try {
            // API 클라이언트 설정 확인
            if (!this.apiClient.apiKey && !this.apiClient.jwtToken) {
                throw new Error("API 키가 설정되지 않았습니다.");
            }

            // 전문 상담가 모드인 경우 전문 지식 베이스와 EXA 검색으로 관련 정보 수집
            if (this.settings.personality === "counselor") {
                try {
                    // 전문 지식 베이스에서 관련 정보 검색
                    const knowledgeBase =
                        this.getCounselingKnowledgeBase(userMessage);

                    // EXA 검색으로 최신 정보 수집
                    const searchResults = await this.searchWithExa(userMessage);

                    // 지식 베이스와 검색 결과 결합
                    let additionalContext = "";

                    if (knowledgeBase) {
                        additionalContext += `전문 상담 지식:\n${knowledgeBase}\n\n`;
                    }

                    if (searchResults && searchResults.length > 0) {
                        additionalContext += `최신 관련 정보:\n${searchResults.map((result) => `- ${result.title}: ${result.snippet}`).join("\n")}`;
                    }

                    if (additionalContext) {
                        messages = [
                            {
                                role: "system",
                                content: `${systemPrompt}\n\n${additionalContext}`,
                            },
                            ...recentMessages,
                            { role: "user", content: userMessage },
                        ];
                    }
                } catch (searchError) {
                    console.warn(
                        "상담 정보 수집 실패, 기본 응답으로 진행:",
                        searchError,
                    );
                }
            }

            // 스트리밍 모드 확인
            if (this.settings.streamingEnabled) {
                return await this.generateStreamingResponse(
                    messages,
                    userMessage,
                );
            } else {
                let response = await this.generateNormalResponse(messages);

                // 상담가 모드인 경우 응답 향상
                if (this.settings.personality === "counselor") {
                    response = this.enhanceCounselingResponse(
                        userMessage,
                        response,
                    );
                }

                return response;
            }
        } catch (error) {
            console.error("Z.AI API 호출 오류:", error);

            // 오류 메시지 표시 후 재발생
            this.showDetailedError(error);
            throw error;
        }
    }

    async generateNormalResponse(messages) {
        try {
            const result = await this.apiClient.chatCompletion(messages, {
                model: this.settings.model,
                maxTokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
                stream: false,
                thinking: { type: "disabled" }, // 추론 모드 비활성화
            });

            if (
                result &&
                result.success &&
                result.data &&
                result.data.choices &&
                result.data.choices[0]
            ) {
                const content = result.data.choices[0].message.content;
                if (content) {
                    return content.trim();
                } else {
                    throw new Error("빈 응답을 받았습니다");
                }
            } else {
                console.error("API 응답 구조 오류:", result);
                throw new Error("API 응답 구조가 잘못되었습니다");
            }
        } catch (error) {
            console.error("일반 응답 생성 오류:", {
                message: error.message,
                stack: error.stack,
                messagesCount: messages.length,
            });
            throw error;
        }
    }

    async generateStreamingResponse(messages, userMessage) {
        // 스트리밍 응답을 위한 메시지 요소 생성
        const messageDiv = this.createStreamingMessage();
        let fullContent = "";
        let receivedChunks = 0;
        let lastUpdateTime = Date.now();
        const updateInterval = 50;
        let streamCompleted = false;
        let streamError = null;
        let totalBytes = 0;

        console.log("=== 스트리밍 응답 시작 ===");
        console.log("설정:", {
            model: this.settings.model,
            maxTokens: this.settings.maxTokens,
            temperature: this.settings.temperature,
            streamingEnabled: this.settings.streamingEnabled,
            messageCount: messages.length,
        });
        console.log("사용자 메시지:", userMessage);

        try {
            // 스트리밍 데이터 수집
            const streamIterator = this.apiClient.chatCompletionStream(
                messages,
                {
                    model: this.settings.model,
                    maxTokens: this.settings.maxTokens,
                    temperature: this.settings.temperature,
                    thinking: { type: "disabled" },
                },
            );

            // 이터레이터를 수동으로 처리하여 더 나은 오류 처리
            while (true) {
                const { value, done } = await streamIterator.next();
                if (done) {
                    streamCompleted = true;
                    console.log("스트리밍 완료: 모든 데이터 수신");
                    break;
                }

                receivedChunks++;
                const chunk = value;

                try {
                    // 응답 구조 안전하게 처리
                    if (chunk && chunk.choices && chunk.choices[0]) {
                        const choice = chunk.choices[0];
                        if (choice.delta) {
                            let newContent = "";
                            const delta = choice.delta;

                            // Z.AI API 응답 필드 flexible 처리
                            if (
                                delta.content &&
                                typeof delta.content === "string" &&
                                delta.content.length > 0
                            ) {
                                newContent = delta.content;
                            } else if (
                                delta.reasoning_content &&
                                typeof delta.reasoning_content === "string" &&
                                delta.reasoning_content.length > 0
                            ) {
                                newContent = delta.reasoning_content;
                            }

                            if (newContent) {
                                fullContent += newContent;
                                const now = Date.now();
                                if (now - lastUpdateTime > updateInterval) {
                                    this.updateStreamingMessage(
                                        messageDiv,
                                        fullContent,
                                    );
                                    lastUpdateTime = now;
                                }
                                // 매 20 청크마다 디버깅 출력
                                if (receivedChunks % 20 === 0) {
                                    console.log(
                                        `콘텐츠 업데이트 [${receivedChunks}]:`,
                                        {
                                            newContent,
                                            totalLength: fullContent.length,
                                        },
                                    );
                                }
                            }
                        }

                        // finish_reason이 'stop'이면 스트림 종료
                        if (choice.finish_reason === "stop") {
                            console.log(
                                "스트림 정상 종료 [finish_reason=stop]:",
                                {
                                    receivedChunks,
                                    totalLength: fullContent.length,
                                },
                            );
                            streamCompleted = true;
                            break;
                        }
                    }

                    // 진행 상황 로깅 (매 20 청크마다)
                    if (receivedChunks % 20 === 0) {
                        console.log(
                            `진행률: ${receivedChunks} 청크, 콘텐츠 길이: ${fullContent.length}자, 수신 데이터:`,
                            {
                                chunkId: chunk.id,
                                hasChoices: !!chunk.choices,
                                hasDelta: !!chunk.choices?.[0]?.delta,
                                finishReason: chunk.choices?.[0]?.finish_reason,
                            },
                        );
                    }
                } catch (chunkError) {
                    console.warn(
                        "청크 처리 중 오류 (계속 처리):",
                        chunkError.message,
                    );
                    // 개별 청크 오류는 전체 프로세스를 중단하지 않음
                    // 하지만 로그를 통해 추적 가능
                }
            }

            // 스트리밍 완료 처리
            console.log("스트리밍 최종 처리:", {
                receivedChunks,
                contentLength: fullContent.length,
                completed: streamCompleted,
            });

            // 최종 UI 업데이트
            if (fullContent && fullContent.length > 0) {
                this.updateStreamingMessage(messageDiv, fullContent);

                // 스트리밍 완료 후 최종 메시지로 변환
                this.finalizeStreamingMessage(messageDiv, fullContent);

                // 메시지 배열에 저장
                this.messages.push({
                    text: fullContent,
                    sender: "ai",
                    timestamp: new Date(),
                });

                // 상담가 모드인 경우 응답 향상
                let enhancedResponse = fullContent;
                if (this.settings.personality === "counselor") {
                    enhancedResponse = this.enhanceCounselingResponse(
                        userMessage,
                        fullContent,
                    );

                    // 향상된 응답이 다른 경우, 메시지 업데이트
                    if (enhancedResponse !== fullContent) {
                        // 기존 메시지 찾기
                        const lastMessage =
                            this.messages[this.messages.length - 1];
                        if (lastMessage && lastMessage.sender === "ai") {
                            lastMessage.text = enhancedResponse;
                        }

                        // 화면의 메시지 업데이트
                        const contentElement =
                            messageDiv.querySelector(".message-content");
                        if (contentElement) {
                            const processedContent = enhancedResponse
                                .split("\n")
                                .filter((p) => p.trim())
                                .map((p) => `<p>${p}</p>`)
                                .join("");

                            contentElement.innerHTML = processedContent;
                            this.scrollToBottom();
                        }
                    }
                }

                console.log("스트리밍 성공적으로 완료:", {
                    originalLength: fullContent.length,
                    enhancedLength: enhancedResponse.length,
                });

                return enhancedResponse;
            } else {
                // 빈 응답 처리
                console.warn("스트리밍에서 빈 응답을 받았습니다");
                throw new Error("스트리밍에서 데이터를 받을 수 없습니다.");
            }
        } catch (error) {
            // 스트리밍 오류 처리
            streamError = error;
            console.error("스트리밍 오류 발생:", {
                message: error.message,
                name: error.name,
                receivedChunks,
                contentLength: fullContent.length,
                hasContent: !!fullContent,
                completed: streamCompleted,
                timestamp: new Date().toISOString(),
            });

            // 네트워크 오류나 일시적 오류인지 판단
            const isTemporaryError =
                error.name === "TypeError" ||
                error.name === "AbortError" ||
                error.message.includes("timeout");

            // 수신된 콘텐츠가 일정 수준 이상이면 부분적 성공으로 처리
            const MIN_CONTENT_LENGTH = 50; // 최소 50자 이상 수신되었을 때 부분적 성공으로 처리
            if (fullContent && fullContent.length >= MIN_CONTENT_LENGTH) {
                console.log(
                    `스트리밍 부분적 성공: ${fullContent.length}자 수신됨`,
                );

                this.updateStreamingMessage(messageDiv, fullContent);
                this.finalizeStreamingMessage(messageDiv, fullContent);

                this.messages.push({
                    text: fullContent,
                    sender: "ai",
                    timestamp: new Date(),
                });

                // 부분적 성공 알림 (콘솔에만 표시, 사용자에게는 보이지 않음)
                console.log(
                    "일부 응답이 누락되었지만 수신된 내용을 표시합니다. 📡",
                );

                // 자동으로 "계속해" 입력 기능 제공
                this.showContinueOptions(fullContent);

                return fullContent;
            }

            // 콘텐츠가 너무 적거나 없는 경우 일반 모드로 전환
            console.log(
                "스트리밍 실패 또는 콘텐츠 부족, 일반 모드로 전환 시도",
            );
            if (messageDiv && messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }

            // 일반 모드로 재시도 (최대 1회)
            try {
                console.log("일반 모드 API 호출 시도...");
                const normalResponse =
                    await this.generateNormalResponse(messages);
                this.addMessage(normalResponse, "ai");
                console.log("일반 모드 성공적으로Fallback됨");
                return normalResponse;
            } catch (normalError) {
                console.error("일반 모드Fallback도 실패:", normalError);

                // 사용자 친화적 오류 메시지 표시
                let errorMessage =
                    "죄송해요, 응답 생성 중 오류가 발생했습니다. ";
                if (isTemporaryError) {
                    errorMessage +=
                        "네트워크 연결을 확인하고 다시 시도해주세요. 🌐";
                } else {
                    errorMessage += "잠시 후 다시 시도해주세요. 🙏";
                }

                this.addMessage(errorMessage, "ai");
                return errorMessage;
            }
        }
    }

    createStreamingMessage() {
        const messageDiv = document.createElement("div");
        messageDiv.className = "message ai-message streaming-message";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "🤗";

        const content = document.createElement("div");
        content.className = "message-content streaming-content";
        content.innerHTML = '<span class="streaming-cursor">▊</span>';

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = this.getCurrentTime();

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        messageDiv.appendChild(time);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        return messageDiv;
    }

    updateStreamingMessage(messageDiv, content) {
        const contentElement = messageDiv.querySelector(".streaming-content");
        if (contentElement && content) {
            try {
                const processedContent = this.processMarkdown(content);
                contentElement.innerHTML =
                    processedContent +
                    '<span class="streaming-cursor">▊</span>';
                this.scrollToBottom();
            } catch (updateError) {
                console.warn("스트리밍 메시지 업데이트 오류:", updateError);
                // 오류 시 기본 텍스트로 표시
                contentElement.textContent = content + "▊";
            }
        }
    }

    finalizeStreamingMessage(messageDiv, finalContent) {
        const contentElement = messageDiv.querySelector(".streaming-content");
        if (contentElement) {
            const processedContent = this.processMarkdown(finalContent)
                .split("<br>")
                .filter((p) => p.trim())
                .map((p) => `<p>${p}</p>`)
                .join("");

            contentElement.innerHTML = processedContent;
            messageDiv.classList.remove("streaming-message");
        }
    }

    processMarkdown(text) {
        // 안전하게 마크다운 기본 처리 (XSS 방지)
        const escapedContent = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        return escapedContent
            .replace(/\n/g, "<br>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>");
    }

    showDetailedError(error) {
        let errorMessage = "API 호출 중 오류가 발생했습니다.";

        if (error.message.includes("API 키가 설정되지 않았습니다")) {
            errorMessage =
                "🔑 Z.AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.";
        } else if (error.message.includes("401")) {
            errorMessage =
                "🔑 API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.";
        } else if (error.message.includes("429")) {
            errorMessage =
                "⏰ API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
        } else if (error.message.includes("500")) {
            errorMessage =
                "🔧 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        } else if (error.message.includes("timeout")) {
            errorMessage =
                "⏱️ 요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.";
        }

        // 오류 메시지 표시
        this.addMessage(errorMessage, "ai");

        // 콘솔에 상세 정보 기록
        console.error("상세 오류 정보:", {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            usageStats: this.apiClient.getUsageStats(),
        });
    }

    getOpenAIKey() {
        // Z.AI API 키 반환
        return localStorage.getItem("zai_api_key") || "";
    }

    async setOpenAIKey(apiKey) {
        localStorage.setItem("zai_api_key", apiKey);

        // API 클라이언트에도 키 설정
        if (this.apiClient) {
            // 비동기 처리를 위해 즉시 실행하지 않고 다음 틱에 예약
            setTimeout(async () => {
                await this.apiClient.setAuthMethod(
                    this.settings.authMethod,
                    apiKey,
                );
            }, 0);
        }
    }

    // API 사용량 통계 표시
    showUsageStats() {
        const stats = this.apiClient.getUsageStats();
        const successRate =
            stats.totalRequests > 0
                ? (
                      (stats.successfulRequests / stats.totalRequests) *
                      100
                  ).toFixed(1)
                : 0;

        const statsMessage = `
📊 API 사용량 통계
• 총 요청: ${stats.totalRequests}회
• 성공: ${stats.successfulRequests}회
• 실패: ${stats.failedRequests}회
• 성공률: ${successRate}%
• 사용 토큰: ${stats.totalTokens}개
• 평균 응답시간: ${stats.averageResponseTime.toFixed(0)}ms
• 마지막 요청: ${stats.lastRequestTime ? new Date(stats.lastRequestTime).toLocaleString() : "없음"}
        `;

        console.log(statsMessage);
        this.showNotification("API 통계가 콘솔에 표시되었습니다 📊");
    }

    // "계속해" 입력 옵션 표시
    showContinueOptions(currentContent) {
        // 계속 입력 옵션 컨테이너 생성
        const continueOptions = document.createElement("div");
        continueOptions.className = "continue-options";
        continueOptions.innerHTML = `
            <div class="continue-message">
                📡 응답이 일부 누락되었습니다. 계속해서 응답을 받으시겠습니까?
            </div>
            <div class="continue-buttons">
                <button class="continue-btn" id="continueBtn">계속해</button>
                <button class="continue-btn continue-auto" id="continueAutoBtn">자동 계속</button>
                <button class="continue-btn continue-close" id="continueCloseBtn">닫기</button>
            </div>
            <div class="continue-hint">
                💡 팁: "계속해"를 입력하거나 Enter 키를 눌러도 응답을 이어받을 수 있습니다
            </div>
        `;

        // 스타일 추가
        const style = document.createElement("style");
        style.textContent = `
            .continue-options {
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                border: 1px solid #dee2e6;
                border-radius: 12px;
                padding: 16px;
                margin: 12px 0;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                animation: slideIn 0.3s ease-out;
            }

            .continue-message {
                color: #495057;
                font-size: 14px;
                margin-bottom: 12px;
                text-align: center;
                font-weight: 500;
            }

            .continue-buttons {
                display: flex;
                gap: 8px;
                justify-content: center;
                margin-bottom: 10px;
            }

            .continue-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 80px;
            }

            .continue-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            #continueBtn {
                background: var(--primary-color, #007bff);
                color: white;
            }

            #continueBtn:hover {
                background: #0056b3;
            }

            .continue-auto {
                background: #28a745;
                color: white;
            }

            .continue-auto:hover {
                background: #1e7e34;
            }

            .continue-close {
                background: #6c757d;
                color: white;
            }

            .continue-close:hover {
                background: #545b62;
            }

            .continue-hint {
                color: #6c757d;
                font-size: 12px;
                text-align: center;
                font-style: italic;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        // 채팅 메시지 영역에 추가
        this.chatMessages.appendChild(continueOptions);
        this.scrollToBottom();

        // 현재 내용과 자동 계속 설정 저장
        this.pendingContinue = {
            content: currentContent,
            autoMode: false,
        };

        // 이벤트 리스너 설정
        document.getElementById("continueBtn").addEventListener("click", () => {
            this.handleContinueResponse();
        });

        document
            .getElementById("continueAutoBtn")
            .addEventListener("click", () => {
                this.handleAutoContinue();
            });

        document
            .getElementById("continueCloseBtn")
            .addEventListener("click", () => {
                this.closeContinueOptions();
            });

        // 5초 후 자동으로 닫기
        setTimeout(() => {
            if (continueOptions.parentNode) {
                this.closeContinueOptions();
            }
        }, 5000);
    }

    // 계속 응답 처리
    async handleContinueResponse() {
        this.closeContinueOptions();

        if (this.pendingContinue && this.pendingContinue.content) {
            // "계속해" 메시지 자동 입력
            this.messageInput.value = "계속해";

            // 입력창 활성화 및 포커스
            this.messageInput.disabled = false;
            this.messageInput.focus();

            // 자동으로 메시지 전송
            setTimeout(() => {
                this.sendMessage();
            }, 300);
        }
    }

    // 자동 계속 모드
    handleAutoContinue() {
        this.closeContinueOptions();

        if (this.pendingContinue && this.pendingContinue.content) {
            this.pendingContinue.autoMode = true;

            // 자동 계속 알림
            this.addMessage("🔄 자동으로 응답을 이어받겠습니다...", "ai");

            // 1초 후 자동으로 "계속해" 전송
            setTimeout(() => {
                this.messageInput.value = "계속해";
                this.sendMessage();
            }, 1000);
        }
    }

    // 계속 옵션 닫기
    closeContinueOptions() {
        const continueOptions =
            this.chatMessages.querySelector(".continue-options");
        if (continueOptions) {
            continueOptions.remove();
        }

        // 자동 계속 모드 해제
        if (this.pendingContinue) {
            this.pendingContinue.autoMode = false;
        }
    }

    // "계속해" 직접 입력 처리
    async handleContinueInput() {
        if (this.pendingContinue && this.pendingContinue.content) {
            console.log(
                '사용자가 "계속해"를 직접 입력했습니다. 이어서 응답을 받습니다...',
            );

            // 진행 중인 계속 요청임을 알림
            this.addMessage("🔄 이전 응답을 이어받겠습니다...", "ai");

            // 이전 대화 맥락 복원을 위한 메시지 구성
            const continueMessage = `이전 응답을 계속해주세요. 중단된 내용: "${this.pendingContinue.content.substring(0, 100)}${this.pendingContinue.content.length > 100 ? "..." : ""}"`;

            try {
                // AI에게 이어서 응답 요청
                const response = await this.generateAIResponse(continueMessage);
                this.addMessage(response, "ai");

                // 성공적으로 응답을 받으면 pending 상태 정리
                this.pendingContinue = null;
            } catch (error) {
                console.error("계속 응답 생성 오류:", error);
                this.addMessage(
                    "죄송해요, 응답을 이어받는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 🙏",
                    "ai",
                );
            }
        }
    }

    // API 설정 초기화
    resetAPISettings() {
        if (
            confirm(
                "API 설정을 초기화하시겠습니까? 모든 API 관련 데이터가 삭제됩니다.",
            )
        ) {
            localStorage.removeItem("zai_api_key");
            this.apiClient.resetUsageStats();
            this.apiClient.apiKey = null;
            this.apiClient.jwtToken = null;

            this.showNotification("API 설정이 초기화되었습니다 🔄");

            // 페이지 새로고침
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
    }

    // 모델 정보 표시
    showModelInfo() {
        const modelInfo = {
            "glm-4.6": {
                name: "GLM-4.6",
                description: "가장 최신의 고성능 모델",
                maxTokens: 8192,
                features: ["대화", "추론", "번역", "요약"],
            },
            // 참고: glm-4 모델은 Z.AI API에서 지원되지 않습니다
        };

        const currentModel =
            modelInfo[this.settings.model] || modelInfo["glm-4.6"];
        const infoMessage = `
🤖 현재 모델 정보
• 모델명: ${currentModel.name}
• 설명: ${currentModel.description}
• 최대 토큰: ${currentModel.maxTokens}
• 기능: ${currentModel.features.join(", ")}
        `;

        console.log(infoMessage);
        this.showNotification(`${currentModel.name} 모델을 사용 중입니다 🤖`);
    }

    showTypingIndicator() {
        this.isTyping = true;
        this.typingIndicator.classList.add("show");
        this.sendBtn.disabled = true;
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        this.typingIndicator.classList.remove("show");
        this.sendBtn.disabled = this.messageInput.value.trim().length === 0;
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    getCurrentTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    }

    playNotificationSound() {
        // 간단한 알림 소리 생성
        const audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.1,
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    // 설정 관련 메서드
    openSettings() {
        alert("Settings button clicked!"); // DEBUG
        this.modalOverlay.style.display = "flex";
        setTimeout(() => {
            this.modalOverlay.classList.add("active");
        }, 10);
        document.body.style.overflow = "hidden";

        // 현재 설정 값으로 폼 요소 초기화
        this.apiKeyInput.value = this.getOpenAIKey();
        this.personalitySelect.value = this.settings.personality;
        this.themeSelect.value = this.settings.theme;
        this.modelSelect.value = this.settings.model;
        this.authMethodSelect.value = this.settings.authMethod;
        this.soundEnabledCheckbox.checked = this.settings.soundEnabled;
        this.streamingCheckbox.checked = this.settings.streamingEnabled;

        this.maxTokensSlider.value = this.settings.maxTokens;
        this.tokenValue.textContent = this.settings.maxTokens;

        this.temperatureSlider.value = this.settings.temperature;
        this.tempValue.textContent = this.settings.temperature;
    }

    closeSettings() {
        this.modalOverlay.classList.remove("active");
        setTimeout(() => {
            this.modalOverlay.style.display = "none";
        }, 300);
        document.body.style.overflow = "";
    }

    saveSettings() {
        // Z.AI API 키 저장 및 API 클라이언트 설정
        const apiKey = this.apiKeyInput.value.trim();
        if (apiKey) {
            this.setOpenAIKey(apiKey);

            // API 클라이언트에 인증 방식과 키 설정
            this.apiClient.setAuthMethod(this.settings.authMethod, apiKey);
        }

        // 이전 페르소나 저장
        const previousPersonality = this.settings.personality;

        // 다른 설정 저장
        this.settings.personality = this.personalitySelect.value;
        this.settings.theme = this.themeSelect.value;
        this.settings.soundEnabled = this.soundEnabledCheckbox.checked;
        this.settings.maxTokens = parseInt(this.maxTokensSlider.value, 10);
        this.settings.temperature = parseFloat(this.temperatureSlider.value);

        localStorage.setItem(
            "ai_companion_settings",
            JSON.stringify(this.settings),
        );

        this.closeSettings();
        this.changeTheme();

        // 페르소나 변경 시 UI 업데이트
        if (previousPersonality !== this.settings.personality) {
            this.updatePersonalityUI(
                previousPersonality,
                this.settings.personality,
            );
        }

        // 설정 저장 성공 메시지
        this.showNotification("설정이 저장되었습니다! ✨");

        // API 키 설정 확인 메시지
        if (apiKey) {
            this.showNotification("Z.AI API가 연결되었습니다! 🚀");
        }
    }

    loadSettings() {
        const savedSettings = localStorage.getItem("ai_companion_settings");
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };

            // 이전 버전의 잘못된 maxTokens 값을 보정합니다.
            if (this.settings.maxTokens > 8192) {
                console.warn(
                    `저장된 maxTokens 값(${this.settings.maxTokens})이 모델 한도를 초과하여 8192로 조정합니다.`,
                );
                this.settings.maxTokens = 8192;
            }

            // 낮은 maxTokens 값 강제 업데이트
            if (this.settings.maxTokens < 2000) {
                console.warn(
                    `저장된 maxTokens 값(${this.settings.maxTokens})이 너무 낮아 기본값 2000으로 재설정합니다.`,
                );
                this.settings.maxTokens = 2000;
            }

            this.personalitySelect.value = this.settings.personality;
            this.themeSelect.value = this.settings.theme;
            this.soundEnabledCheckbox.checked = this.settings.soundEnabled;

            this.changeTheme();
        }

        // API 키 로드 및 클라이언트 설정
        const apiKey = this.getOpenAIKey();
        if (apiKey) {
            this.apiClient.setAuthMethod(this.settings.authMethod, apiKey);
        }
    }

    changeTheme() {
        const theme = this.themeSelect.value;
        const root = document.documentElement;

        const themes = {
            warm: {
                "--primary-color": "#ff6b6b",
                "--secondary-color": "#4ecdc4",
                "--background-gradient":
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "--warm-gradient":
                    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)",
            },
            calm: {
                "--primary-color": "#4a90e2",
                "--secondary-color": "#7b68ee",
                "--background-gradient":
                    "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",
                "--warm-gradient":
                    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
            },
            bright: {
                "--primary-color": "#f39c12",
                "--secondary-color": "#e74c3c",
                "--background-gradient":
                    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                "--warm-gradient":
                    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            },
        };

        const selectedTheme = themes[theme] || themes.warm;

        for (const [property, value] of Object.entries(selectedTheme)) {
            root.style.setProperty(property, value);
        }
    }

    showNotification(message) {
        // 간단한 알림 메시지 표시
        const notification = document.createElement("div");
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 2000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = "slideOut 0.3s ease";
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    initializeChat() {
        // 초기 환영 메시지 (메시지가 없을 때만 표시)
        if (this.messages.length === 0) {
            setTimeout(() => {
                // API 키 설정 여부에 따라 다른 환영 메시지 표시
                if (!this.getOpenAIKey()) {
                    if (this.settings.personality === "counselor") {
                        this.addMessage(
                            '안녕하세요. 😊 저는 가정 문제 전문 상담가입니다. 15년의 임상 경험을 바탕으로 당신의 마음을 치유하고 관계를 회복시키는 도움을 드릴게요.\n\n먼저 Z.AI API 키를 설정해주세요. 설정 버튼을 눌러 API 키를 입력해주세요. 🔧\n\n**빠른 시작:**\n• 설정에서 "전문 상담가 (가정/자녀 문제)" 선택\n• API 키 입력 후 저장\n• 그 후 바로 상담 시작 가능',
                            "ai",
                        );
                    } else {
                        this.addMessage(
                            "만나서 반가워요! 😊 당신의 AI 친구입니다. 오늘 하루는 어땠나요? 어떤 이야기든 편하게 나눠요!\n\n처음 사용하시는군요! 더 나은 대화를 위해 Z.AI API 키를 설정해주세요. 설정 버튼을 눌러 API 키를 입력해주세요. 🔧",
                            "ai",
                        );
                    }
                } else {
                    if (this.settings.personality === "counselor") {
                        this.addMessage(
                            '안녕하세요. 😊 저는 가정 문제 전문 상담가입니다. 15년의 임상 경험을 바탕으로 당신의 마음을 치유하고 관계를 회복시키는 도움을 드릴게요.\n\n어떤 고민이든 편하게 이야기해주세요. 당신의 이야기를 경청하며 전문적인 조언을 제공해 드리겠습니다.\n\n**빠른 시작 팁:**\n• "부부 관계가 힘들어요" 또는 "자녀 교육 문제로 고민이에요" 클릭\n• 또는 직접 "스트레스가 너무 심해요" 등 입력\n• 대화 패턴 분석도 가능합니다',
                            "ai",
                        );
                    } else {
                        this.addMessage(
                            "만나서 반가워요! 😊 당신의 AI 친구입니다. 오늘 하루는 어땠나요? 어떤 이야기든 편하게 나눠요!",
                            "ai",
                        );
                    }
                }
            }, 500);
        } else {
            // 대화 기록이 있는 경우, 이전 대화 복원 후 환영 메시지 표시
            setTimeout(() => {
                if (this.settings.personality === "counselor") {
                    this.addMessage(
                        '다시 만나 반가워요. 😊 이전 대화를 기억하고 있어요. 계속해서 당신의 고민을 들어드리며 전문적인 조언을 제공해 드리겠습니다.\n\n**계속 상담하기:**\n• 이전 대화 내용 바탕으로 맞춤형 조언 제공\n• "대화 패턴 분석해주세요" 입력 가능\n• 이완 기법, 소통 가이드 활용',
                        "ai",
                    );
                } else {
                    this.addMessage(
                        "다시 만나 반가워요! 😊 이전 대화를 기억하고 있어요. 계속해서 이야기 나눠요!",
                        "ai",
                    );
                }
            }, 500);
        }

        // 상담가 모드인 경우 추가 UI 요소 생성
        if (this.settings.personality === "counselor") {
            this.setupCounselingUI();
        }

        // 대화 기록 파일 관리 버튼 추가
        this.setupChatHistoryButtons();
    }

    // 대화 기록 저장
    saveChatHistory() {
        try {
            // 최근 50개 메시지만 저장 (localStorage 용량 제한 고려)
            const recentMessages = this.messages.slice(-50);
            localStorage.setItem(
                "ai_companion_chat_history",
                JSON.stringify(recentMessages),
            );
        } catch (error) {
            console.error("대화 기록 저장 오류:", error);
        }
    }

    // 대화 기록을 파일로 저장
    saveChatHistoryToFile(messages) {
        try {
            // 파일 다운로드 생성
            const dataStr = JSON.stringify(messages, null, 2);
            const dataBlob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(dataBlob);

            // 다운로드 링크 생성
            const link = document.createElement("a");
            link.href = url;
            link.download = `ai_companion_chat_history_${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // URL 객체 정리
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error("대화 기록 파일 저장 오류:", error);
        }
    }

    // 파일에서 대화 기록 로드
    loadChatHistoryFromFile() {
        try {
            // 파일 입력 요소 생성
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".json";
            fileInput.style.display = "none";

            // 파일 선택 이벤트
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const loadedMessages = JSON.parse(
                                event.target.result,
                            );

                            // 타임스탬프 문자열을 Date 객체로 변환
                            this.messages = loadedMessages.map((msg) => ({
                                ...msg,
                                timestamp: new Date(msg.timestamp),
                            }));

                            // 화면의 메시지 모두 제거
                            while (this.chatMessages.firstChild) {
                                this.chatMessages.removeChild(
                                    this.chatMessages.firstChild,
                                );
                            }

                            // 로드된 메시지를 화면에 표시
                            this.messages.forEach((msg) => {
                                this.displayMessage(
                                    msg.text,
                                    msg.sender,
                                    msg.timestamp,
                                );
                            });

                            this.addMessage(
                                "대화 기록이 파일에서 성공적으로 로드되었습니다. 😊",
                                "ai",
                            );
                        } catch (parseError) {
                            console.error("파일 파싱 오류:", parseError);
                            this.addMessage(
                                "대화 기록 파일을 불러오는 중 오류가 발생했습니다. 파일 형식을 확인해주세요. 🙏",
                                "ai",
                            );
                        }
                    };

                    reader.readAsText(file);
                }
            });

            // 파일 선택창 열기
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        } catch (error) {
            console.error("대화 기록 파일 로드 오류:", error);
            this.addMessage(
                "대화 기록 파일을 불러오는 중 오류가 발생했습니다. 🙏",
                "ai",
            );
        }
    }

    // 대화 기록 로드
    loadChatHistory() {
        try {
            const savedHistory = localStorage.getItem(
                "ai_companion_chat_history",
            );
            if (savedHistory) {
                const parsedHistory = JSON.parse(savedHistory);

                // 타임스탬프 문자열을 Date 객체로 변환
                this.messages = parsedHistory.map((msg) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp),
                }));

                // 저장된 메시지를 화면에 표시
                this.messages.forEach((msg) => {
                    this.displayMessage(msg.text, msg.sender, msg.timestamp);
                });

                // 대화 기록 로드 확인을 위한 콘솔 로그
                console.log(
                    `대화 기록 로드 완료: ${this.messages.length}개 메시지`,
                );
            }
        } catch (error) {
            console.error("대화 기록 로드 오류:", error);
            this.messages = [];
        }
    }

    // 메시지를 화면에 표시하는 함수 (addMessage와 분리)
    displayMessage(text, sender, timestamp) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${sender}-message`;

        if (sender === "system") {
            messageDiv.classList.add("system-message");
            messageDiv.innerHTML = `<p><em>${text}</em></p>`;
        } else {
            const avatar = document.createElement("div");
            avatar.className = "message-avatar";
            avatar.textContent = sender === "ai" ? "🤗" : "😊";

            const content = document.createElement("div");
            content.className = "message-content";

            // 텍스트를 단락으로 분리
            const paragraphs = text.split("\n").filter((p) => p.trim());
            paragraphs.forEach((paragraph) => {
                const p = document.createElement("p");
                p.textContent = paragraph;
                content.appendChild(p);
            });

            const time = document.createElement("div");
            time.className = "message-time";

            // 저장된 타임스탬프가 있으면 사용, 없으면 현재 시간 사용
            if (timestamp && timestamp instanceof Date) {
                const hours = timestamp.getHours().toString().padStart(2, "0");
                const minutes = timestamp
                    .getMinutes()
                    .toString()
                    .padStart(2, "0");
                time.textContent = `${hours}:${minutes}`;
            } else {
                time.textContent = this.getCurrentTime();
            }

            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
            messageDiv.appendChild(time);
        }

        this.chatMessages.appendChild(messageDiv);
    }

    async summarizeConversation() {
        const messageThreshold = 30;
        const messagesToSummarize = 15;

        if (this.messages.length > messageThreshold) {
            console.log("대화 요약을 시작합니다...");

            const messagesForSummary = this.messages.slice(
                0,
                messagesToSummarize,
            );
            const remainingMessages = this.messages.slice(messagesToSummarize);

            const summaryPrompt = `다음 대화 내용을 한두 문단으로 요약해줘. 이 요약은 대화의 맥락을 유지하기 위해 사용될 거야.\n\n---\n\n${messagesForSummary.map((m) => `${m.sender}: ${m.text}`).join("\n")}`;

            try {
                const result = await this.apiClient.chatCompletion(
                    [{ role: "user", content: summaryPrompt }],
                    {
                        model: "glm-4.6",
                        maxTokens: 1000, // 요약 토큰 제한을 1000으로 늘림
                        temperature: 0.5,
                    },
                );

                console.log(
                    "요약 API 응답 수신:",
                    JSON.stringify(result, null, 2),
                );

                if (
                    !result ||
                    !result.success ||
                    !result.data ||
                    !result.data.choices ||
                    result.data.choices.length === 0
                ) {
                    console.error("잘못된 요약 API 응답:", result);
                    return;
                }

                const choice = result.data.choices[0];
                let summaryText = "";

                if (choice && choice.message) {
                    console.log(
                        "요약 choice.message 객체:",
                        JSON.stringify(choice.message, null, 2),
                    );

                    if (
                        choice.message.content &&
                        typeof choice.message.content === "string"
                    ) {
                        summaryText = choice.message.content.trim();
                    } else if (
                        choice.message.reasoning_content &&
                        typeof choice.message.reasoning_content === "string"
                    ) {
                        summaryText = choice.message.reasoning_content.trim();
                        console.log(
                            "reasoning_content에서 요약 추출:",
                            summaryText,
                        );
                    } else {
                        // 다른 예상치 못한 구조에 대한 처리
                        const messageContent = choice.message;
                        if (
                            typeof messageContent === "object" &&
                            messageContent !== null
                        ) {
                            const possibleKeys = [
                                "content",
                                "reasoning_content",
                                "text",
                            ];
                            for (const key of possibleKeys) {
                                if (
                                    typeof messageContent[key] === "string" &&
                                    messageContent[key].trim()
                                ) {
                                    summaryText = messageContent[key].trim();
                                    console.log(
                                        `대체 키 '${key}'에서 요약 추출:`,
                                        summaryText,
                                    );
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    console.warn(
                        "choice 또는 choice.message가 없습니다:",
                        JSON.stringify(choice, null, 2),
                    );
                }

                if (summaryText) {
                    const summaryMessage = {
                        text: `지난 대화 요약:\n${summaryText}`,
                        sender: "system",
                        timestamp: new Date(),
                    };

                    this.messages = [summaryMessage, ...remainingMessages];
                    console.log("대화 요약 완료:", summaryText);
                    this.showNotification(
                        "이전 대화 내용이 요약되었습니다. 🧠",
                    );
                    this.reloadChatUI();
                } else {
                    console.error(
                        "최종적으로 요약 내용을 추출하지 못했습니다.",
                    );
                    console.log(
                        "전체 API 응답 데이터:",
                        JSON.stringify(result.data, null, 2),
                    );
                }
            } catch (error) {
                console.error("대화 요약 중 심각한 오류 발생:", error);
            }
        }
    }

    reloadChatUI() {
        // 화면의 메시지 모두 제거
        while (this.chatMessages.firstChild) {
            this.chatMessages.removeChild(this.chatMessages.firstChild);
        }

        // 현재 메시지 배열을 기반으로 화면 다시 그리기
        this.messages.forEach((msg) => {
            this.displayMessage(msg.text, msg.sender, msg.timestamp);
        });
    }

    // 대화 기록 초기화
    clearChatHistory() {
        if (
            confirm(
                "대화 기록을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            )
        ) {
            localStorage.removeItem("ai_companion_chat_history");
            this.messages = [];

            // 화면의 메시지 모두 제거
            while (this.chatMessages.firstChild) {
                this.chatMessages.removeChild(this.chatMessages.firstChild);
            }

            // 초기 환영 메시지 표시
            setTimeout(() => {
                this.addMessage(
                    "대화 기록이 삭제되었습니다. 새로운 시작을 응원합니다! 😊",
                    "ai",
                );
            }, 500);
        }
    }

    // 페르소나 변경 시 UI 업데이트
    updatePersonalityUI(previousPersonality, newPersonality) {
        // 상담가 모드로 변경된 경우
        if (newPersonality === "counselor") {
            this.setupCounselingUI();
            this.addMessage(
                "상담가 모드로 전환되었습니다. 😊 이제 당신의 가정 문제 전문 상담가로서 더 깊이 있는 조언과 지원을 제공해 드리겠습니다.\n\n이전 대화 내용을 모두 기억하고 있으니, 계속해서 상담을 이어나가셔도 좋습니다.",
                "ai",
            );
        }
        // 상담가 모드에서 다른 모드로 변경된 경우
        else if (previousPersonality === "counselor") {
            this.removeCounselingUI();
            this.addMessage(
                "일반 대화 모드로 전환되었습니다. 😊 이제 더 친근한 대화를 나눌 수 있습니다.\n\n이전 대화 내용은 모두 기억하고 있으니, 계속해서 대화를 이어나가셔도 좋습니다.",
                "ai",
            );
        }
    }

    // 상담가 모드 UI 제거
    removeCounselingUI() {
        // 기존 빠른 응답 버튼 내용을 일반 모드로 복원
        if (this.quickResponses) {
            const quickResponsesContent = this.quickResponses.querySelector(
                ".quick-responses-content",
            );
            if (quickResponsesContent) {
                quickResponsesContent.innerHTML = `
                    <button class="quick-btn" data-message="부부 관계가 힘들어요">부부 관계 힘듦</button>
                    <button class="quick-btn" data-message="자녀 교육 고민이 있어요">자녀 교육 고민</button>
                    <button class="quick-btn" data-message="가족 갈등을 해결하고 싶어요">가족 갈등 해결</button>
                    <button class="quick-btn" data-message="스트레스를 관리하고 싶어요">스트레스 관리</button>
                    <button class="quick-btn" data-message="대화 패턴을 분석해주세요">대화 패턴 분석</button>
                    <button class="quick-btn" data-message="오늘 하루 힘들었어요">오늘 하루 힘들었어요</button>
                    <button class="quick-btn" data-message="기분이 좋아요!">기분이 좋아요! 😊</button>
                    <button class="quick-btn" data-message="조언이 필요해요">조언이 필요해요</button>
                    <button class="quick-btn" data-message="그냥 이야기하고 싶어요">그냥 이야기하고 싶어요</button>
                `;

                // 헤더 텍스트도 원래대로
                const headerTitle = this.quickResponses.querySelector(
                    ".quick-responses-title",
                );
                if (headerTitle) {
                    headerTitle.innerHTML = `
                        <span>💬</span>
                        <span>상담 주제</span>
                    `;
                }

                // 이벤트 리스너 재설정
                const quickBtns =
                    quickResponsesContent.querySelectorAll(".quick-btn");
                quickBtns.forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        const message = e.target.getAttribute("data-message");
                        this.sendMessageWithText(message);
                    });
                });
            }
        }

        // 상담가 빠른 응답 버튼 제거 (이전 버전 호환성)
        const counselingQuickContainer = document.querySelector(
            ".counseling-quick-responses",
        );
        if (counselingQuickContainer) {
            counselingQuickContainer.remove();
        }

        // 상담가 기능 버튼 제거
        const toolsContainer = document.querySelector(".counseling-tools");
        if (toolsContainer) {
            toolsContainer.remove();
        }
    }

    // 상담가 모드 UI 설정
    setupCounselingUI() {
        // 상담가 모드 전용 빠른 응답 버튼 추가
        this.addCounselingQuickResponses();

        // 상담가 모드 전용 기능 버튼 추가
        this.addCounselingTools();
    }

    // 상담가 모드 빠른 응답 버튼 추가
    addCounselingQuickResponses() {
        // 기존 빠른 응답 버튼이 있으면 내용만 변경
        if (this.quickResponses) {
            const quickResponsesContent = this.quickResponses.querySelector(
                ".quick-responses-content",
            );
            if (quickResponsesContent) {
                // 기존 토글 구조 유지하면서 버튼만 교체
                quickResponsesContent.innerHTML = `
                    <button class="quick-btn" data-message="부부 관계가 힘들어요">부부 관계 힘듦</button>
                    <button class="quick-btn" data-message="자녀 교육 문제로 고민이에요">자녀 교육 고민</button>
                    <button class="quick-btn" data-message="가족 갈등을 해결하고 싶어요">가족 갈등 해결</button>
                    <button class="quick-btn" data-message="스트레스가 너무 심해요">스트레스 관리</button>
                    <button class="quick-btn" data-message="대화 패턴 분석해주세요">대화 패턴 분석</button>
                    <button class="quick-btn" data-message="이완 기법 알려주세요">이완 기법</button>
                    <button class="quick-btn" data-message="소통 가이드 보여주세요">소통 가이드</button>
                `;

                // 헤더 텍스트도 변경
                const headerTitle = this.quickResponses.querySelector(
                    ".quick-responses-title",
                );
                if (headerTitle) {
                    headerTitle.innerHTML = `
                        <span>💬</span>
                        <span>전문 상담 주제</span>
                    `;
                }

                // 이벤트 리스너 재설정
                const counselingBtns =
                    quickResponsesContent.querySelectorAll(".quick-btn");
                counselingBtns.forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        const message = e.target.getAttribute("data-message");
                        if (message === "대화 패턴 분석해주세요") {
                            this.providePersonalizedInsights();
                        } else {
                            this.sendMessageWithText(message);
                        }
                    });
                });

                return;
            }
        }

        // 기존 구조가 없는 경우 (이전 버전 호환성)
        const counselingQuickContainer = document.createElement("div");
        counselingQuickContainer.className = "counseling-quick-responses";
        counselingQuickContainer.innerHTML = `
            <button class="counseling-quick-btn" data-message="부부 관계가 힘들어요">부부 관계 힘듦</button>
            <button class="counseling-quick-btn" data-message="자녀 교육 문제로 고민이에요">자녀 교육 고민</button>
            <button class="counseling-quick-btn" data-message="가족 갈등을 해결하고 싶어요">가족 갈등 해결</button>
            <button class="counseling-quick-btn" data-message="스트레스가 너무 심해요">스트레스 관리</button>
            <button class="counseling-quick-btn" data-message="대화 패턴 분석해주세요">대화 패턴 분석</button>
        `;

        const chatContainer = document.querySelector(".chat-container");
        if (chatContainer) {
            chatContainer.insertBefore(
                counselingQuickContainer,
                chatContainer.querySelector(".input-container"),
            );
        }

        const counselingBtns = counselingQuickContainer.querySelectorAll(
            ".counseling-quick-btn",
        );
        counselingBtns.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const message = e.target.getAttribute("data-message");
                if (message === "대화 패턴 분석해주세요") {
                    this.providePersonalizedInsights();
                } else {
                    this.sendMessageWithText(message);
                }
            });
        });
    }

    // 상담가 모드 전용 기능 버튼 추가
    // 상담 도구 버튼 추가 (감정 일기 제거됨)
    addCounselingTools() {
        const toolsContainer = document.createElement("div");
        toolsContainer.className = "counseling-tools";
        toolsContainer.innerHTML = `
            <button class="counseling-tool-btn" id="relaxationBtn">🧘 이완 기법</button>
            <button class="counseling-tool-btn" id="communicationGuideBtn">💬 소통 가이드</button>
        `;

        // 헤더에 추가
        const header = document.querySelector(".header-content");
        if (header) {
            header.appendChild(toolsContainer);
        }

        // 이벤트 리스너 추가
        document
            .getElementById("relaxationBtn")
            .addEventListener("click", () => {
                this.showRelaxationTechniques();
            });

        document
            .getElementById("communicationGuideBtn")
            .addEventListener("click", () => {
                this.showCommunicationGuide();
            });
    }

    // 이완 기법 표시
    showRelaxationTechniques() {
        const relaxationContent = `
🧘 **스트레스 관리 및 이완 기법**

긴장된 마음과 몸을 이완시키는 데 도움이 되는 기법들입니다:

**1. 심호흡법 (4-7-8 기법):**
- 4초 동안 코로 숨을 들이쉬기
- 7초 동안 숨을 참기
- 8초 동안 입으로 숨을 내쉬기
- 3-5회 반복

**2. 점진적 근육 이완법:**
- 발끝부터 머리까지 각 근육 그룹을 5초간 긴장시키기
- 10초간 근육을 이완시키기
- 전신 근육 반복

**3. 명상 기법:**
- 편안한 자세로 앉기
- 눈을 감고 호흡에 집중하기
- 생각이 떠오르면 판단 없이 관찰하고 다시 호흡으로 돌아오기
- 5-10분간 지속

**4. 시각화 기법:**
- 평화로운 장소 상상하기 (해볏, 숲, 정원 등)
- 그 장소의 소리, 냄새, 감촉 느끼기
- 2-3분간 집중

이 기법들을 꾸준히 연습하면 스트레스 관리 능력이 향상됩니다.
        `;

        this.addMessage(relaxationContent, "ai");
    }

    // 소통 가이드 표시
    showCommunicationGuide() {
        const communicationContent = `
💬 **효과적인 소통 가이드**

가족 관계에서 건강한 소통은 갈등 예방과 해결의 핵심입니다:

**1. 경청 기술:**
- 상대방 말을 방해하지 않고 끝까지 듣기
- 이해했는지 확인하며 질문하기 ("그래서 ~라고 이해했어요")
- 판단이나 조언 없이 공감하기 ("마음이 많이 힘드셨겠어요")

**2. "나-전달법":**
- 비난 대신 자신의 감정과 생각 표현
- "당신은 ~" 대신 "나는 ~라고 느껴져" 표현
- 구체적인 행동과 그 결과 설명하기

**3. 갈등 해결 대화:**
- 한 사람씩 말할 시간 갖기
- 감정 먼저 공유하고 나중에 문제 논의하기
- 해결책 중심으로 대화하기

**4. 긍정적 피드백:**
- 칭찬은 구체적으로 ("설거지해줘서 고마워" vs "착하다")
- 감사 인사 자주 표현하기
- 작은 노력과 변화도 인정해주기

이 소통 기법들을 연습하면 관계 개선에 큰 도움이 됩니다.
        `;

        this.addMessage(communicationContent, "ai");
    }
}

// Memory MCP 서버 클라이언트
class MemoryMCPClient {
    constructor() {
        this.baseUrl = "http://localhost:3001/memory";
        this.isAvailable = false;
        this.userId = this.generateUserId();
    }

    // 사용자 ID 생성
    generateUserId() {
        const savedId = localStorage.getItem("ai_companion_user_id");
        if (savedId) {
            return savedId;
        }
        const newId =
            "user_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substr(2, 9);
        localStorage.setItem("ai_companion_user_id", newId);
        return newId;
    }

    // 서버 연결 상태 확인
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/status`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
                this.isAvailable = true;
                console.log("✅ Memory MCP 서버 연결됨");
                return true;
            }
        } catch (error) {
            console.log("❌ Memory MCP 서버 연결 실패:", error.message);
        }
        this.isAvailable = false;
        return false;
    }

    // 엔티티 생성
    async createEntity(name, entityType, observations) {
        if (!this.isAvailable) return false;

        try {
            const response = await fetch(`${this.baseUrl}/entities`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    entityType,
                    observations,
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                console.log("✅ 엔티티 생성됨:", name);
                return true;
            }
        } catch (error) {
            console.error("❌ 엔티티 생성 실패:", error);
        }
        return false;
    }

    // 엔티티 검색
    async searchNodes(query) {
        if (!this.isAvailable) return [];

        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                const data = await response.json();
                return data.nodes || [];
            }
        } catch (error) {
            console.error("❌ 검색 실패:", error);
        }
        return [];
    }

    // 관계 생성
    async createRelation(from, relationType, to) {
        if (!this.isAvailable) return false;

        try {
            const response = await fetch(`${this.baseUrl}/relations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from,
                    relationType,
                    to,
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                console.log("✅ 관계 생성됨:", from, "->", to);
                return true;
            }
        } catch (error) {
            console.error("❌ 관계 생성 실패:", error);
        }
        return false;
    }

    // 관찰 추가
    async addObservation(entityName, observation) {
        if (!this.isAvailable) return false;

        try {
            const response = await fetch(`${this.baseUrl}/observations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    entityName,
                    contents: [observation],
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                console.log("✅ 관찰 추가됨:", entityName);
                return true;
            }
        } catch (error) {
            console.error("❌ 관찰 추가 실패:", error);
        }
        return false;
    }

    // 그래프 전체 조회
    async readGraph() {
        if (!this.isAvailable) return null;

        try {
            const response = await fetch(`${this.baseUrl}/graph`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error("❌ 그래프 조회 실패:", error);
        }
        return null;
    }
}

// EXA MCP 서버를 통한 웹 검색 기능 (Netlify Function 프록시 사용)
class EXASearchManager {
    constructor() {
        this.proxyUrl = "/.netlify/functions/exa-search";
    }

    // 웹 검색 수행
    async webSearch(query, numResults = 5, options = {}) {
        try {
            const response = await fetch(this.proxyUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: query,
                    numResults: numResults,
                    ...options,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `EXA 프록시 검색 오류: ${response.status}`);
            }

            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error("EXA 웹 검색 오류:", error);
            // 챗봇 UI에 오류 메시지 표시
            if (window.aiCompanion) {
                window.aiCompanion.addMessage(`죄송해요, 외부 정보 검색 중 오류가 발생했어요. (오류: ${error.message})`, 'ai');
            }
            return [];
        }
    }

    // 코드 관련 검색 수행
    async codeSearch(query, numResults = 5) {
        return this.webSearch(query, numResults, {
            includeDomains: [
                "github.com",
                "stackoverflow.com",
                "medium.com",
                "dev.to",
            ],
            category: "code",
        });
    }
}

// AICompanion 클래스에 EXA 검색 기능 추가
AICompanion.prototype.initializeEXA = function () {
    this.exaManager = new EXASearchManager();
    this.exaAvailable = true; // 프록시를 사용하므로 항상 사용 가능으로 설정
};

// AICompanion 클래스에 상담 지식 베이스 기능 추가
AICompanion.prototype.getCounselingKnowledgeBase = function (userMessage) {
    const counselingKnowledge = {
        // 부부 관계 갈등
        marital_conflict: {
            keywords: [
                "부부",
                "남편",
                "아내",
                "결혼",
                "이혼",
                "갈등",
                "싸움",
                "다툼",
            ],
            knowledge: `
부부 관계 갈등 해결을 위한 전문 지식:

1. 건강한 소통 기술:
- "나-전달법" 사용: "당신은 항상~" 대신 "나는~라고 느껴져" 표현
- 적극적 경청: 상대방 말을 방해하지 않고 이해하려는 태도
- 비난 대신 행동 설명: "당신은 게을러" 대신 "설거지가 안 되어 있어서 실망했어"

2. 갈등 해결 4단계:
1) 문제 명확화: 구체적인 행동과 감정 표현
2) 감정 교환: 서로의 감정과 생각 공유
3) 해결책 탐색: 양쪽 모두 만족할 수 있는 대안 찾기
4) 합의 및 실행: 구체적인 행동 계획 수립

3. 사랑의 언어 이해하기:
- 인정하는 말: 칭찬과 격려의 표현
- 함께하는 시간: 온전한 집중과 교류
- 받는 선물: 생각과 배려의 상징
- 봉사하는 행동: 상대방을 위한 실질적 도움
- 신체 접촉: 애정과 안정감 표현
            `,
        },

        // 자녀 교육 문제
        parenting_issues: {
            keywords: ["자녀", "아이", "육아", "교육", "훈육", "성장", "발달"],
            knowledge: `
자녀 교육 및 양육을 위한 전문 지식:

1. 긍정적 양육 기술:
- 구체적 칭찬: "착하다" 대신 "장난감을 스스로 정리해서 정리해 고마워"
- 자연스러운 결과: 행동의 결과를 직접 경험하게 함
- 감정 이름 붙이기: "화가 났구나", "속상했겠다" 감정 인정

2. 연령별 발달 특징:
- 영유기(0-3세): 기본 신뢰감 형성, 애착 관계 중요
- 학령전기(3-6세): 자율성 발달, 사회적 규칙 학습
- 학령기(6-12세): 근면성 발달, 성취감 중요
- 청소년기(12-18세): 정체성 형성, 독립성 추구

3. 효과적인 훈육 방법:
- 일관성 있는 규칙과 한계 설정
- 예측 가능한 일상과 routines
- 긍정적 행동 강화와 관계 중심 접근
- 부모의 감정 조절과 모델링
            `,
        },

        // 가족 시스템 문제
        family_system: {
            keywords: ["가족", "시댁", "친정", "형제", "자매", "가정"],
            knowledge: `
가족 시스템 치료를 위한 전문 지식:

1. 가족 시스템 이해:
- 가족은 상호작용하는 하나의 시스템
- 한 구성원의 문제는 전체 가족의 문제
- 가족 규칙, 경계, 역할의 중요성

2. 건강한 가족 경계:
- 명확한 경계: 개인과 가족 간 균형
- 유연한 경계: 상황에 따른 적응 가능
- 세대 간 경계: 부부 관계 우선, 자녀는 자녀로

3. 가족 소통 패턴:
- 이중 구속 메시지 피하기
- 갈등 회적 vs 직접적 대화
- 비밀과 충성심 문제 다루기
            `,
        },

        // 심리적 정서 지원
        emotional_support: {
            keywords: ["우울", "불안", "스트레스", "감정", "마음", "정신"],
            knowledge: `
심리적 정서 지원을 위한 전문 지식:

1. 스트레스 관리 기술:
- 심호흡과 근육 이완법
- 인지 재구성: 부정적 생각 도전
- 문제 해결 기술: 문제 분석과 해결책 탐색
- 사회적 지지망 활용

2. 감정 조절 전략:
- 감정 인식과 표현
- 건강한 감정 조절 방법
- 충동적 반응 대신 선택적 반응
- 마음챙김과 현재 순간 집중

3. 정신 건강 증진:
- 규칙적인 운동과 수면
- 균형 잡힌 영양과 자기 관리
- 긍정적 관계와 사회적 연결
- 의미 있는 목표와 활동
            `,
        },
    };

    // 사용자 메시지에서 관련 키워드 검색
    for (const [category, data] of Object.entries(counselingKnowledge)) {
        if (data.keywords.some((keyword) => userMessage.includes(keyword))) {
            return data.knowledge;
        }
    }

    return null;
};

// AICompanion 클래스에 갈등 해결 기법과 감정 지원 기능 추가
AICompanion.prototype.getCounselingTechniques = function (userMessage) {
    const counselingTechniques = {
        // 부부 갈등 해결 기법
        marital_conflict_resolution: {
            keywords: ["부부 갈등", "남편 아내", "결혼 문제", "부부 싸움"],
            techniques: `
부부 갈등 해결을 위한 구체적 기법:

1. 감정 교환 기법 (Emotion Exchange Technique):
- 단계 1: 각자 5분간 자신의 감정과 생각 표현 (방해 금지)
- 단계 2: 상대방의 감정을 자신의 말로 다시 설명 (이해 확인)
- 단계 3: 감정의 원인과 배경 공유
- 단계 4: 서로의 감정을 인정하고 공감 표현

2. 문제 재구성화 (Problem Reframing):
- "당신 문제" → "우리 문제"로 전환
- 비난에서 벗어나 상황 객관적으로 묘사
- 긍정적 의도 찾기: "당신은 나를 무시한 게 아니라, 피곤해서 그랬구나"

3. 해결책 탐색 기법:
- 브레인스토밍: 비판 없이 10개 이상의 해결책 제시
- 윈-윈(Win-Win) 해결책: 양쪽 모두 만족할 수 있는 방법 찾기
- 작은 성공 경험: 당장 실천 가능한 작은 변화부터 시작
            `,
        },

        // 자녀 문제 해결 기법
        parenting_techniques: {
            keywords: ["자녀 문제", "육아", "훈육", "아이와 갈등"],
            techniques: `
자녀 문제 해결을 위한 구체적 기법:

1. 긍정적 훈육 기법 (Positive Discipline):
- 자연스러운 결과: 행동의 결과 직접 경험하게 함
- 논리적 결과: 행동과 관련된 적절한 결과 제시
- 일관성 있는 규칙: 예측 가능한 한계와 기대 설정

2. 효과적인 소통 기법:
- 능동적 경청: 아이의 말을 방해하지 않고 이해하려는 태도
- 개방형 질문: "왜 그랬어?" 대신 "무슨 일이 있었는지 이야기해줄래?"
- 감정 이름 붙이기: "화가 났구나", "속상했겠다" 감정 인정

3. 행동 수정 기법:
- 구체적 칭찬: "착하다" 대신 "장난감을 스스로 정리해서 고마워"
- 계획적 무시: 작은 부정적 행동은 관심 주지 않음
- 대체 행동 교육: 하지 말아야 할 행동 대신 해야 할 행동 가르침
            `,
        },

        // 감정 조절 기법
        emotional_regulation: {
            keywords: ["감정 조절", "화", "스트레스", "불안", "우울"],
            techniques: `
감정 조절을 위한 구체적 기법:

1. 즉각적 감정 조절 기법:
- 심호흡법: 4초 들이쉬기, 7초 참기, 8초 내쉬기
- 근육 이완법: 긴장된 근육을 의식적으로 이완시키기
- 5-4-3-2-1 기법: 5가지 볼 것, 4가지 만질 것, 3가지 들을 것, 2가지 맡을 것, 1가지 맛볼 것

2. 인지적 재구성 기법:
- 생각 도전하기: "정말 그럴까?", "다른 관점은 없을까?"
- 긍정적 대안 찾기: 부정적 생각을 긍정적 생각으로 대체
- 문제 해결적 사고: 문제를 위기가 아닌 도전으로 재해석

3. 장기적 감정 관리:
- 감정 패턴 기록하고 분석하기
- 스트레스 관리 계획: 스트레스 원인과 대처 방법 미리 계획
- 사회적 지지망 활용: 신뢰할 수 있는 사람과 감정 나누기
            `,
        },

        // 가족 관계 개선 기법
        family_relationship: {
            keywords: ["가족 관계", "시댁", "형제", "가족 갈등"],
            techniques: `
가족 관계 개선을 위한 구체적 기법:

1. 가족 회의 기법:
- 정기적인 가족 회의: 주 1회 30분 정해진 시간에
- 의제 정하기: 논의할 주제 미리 정하기
- 회의 규칙: 한 사람씩 말하기, 비난 금지, 해결책 중심

2. 경계 설정 기법:
- 개인 경계: 나의 시간과 공간 존중하기
- 부부 경계: 부부 관계를 최우선으로 생각하기
- 세대 경계: 조부모-부모-자녀 역할 명확히 하기

3. 긍정적 가족 문화:
- 감사 표현: 서로에게 고마운 점 매일 표현하기
- 함께하는 시간: 온전한 집중으로 함께하는 활동
- 가족 전통: 의미 있는 가족만의 행사와 기념일 만들기
            `,
        },
    };

    // 사용자 메시지에서 관련 키워드 검색
    for (const [category, data] of Object.entries(counselingTechniques)) {
        if (data.keywords.some((keyword) => userMessage.includes(keyword))) {
            return data.techniques;
        }
    }

    return null;
};

// 상담가 모드에서 추가 기법 정보 제공
AICompanion.prototype.enhanceCounselingResponse = function (
    userMessage,
    baseResponse,
) {
    if (this.settings.personality !== "counselor") {
        return baseResponse;
    }

    // 상담 기법 정보 가져오기
    const techniques = this.getCounselingTechniques(userMessage);

    if (techniques) {
        return `${baseResponse}\n\n💡 **전문가 조언:**\n${techniques}\n\n이 기법들을 꾸준히 실천하시면 관계 개선에 큰 도움이 될 것입니다. 처음에는 어색하게 느껴질 수 있지만, 꾸준한 연습을 통해 자연스러워질 수 있습니다. 필요할 때마다 저와 함께 연습해나가요! 💪`;
    }

    return baseResponse;
};

// 대화 기록 분석 및 맞춤형 조언 기능
AICompanion.prototype.analyzeConversationPatterns = function () {
    if (this.messages.length < 10) {
        return null; // 분석할 충분한 대화가 없음
    }

    const recentMessages = this.messages.slice(-20); // 최근 20개 메시지 분석
    const userMessages = recentMessages.filter((msg) => msg.sender === "user");
    const aiMessages = recentMessages.filter((msg) => msg.sender === "ai");

    // 감정 패턴 분석
    const emotionPatterns = {
        stress: ["스트레스", "힘들", "지쳤", "피곤", "번아웃"],
        conflict: ["싸움", "갈등", "다툼", "다툼", "맞았", "화"],
        sadness: ["슬프", "우울", "속상", "마음 아파", "눈물"],
        anxiety: ["불안", "걱정", "염려", "초조", "긴장"],
        happiness: ["기쁨", "행복", "좋아", "즐거워", "웃겼"],
    };

    // 주제 패턴 분석
    const topicPatterns = {
        marital: ["남편", "아내", "부부", "결혼", "이혼"],
        parenting: ["자녀", "아이", "육아", "교육", "훈육"],
        family: ["가족", "시댁", "부모", "형제", "자매"],
        work: ["직장", "일", "동료", "상사", "업무"],
        personal: ["나", "제", "저", "스스로", "자신"],
    };

    // 감정 빈도 계산
    const emotionFrequency = {};
    const topicFrequency = {};

    userMessages.forEach((msg) => {
        const text = msg.text.toLowerCase();

        // 감정 패턴 분석
        for (const [emotion, keywords] of Object.entries(emotionPatterns)) {
            if (keywords.some((keyword) => text.includes(keyword))) {
                emotionFrequency[emotion] =
                    (emotionFrequency[emotion] || 0) + 1;
            }
        }

        // 주제 패턴 분석
        for (const [topic, keywords] of Object.entries(topicPatterns)) {
            if (keywords.some((keyword) => text.includes(keyword))) {
                topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
            }
        }
    });

    // 가장 빈번한 감정과 주제 찾기
    const dominantEmotion = Object.keys(emotionFrequency).reduce(
        (a, b) => (emotionFrequency[a] > emotionFrequency[b] ? a : b),
        null,
    );
    const dominantTopic = Object.keys(topicFrequency).reduce(
        (a, b) => (topicFrequency[a] > topicFrequency[b] ? a : b),
        null,
    );

    return {
        emotionFrequency,
        topicFrequency,
        dominantEmotion,
        dominantTopic,
        messageCount: userMessages.length,
        timeSpan: this.getTimeSpan(recentMessages),
    };
};

// 대화 기록 시간 범위 계산
AICompanion.prototype.getTimeSpan = function (messages) {
    if (messages.length < 2) return null;

    const timestamps = messages.map((msg) => new Date(msg.timestamp));
    const minTime = new Date(Math.min(...timestamps));
    const maxTime = new Date(Math.max(...timestamps));

    const diffMs = maxTime - minTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );

    return { days: diffDays, hours: diffHours };
};

// 맞춤형 조언 생성
AICompanion.prototype.generatePersonalizedAdvice = function (analysis) {
    if (!analysis) return null;

    const { dominantEmotion, dominantTopic, emotionFrequency, topicFrequency } =
        analysis;

    let advice = "";

    // 감정 기반 조언
    if (dominantEmotion === "stress") {
        advice += `최근 대화에서 스트레스 관련 표현이 많이 나타났습니다. 스트레스 관리를 위한 몇 가지 방법을 제안해드릴게요:\n`;
        advice += `- 매일 10분 명상이나 심호흡 연습\n`;
        advice += `- 주 3회 이상 가벼운 운동\n`;
        advice += `- 충분한 수면과 규칙적인 생활 리듬\n\n`;
    } else if (dominantEmotion === "conflict") {
        advice += `관계 갈등에 대한 고민이 많으신 것 같습니다. 갈등을 건강하게 해결하기 위한 접근법:\n`;
        advice += `- '나-전달법'으로 감정 표현하기\n`;
        advice += `- 상대방 입장에서 생각해보기\n`;
        advice += `- 문제가 아닌 '우리'의 관계로 접근하기\n\n`;
    } else if (dominantEmotion === "sadness") {
        advice += `마음이 힘든 시간을 보내고 계시는군요. 감정을 잘 돌보기 위한 제안:\n`;
        advice += `- 감정을 표현하고 기록하기\n`;
        advice += `- 신뢰할 수 있는 사람과 대화 나누기\n`;
        advice += `- 전문가 상담 고려하기\n\n`;
    }

    // 주제 기반 조언
    if (dominantTopic === "marital") {
        advice += `부부 관계에 대한 고민이 깊으신 것 같습니다. 관계 개선을 위한 구체적 방법:\n`;
        advice += `- 주 1회 부부 데이트 시간 갖기\n`;
        advice += `- 감정 교환 시간 정기적으로 갖기\n`;
        advice += `- 서로의 장점 칭찬하기\n\n`;
    } else if (dominantTopic === "parenting") {
        advice += `자녀 양육에 대한 고민이 많으신 것 같습니다. 긍정적 양육을 위한 제안:\n`;
        advice += `- 아이의 감정을 인정하고 이름 붙여주기\n`;
        advice += `- 일관성 있는 규칙과 한계 설정하기\n`;
        advice += `- 부모 자신의 감정 조절 먼저 하기\n\n`;
    }

    return advice;
};

// 상담가 모드에서 대화 패턴 분석 후 맞춤형 조언 제공
AICompanion.prototype.providePersonalizedInsights = function () {
    if (this.settings.personality !== "counselor") return;

    const analysis = this.analyzeConversationPatterns();
    if (!analysis) return;

    const personalizedAdvice = this.generatePersonalizedAdvice(analysis);
    if (!personalizedAdvice) return;

    const insightMessage = `📊 **대화 패턴 분석 결과:**\n\n${personalizedAdvice}꾸준한 노력과 변화를 위해 제가 계속 함께하겠습니다. 필요할 때마다 이 분석을 요청해주세요! 🌱`;

    this.addMessage(insightMessage, "ai");
};

// Memory MCP 서버 연결 및 활용 방법 안내
AICompanion.prototype.setupMemoryMCP = function () {
    // Memory MCP 서버 연결 상태 확인
    const checkMemoryMCP = () => {
        // Memory MCP 서버가 실행 중인지 확인
        fetch("http://localhost:3001/memory", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((response) => {
                if (response.ok) {
                    console.log("Memory MCP 서버가 실행 중입니다.");
                    this.addMessage(
                        'Memory MCP 서버가 실행 중입니다. 😊\n\n**Memory MCP 활용 방법:**\n\n1. **대화 기록 저장:**\n   - 자동으로 모든 대화가 Memory MCP 서버에 저장됩니다.\n   - 수동으로 저장하려면 "대화 기록을 Memory에 저장해줘"라고 입력해주세요.\n\n2. **대화 기록 검색:**\n   - "이전 대화 내용 검색해줘" 또는 "OOO에 대해 이야기했던 거 알려줘"라고 입력해주세요.\n   - 예: "스트레스 관리에 대해 이야기했던 거 알려줘"\n\n3. **대화 기록 요약:**\n   - "최근 대화 내용 요약해줘"라고 입력해주세요.\n   - 주요 주제와 감정 패턴을 요약해드립니다.\n\n4. **맞춤형 조언:**\n   - "나에게 맞춤형 조언 해줘"라고 입력해주세요.\n   - 이전 대화 내용을 바탕으로 개인화된 조언을 제공합니다.\n\nMemory MCP 서버를 통해 더 지능적인 대화 경험을 즐겨보세요! 🧠',
                        "ai",
                    );
                } else {
                    console.log("Memory MCP 서버가 실행 중이 아닙니다.");
                    this.addMessage(
                        "Memory MCP 서버가 실행 중이 아닙니다. 🤔\n\n**Memory MCP 서버 실행 방법:**\n\n**터미널에서 직접 실행:**\n   - 터미널을 열고 다음 명령을 입력합니다:\n   ```bash\n   npx @modelcontextprotocol/server-memory\n   ```\n\n**서버 확인:**\n   - 서버가 실행되면 http://localhost:3001 에서 접속할 수 있습니다.\n   - 브라우저에서 접속하여 Memory MCP 서버 상태를 확인할 수 있습니다.\n\nMemory MCP 서버를 실행하면 더 지능적인 대화 경험을 즐길 수 있습니다! 🧠",
                        "ai",
                    );
                }
            })
            .catch((error) => {
                console.error("Memory MCP 서버 확인 오류:", error);
                this.addMessage(
                    "Memory MCP 서버 확인 중 오류가 발생했습니다. 🙏\n\n서버가 실행 중인지 수동으로 확인해주세요.\n\n**수동 확인 방법:**\n\n1. 브라우저에서 http://localhost:3001 접속\n2. 서버 상태 확인\n\nMemory MCP 서버를 실행하면 더 지능적인 대화 경험을 즐길 수 있습니다! 🧠",
                    "ai",
                );
            });
    };

    // 초기 확인 및 주기적 확인 (30초마다)
    checkMemoryMCP();
    setInterval(checkMemoryMCP, 30000);
};

// 대화 기록 시간 범위 계산
AICompanion.prototype.getTimeSpan = function (messages) {
    if (messages.length < 2) return null;

    const timestamps = messages.map((msg) => new Date(msg.timestamp));
    const minTime = new Date(Math.min(...timestamps));
    const maxTime = new Date(Math.max(...timestamps));

    const diffMs = maxTime - minTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );

    return { days: diffDays, hours: diffHours };
};

// 맞춤형 조언 생성
AICompanion.prototype.generatePersonalizedAdvice = function (analysis) {
    if (!analysis) return null;

    const { dominantEmotion, dominantTopic, emotionFrequency, topicFrequency } =
        analysis;

    let advice = "";

    // 감정 기반 조언
    if (dominantEmotion === "stress") {
        advice += `최근 대화에서 스트레스 관련 표현이 많이 나타났습니다. 스트레스 관리를 위한 몇 가지 방법을 제안해드릴게요:\n`;
        advice += `- 매일 10분 명상이나 심호흡 연습\n`;
        advice += `- 주 3회 이상 가벼운 운동\n`;
        advice += `- 충분한 수면과 규칙적인 생활 리듬\n\n`;
    } else if (dominantEmotion === "conflict") {
        advice += `관계 갈등에 대한 고민이 많으신 것 같습니다. 갈등을 건강하게 해결하기 위한 접근법:\n`;
        advice += `- '나-전달법'으로 감정 표현하기\n`;
        advice += `- 상대방 입장에서 생각해보기\n`;
        advice += `- 문제가 아닌 '우리'의 관계로 접근하기\n\n`;
    } else if (dominantEmotion === "sadness") {
        advice += `마음이 힘든 시간을 보내고 계시는군요. 감정을 잘 돌보기 위한 제안:\n`;
        advice += `- 감정을 표현하고 기록하기\n`;
        advice += `- 신뢰할 수 있는 사람과 대화 나누기\n`;
        advice += `- 전문가 상담 고려하기\n\n`;
    }

    // 주제 기반 조언
    if (dominantTopic === "marital") {
        advice += `부부 관계에 대한 고민이 깊으신 것 같습니다. 관계 개선을 위한 구체적 방법:\n`;
        advice += `- 주 1회 부부 데이트 시간 갖기\n`;
        advice += `- 감정 교환 시간 정기적으로 갖기\n`;
        advice += `- 서로의 장점 칭찬하기\n\n`;
    } else if (dominantTopic === "parenting") {
        advice += `자녀 양육에 대한 고민이 많으신 것 같습니다. 긍정적 양육을 위한 제안:\n`;
        advice += `- 아이의 감정을 인정하고 이름 붙여주기\n`;
        advice += `- 일관성 있는 규칙과 한계 설정하기\n`;
        advice += `- 부모 자신의 감정 조절 먼저 하기\n\n`;
    }

    return advice;
};

// 상담가 모드에서 대화 패턴 분석 후 맞춤형 조언 제공
AICompanion.prototype.providePersonalizedInsights = function () {
    if (this.settings.personality !== "counselor") return;

    const analysis = this.analyzeConversationPatterns();
    if (!analysis) return;

    const personalizedAdvice = this.generatePersonalizedAdvice(analysis);
    if (!personalizedAdvice) return;

    const insightMessage = `📊 **대화 패턴 분석 결과:**\n\n${personalizedAdvice}꾸준한 노력과 변화를 위해 제가 계속 함께하겠습니다. 필요할 때마다 이 분석을 요청해주세요! 🌱`;

    this.addMessage(insightMessage, "ai");
};

AICompanion.prototype.searchWithExa = async function (query) {
    if (!this.exaAvailable) {
        this.initializeEXA();
    }

    try {
        // 가정 문제 관련 키워드 포함 여부 확인
        const counselingKeywords = [
            "가정",
            "부부",
            "아내",
            "남편",
            "자녀",
            "아이",
            "갈등",
            "갈등",
            "문제",
            "상담",
            "결혼",
            "이혼",
            "육아",
        ];
        const isCounselingQuery = counselingKeywords.some((keyword) =>
            query.includes(keyword),
        );

        if (isCounselingQuery) {
            // 가정 상담 관련 검색
            const searchQuery = `${query} 가정 상담 심리학 해결 방안`;
            return await this.exaManager.webSearch(searchQuery, 3);
        } else {
            // 일반 검색
            return await this.exaManager.webSearch(query, 3);
        }
    } catch (error) {
        console.error("EXA 검색 중 오류:", error);
        return [];
    }
};

// Memory MCP 서버 상태 확인
AICompanion.prototype.checkMemoryMCPServer = async function () {
    const isConnected = await this.memoryClient.checkConnection();
    this.memoryMCPAvailable = isConnected;

    if (isConnected) {
        console.log("✅ Memory 시스템 연결됨 - 자동으로 대화를 기억합니다");
        // 자동으로 작동하므로 별도 메시지 불필요
    } else {
        console.log("⚠️ Memory 서버 연결 실패 - 일반 대화 모드로 작동");
        // 오류 메시지 표시하지 않음 (서버 없어도 작동)
    }

    return isConnected;
};

// 사용자 ID 가져오기
AICompanion.prototype.getUserId = function () {
    return this.memoryClient.userId;
};

// 대화 쌍(사용자 메시지 + AI 응답)을 Memory에 저장
AICompanion.prototype.saveConversationPair = async function (userMessage, aiMessage) {
    if (!this.memoryMCPAvailable) return false;

    try {
        // NetlifyMemoryClient에 대화 저장
        const saved = await this.memoryClient.saveConversation(
            userMessage.text,  // 사용자 메시지
            aiMessage.text,    // AI 응답
            {
                sender: "user+ai",
                emotion: this.memoryClient.detectEmotion?.(userMessage.text) || "중립",
                topic: this.memoryClient.detectTopic?.(userMessage.text) || "일반",
                timestamp: aiMessage.timestamp.toISOString(),
            },
        );

        if (saved) {
            console.log(
                "💾 Memory 대화 쌍 저장 성공:",
                "사용자:", userMessage.text.substring(0, 30) + "...",
                "AI:", aiMessage.text.substring(0, 30) + "..."
            );
        }

        return saved;
    } catch (error) {
        console.error("Memory 대화 쌍 저장 오류:", error);
        return false;
    }
};

// 개별 메시지를 Memory에 저장 (USER 메시지 전용)
AICompanion.prototype.saveMessageToMemory = async function (message) {
    if (!this.memoryMCPAvailable) return false;
    if (message.sender !== "user") return false; // 사용자 메시지 فقط 저장

    try {
        // 시스템 메시지 및 자동 응답 필터링
        const text = message.text || '';
        const isSystemMessage =
            text.includes('🔄 자동으로 응답을 이어받겠습니다') ||
            text.includes('계속해서 응답을 받으시겠습니까') ||
            text.includes('계속해') ||
            text.includes('Memory') ||
            text.includes('기록') ||
            text.includes('저장') ||
            text.includes('삭제') ||
            text.includes('조회') ||
            text.includes('검색') ||
            text.includes('분석') ||
            text.includes('요약') ||
            text.includes('조정') ||
            text.includes('자동') ||
            text.includes('계속') ||
            text.includes('이어받') ||
            text.includes('기억') ||
            text.includes('저장된') ||
            text.includes('대화 기록') ||
            text.includes('패턴 분석') ||
            text.includes('분석 결과') ||
            text.includes('대화 내용') ||
            text.includes('관련 대화') ||
            text.includes('Memory에서') ||
            text.includes('조회하고 있습니다') ||
            text.includes('저장하고 있습니다') ||
            text.includes('삭제하고 있습니다') ||
            text.includes('검색하고 있습니다') ||
            text.includes('분석하고 있습니다') ||
            text.includes('확인하고 있습니다') ||
            text.includes('준비하고 있습니다');

        // 시스템 메시지는 저장하지 않음
        if (isSystemMessage) {
            console.log('📚 시스템 메시지이므로 Memory 저장하지 않음:', text.substring(0, 50));
            return false;
        }

        // 사용자 메시지만 저장 (ai_message는 비워둠 - AI 응답을 기다림)
        const saved = await this.memoryClient.saveConversation(
            message.text,
            null, // AI 응답은 아직 없음 (나중에 saveConversationPair에서 채워짐)
            {
                sender: message.sender,
                emotion: this.memoryClient.detectEmotion?.(message.text) || "중립",
                topic: this.memoryClient.detectTopic?.(message.text) || "일반",
                timestamp: message.timestamp.toISOString(),
            },
        );

        if (saved) {
            console.log(
                "💾 Memory 사용자 메시지 저장 성공:",
                message.text.substring(0, 30) + "...",
            );
        }

        return saved;
    } catch (error) {
        console.error("Memory 저장 오류:", error);
        return false;
    }
};

// 최근 대화 가져오기 함수 추가
AICompanion.prototype.getRecentConversations = async function (limit = 5) {
    if (!this.memoryMCPAvailable) return [];

    try {
        const conversations =
            await this.memoryClient.getRecentConversations(limit);
        return conversations || [];
    } catch (error) {
        console.error("최근 대화 조회 실패:", error);
        return [];
    }
};

// 레거시 Memory MCP 방식 (사용 안 함, 호환성 유지)
AICompanion.prototype.saveMessageToMemoryLegacy = async function (message) {
    if (!this.memoryMCPAvailable) return false;

    try {
        // 메시지 분석하여 주제 추출
        const topics = this.analyzeTopics(message.text);
        const emotions = this.analyzeEmotions(message.text);

        // 엔티티명 생성
        const entityName = `대화_${this.userId}_${Date.now()}`;

        // 관찰 데이터 생성
        const observations = [
            `타임스탬프: ${message.timestamp.toISOString()}`,
            `송신자: ${message.sender}`,
            `내용: ${message.text}`,
            `주제: ${topics.join(", ")}`,
            `감정: ${emotions.join(", ")}`,
        ];

        // 엔티티 생성
        await this.memoryClient.createEntity?.(
            entityName,
            "대화",
            observations,
        );

        // 주제 엔티티와 관계 생성
        for (const topic of topics) {
            const topicEntityName = `주제_${topic}`;
            await this.memoryClient.createEntity(topicEntityName, "주제", [
                `주제: ${topic}`,
            ]);
            await this.memoryClient.createRelation(
                entityName,
                "belongs_to",
                topicEntityName,
            );
        }

        // 감정 엔티티와 관계 생성
        for (const emotion of emotions) {
            const emotionEntityName = `감정_${emotion}`;
            await this.memoryClient.createEntity(emotionEntityName, "감정", [
                `감정: ${emotion}`,
            ]);
            await this.memoryClient.createRelation(
                entityName,
                "expresses",
                emotionEntityName,
            );
        }

        // 사용자 엔티티와 관계 생성
        const userEntityName = `사용자_${this.userId}`;
        await this.memoryClient.createEntity(userEntityName, "사용자", [
            `사용자 ID: ${this.userId}`,
        ]);
        await this.memoryClient.createRelation(
            userEntityName,
            "has_conversation",
            entityName,
        );

        return true;
    } catch (error) {
        console.error("메모리 저장 실패:", error);
        return false;
    }
};

// Memory에서 대화 검색
AICompanion.prototype.searchConversationsInMemory = async function (query) {
    if (!this.memoryMCPAvailable) return [];

    try {
        // NetlifyMemoryClient 기반 검색 (키워드 배열로 전달)
        const keywords = this.extractKeywords(query);
        const results = await this.memoryClient.searchConversations?.(keywords, 10);
        return results || [];
    } catch (error) {
        console.error("대화 검색 실패:", error);
        return [];
    }
};

// Memory에서 주제별 대화 검색
AICompanion.prototype.searchConversationsByTopic = async function (topic) {
    if (!this.memoryMCPAvailable) return [];

    try {
        // NetlifyMemoryClient에서는 키워드 검색 사용
        const results = await this.memoryClient.searchConversations([topic], 20);
        return results || [];
    } catch (error) {
        console.error("주제별 검색 실패:", error);
        return [];
    }
};

// Memory에서 대화 요약 생성
AICompanion.prototype.summarizeConversationsInMemory = async function () {
    if (!this.memoryMCPAvailable) return null;

    try {
        // NetlifyMemoryClient에서는 generateReport 사용
        const report = await this.memoryClient.generateReport();
        if (!report) return null;

        // 주제별 통계와 감정별 통계를 기존 형식에 맞게 변환
        const topicCount = report.topicDistribution || {};
        const emotionCount = report.emotionDistribution || {};

        return {
            totalConversations: report.totalConversations || 0,
            recentConversations: report.totalConversations || 0,
            topTopics: Object.keys(topicCount).sort(
                (a, b) => topicCount[b] - topicCount[a],
            ),
            topEmotions: Object.keys(emotionCount).sort(
                (a, b) => emotionCount[b] - emotionCount[a],
            ),
            topicCount,
            emotionCount,
        };
    } catch (error) {
        console.error("대화 요약 실패:", error);
        return null;
    }
};

// 메시지에서 주제 분석
AICompanion.prototype.analyzeTopics = function (text) {
    const topicKeywords = {
        부부관계: ["남편", "아내", "부부", "결혼", "배우자"],
        자녀교육: ["자녀", "아이", "양육", "육아", "교육", "훈육"],
        가족갈등: ["가족", "시댁", "친정", "형제", "자매", "시어머니"],
        직장: ["직장", "동료", "상사", "업무"],
        스트레스: ["스트레스", "피곤", "지침"],
        우울: ["우울", "슬픔", "속상"],
        불안: ["불안", "걱정", "염려"],
    };

    const topics = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some((keyword) => text.includes(keyword))) {
            topics.push(topic);
        }
    }

    return topics.length > 0 ? topics : ["일반"];
};

// 메시지에서 감정 분석
AICompanion.prototype.analyzeEmotions = function (text) {
    const emotionKeywords = {
        행복: ["기쁨", "행복", "좋아", "즐거워"],
        슬픔: ["슬프", "우울", "속상", "눈물"],
        화: ["화", "짜증", "분노"],
        불안: ["불안", "걱정", "염려"],
        스트레스: ["스트레스", "피곤", "지침"],
        평온: ["평온", "차분"],
        감사: ["고마워", "감사"],
    };

    const emotions = [];
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        if (keywords.some((keyword) => text.includes(keyword))) {
            emotions.push(emotion);
        }
    }

    return emotions.length > 0 ? emotions : ["중립"];
};

// 메시지에서 키워드 추출
AICompanion.prototype.extractKeywords = function (text) {
    const stopWords = new Set([
        "이거",
        "그거",
        "저거",
        "뭐",
        "왜",
        "어떻게",
        "무엇",
        "오늘",
        "어제",
        "내일",
        "지금",
        "아침",
        "점심",
        "저녁",
        "그리고",
        "그런데",
        "그래서",
        "하지만",
        "또한",
        "我",
        "私",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl ",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl ",
        " Pfl",
        " Pfl",
        " Pfl ",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl ",
        " Pfl",
        " Pfl",
        " Pfl ",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl",
        " Pfl ",
        " Pfl",
        " Pfl",
        " Pfl ",
        " Pfl",
    ]);

    // 특수문자 제거 및 단어 분리
    const words = text
        .replace(/[^\w\s가-힣]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 1 && !stopWords.has(word));

    // 의미있는 단어 필터링 (2자 이상, 한글/영어/숫자 조합)
    const meaningfulWords = words.filter((word) => {
        return /^[가-힣a-zA-Z0-9]{2,}$/.test(word);
    });

    // 중복 제거 후 상위 5개 반환
    return [...new Set(meaningfulWords)].slice(0, 5);
};

// Memory 기반 맞춤형 조언
AICompanion.prototype.getPersonalizedAdviceFromMemory = async function () {
    const summary = await this.summarizeConversationsInMemory();
    if (!summary) return null;

    let advice = "";

    // 상위 주제 기반 조언
    if (summary.topTopics.length > 0) {
        const topTopic = summary.topTopics[0];
        advice += `📊 **최근 대화 분석 결과**\n\n`;
        advice += `가장 많이 언급한 주제: **${topTopic}**\n`;

        if (topTopic === "스트레스") {
            advice += `\n💡 **스트레스 관리 맞춤형 조언:**\n`;
            advice += `- 이전 대화에서 스트레스 언급이 많으셨네요. 스트레스 관리 방법을 함께 알아보시겠어요?\n`;
            advice += `- 4-7-8 호흡법, 점진적 근육 이완법 등을 추천드립니다.\n`;
        } else if (topTopic === "부부관계") {
            advice += `\n💡 **부부 관계 개선 조언:**\n`;
            advice += `- 부부 관계에 대한 고민이 많으시네요. '나-전달법'을 활용해 보세요.\n`;
            advice += `- 감정 교환 시간과 긍정적 피드백을 실천해보세요.\n`;
        } else if (topTopic === "자녀교육") {
            advice += `\n💡 **긍정적 양육 조언:**\n`;
            advice += `- 자녀 양육에 대한 고민이 깊으시네요. 아이의 감정을 인정하고 칭찬을 구체적으로 표현하세요.\n`;
            advice += `- 일관성 있는 규칙과 한계를 설정하는 것이 중요해요.\n`;
        }
    }

    // 감정 패턴 기반 조언
    if (summary.topEmotions.length > 0) {
        const topEmotion = summary.topEmotions[0];
        if (topEmotion === "스트레스" || topEmotion === "불안") {
            advice += `\n🧘 **정서 관리 팁:**\n`;
            advice += `- 최근 부정적 감정이 많으셨네요.深呼吸과 명상을 통해 마음을 진정시켜보세요.\n`;
            advice += `- 신뢰할 수 있는 사람과 대화하는 것도 좋은 방법입니다.\n`;
        }
    }

    return advice;
};

// Memory 관련 명령어 처리
AICompanion.prototype.handleMemoryCommand = async function (userMessage) {
    const message = userMessage.toLowerCase();

    // *** Memory 관련 모든 명령어 제거 ***
    // Memory 키워드가 들어와도 일반 대화로 처리됨
    // Memory 기능은 설정에서 별도 버튼으로 구현됨

    return false; // Memory 명령어 없음 - 일반 대화로 처리

    // "이전 대화 검색해줘" - Memory 관련 키워드가 있을 때만
    if (
        (message.includes("memory") || message.includes("기록") || message.includes("저장된")) &&
        message.includes("검색")
    ) {
        this.addMessage(
            "Memory에서 이전 대화 내용을 검색하고 있습니다... 🔍",
            "ai",
        );

        // 키워드 추출 (주제어 제외)
        const keywords = message
            .replace(/memory|기록|저장된|검색|이전|과거|대화|내용/gi, "")
            .trim();

        if (keywords.length > 0) {
            const results = await this.searchConversationsInMemory(keywords);
            if (results.length > 0) {
                let response = `📚 **${keywords} 관련 이전 대화 내용:**\n\n`;
                results.slice(0, 3).forEach((conv, index) => {
                    const date = new Date(conv.timestamp).toLocaleString('ko-KR');
                    response += `${index + 1}. **사용자:** ${conv.user_message}\n`;
                    response += `   **AI:** ${conv.ai_message ? conv.ai_message.substring(0, 100) + '...' : 'AI 응답'}\n`;
                    response += `   (${date})\n\n`;
                });
                this.addMessage(response, "ai");
            } else {
                this.addMessage(
                    `❌ '${keywords}' 관련 대화를 찾을 수 없습니다. 다른 키워드로 검색해보세요. 🤔`,
                    "ai",
                );
            }
        } else {
            const results = await this.memoryClient.getRecentConversations(5);
            if (results.length > 0) {
                let response = `📚 **최근 대화 기록:**\n\n`;
                results.forEach((conv, index) => {
                    response += `${index + 1}. ${conv.user_message.substring(0, 80)}...\n`;
                });
                this.addMessage(response, "ai");
            } else {
                this.addMessage(
                    "저장된 대화 기록이 없습니다. 먼저 대화를 저장해주세요. 😊",
                    "ai",
                );
            }
        }
        return true;
    }

    // "이전 대화 내용을 알려줘" - Memory 조회 전용 ( Memory 키워드 필수 )
    if (
        (message.includes("memory") || message.includes("기록") || message.includes("저장된") || message.includes("뭐") || message.includes("어떤")) &&
        (message.includes("보여줘") || message.includes("봐줘") || message.includes("내용") || message.includes("있어"))
    ) {
        this.addMessage(
            "Memory에 저장된 대화 기록을 조회하고 있습니다... 📚",
            "ai",
        );

        try {
            // NetlifyMemoryClient에서는 getRecentConversations 사용
            const conversations = await this.memoryClient.getRecentConversations(20);

            if (conversations && conversations.length > 0) {
                let response = "📚 **Memory에 저장된 대화 기록:**\n\n";

                // 실제 대화만 필터링 (Memory 명령어 응답 제외)
                const realConversations = conversations.filter(conv => {
                    const userMsg = conv.user_message || '';
                    const aiMsg = conv.ai_message || '';

                    // Memory 명령어 응답이거나 시스템 메시지 필터링
                    return !(
                        userMsg.includes('Memory') ||
                        userMsg.includes('기록') ||
                        userMsg.includes('저장') ||
                        userMsg.includes('삭제') ||
                        userMsg.includes('조회') ||
                        userMsg.includes('검색') ||
                        aiMsg.includes('Memory') ||
                        aiMsg.includes('기록') ||
                        aiMsg.includes('저장') ||
                        aiMsg.includes('삭제') ||
                        aiMsg.includes('조회') ||
                        aiMsg.includes('검색') ||
                        aiMsg.includes('조회하고 있습니다') ||
                        aiMsg.includes('저장하고 있습니다') ||
                        aiMsg.includes('삭제하고 있습니다') ||
                        aiMsg.includes('검색하고 있습니다') ||
                        aiMsg.includes('패턴 분석') ||
                        aiMsg.includes('분석 결과') ||
                        aiMsg.includes('요약')
                    );
                });

                if (realConversations.length > 0) {
                    realConversations.forEach((conv, index) => {
                        const date = new Date(conv.timestamp).toLocaleString('ko-KR');
                        response += `**[대화 ${index + 1}]**\n`;
                        response += `**사용자:** ${conv.user_message}\n`;
                        response += `**AI:** ${conv.ai_message}\n`;
                        response += `**시간:** ${date}\n`;
                        if (conv.topic) {
                            response += `**주제:** ${conv.topic}\n`;
                        }
                        if (conv.emotion) {
                            response += `**감정:** ${conv.emotion}\n`;
                        }
                        response += "\n";
                    });

                    this.addMessage(response, "ai");
                } else {
                    this.addMessage(
                        "Memory에 저장된 실제 대화가 없습니다. 일반 대화만 저장되었고 Memory 명령어 응답은 저장되지 않았어요. 😊",
                        "ai",
                    );
                }
            } else {
                this.addMessage(
                    "Memory에 저장된 기록이 없습니다. 일반 대화를 나눠보세요! 😊",
                    "ai",
                );
            }
        } catch (error) {
            console.error("Memory 조회 실패:", error);
            this.addMessage("Memory 조회 중 오류가 발생했습니다. 😥", "ai");
        }
        return true;
    }

    // "최근 대화 요약해줘" - Memory 관련 키워드가 있을 때만 Memory 패턴 분석 실행
    if (
        (message.includes("memory") || message.includes("기록") || message.includes("저장된")) &&
        message.includes("요약")
    ) {
        this.addMessage("Memory에서 최근 대화 패턴을 분석하고 있습니다... 📊", "ai");

        const summary = await this.summarizeConversationsInMemory();
        if (summary) {
            let response = `📊 **Memory 기반 대화 패턴 분석 결과**\n\n`;
            response += `• 총 대화 횟수: ${summary.totalConversations}회\n`;
            response += `• 최근 분석 대화: ${summary.recentConversations}개\n\n`;

            if (summary.topTopics.length > 0) {
                response += `🎯 **주요 대화 주제:**\n`;
                summary.topTopics.slice(0, 3).forEach((topic, index) => {
                    response += `${index + 1}. ${topic} (${summary.topicCount[topic]}회)\n`;
                });
                response += "\n";
            }

            if (summary.topEmotions.length > 0) {
                response += `💭 **감정 패턴:**\n`;
                summary.topEmotions.slice(0, 3).forEach((emotion, index) => {
                    response += `${index + 1}. ${emotion} (${summary.emotionCount[emotion]}회)\n`;
                });
            }

            this.addMessage(response, "ai");
        } else {
            this.addMessage(
                "Memory 분석을 위한 데이터가 부족합니다. 더 많은 대화를 나눠보세요! 😊",
                "ai",
            );
        }
        return true;
    }

    // "맞춤형 조언 해줘" - Memory 관련 키워드가 있을 때만 Memory 기반 조언 제공
    if (
        (message.includes("memory") || message.includes("기록") || message.includes("저장된")) &&
        message.includes("맞춤형") &&
        message.includes("조언")
    ) {
        this.addMessage(
            "Memory에 저장된 이전 대화 내용을 바탕으로 맞춤형 조언을 준비하고 있습니다... 🎯",
            "ai",
        );

        const advice = await this.getPersonalizedAdviceFromMemory();
        if (advice) {
            this.addMessage(advice, "ai");
        } else {
            this.addMessage(
                "Memory 기반 맞춤형 조언을 제공하기 위한 데이터가 부족합니다. 더 많은 대화를 나눠보세요! 😊",
                "ai",
            );
        }
        return true;
    }

    // "전체 기록 보기" - Memory 관련 키워드가 있을 때만 Memory 조회 기능 실행
    if (
        (message.includes("memory") || message.includes("기록") || message.includes("저장된")) &&
        (message.includes("전체") || message.includes("전체 기록"))
    ) {
        this.addMessage(
            "Memory에 저장된 전체 기록을 조회하고 있습니다... 📜",
            "ai",
        );
        try {
            // NetlifyMemoryClient에서는 getRecentConversations 사용 (모든 대화)
            const conversations = await this.memoryClient.getRecentConversations(100);

            if (conversations && conversations.length > 0) {
                let response = "📜 **Memory 전체 기록:**\n\n";

                conversations.forEach((conv, index) => {
                    const date = new Date(conv.timestamp).toLocaleString('ko-KR');
                    response += `**[메시지 ${index + 1}]**\n`;
                    response += `**사용자:** ${conv.user_message}\n`;
                    response += `**AI:** ${conv.ai_message}\n`;
                    response += `**시간:** ${date}\n`;
                    if (conv.topic) {
                        response += `**주제:** ${conv.topic}\n`;
                    }
                    if (conv.emotion) {
                        response += `**감정:** ${conv.emotion}\n`;
                    }
                    response += "\n";
                });

                this.addMessage(response, "ai");
            } else {
                this.addMessage(
                    "Memory에 저장된 기록이 없습니다. 텅 비어있어요. 🤔",
                    "ai",
                );
            }
        } catch (error) {
            console.error("Memory 전체 기록 조회 실패:", error);
            this.addMessage("기록을 조회하는 중 오류가 발생했습니다. 😥", "ai");
        }
        return true;
    }

    // "Memory 전체 삭제" 또는 "기록 다 지워" - Memory 전체 삭제 명령어
    if (
        (message.includes("memory") || message.includes("기록")) &&
        (message.includes("삭제") || message.includes("지워") || message.includes("초기화") || message.includes("비워"))
    ) {
        this.addMessage(
            "Memory에 저장된 모든 대화 기록을 삭제하고 있습니다... 🗑️",
            "ai",
        );

        let deletionSuccessful = false;
        let errorMessages = [];

        // 1단계: NetlifyMemoryClient의 clearAllConversations 사용
        try {
            console.log("🚀 Memory 삭제 시도 1: Netlify Function을 통한 삭제");
            const success = await this.memoryClient.clearAllConversations();

            if (success) {
                console.log("✅ Netlify Function을 통한 삭제 성공");
                deletionSuccessful = true;
            } else {
                console.warn("⚠️ Netlify Function 삭제에서 false 반환");
                errorMessages.push("Netlify Function 삭제에서 false 반환");
            }
        } catch (netlifyError) {
            console.error("❌ Netlify Function 삭제 실패:", netlifyError);
            errorMessages.push(`Netlify Function 오류: ${netlifyError.message}`);
        }

        // 삭제 확인: Memory에서 데이터가 실제로 삭제되었는지 확인
        try {
            console.log("🔍 Memory 삭제 확인: 남은 데이터 조회");
            const remainingData = await this.memoryClient.getRecentConversations(1);

            if (!remainingData || remainingData.length === 0) {
                console.log("✅ Memory 삭제 확인: 모든 데이터가 삭제됨");
                deletionSuccessful = true;
            } else {
                console.warn("⚠️ Memory 삭제 확인: 데이터가 남아있음", remainingData);
                errorMessages.push(`삭제 후에도 ${remainingData.length}개의 데이터가 남아있음`);
            }
        } catch (verifyError) {
            console.error("❌ Memory 삭제 확인 실패:", verifyError);
            errorMessages.push(`삭제 확인 실패: ${verifyError.message}`);
        }

        // 최종 결과 보고
        if (deletionSuccessful) {
            console.log("🎉 Memory 삭제 전체 성공");
            this.addMessage(
                "✅ Memory 기록이 모두 삭제되었습니다! 🧹\n\n새로운 대화를 시작하세요. 이제 이전 기록 없이 깨끗한 상태입니다.",
                "ai",
            );
        } else {
            console.error("❌ Memory 삭제 전체 실패:", errorMessages);
            this.addMessage(
                `❌ Memory 삭제 중 오류가 발생했습니다. 😥\n\n**오류 내용:**\n${errorMessages.join('\n')}\n\n다시 시도하시거나 새로고침 후 다시 시도해주세요.`,
                "ai",
            );
        }

        return true;
    }

    return false;
};

// 애플리케이션 초기화
document.addEventListener("DOMContentLoaded", () => {
    // 애니메이션 스타일 추가
    const style = document.createElement("style");
    style.textContent = `
        @keyframes slideOut {
            to {
                opacity: 0;
                transform: translateX(100px);
            }
        }
    `;
    document.head.appendChild(style);

    // AI 컴패니언 인스턴스 생성 후 EXA 기능 활성화
    window.aiCompanion = new AICompanion();
    window.aiCompanion.initializeEXA();

    // 상담 주제 토글 기능 추가
    const quickResponsesHeader = document.getElementById(
        "quickResponsesHeader",
    );
    const quickResponses = document.getElementById("quickResponses");

    if (quickResponsesHeader && quickResponses) {
        // 로컬 스토리지에서 상태 복원
        const isCollapsed =
            localStorage.getItem("quickResponsesCollapsed") === "true";
        if (isCollapsed) {
            quickResponses.classList.add("collapsed");
        }

        quickResponsesHeader.addEventListener("click", () => {
            quickResponses.classList.toggle("collapsed");
            const collapsed = quickResponses.classList.contains("collapsed");
            localStorage.setItem("quickResponsesCollapsed", collapsed);
        });
    }
});

// 전역 함수로 API 키 설정 함수 제공
window.setOpenAIKey = function (apiKey) {
    if (window.aiCompanion) {
        window.aiCompanion.setOpenAIKey(apiKey);
        window.aiCompanion.showNotification("Z.AI API 키가 설정되었습니다! 🎉");
        return true;
    }
    return false;
};

// Memory 조회하기
AICompanion.prototype.viewMemoryConversations = function () {
    if (!this.memoryMCPAvailable) {
        this.addMessage("Memory 서버가 연결되어 있지 않습니다. 설정에서 Memory 연결을 확인해주세요.", "ai");
        return;
    }

    this.addMessage("Memory에 저장된 대화 기록을 조회하고 있습니다... 📚", "ai");

    this.memoryClient.getRecentConversations(20).then(conversations => {
        if (conversations && conversations.length > 0) {
            let response = "📚 **Memory에 저장된 대화 기록:**\n\n";

            // 실제 대화만 필터링 (Memory 명령어 응답 제외)
            const realConversations = conversations.filter(conv => {
                const userMsg = conv.user_message || '';
                const aiMsg = conv.ai_message || '';

                return !(
                    userMsg.includes('Memory') ||
                    userMsg.includes('기록') ||
                    userMsg.includes('저장') ||
                    userMsg.includes('삭제') ||
                    userMsg.includes('조회') ||
                    userMsg.includes('검색') ||
                    aiMsg.includes('Memory') ||
                    aiMsg.includes('기록') ||
                    aiMsg.includes('저장') ||
                    aiMsg.includes('삭제') ||
                    aiMsg.includes('조회') ||
                    aiMsg.includes('검색') ||
                    aiMsg.includes('조회하고 있습니다') ||
                    aiMsg.includes('저장하고 있습니다') ||
                    aiMsg.includes('삭제하고 있습니다') ||
                    aiMsg.includes('검색하고 있습니다') ||
                    aiMsg.includes('패턴 분석') ||
                    aiMsg.includes('분석 결과') ||
                    aiMsg.includes('요약')
                );
            });

            if (realConversations.length > 0) {
                realConversations.forEach((conv, index) => {
                    const date = new Date(conv.timestamp).toLocaleString('ko-KR');
                    response += `**[대화 ${index + 1}]**\n`;
                    response += `**사용자:** ${conv.user_message}\n`;
                    response += `**AI:** ${conv.ai_message}\n`;
                    response += `**시간:** ${date}\n`;
                    if (conv.topic) {
                        response += `**주제:** ${conv.topic}\n`;
                    }
                    if (conv.emotion) {
                        response += `**감정:** ${conv.emotion}\n`;
                    }
                    response += "\n";
                });

                this.addMessage(response, "ai");
            } else {
                this.addMessage(
                    "Memory에 저장된 실제 대화가 없습니다. 일반 대화만 저장되었고 Memory 명령어 응답은 저장되지 않았어요. 😊",
                    "ai",
                );
            }
        } else {
            this.addMessage(
                "Memory에 저장된 기록이 없습니다. 일반 대화를 나눠보세요! 😊",
                "ai",
            );
        }
    }).catch(error => {
        console.error("Memory 조회 실패:", error);
        this.addMessage("Memory 조회 중 오류가 발생했습니다. 😥", "ai");
    });
};

// Memory 요약보기
AICompanion.prototype.showMemorySummary = function () {
    if (!this.memoryMCPAvailable) {
        this.addMessage("Memory 서버가 연결되어 있지 않습니다. 설정에서 Memory 연결을 확인해주세요.", "ai");
        return;
    }

    this.addMessage("Memory에서 대화 패턴을 분석하고 있습니다... 📊", "ai");

    this.memoryClient.generateReport().then(report => {
        if (report) {
            let response = `📊 **Memory 기반 대화 분석 결과**\n\n`;
            response += `• 총 대화 횟수: ${report.totalConversations || 0}회\n\n`;

            if (report.topTopics && report.topTopics.length > 0) {
                response += `🎯 **주요 대화 주제:**\n`;
                const topTopics = Object.keys(report.topicDistribution || {}).sort(
                    (a, b) => (report.topicDistribution[b] || 0) - (report.topicDistribution[a] || 0)
                ).slice(0, 3);
                topTopics.forEach((topic, index) => {
                    response += `${index + 1}. ${topic} (${report.topicDistribution[topic] || 0}회)\n`;
                });
                response += "\n";
            }

            if (report.topEmotions && report.topEmotions.length > 0) {
                response += `💭 **감정 패턴:**\n`;
                const topEmotions = Object.keys(report.emotionDistribution || {}).sort(
                    (a, b) => (report.emotionDistribution[b] || 0) - (report.emotionDistribution[a] || 0)
                ).slice(0, 3);
                topEmotions.forEach((emotion, index) => {
                    response += `${index + 1}. ${emotion} (${report.emotionDistribution[emotion] || 0}회)\n`;
                });
            }

            if (report.insights && report.insights.length > 0) {
                response += `\n💡 **인사이트:**\n${report.insights.map(insight => `• ${insight}`).join('\n')}`;
            }

            this.addMessage(response, "ai");
        } else {
            this.addMessage(
                "Memory 분석을 위한 데이터가 부족합니다. 더 많은 대화를 나눠보세요! 😊",
                "ai",
            );
        }
    }).catch(error => {
        console.error("Memory 요약 실패:", error);
        this.addMessage("Memory 요약 생성 중 오류가 발생했습니다. 😥", "ai");
    });
};

// Memory 전체 삭제
AICompanion.prototype.clearMemoryConversations = async function () {
    if (!this.memoryMCPAvailable) {
        this.addMessage("Memory 서버가 연결되어 있지 않습니다. 설정에서 Memory 연결을 확인해주세요.", "ai");
        return false;
    }

    this.addMessage("Memory에 저장된 모든 대화 기록을 삭제하고 있습니다... 🗑️", "ai");

    try {
        const success = await this.memoryClient.clearAllConversations();

        if (success) {
            // 삭제 확인
            const remainingData = await this.memoryClient.getRecentConversations(1);

            if (!remainingData || remainingData.length === 0) {
                this.addMessage(
                    "✅ Memory 기록이 모두 삭제되었습니다! 🧹\n\n새로운 대화를 시작하세요. 이제 이전 기록 없이 깨끗한 상태입니다.",
                    "ai",
                );
                return true;
            } else {
                this.addMessage(
                    `⚠️ 일부 데이터가 남아있을 수 있습니다. (${remainingData.length}개)\n\n다시 시도해보시거나 새로고침 후 시도해주세요.`,
                    "ai",
                );
                return false;
            }
        } else {
            this.addMessage(
                "❌ Memory 삭제에 실패했습니다. 😥\n\n다시 시도해보시거나 새로고침 후 시도해주세요.",
                "ai",
            );
            return false;
        }
    } catch (error) {
        console.error("Memory 삭제 실패:", error);
        this.addMessage(
            `❌ Memory 삭제 중 오류가 발생했습니다. 😥\n\n오류: ${error.message}\n\n다시 시도해보시거나 새로고침 후 시도해주세요.`,
            "ai",
        );
        return false;
    }
};

// AICompanion 클래스에 대화 기록 파일 관리 버튼 추가
AICompanion.prototype.setupChatHistoryButtons = function () {
    // 대화 기록 파일 관리 버튼
    const historyGroup = document.createElement("div");
    historyGroup.className = "setting-group";
    historyGroup.innerHTML = `
        <label>대화 기록 관리</label>
        <small>대화 기록을 파일로 저장, 불러오기, 또는 초기화할 수 있습니다.</small>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button id="saveHistoryBtn" class="btn-primary" style="flex: 1;">기록 저장</button>
            <button id="loadHistoryBtn" class="btn-primary" style="flex: 1;">기록 불러오기</button>
            <button id="clearHistoryBtn" class="btn-primary" style="flex: 1; background-color: #e74c3c;">기록 초기화</button>
        </div>
    `;

    // Memory 시스템 버튼 추가
    const memoryGroup = document.createElement("div");
    memoryGroup.className = "setting-group";
    memoryGroup.innerHTML = `
        <label>Memory 시스템 관리</label>
        <small>AI Companion의 Memory(기억) 시스템을 관리할 수 있습니다.</small>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
            <button id="memoryViewBtn" class="btn-primary">📚 Memory 조회하기</button>
            <button id="memorySummaryBtn" class="btn-primary">📊 Memory 요약보기</button>
            <button id="memoryClearBtn" class="btn-primary" style="background-color: #e74c3c;">🗑️ Memory 전체 삭제</button>
        </div>
        <small style="color: #666; margin-top: 8px; display: block;">
            💡 Memory는 AI가 이전 대화를 기억하고 분석하는 시스템입니다.
        </small>
    `;

    const modalContent = this.settingsModal.querySelector(".modal-content");
    if (modalContent) {
        modalContent.appendChild(historyGroup);
        modalContent.appendChild(memoryGroup);

        // 기존 대화 기록 버튼 이벤트
        document
            .getElementById("saveHistoryBtn")
            .addEventListener("click", () => {
                this.saveChatHistoryToFile(this.messages);
                this.showNotification("대화 기록이 파일로 저장되었습니다. 💾");
            });

        document
            .getElementById("loadHistoryBtn")
            .addEventListener("click", () => {
                this.loadChatHistoryFromFile();
            });

        document
            .getElementById("clearHistoryBtn")
            .addEventListener("click", () => {
                this.clearChatHistory();
            });

        // Memory 버튼 이벤트 추가
        document
            .getElementById("memoryViewBtn")
            .addEventListener("click", () => {
                this.viewMemoryConversations();
                this.closeSettings();
            });

        document
            .getElementById("memorySummaryBtn")
            .addEventListener("click", () => {
                this.showMemorySummary();
                this.closeSettings();
            });

        document
            .getElementById("memoryClearBtn")
            .addEventListener("click", async () => {
                if (confirm("Memory에 저장된 모든 대화 기록을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.")) {
                    await this.clearMemoryConversations();
                    this.closeSettings();
                }
            });
    }
};
