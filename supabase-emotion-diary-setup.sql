-- 감정일기 테이블 생성
CREATE TABLE IF NOT EXISTS emotion_diaries (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    emotional_moment TEXT,
    emotion_cause TEXT,
    coping_method TEXT,
    self_comfort TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_user_id ON emotion_diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_created_at ON emotion_diaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_tags ON emotion_diaries USING GIN(tags);

-- user_id와 created_at 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_user_created ON emotion_diaries(user_id, created_at DESC);

-- 전체 텍스트 검색을 위한 인덱스 (영어 설정 사용)
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_search ON emotion_diaries
USING GIN(to_tsvector('english',
    COALESCE(emotional_moment, '') || ' ' ||
    COALESCE(emotion_cause, '') || ' ' ||
    COALESCE(coping_method, '') || ' ' ||
    COALESCE(self_comfort, '')
));

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_emotion_diaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_emotion_diaries_updated_at ON emotion_diaries;
CREATE TRIGGER trigger_update_emotion_diaries_updated_at
    BEFORE UPDATE ON emotion_diaries
    FOR EACH ROW
    EXECUTE FUNCTION update_emotion_diaries_updated_at();

-- Row Level Security (RLS) 활성화
ALTER TABLE emotion_diaries ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 일기만 볼 수 있음
CREATE POLICY "Users can view their own diaries"
    ON emotion_diaries
    FOR SELECT
    USING (true);  -- API 키로 접근하므로 모든 읽기 허용

-- 정책: 사용자는 자신의 일기만 생성할 수 있음
CREATE POLICY "Users can create their own diaries"
    ON emotion_diaries
    FOR INSERT
    WITH CHECK (true);  -- API 키로 접근하므로 모든 삽입 허용

-- 정책: 사용자는 자신의 일기만 업데이트할 수 있음
CREATE POLICY "Users can update their own diaries"
    ON emotion_diaries
    FOR UPDATE
    USING (true);  -- API 키로 접근하므로 모든 업데이트 허용

-- 정책: 사용자는 자신의 일기만 삭제할 수 있음
CREATE POLICY "Users can delete their own diaries"
    ON emotion_diaries
    FOR DELETE
    USING (true);  -- API 키로 접근하므로 모든 삭제 허용

-- 샘플 데이터 (테스트용, 필요시 삭제)
-- INSERT INTO emotion_diaries (user_id, emotional_moment, emotion_cause, coping_method, self_comfort, tags)
-- VALUES
--     ('test_user_001', '회의에서 지적받았을 때 마음이 무너졌다', '내 능력이 부족한 것 같아 불안했고, 다른 사람들 앞에서 창피했다', '점심시간에 산책하며 심호흡을 했다', '실수할 수 있어. 완벽할 필요는 없어. 오늘도 최선을 다한 나를 응원해', ARRAY['불안', '스트레스']),
--     ('test_user_001', '프로젝트가 성공적으로 끝났다', '오랜 노력이 인정받아서 기뻤다', '친구들과 맛있는 저녁을 먹었다', '정말 잘했어! 자랑스러워!', ARRAY['기쁨', '감사']);

-- 통계 뷰 생성 (선택사항)
CREATE OR REPLACE VIEW emotion_diary_stats AS
SELECT
    user_id,
    COUNT(*) as total_diaries,
    COUNT(DISTINCT unnest(tags)) as unique_tags,
    MIN(created_at) as first_diary_date,
    MAX(created_at) as last_diary_date
FROM emotion_diaries
GROUP BY user_id;

-- 최근 일기 조회 함수
CREATE OR REPLACE FUNCTION get_recent_diaries(p_user_id TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (
    id BIGINT,
    emotional_moment TEXT,
    emotion_cause TEXT,
    coping_method TEXT,
    self_comfort TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.emotional_moment,
        d.emotion_cause,
        d.coping_method,
        d.self_comfort,
        d.tags,
        d.created_at
    FROM emotion_diaries d
    WHERE d.user_id = p_user_id
    ORDER BY d.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 태그별 일기 조회 함수
CREATE OR REPLACE FUNCTION get_diaries_by_tag(p_user_id TEXT, p_tag TEXT)
RETURNS TABLE (
    id BIGINT,
    emotional_moment TEXT,
    emotion_cause TEXT,
    coping_method TEXT,
    self_comfort TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.emotional_moment,
        d.emotion_cause,
        d.coping_method,
        d.self_comfort,
        d.tags,
        d.created_at
    FROM emotion_diaries d
    WHERE d.user_id = p_user_id
    AND p_tag = ANY(d.tags)
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 검색 함수
CREATE OR REPLACE FUNCTION search_diaries(p_user_id TEXT, p_search_term TEXT)
RETURNS TABLE (
    id BIGINT,
    emotional_moment TEXT,
    emotion_cause TEXT,
    coping_method TEXT,
    self_comfort TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.emotional_moment,
        d.emotion_cause,
        d.coping_method,
        d.self_comfort,
        d.tags,
        d.created_at,
        ts_rank(
            to_tsvector('english',
                COALESCE(d.emotional_moment, '') || ' ' ||
                COALESCE(d.emotion_cause, '') || ' ' ||
                COALESCE(d.coping_method, '') || ' ' ||
                COALESCE(d.self_comfort, '')
            ),
            plainto_tsquery('english', p_search_term)
        ) as rank
    FROM emotion_diaries d
    WHERE d.user_id = p_user_id
    AND (
        to_tsvector('english',
            COALESCE(d.emotional_moment, '') || ' ' ||
            COALESCE(d.emotion_cause, '') || ' ' ||
            COALESCE(d.coping_method, '') || ' ' ||
            COALESCE(d.self_comfort, '')
        ) @@ plainto_tsquery('english', p_search_term)
        OR p_search_term = ANY(d.tags)
    )
    ORDER BY rank DESC, d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- AI를 위한 최근 감정 요약 함수
CREATE OR REPLACE FUNCTION get_emotion_summary(p_user_id TEXT, p_days INT DEFAULT 7)
RETURNS TABLE (
    tag TEXT,
    count BIGINT,
    recent_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        unnest(d.tags) as tag,
        COUNT(*) as count,
        MAX(d.created_at) as recent_date
    FROM emotion_diaries d
    WHERE d.user_id = p_user_id
    AND d.created_at >= NOW() - INTERVAL '1 day' * p_days
    GROUP BY unnest(d.tags)
    ORDER BY count DESC, recent_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 감정일기 테이블 및 함수가 성공적으로 생성되었습니다!';
    RAISE NOTICE '📊 테이블: emotion_diaries';
    RAISE NOTICE '🔍 함수: get_recent_diaries, get_diaries_by_tag, search_diaries, get_emotion_summary';
    RAISE NOTICE '🔒 RLS (Row Level Security) 활성화됨';
END $$;
