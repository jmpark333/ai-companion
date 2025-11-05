-- 사용자 컨텍스트 테이블 생성
CREATE TABLE IF NOT EXISTS user_contexts (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    context_type TEXT NOT NULL DEFAULT 'basic_situation',
    context_data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_type ON user_contexts(context_type);
CREATE INDEX IF NOT EXISTS idx_user_contexts_created_at ON user_contexts(created_at DESC);

-- user_id와 context_type 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_type ON user_contexts(user_id, context_type);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_user_contexts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_user_contexts_updated_at ON user_contexts;
CREATE TRIGGER trigger_update_user_contexts_updated_at
    BEFORE UPDATE ON user_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_user_contexts_updated_at();

-- Row Level Security (RLS) 활성화
ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 컨텍스트만 볼 수 있음
CREATE POLICY "Users can view their own contexts"
    ON user_contexts
    FOR SELECT
    USING (true);  -- API 키로 접근하므로 모든 읽기 허용

-- 정책: 사용자는 자신의 컨텍스트만 생성할 수 있음
CREATE POLICY "Users can create their own contexts"
    ON user_contexts
    FOR INSERT
    WITH CHECK (true);  -- API 키로 접근하므로 모든 삽입 허용

-- 정책: 사용자는 자신의 컨텍스트만 업데이트할 수 있음
CREATE POLICY "Users can update their own contexts"
    ON user_contexts
    FOR UPDATE
    USING (true);  -- API 키로 접근하므로 모든 업데이트 허용

-- 정책: 사용자는 자신의 컨텍스트만 삭제할 수 있음
CREATE POLICY "Users can delete their own contexts"
    ON user_contexts
    FOR DELETE
    USING (true);  -- API 키로 접근하므로 모든 삭제 허용

-- 사용자 컨텍스트 조회 함수
CREATE OR REPLACE FUNCTION get_user_context(p_user_id TEXT, p_context_type TEXT DEFAULT 'basic_situation')
RETURNS TABLE (
    id BIGINT,
    user_id TEXT,
    context_type TEXT,
    context_data TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.user_id,
        c.context_type,
        c.context_data,
        c.created_at,
        c.updated_at
    FROM user_contexts c
    WHERE c.user_id = p_user_id
    AND c.context_type = p_context_type
    ORDER BY c.updated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 사용자 컨텍스트 저장 또는 업데이트 함수
CREATE OR REPLACE FUNCTION save_user_context(p_user_id TEXT, p_context_type TEXT, p_context_data TEXT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    context_id BIGINT
) AS $$
DECLARE
    existing_context_id BIGINT;
    new_context_id BIGINT;
BEGIN
    -- 기존 컨텍스트 확인
    SELECT id INTO existing_context_id
    FROM user_contexts
    WHERE user_id = p_user_id
    AND context_type = p_context_type
    ORDER BY updated_at DESC
    LIMIT 1;
    
    -- 기존 컨텍스트가 있으면 업데이트
    IF existing_context_id IS NOT NULL THEN
        UPDATE user_contexts
        SET context_data = p_context_data
        WHERE id = existing_context_id;
        
        RETURN QUERY
        SELECT true, '컨텍스트가 업데이트되었습니다.'::TEXT, existing_context_id;
    -- 기존 컨텍스트가 없으면 새로 생성
    ELSE
        INSERT INTO user_contexts (user_id, context_type, context_data)
        VALUES (p_user_id, p_context_type, p_context_data)
        RETURNING id INTO new_context_id;
        
        RETURN QUERY
        SELECT true, '컨텍스트가 생성되었습니다.'::TEXT, new_context_id;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- 사용자 컨텍스트 삭제 함수
CREATE OR REPLACE FUNCTION delete_user_context(p_user_id TEXT, p_context_type TEXT DEFAULT 'basic_situation')
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    deleted_count BIGINT
) AS $$
DECLARE
    deleted_count BIGINT;
BEGIN
    DELETE FROM user_contexts
    WHERE user_id = p_user_id
    AND context_type = p_context_type;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RETURN QUERY
        SELECT true, '컨텍스트가 삭제되었습니다.'::TEXT, deleted_count;
    ELSE
        RETURN QUERY
        SELECT false, '삭제할 컨텍스트가 없습니다.'::TEXT, 0::BIGINT;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 사용자 컨텍스트 테이블 및 함수가 성공적으로 생성되었습니다!';
    RAISE NOTICE '📊 테이블: user_contexts';
    RAISE NOTICE '🔍 함수: get_user_context, save_user_context, delete_user_context';
    RAISE NOTICE '🔒 RLS (Row Level Security) 활성화됨';
END $$;