// Simple Cache Module
export class Cache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.ttl = options.ttl || 5 * 60 * 1000; // 5분
        this.cache = new Map();
    }

    // 키 생성
    _createKey(prefix, ...args) {
        return `${prefix}:${JSON.stringify(args)}`;
    }

    // 만료 확인
    _isExpired(item) {
        return Date.now() - item.timestamp > this.ttl;
    }

    // 저장
    set(key, value) {
        // 만료된 항목 정리
        this.cleanup();

        // 최대 크기 확인
        if (this.cache.size >= this.maxSize) {
            // 가장 오래된 항목 제거
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    // 가져오기
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (this._isExpired(item)) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    // 삭제
    delete(key) {
        this.cache.delete(key);
    }

    // 초기화
    clear() {
        this.cache.clear();
    }

    // 만료된 항목 정리
    cleanup() {
        for (const [key, item] of this.cache.entries()) {
            if (this._isExpired(item)) {
                this.cache.delete(key);
            }
        }
    }

    // 크기
    size() {
        return this.cache.size;
    }
}

// API 응답 캐시
export const apiCache = new Cache({
    maxSize: 100,
    ttl: 5 * 60 * 1000 // 5분
});

// 캐시 래퍼 함수
export function withCache(cacheKey, fn, ttl) {
    const cache = ttl ? new Cache({ ttl }) : apiCache;

    return async (...args) => {
        const key = cache._createKey(cacheKey, ...args);

        // 캐시 확인
        let result = cache.get(key);
        if (result) {
            console.log(`Cache hit: ${key}`);
            return result;
        }

        // 함수 실행
        console.log(`Cache miss: ${key}`);
        result = await fn(...args);

        // 결과 저장
        if (result) {
            cache.set(key, result);
        }

        return result;
    };
}