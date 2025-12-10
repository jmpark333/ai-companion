// Shared Emotion and Topic Detection Utilities
// Centralized logic for emotion and topic analysis

/**
 * Detects emotion from text using keyword matching
 * @param {string} text - Input text to analyze
 * @returns {string|null} - Detected emotion or null if none found
 */
function detectEmotion(text) {
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

/**
 * Detects topic from text using keyword matching
 * @param {string} text - Input text to analyze
 * @returns {string} - Detected topic or '일상' as default
 */
function detectTopic(text) {
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

/**
 * Extracts keywords from text for search and analysis
 * @param {string} text - Input text to process
 * @returns {string[]} - Array of extracted keywords
 */
function extractKeywords(text) {
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

/**
 * Gets all available emotion types
 * @returns {string[]} - Array of emotion types
 */
function getEmotionTypes() {
    return ['행복', '슬픔', '화', '불안', '스트레스', '평온', '감사'];
}

/**
 * Gets all available topic types
 * @returns {string[]} - Array of topic types
 */
function getTopicTypes() {
    return ['부부관계', '자녀교육', '가족갈등', '직장', '건강', '재정', '개인성장', '관계', '일상'];
}

// Export functions to global scope for compatibility with non-module scripts
window.detectEmotion = detectEmotion;
window.detectTopic = detectTopic;
window.extractKeywords = extractKeywords;
window.getEmotionTypes = getEmotionTypes;
window.getTopicTypes = getTopicTypes;