// Netlify Function - Memory API
// Supabase를 사용한 서버리스 메모리 관리

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// CORS 헤더
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Supabase 설정 확인
  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Supabase가 설정되지 않았습니다. 환경 변수를 확인하세요.'
      })
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/memory', '');
    const body = event.body ? JSON.parse(event.body) : {};

    // 라우팅
    switch (path) {
      case '/save':
        return await saveConversation(body);

      case '/search':
        return await searchConversations(body);

      case '/recent':
        return await getRecentConversations(body);

      case '/stats/emotion':
        return await getEmotionStats(body);

      case '/stats/topic':
        return await getTopicStats(body);

      case '/clear':
        return await clearConversations(body);

      case '/summary/save':
        return await saveSummary(body);

      case '/summary/get':
        return await getSummaries(body);

      case '/status':
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            status: 'running',
            timestamp: new Date().toISOString()
          })
        };

      case '/context/save':
        return await saveUserContext(body);

      case '/context/get':
        return await getUserContext(body);

      case '/context/delete':
        return await deleteUserContext(body);

      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: '잘못된 경로입니다.'
          })
        };
    }
  } catch (error) {
    console.error('함수 실행 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// 대화 저장
async function saveConversation(body) {
  const { userMessage, aiMessage, emotion, topic, personality } = body;
  
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userMessage) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: '필수 필드(userMessage)가 누락되었습니다.'
      })
    };
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert([
      {
        user_id: userId,
        user_message: userMessage,
        ai_message: aiMessage || null,
        emotion: emotion || null,
        topic: topic || null,
        personality: personality || 'warm',
        timestamp: new Date().toISOString()
      }
    ])
    .select();

  if (error) {
    console.error('Supabase 대화 저장 오류:', error.message); // Supabase 오류 로깅 추가
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  console.log('✅ Supabase에 대화 저장 완료:', { userId, userMessage: userMessage.substring(0, 50) + '...', aiMessage: aiMessage ? aiMessage.substring(0, 50) + '...' : 'null' }); // 성공 시 로깅 추가

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: data[0]
    })
  };
}

// 대화 검색
async function searchConversations(body) {
  const { keywords, limit = 5 } = body;
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!keywords || keywords.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: '필수 필드가 누락되었습니다.'
      })
    };
  }

  // 키워드로 검색 (ILIKE 사용)
  const searchPattern = keywords.join(' ');

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .or(`user_message.ilike.%${searchPattern}%,ai_message.ilike.%${searchPattern}%`)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: data || []
    })
  };
}

// 최근 대화 가져오기
async function getRecentConversations(body) {
  const { limit = 10 } = body;
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'userId가 필요합니다.'
      })
    };
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: data || []
    })
  };
}

// 감정 통계
async function getEmotionStats(body) {
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'userId가 필요합니다.'
      })
    };
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('emotion')
    .eq('user_id', userId)
    .not('emotion', 'is', null);

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  // 감정별 카운트
  const emotionCount = {};
  data.forEach(row => {
    if (row.emotion) {
      emotionCount[row.emotion] = (emotionCount[row.emotion] || 0) + 1;
    }
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: emotionCount
    })
  };
}

// 주제 통계
async function getTopicStats(body) {
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'userId가 필요합니다.'
      })
    };
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('topic')
    .eq('user_id', userId)
    .not('topic', 'is', null);

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  // 주제별 카운트
  const topicCount = {};
  data.forEach(row => {
    if (row.topic) {
      topicCount[row.topic] = (topicCount[row.topic] || 0) + 1;
    }
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: topicCount
    })
  };
}

// 대화 삭제 (모든 대화 삭제)
async function clearConversations(body) {
  // userId 체크 제거 - 모든 대화를 삭제하기 위함
  // const { userId } = body;

  // 모든 대화 삭제 (.neq('id', 0)은 모든 레코드를 삭제)
  const { error } = await supabase
    .from('conversations')
    .delete()
    .neq('id', 0);

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: '모든 대화가 삭제되었습니다.'
    })
  };
}

// 요약 저장
async function saveSummary(body) {
  const { summaryText, conversationIds = [] } = body;
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId || !summaryText) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: '필수 필드가 누락되었습니다.'
      })
    };
  }

  const { data, error } = await supabase
    .from('conversation_summaries')
    .insert([
      {
        user_id: userId,
        summary_text: summaryText,
        conversation_ids: conversationIds,
        created_at: new Date().toISOString()
      }
    ])
    .select();

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: data[0]
    })
  };
}

// 사용자 컨텍스트 저장
async function saveUserContext(body) {
  const { contextType, contextData } = body;
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId || !contextType || !contextData) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: '필수 필드가 누락되었습니다.'
      })
    };
  }

  const { data, error } = await supabase
    .from('user_contexts')
    .upsert([
      {
        user_id: userId,
        context_type: contextType,
        context_data: contextData,
        updated_at: new Date().toISOString()
      }
    ])
    .select();

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: data[0]
    })
  };
}

// 사용자 컨텍스트 조회
async function getUserContext(body) {
  const { contextType } = body;
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'userId가 필요합니다.'
      })
    };
  }

  let query = supabase
    .from('user_contexts')
    .select('*')
    .eq('user_id', userId);

  if (contextType) {
    query = query.eq('context_type', contextType);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: data || []
    })
  };
}

// 사용자 컨텍스트 삭제
async function deleteUserContext(body) {
  const { contextType } = body;
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'userId가 필요합니다.'
      })
    };
  }

  let query = supabase
    .from('user_contexts')
    .delete()
    .eq('user_id', userId);

  if (contextType) {
    query = query.eq('context_type', contextType);
  }

  const { data, error, count } = await query.select();

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: `${count || 0}개의 컨텍스트가 삭제되었습니다.`,
      deletedCount: count || 0
    })
  };
}

// 요약 가져오기
async function getSummaries(body) {
  const { limit = 5 } = body;
  // NetlifyMemoryClient에서 자동으로 생성한 userId 사용
  const userId = body.userId || 'user_default';

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'userId가 필요합니다.'
      })
    };
  }

  const { data, error } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: data || []
    })
  };
}
