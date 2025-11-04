// Netlify Functions를 통한 Memory 클라이언트
// Supabase + Netlify Functions를 사용한 서버리스 메모리 시스템

class NetlifyMemoryClient {
    constructor() {
        this.baseURL = '/.netlify/functions/memory';
        this.userId = this.generateUserId();
        this.requestTimeout = 10000; // 10초
    }

    generateUserId() {
        const savedId = localStorage.getItem('memory_user_id');
        if (savedId) return savedId;

        const newId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('memory_user_id', newId);
        return newId;
    }

    // Netlify Function 호출 헬퍼
    async callFunction(endpoint, body = {}) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.userId,
                    ...body
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API 오류 (${response.status}): ${error}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('요청 시간 초과:', endpoint);
                throw new Error('요청 시간이 초과되었습니다.');
            }
            console.error('Netlify Function 호출 오류:', error);
            throw error;
        }
    }

    // 연결 상태 확인
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseURL}/status`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Netlify Memory 서버 연결 성공:', data);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Netlify Memory 서버 연결 실패:', error);
            return false;
        }
    }

    // 대화 저장
    async saveConversation(userMessage, aiMessage, metadata = {}) {
        try {
            const result = await this.callFunction('/save', {
                userMessage,
                aiMessage,
                emotion: metadata.emotion || null,
                topic: metadata.topic || null,
                personality: metadata.personality || 'warm'
            });

            if (result.success) {
                console.log('💾 대화 저장 성공:', result.data);
                return result.data;
            } else {
                console.error('대화 저장 실패:', result.error);
                return null;
            }
        } catch (error) {
            console.error('대화 저장 중 오류:', error);
            return null;
        }
    }

    // 관련 대화 검색 (키워드 기반)
    async searchConversations(keywords, limit = 5) {
        try {
            const result = await this.callFunction('/search', {
                keywords: Array.isArray(keywords) ? keywords : [keywords],
                limit
            });

            if (result.success) {
                console.log(`🔍 검색 결과: ${result.data.length}개 발견`);
                return result.data;
            } else {
                console.error('대화 검색 실패:', result.error);
                return [];
            }
        } catch (error) {
            console.error('대화 검색 중 오류:', error);
            return [];
        }
    }

    // 최근 대화 가져오기
    async getRecentConversations(limit = 10) {
        try {
            const result = await this.callFunction('/recent', { limit });

            if (result.success) {
                console.log(`📋 최근 대화 ${result.data.length}개 조회`);
                return result.data;
            } else {
                console.error('최근 대화 조회 실패:', result.error);
                return [];
            }
        } catch (error) {
            console.error('최근 대화 조회 중 오류:', error);
            return [];
        }
    }

    // 감정별 대화 통계
    async getEmotionStats() {
        try {
            const result = await this.callFunction('/stats/emotion', {});

            if (result.success) {
                console.log('😊 감정 통계:', result.data);
                return result.data;
            } else {
                console.error('감정 통계 조회 실패:', result.error);
                return {};
            }
        } catch (error) {
            console.error('감정 통계 조회 중 오류:', error);
            return {};
        }
    }

    // 주제별 대화 통계
    async getTopicStats() {
        try {
            const result = await this.callFunction('/stats/topic', {});

            if (result.success) {
                console.log('📊 주제 통계:', result.data);
                return result.data;
            } else {
                console.error('주제 통계 조회 실패:', result.error);
                return {};
            }
        } catch (error) {
            console.error('주제 통계 조회 중 오류:', error);
            return {};
        }
    }

    // 전체 대화 내역 삭제
    async clearAllConversations() {
        try {
            const result = await this.callFunction('/clear', {});

            if (result.success) {
                console.log('🗑️ 모든 대화가 삭제되었습니다.');
                return true;
            } else {
                console.error('대화 삭제 실패:', result.error);
                return false;
            }
        } catch (error) {
            console.error('대화 삭제 중 오류:', error);
            return false;
        }
    }

    // 대화 요약 저장
    async saveSummary(summaryText, conversationIds = []) {
        try {
            const result = await this.callFunction('/summary/save', {
                summaryText,
                conversationIds
            });

            if (result.success) {
                console.log('📝 요약 저장 성공:', result.data);
                return result.data;
            } else {
                console.error('요약 저장 실패:', result.error);
                return null;
            }
        } catch (error) {
            console.error('요약 저장 중 오류:', error);
            return null;
        }
    }

    // 저장된 요약 가져오기
    async getSummaries(limit = 5) {
        try {
            const result = await this.callFunction('/summary/get', { limit });

            if (result.success) {
                console.log(`📚 요약 ${result.data.length}개 조회`);
                return result.data;
            } else {
                console.error('요약 조회 실패:', result.error);
                return [];
            }
        } catch (error) {
            console.error('요약 조회 중 오류:', error);
            return [];
        }
    }

    // 대화 맥락 분석 (통합 메서드)
    async analyzeContext(message, limit = 3) {
        try {
            // 키워드 추출
            const keywords = this.extractKeywords(message);

            // 관련 대화 검색
            const relatedConversations = await this.searchConversations(keywords, limit);

            // 최근 대화도 가져오기 (맥락 보강)
            const recentConversations = await this.getRecentConversations(5);

            // 감정 및 주제 통계
            const emotionStats = await this.getEmotionStats();
            const topicStats = await this.getTopicStats();

            return {
                keywords,
                relatedConversations,
                recentConversations,
                emotionStats,
                topicStats,
                context: this.buildContext(relatedConversations, recentConversations)
            };
        } catch (error) {
            console.error('맥락 분석 중 오류:', error);
            return {
                keywords: [],
                relatedConversations: [],
                recentConversations: [],
                emotionStats: {},
                topicStats: {},
                context: ''
            };
        }
    }

    // 키워드 추출 헬퍼
    extractKeywords(text) {
        const stopWords = [
            '은', '는', '이', '가', '을', '를', '에', '와', '과', '의',
            '도', '만', '에서', '부터', '까지', '으로', '로', '에게',
            '한테', '께', '요', '네', '요', '습니다', '입니다'
        ];

        const words = text
            .replace(/[^\w\s가-힣]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 1 && !stopWords.includes(word))
            .slice(0, 5);

        return words;
    }

    // 맥락 구성 헬퍼
    buildContext(relatedConversations, recentConversations) {
        let context = '';

        if (relatedConversations.length > 0) {
            context += '\n\n[관련된 과거 대화]\n';
            relatedConversations.slice(0, 3).forEach((conv, idx) => {
                const date = new Date(conv.timestamp).toLocaleDateString('ko-KR');
                context += `${idx + 1}. (${date}) 사용자: "${conv.user_message}"\n`;
                context += `   AI: "${conv.ai_message.substring(0, 100)}..."\n\n`;
            });
        }

        // 최근 대화는 간략하게
        if (recentConversations.length > 0) {
            context += '[최근 대화 주제]\n';
            const recentTopics = recentConversations
                .filter(conv => conv.topic)
                .map(conv => conv.topic)
                .filter((topic, idx, arr) => arr.indexOf(topic) === idx)
                .slice(0, 3);

            if (recentTopics.length > 0) {
                context += recentTopics.join(', ') + '\n';
            }
        }

        return context;
    }

    // 감정 감지 헬퍼
    detectEmotion(text) {
        const emotionKeywords = {
            '행복': ['좋아', '기쁘', '행복', '감사', '웃', '즐거', '신나', '좋은'],
            '슬픔': ['슬프', '우울', '눈물', '힘들', '외로', '쓸쓸', '허전'],
            '화': ['화나', '짜증', '분노', '억울', '답답', '열받', '빡쳐'],
            '불안': ['걱정', '불안', '두렵', '무서', '초조', '긴장'],
            '스트레스': ['스트레스', '피곤', '지쳐', '힘들', '버거', '벅차'],
            '평온': ['평온', '편안', '차분', '안정', '여유', '평화'],
            '감사': ['감사', '고마', '다행', '축복']
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
            '부부관계': ['남편', '아내', '부부', '결혼', '배우자', '와이프'],
            '자녀교육': ['아이', '자녀', '교육', '육아', '아들', '딸', '학교'],
            '가족갈등': ['가족', '부모님', '형제', '갈등', '친척', '시댁', '처가'],
            '직장': ['회사', '직장', '업무', '상사', '동료', '일', '직장인'],
            '건강': ['건강', '병', '아프', '치료', '의사', '병원', '몸'],
            '재정': ['돈', '경제', '재정', '빚', '저축', '투자', '월급'],
            '개인성장': ['공부', '배우', '성장', '발전', '도전', '목표'],
            '관계': ['친구', '사람', '관계', '소통', '이해', '대화']
        };

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return topic;
            }
        }
        return '일상';
    }

    // 전체 분석 리포트 생성
    async generateReport() {
        try {
            const [emotionStats, topicStats, recentConversations, summaries] = await Promise.all([
                this.getEmotionStats(),
                this.getTopicStats(),
                this.getRecentConversations(20),
                this.getSummaries(5)
            ]);

            const totalConversations = recentConversations.length;
            const dateRange = this.getDateRange(recentConversations);

            const report = {
                period: dateRange,
                totalConversations,
                emotionDistribution: emotionStats,
                topicDistribution: topicStats,
                dominantEmotion: this.getDominant(emotionStats),
                dominantTopic: this.getDominant(topicStats),
                recentSummaries: summaries,
                insights: this.generateInsights(emotionStats, topicStats, totalConversations)
            };

            console.log('📈 분석 리포트 생성 완료:', report);
            return report;
        } catch (error) {
            console.error('리포트 생성 중 오류:', error);
            return null;
        }
    }

    // 날짜 범위 계산
    getDateRange(conversations) {
        if (conversations.length === 0) return '대화 없음';

        const dates = conversations
            .map(conv => new Date(conv.timestamp))
            .sort((a, b) => a - b);

        const start = dates[0].toLocaleDateString('ko-KR');
        const end = dates[dates.length - 1].toLocaleDateString('ko-KR');

        return start === end ? start : `${start} ~ ${end}`;
    }

    // 가장 빈도 높은 항목 찾기
    getDominant(stats) {
        if (Object.keys(stats).length === 0) return null;

        return Object.entries(stats)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    // 인사이트 생성
    generateInsights(emotionStats, topicStats, totalConversations) {
        const insights = [];

        // 대화 빈도
        if (totalConversations > 10) {
            insights.push('활발한 대화를 나누고 계시네요! 👏');
        } else if (totalConversations > 5) {
            insights.push('꾸준히 대화하고 계시는군요. 😊');
        } else {
            insights.push('더 많은 이야기를 나눠보면 어떨까요?');
        }

        // 감정 분석
        const dominantEmotion = this.getDominant(emotionStats);
        if (dominantEmotion) {
            const emotionMessages = {
                '행복': '긍정적인 감정이 많으시네요! 계속 좋은 일이 있길 바랍니다. ✨',
                '슬픔': '힘든 시간을 보내고 계신 것 같아요. 언제든 이야기 나눠요. 💙',
                '화': '화가 나는 일이 있으셨나요? 감정을 표현하는 것도 중요해요.',
                '불안': '걱정이 많으신 것 같아요. 함께 해결책을 찾아봐요.',
                '스트레스': '스트레스가 쌓인 것 같아요. 휴식이 필요할 때입니다. 🌿'
            };
            insights.push(emotionMessages[dominantEmotion] || '다양한 감정을 나누고 계시네요.');
        }

        // 주제 분석
        const dominantTopic = this.getDominant(topicStats);
        if (dominantTopic) {
            insights.push(`주로 ${dominantTopic}에 관심이 많으시군요.`);
        }

        return insights;
    }
}

// 사용 예제:
/*

// 1. HTML에서 스크립트 로드
<script src="memory-netlify-client.js"></script>

// 2. AICompanion 클래스에서 사용
class AICompanion {
    constructor() {
        // NetlifyMemoryClient로 교체
        this.memoryClient = new NetlifyMemoryClient();
        // ... 나머지 코드
    }

    async generateAIResponse(message) {
        // 맥락 분석
        const analysis = await this.memoryClient.analyzeContext(message);

        console.log('추출된 키워드:', analysis.keywords);
        console.log('관련 대화:', analysis.relatedConversations.length);

        // AI 메시지에 맥락 추가
        const messages = [
            {
                role: 'system',
                content: `당신은 따뜻한 AI 친구입니다.${analysis.context}`
            },
            ...this.getRecentMessages(),
            {
                role: 'user',
                content: message
            }
        ];

        // AI 응답 생성
        const response = await this.generateStreamingResponse(messages);

        // 대화 저장 (감정/주제 자동 감지)
        await this.memoryClient.saveConversation(message, response, {
            emotion: this.memoryClient.detectEmotion(message),
            topic: this.memoryClient.detectTopic(message),
            personality: this.settings.personality
        });

        return response;
    }

    // 분석 리포트 표시
    async showAnalysisReport() {
        const report = await this.memoryClient.generateReport();

        if (report) {
            const message = `
📊 대화 분석 리포트

기간: ${report.period}
총 대화 수: ${report.totalConversations}회

주요 감정: ${report.dominantEmotion || '없음'}
주요 주제: ${report.dominantTopic || '없음'}

💡 인사이트:
${report.insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}
            `;

            alert(message);
        }
    }
}

// 3. 설정에 분석 리포트 버튼 추가
<button onclick="window.aiCompanion.showAnalysisReport()">
    📊 대화 분석 보기
</button>

*/
