// Z.AI API Client Module
export class ZAIAPIClient {
    constructor() {
        this.baseURL = "https://api.z.ai/api/paas/v4/";
        this.apiKey = null;
        this.jwtToken = null;
        this.tokenExpiry = null;
        this.authMethod = "apikey";
        this.requestTimeout = 30000;
        this.maxRetries = 3;
        this.retryDelay = 1000;

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

    // JWT 토큰 생성
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

            // 서명 생성
            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const signature = await this.generateHMACSHA256(
                signatureInput,
                secret,
            );

            this.jwtToken = `${signatureInput}.${signature}`;
            this.tokenExpiry = payload.exp * 1000;

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

    // 토큰 갱신 확인
    async ensureValidToken() {
        if (this.authMethod === "jwt") {
            if (!this.jwtToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry - 60000) {
                await this.generateJWTToken(this.apiKey);
            }
        }
    }

    // 요청 헤더 생성
    getHeaders() {
        const headers = {
            "Content-Type": "application/json",
        };

        if (this.authMethod === "apikey" && this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        } else if (this.authMethod === "jwt" && this.jwtToken) {
            headers["Authorization"] = `Bearer ${this.jwtToken}`;
        }

        return headers;
    }

    // API 요청 실행
    async makeRequest(endpoint, payload, options = {}) {
        await this.ensureValidToken();

        const startTime = Date.now();
        let attempt = 0;
        let lastError = null;

        while (attempt < this.maxRetries) {
            try {
                attempt++;
                this.usageStats.totalRequests++;

                const response = await fetch(`${this.baseURL}${endpoint}`, {
                    method: "POST",
                    headers: this.getHeaders(),
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(this.requestTimeout),
                    ...options,
                });

                if (!response.ok) {
                    throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const responseTime = Date.now() - startTime;

                // 성공 통계 업데이트
                this.usageStats.successfulRequests++;
                this.usageStats.lastRequestTime = new Date().toISOString();
                this.usageStats.averageResponseTime =
                    (this.usageStats.averageResponseTime * (this.usageStats.successfulRequests - 1) +
                     responseTime) / this.usageStats.successfulRequests;

                if (data.usage && data.usage.total_tokens) {
                    this.usageStats.totalTokens += data.usage.total_tokens;
                }

                return data;
            } catch (error) {
                lastError = error;
                this.usageStats.failedRequests++;

                if (attempt < this.maxRetries) {
                    console.warn(`요청 실패 (시도 ${attempt}/${this.maxRetries}):`, error.message);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                }
            }
        }

        throw new Error(`API 요청 실패: ${lastError.message}`);
    }

    // 채팅 메시지 전송
    async chat(messages, options = {}) {
        const payload = {
            model: options.model || "gpt-4o",
            messages: messages,
            stream: false,
            ...options
        };

        return this.makeRequest("chat/completions", payload);
    }

    // 사용량 통계 가져오기
    getUsageStats() {
        return { ...this.usageStats };
    }

    // 통계 초기화
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