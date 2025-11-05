-- 감정일기 테이블 생성 (간소화 버전)
-- 전체 텍스트 검색 인덱스를 제외한 기본 버전

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

-- 기본 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_user_id ON emotion_diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_created_at ON emotion_diaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_tags ON emotion_diaries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_emotion_diaries_user_created ON emotion_diaries(user_id, created_at DESC);

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

-- 정책: 모든 작업 허용 (Netlify Functions에서 service_role key 사용)
CREATE POLICY "Allow all operations"
    ON emotion_diaries
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 통계 뷰 생성
CREATE OR REPLACE VIEW emotion_diary_stats AS
SELECT
    user_id,
    COUNT(*) as total_diaries,
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
    RAISE NOTICE '🔍 함수: get_recent_diaries, get_diaries_by_tag, get_emotion_summary';
    RAISE NOTICE '🔒 RLS (Row Level Security) 활성화됨';
    RAISE NOTICE '';
    RAISE NOTICE '💡 참고: 이 버전은 전체 텍스트 검색 인덱스를 제외한 간소화 버전입니다.';
    RAISE NOTICE '   검색 기능은 ILIKE를 사용하여 Netlify Functions에서 처리됩니다.';
END $$;
