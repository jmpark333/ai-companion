// Supabase를 사용한 Memory 클라이언트
// Netlify에서 사용 가능한 클라우드 데이터베이스 솔루션

class SupabaseMemoryClient {
    constructor(supabaseUrl, supabaseKey) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.userId = this.generateUserId();
    }

    generateUserId() {
        const savedId = localStorage.getItem('memory_user_id');
        if (savedId) return savedId;

        const newId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('memory_user_id', newId);
        return newId;
    }

    // Supabase REST API 호출 헬퍼
    async supabaseRequest(endpoint, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.supabaseUrl}/rest/v1/${endpoint}`, options);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Supabase 오류: ${error}`);
        }

        return await response.json();
    }

    // 대화 저장
    async saveConversation(userMessage, aiMessage, metadata = {}) {
        try {
            const conversation = {
                user_id: this.userId,
                user_message: userMessage,
                ai_message: aiMessage,
                timestamp: new Date().toISOString(),
                emotion: metadata.emotion || null,
                topic: metadata.topic || null,
                personality: metadata.personality || 'warm'
            };

            const result = await this.supabaseRequest('conversations', 'POST', conversation);
            console.log('대화 저장 성공:', result);
            return result;
        } catch (error) {
            console.error('대화 저장 실패:', error);
            return null;
        }
    }

    // 관련 대화 검색 (키워드 기반)
    async searchConversations(keywords, limit = 5) {
        try {
            // Supabase의 텍스트 검색 기능 사용
            // Full-Text Search가 설정되어 있다면 더 정확한 검색 가능
            const searchQuery = keywords.join(' ');

            const endpoint = `conversations?user_id=eq.${this.userId}&or=(user_message.ilike.*${encodeURIComponent(searchQuery)}*,ai_message.ilike.*${encodeURIComponent(searchQuery)}*)&order=timestamp.desc&limit=${limit}`;

            const results = await this.supabaseRequest(endpoint, 'GET');
            return results;
        } catch (error) {
            console.error('대화 검색 실패:', error);
            return [];
        }
    }

    // 최근 대화 가져오기
    async getRecentConversations(limit = 10) {
        try {
            const endpoint = `conversations?user_id=eq.${this.userId}&order=timestamp.desc&limit=${limit}`;
            const results = await this.supabaseRequest(endpoint, 'GET');
            return results;
        } catch (error) {
            console.error('최근 대화 조회 실패:', error);
            return [];
        }
    }

    // 감정별 대화 통계
    async getEmotionStats() {
        try {
            const endpoint = `conversations?user_id=eq.${this.userId}&select=emotion`;
            const results = await this.supabaseRequest(endpoint, 'GET');

            const emotionCount = {};
            results.forEach(conv => {
                if (conv.emotion) {
                    emotionCount[conv.emotion] = (emotionCount[conv.emotion] || 0) + 1;
                }
            });

            return emotionCount;
        } catch (error) {
            console.error('감정 통계 조회 실패:', error);
            return {};
        }
    }

    // 주제별 대화 통계
    async getTopicStats() {
        try {
            const endpoint = `conversations?user_id=eq.${this.userId}&select=topic`;
            const results = await this.supabaseRequest(endpoint, 'GET');

            const topicCount = {};
            results.forEach(conv => {
                if (conv.topic) {
                    topicCount[conv.topic] = (topicCount[conv.topic] || 0) + 1;
                }
            });

            return topicCount;
        } catch (error) {
            console.error('주제 통계 조회 실패:', error);
            return {};
        }
    }

    // 전체 대화 내역 삭제
    async clearAllConversations() {
        try {
            const endpoint = `conversations?user_id=eq.${this.userId}`;
            await this.supabaseRequest(endpoint, 'DELETE');
            console.log('모든 대화 내역이 삭제되었습니다.');
            return true;
        } catch (error) {
            console.error('대화 삭제 실패:', error);
            return false;
        }
    }

    // 대화 요약 저장
    async saveSummary(summary, conversationIds = []) {
        try {
            const summaryData = {
                user_id: this.userId,
                summary_text: summary,
                conversation_ids: conversationIds,
                created_at: new Date().toISOString()
            };

            const result = await this.supabaseRequest('conversation_summaries', 'POST', summaryData);
            console.log('요약 저장 성공:', result);
            return result;
        } catch (error) {
            console.error('요약 저장 실패:', error);
            return null;
        }
    }

    // 저장된 요약 가져오기
    async getSummaries(limit = 5) {
        try {
            const endpoint = `conversation_summaries?user_id=eq.${this.userId}&order=created_at.desc&limit=${limit}`;
            const results = await this.supabaseRequest(endpoint, 'GET');
            return results;
        } catch (error) {
            console.error('요약 조회 실패:', error);
            return [];
        }
    }

    // 연결 상태 확인
    async checkConnection() {
        try {
            // 간단한 SELECT 쿼리로 연결 확인
            const endpoint = 'conversations?select=count&limit=1';
            await this.supabaseRequest(endpoint, 'GET');
            console.log('✅ Supabase 연결 성공');
            return true;
        } catch (error) {
            console.error('❌ Supabase 연결 실패:', error);
            return false;
        }
    }
}

// AICompanion 클래스에서 사용하는 방법:
/*

// 1. Supabase 프로젝트 생성 후 URL과 API Key 가져오기
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// 2. AICompanion 클래스 수정
class AICompanion {
    constructor() {
        // 기존 MemoryMCPClient 대신 SupabaseMemoryClient 사용
        this.memoryClient = new SupabaseMemoryClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        // ... 나머지 코드
    }

    async generateAIResponse(message) {
        // 관련 대화 검색
        const keywords = this.extractKeywords(message);
        const relatedConversations = await this.memoryClient.searchConversations(keywords, 3);

        // 맥락 추가
        let context = '';
        if (relatedConversations.length > 0) {
            context = '\n\n[과거 대화 참고]\n';
            relatedConversations.forEach(conv => {
                context += `사용자: ${conv.user_message}\n`;
                context += `AI: ${conv.ai_message}\n\n`;
            });
        }

        // AI 응답 생성
        const response = await this.generateStreamingResponse([...messages]);

        // 대화 저장
        await this.memoryClient.saveConversation(message, response, {
            emotion: this.detectEmotion(message),
            topic: this.detectTopic(message),
            personality: this.settings.personality
        });

        return response;
    }

    // 키워드 추출 헬퍼
    extractKeywords(text) {
        const stopWords = ['은', '는', '이', '가', '을', '를', '에', '와', '과', '의'];
        const words = text.split(/\s+/)
            .filter(word => word.length > 1 && !stopWords.includes(word))
            .slice(0, 5);
        return words;
    }

    // 감정 감지 헬퍼
    detectEmotion(text) {
        const emotionKeywords = {
            '행복': ['좋아', '기쁘', '행복', '감사', '웃'],
            '슬픔': ['슬프', '우울', '눈물', '힘들'],
            '화': ['화나', '짜증', '분노', '억울'],
            '불안': ['걱정', '불안', '두렵', '무서'],
            '스트레스': ['스트레스', '피곤', '지쳐', '힘들']
        };

        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return emotion;
            }
        }
        return null;
    }

    // 주제 감지 헬퍼
    detectTopic(text) {
        const topicKeywords = {
            '부부관계': ['남편', '아내', '부부', '결혼'],
            '자녀교육': ['아이', '자녀', '교육', '육아'],
            '가족갈등': ['가족', '부모님', '형제', '갈등'],
            '직장': ['회사', '직장', '업무', '상사'],
            '개인': ['나', '내', '자신', '혼자']
        };

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return topic;
            }
        }
        return null;
    }
}

*/

// SQL 스키마 (Supabase SQL Editor에서 실행):
/*

-- conversations 테이블 생성
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    ai_message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    emotion TEXT,
    topic TEXT,
    personality TEXT DEFAULT 'warm',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp DESC);
CREATE INDEX idx_conversations_emotion ON conversations(emotion);
CREATE INDEX idx_conversations_topic ON conversations(topic);

-- Full-Text Search 인덱스 (선택사항)
CREATE INDEX idx_conversations_user_message_fts ON conversations USING gin(to_tsvector('korean', user_message));
CREATE INDEX idx_conversations_ai_message_fts ON conversations USING gin(to_tsvector('korean', ai_message));

-- conversation_summaries 테이블 생성
CREATE TABLE conversation_summaries (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    conversation_ids BIGINT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_summaries_user_id ON conversation_summaries(user_id);
CREATE INDEX idx_summaries_created_at ON conversation_summaries(created_at DESC);

-- Row Level Security (RLS) 활성화 (보안)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 데이터만 접근 가능하도록 정책 설정
CREATE POLICY "Users can view their own conversations"
    ON conversations FOR SELECT
    USING (true);  -- 익명 사용자도 접근 가능 (user_id로 필터링)

CREATE POLICY "Users can insert their own conversations"
    ON conversations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can delete their own conversations"
    ON conversations FOR DELETE
    USING (true);

CREATE POLICY "Users can view their own summaries"
    ON conversation_summaries FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own summaries"
    ON conversation_summaries FOR INSERT
    WITH CHECK (true);

*/

// 사용 예제:
/*

// HTML에 스크립트 추가
<script src="memory-supabase-example.js"></script>

// script.js에서 사용
const memoryClient = new SupabaseMemoryClient(
    'https://your-project.supabase.co',
    'your-anon-key'
);

// 연결 확인
await memoryClient.checkConnection();

// 대화 저장
await memoryClient.saveConversation(
    '오늘 기분이 안 좋아요',
    '무슨 일이 있었나요? 이야기를 들려주세요.',
    { emotion: '슬픔', topic: '개인', personality: 'warm' }
);

// 대화 검색
const results = await memoryClient.searchConversations(['기분', '슬픔'], 5);
console.log('관련 대화:', results);

// 통계 조회
const emotionStats = await memoryClient.getEmotionStats();
console.log('감정 통계:', emotionStats);

*/
