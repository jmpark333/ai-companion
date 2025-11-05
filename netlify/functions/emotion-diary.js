// 감정일기 Netlify Function
// Supabase를 통한 CRUD 작업

const { createClient } = require("@supabase/supabase-js");

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase 환경 변수가 설정되지 않았습니다.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// CORS 헤더
const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
};

// 메인 핸들러
exports.handler = async (event, context) => {
    // Preflight 요청 처리
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers,
            body: "",
        };
    }

    try {
        const path = event.path.replace(
            "/.netlify/functions/emotion-diary",
            "",
        );
        const method = event.httpMethod;
        const body = event.body ? JSON.parse(event.body) : {};

        console.log(`📖 감정일기 요청: ${method} ${path}`);

        // 라우팅
        if (method === "POST" && path === "/create") {
            return await createDiary(body);
        } else if (method === "GET" && path === "/list") {
            return await listDiaries(event.queryStringParameters);
        } else if (method === "GET" && path.startsWith("/get/")) {
            const id = path.split("/")[2];
            return await getDiary(id, event.queryStringParameters);
        } else if (method === "PUT" && path.startsWith("/update/")) {
            const id = path.split("/")[2];
            return await updateDiary(id, body);
        } else if (method === "DELETE" && path.startsWith("/delete/")) {
            const id = path.split("/")[2];
            return await deleteDiary(id, event.queryStringParameters);
        } else if (method === "GET" && path === "/search") {
            return await searchDiaries(event.queryStringParameters);
        } else if (method === "GET" && path === "/summary") {
            return await getEmotionSummary(event.queryStringParameters);
        } else if (method === "GET" && path === "/recent-for-ai") {
            return await getRecentDiariesForAI(event.queryStringParameters);
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: "Endpoint not found" }),
            };
        }
    } catch (error) {
        console.error("❌ 감정일기 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Internal server error",
                message: error.message,
            }),
        };
    }
};

// 일기 생성
async function createDiary(body) {
    const {
        user_id,
        emotional_moment,
        emotion_cause,
        coping_method,
        self_comfort,
        tags = [],
    } = body;

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    const { data, error } = await supabase
        .from("emotion_diaries")
        .insert([
            {
                user_id,
                emotional_moment,
                emotion_cause,
                coping_method,
                self_comfort,
                tags,
            },
        ])
        .select();

    if (error) {
        console.error("❌ 일기 생성 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }

    console.log("✅ 일기 생성 성공:", data[0].id);
    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
            success: true,
            diary: data[0],
        }),
    };
}

// 일기 목록 조회
async function listDiaries(params) {
    const { user_id, limit = 50, offset = 0, tag } = params || {};

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    let query = supabase
        .from("emotion_diaries")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // 태그 필터링
    if (tag) {
        query = query.contains("tags", [tag]);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error("❌ 일기 목록 조회 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }

    console.log(`✅ 일기 목록 조회 성공: ${data.length}개`);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            diaries: data,
            count: data.length,
        }),
    };
}

// 일기 단건 조회
async function getDiary(id, params) {
    const { user_id } = params || {};

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    const { data, error } = await supabase
        .from("emotion_diaries")
        .select("*")
        .eq("id", id)
        .eq("user_id", user_id)
        .single();

    if (error) {
        console.error("❌ 일기 조회 오류:", error);
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Diary not found" }),
        };
    }

    console.log("✅ 일기 조회 성공:", id);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            diary: data,
        }),
    };
}

// 일기 수정
async function updateDiary(id, body) {
    const {
        user_id,
        emotional_moment,
        emotion_cause,
        coping_method,
        self_comfort,
        tags,
    } = body;

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    const updateData = {};
    if (emotional_moment !== undefined)
        updateData.emotional_moment = emotional_moment;
    if (emotion_cause !== undefined) updateData.emotion_cause = emotion_cause;
    if (coping_method !== undefined) updateData.coping_method = coping_method;
    if (self_comfort !== undefined) updateData.self_comfort = self_comfort;
    if (tags !== undefined) updateData.tags = tags;

    const { data, error } = await supabase
        .from("emotion_diaries")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user_id)
        .select();

    if (error) {
        console.error("❌ 일기 수정 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }

    if (!data || data.length === 0) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Diary not found" }),
        };
    }

    console.log("✅ 일기 수정 성공:", id);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            diary: data[0],
        }),
    };
}

// 일기 삭제
async function deleteDiary(id, params) {
    const { user_id } = params || {};

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    const { data, error } = await supabase
        .from("emotion_diaries")
        .delete()
        .eq("id", id)
        .eq("user_id", user_id)
        .select();

    if (error) {
        console.error("❌ 일기 삭제 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }

    if (!data || data.length === 0) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Diary not found" }),
        };
    }

    console.log("✅ 일기 삭제 성공:", id);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: "Diary deleted successfully",
        }),
    };
}

// 일기 검색
async function searchDiaries(params) {
    const { user_id, search_term, tag } = params || {};

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    let query = supabase
        .from("emotion_diaries")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

    // 검색어가 있으면 필터링
    if (search_term) {
        query = query.or(
            `emotional_moment.ilike.%${search_term}%,` +
                `emotion_cause.ilike.%${search_term}%,` +
                `coping_method.ilike.%${search_term}%,` +
                `self_comfort.ilike.%${search_term}%`,
        );
    }

    // 태그 필터링
    if (tag) {
        query = query.contains("tags", [tag]);
    }

    const { data, error } = await query;

    if (error) {
        console.error("❌ 일기 검색 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }

    console.log(`✅ 일기 검색 성공: ${data.length}개`);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            diaries: data,
            count: data.length,
        }),
    };
}

// 감정 요약 (AI용)
async function getEmotionSummary(params) {
    const { user_id, days = 7 } = params || {};

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    // 최근 N일간의 일기 조회
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));

    const { data, error } = await supabase
        .from("emotion_diaries")
        .select("tags, created_at")
        .eq("user_id", user_id)
        .gte("created_at", dateLimit.toISOString())
        .order("created_at", { ascending: false });

    if (error) {
        console.error("❌ 감정 요약 조회 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }

    // 태그별 카운트
    const tagCounts = {};
    data.forEach((diary) => {
        if (diary.tags && Array.isArray(diary.tags)) {
            diary.tags.forEach((tag) => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    // 가장 많이 사용된 태그 정렬
    const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }));

    console.log(
        `✅ 감정 요약 성공: ${data.length}개 일기, ${sortedTags.length}개 태그`,
    );
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            summary: {
                total_diaries: data.length,
                date_range: days,
                tag_counts: sortedTags,
                most_common_tag: sortedTags[0] || null,
            },
        }),
    };
}

// AI를 위한 최근 일기 조회 (요약 버전)
async function getRecentDiariesForAI(params) {
    const { user_id, limit = 5 } = params || {};

    if (!user_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "user_id is required" }),
        };
    }

    const { data, error } = await supabase
        .from("emotion_diaries")
        .select("emotional_moment, emotion_cause, tags, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(parseInt(limit));

    if (error) {
        console.error("❌ AI용 일기 조회 오류:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }

    console.log(`✅ AI용 일기 조회 성공: ${data.length}개`);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            diaries: data,
            count: data.length,
        }),
    };
}
