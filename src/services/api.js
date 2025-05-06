/**
 * API服务
 * 提供与后端API交互的方法
 */

// 后端API基础URL
// 根据环境自动切换API基础URL
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:8000/api/v1'  // 本地开发环境
  : 'https://toolapi.sangucloud.com/api/v1';  // 生产环境

console.log(`当前环境: ${process.env.NODE_ENV}, 使用API基础URL: ${API_BASE_URL}`);

/**
 * 通用请求方法
 * @param {string} endpoint - API端点
 * @param {string} method - HTTP方法
 * @param {object} data - 请求数据
 * @param {boolean} stream - 是否返回原始响应，用于处理流式数据
 * @param {boolean} isFormData - 是否为FormData类型的数据
 * @returns {Promise<any>} - 响应数据
 */
const request = async (endpoint, method = 'GET', data = null, stream = false, isFormData = false) => {
  let url = `${API_BASE_URL}${endpoint}`;
  
  // 添加详细日志
  console.log(`准备发送${method}请求到: ${url}`);
  console.log('请求数据:', data);
  console.log('是否流式请求:', stream);
  console.log('是否FormData:', isFormData);
  
  const options = {
    method,
    headers: {},
  };

  // 如果是流式请求，添加特殊的headers
  if (stream) {
    options.headers.accept = 'text/event-stream';
  }

  // 根据数据类型设置不同的Content-Type
  if (data) {
    if (isFormData) {
      // FormData不需要设置Content-Type，浏览器会自动设置正确的boundary
      options.body = data;
    } else if (method === 'GET') {
      const params = new URLSearchParams(data);
      url += `?${params.toString()}`;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
  }

  try {
    console.log(`[API Request] 发送请求到: ${url}`); 
    console.log('[API Request] 请求选项: ', JSON.stringify(options, (key, value) => 
      key === 'body' && value instanceof FormData ? '[FormData]' : value, 2)); 
    const response = await fetch(url, options);
    
    console.log(`收到响应: 状态码=${response.status}, 状态文本=${response.statusText}`);
    
    if (!response.ok) {
      console.error(`API请求失败: ${response.status} ${response.statusText}`);
      console.error(`请求URL: ${url}`);
      console.error(`请求方法: ${method}`);
      console.error(`请求数据:`, data);
      
      // 尝试解析错误响应体
      try {
        const errorData = await response.text();
        console.error('错误响应体:', errorData);
        throw new Error(`API请求失败: ${response.status} ${response.statusText}, 错误详情: ${errorData}`);
      } catch (parseError) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
    }
    
    // 如果是流式请求，返回原始响应
    if (stream) {
      console.log('返回流式响应');
      return response;
    }
    
    // 检查Content-Type，如果是音频类型，直接返回响应
    const contentType = response.headers.get('Content-Type');
    if (contentType && (contentType.includes('audio/') || contentType.includes('application/octet-stream'))) {
      console.log('检测到音频响应，返回原始响应');
      return response;
    }
    
    const responseData = await response.json();
    console.log('响应数据:', responseData);
    return responseData;
  } catch (error) {
    console.error('API请求错误:', error);
    console.error(`请求URL: ${url}`);
    console.error(`请求方法: ${method}`);
    console.error(`请求数据:`, data);
    throw error;
  }
};

export default {
  /**
   * 获取API健康状态
   * @returns {Promise<{status: string}>} - 健康状态
   */
  getHealth: () => request('/health'),
    
  /**
   * 与就业服务助手进行对话
   * @param {string} message - 用户消息
   * @param {Array} history - 历史对话记录
   * @param {boolean} stream - 是否返回流式响应
   * @param {string} location - 用户位置信息（可选）
   * @returns {Promise<Response|object>} - 对话结果
   */
  chatWithAssistant: (message, history = [], stream = false, location = '') => {
    console.log('[API chatWithAssistant] Received location:', location); // 添加日志确认接收到的值
    return request('/career_assistant/chat', 'POST', { message, history, location }, stream);
  },
    
  /**
   * 终止就业服务助手对话生成过程
   * @param {string} requestId - 要终止的请求ID
   * @returns {Promise<{status: string, message: string}>} - 终止结果
   */
  terminateCareerChat: (requestId) =>
    request('/career_assistant/terminate', 'POST', { request_id: requestId }),
    
  /**
   * 获取更多职位信息
   * @param {object} params - 搜索参数
   * @returns {Promise<object>} - 职位搜索结果
   */
  getMorePositions: (params) =>
    request('/career_assistant/proxy/position_search', 'POST', params),
    
  /**
   * 上传文件并解析为文本
   * @param {FormData} formData - 包含文件的FormData对象
   * @returns {Promise<{file_id: string, filename: string, content: string, status: string, message: string}>} - 文件解析结果
   */
  parseFile: (formData) =>
    request('/file_parser/upload', 'POST', formData, false, true),
    
  /**
   * 上传简历文件并流式解析为结构化数据
   * @param {FormData} formData - 包含简历文件的FormData对象
   * @param {string} [customSchema] - 可选，自定义的JSON结构模板，如果不提供则使用默认模板
   * @param {string} [userId] - 可选，用户ID，用于记录执行结果
   * @returns {Promise<Response>} - 流式响应对象
   */
  parseResumeFileStream: (formData, customSchema = null, userId = null) => {
    if (customSchema) {
      formData.append('custom_schema', customSchema);
    }
    if (userId) {
      formData.append('user_id', userId);
    }
    return request('/resume_parser/parse_file_stream', 'POST', formData, true, true);
  },
    
  /**
   * 流式解析简历文本为结构化数据
   * @param {string} content - 简历文本内容
   * @param {string} [customSchema] - 可选，自定义的JSON结构模板，如果不提供则使用默认模板
   * @param {string} [userId] - 可选，用户ID，用于记录执行结果
   * @returns {Promise<Response>} - 流式响应对象
   */
  parseResumeTextStream: (content, customSchema = null, userId = null) =>
    request('/resume_parser/parse_text_stream', 'POST', { 
      content, 
      custom_schema: customSchema,
      user_id: userId
    }, true),
    
  /**
   * 将文本转换为语音
   * @param {Object} params - 语音合成参数
   * @returns {Promise<Object>} - 语音合成结果
   */
  synthesizeSpeech: (params) =>
    request('/text_to_speech/synthesize', 'POST', params),
    
  /**
   * 流式将文本转换为语音
   * @param {Object} params - 语音合成参数
   * @returns {Promise<Response>} - 流式响应对象，可直接用于音频播放
   */
  synthesizeSpeechStream: (params) =>
    request('/text_to_speech/synthesize-stream', 'POST', params, true),
    
  /**
   * 获取可用的声音列表
   * @returns {Promise<{voices: Array}>} - 声音列表
   */
  getAvailableVoices: () =>
    request('/text_to_speech/voices'),
    
  /**
   * 获取可用的情感列表
   * @returns {Promise<{emotions: Array}>} - 情感列表
   */
  getAvailableEmotions: () =>
    request('/text_to_speech/emotions'),
    
  /**
   * 获取预设的混合音色列表
   * @returns {Promise<{presets: Array}>} - 混合音色预设列表
   */
  getTimberPresets: () =>
    request('/text_to_speech/timber-presets'),
    
  /**
   * 与简历生成助手进行对话
   * @param {string} message - 用户消息
   * @param {Array} messagesHistory - 历史对话记录
   * @param {string} conversationId - 会话ID，如果为空则创建新会话
   * @returns {Promise<Response>} - 流式响应对象
   */
  chatWithResumeAssistant: (message, messagesHistory = [], conversationId = null) =>
    request('/resume_chat_assistant/chat_stream', 'POST', {
      message,
      messages_history: messagesHistory,
      conversation_id: conversationId
    }, true),
    
  /**
   * 根据聊天历史生成结构化简历
   * @param {Array} messagesHistory - 聊天历史记录
   * @returns {Promise<{resume_data: object}>} - 生成的简历数据
   */
  generateResume: (messagesHistory) =>
    request('/resume_chat_assistant/generate_resume', 'POST', { messages_history: messagesHistory }),
    
  /**
   * 上传职位描述文件并流式解析为胜任力模型
   * @param {FormData} formData - 包含职位描述文件的FormData对象
   * @returns {Promise<Response>} - 流式响应对象
   */
  parseJobCompetencyFileStream: (formData) =>
    request('/job_competency/parse_file_stream', 'POST', formData, true, true),
    
  /**
   * 流式解析职位描述文本为胜任力模型
   * @param {string} content - 职位描述文本内容
   * @returns {Promise<Response>} - 流式响应对象
   */
  parseJobCompetencyTextStream: (content) =>
    request('/job_competency/parse_text_stream', 'POST', { content }, true),

  /**
   * 解析上传的简历文件
   * @param {FormData} formData - 包含简历文件的FormData对象
   * @returns {Promise<{status: string, content: string, is_resume: boolean}>} - 解析结果
   */
  parseResumeFile: (formData) =>
    request('/resume_match/parse-resume-file', 'POST', formData, false, true),

  /**
   * 解析上传的职位描述文件
   * @param {FormData} formData - 包含职位描述文件的FormData对象
   * @returns {Promise<{status: string, content: string, is_position: boolean}>} - 解析结果
   */
  parsePositionFile: (formData) =>
    request('/resume_match/parse-position-file', 'POST', formData, false, true),

  /**
   * 混合模式匹配简历和职位描述
   * 支持文件和文本的任意组合
   * @param {Object} data - 包含简历和职位描述的数据对象
   * @param {File} [data.resumeFile] - 简历文件（可选）
   * @param {File} [data.positionFile] - 职位描述文件（可选）
   * @param {string} [data.resumeText] - 简历文本（可选）
   * @param {string} [data.positionText] - 职位描述文本（可选）
   * @param {string} [data.competencyModelText] - 胜任力模型文本（可选，如果提供则直接使用，不再生成）
   * @param {string} [data.hardRequirements] - 硬性条件（可选），用于指定必须满足的条件
   * @returns {Promise<Response>} - 流式响应对象
   */
  matchResumeMixed: (data) => {
    const formData = new FormData();
    
    // 添加文件（如果有）
    if (data.resumeFile) {
      formData.append('resume_file', data.resumeFile);
    }
    
    if (data.positionFile) {
      formData.append('position_file', data.positionFile);
    }
    
    // 添加文本（如果有）
    if (data.resumeText) {
      formData.append('resume_text', data.resumeText);
    }
    
    if (data.positionText) {
      formData.append('position_text', data.positionText);
    }
    
    // 添加胜任力模型（如果有）
    if (data.competencyModelText) {
      formData.append('competency_model_text', data.competencyModelText);
    }
    
    // 添加硬性条件（如果有）
    if (data.hardRequirements) {
      formData.append('hard_requirements', data.hardRequirements);
    }
    
    return request('/resume_match/match-files', 'POST', formData, true, true);
  },

  /**
   * 终止简历匹配生成过程
   * @param {string} requestId - 要终止的请求ID
   * @returns {Promise<{status: string, message: string}>} - 终止结果
   */
  terminateResumeMatch: (requestId) =>
    request('/resume_match/terminate', 'POST', { request_id: requestId }),

  /**
   * 解析上传的简历文件（面试指南专用）
   * @param {FormData} formData - 包含简历文件的FormData对象
   * @returns {Promise<{status: string, content: string, is_resume: boolean}>} - 解析结果
   */
  parseResumeFileForInterview: (formData) =>
    request('/resume_interview/parse-resume-file', 'POST', formData, false, true),

  /**
   * 解析上传的职位描述文件（面试指南专用）
   * @param {FormData} formData - 包含职位描述文件的FormData对象
   * @returns {Promise<{status: string, content: string, is_position: boolean}>} - 解析结果
   */
  parsePositionFileForInterview: (formData) =>
    request('/resume_interview/parse-position-file', 'POST', formData, false, true),

  /**
   * 生成面试指南
   * 支持文件和文本的任意组合
   * @param {Object} data - 包含简历和职位描述的数据对象
   * @param {File} [data.resumeFile] - 简历文件（可选）
   * @param {File} [data.positionFile] - 职位描述文件（可选）
   * @param {string} [data.resumeText] - 简历文本（可选）
   * @param {string} [data.positionText] - 职位描述文本（可选）
   * @param {Object} [data.competencyModel] - 胜任力模型数据（可选）
   * @param {string} [data.interviewQuestionLevel] - 面试问题描述文本（可选）
   * @returns {Promise<Response>} - 流式响应对象
   */
  generateInterviewGuide: (data) => {
    const formData = new FormData();
    
    // 添加文件（如果有）
    if (data.resumeFile) {
      formData.append('resume_file', data.resumeFile);
    }
    
    if (data.positionFile) {
      formData.append('position_file', data.positionFile);
    }
    
    // 添加文本（如果有）
    if (data.resumeText) {
      formData.append('resume_text', data.resumeText);
    }
    
    if (data.positionText) {
      formData.append('position_text', data.positionText);
    }
    
    // 添加胜任力模型（如果有）- 将对象转换为JSON字符串
    if (data.competencyModel) {
      formData.append('competency_model_text', JSON.stringify(data.competencyModel));
    }
    
    // 添加面试问题描述文本（如果有）
    if (data.interviewQuestionLevel) {
      formData.append('interview_question_level', data.interviewQuestionLevel);
    }
    
    return request('/interview_guide/generate', 'POST', formData, true, true);
  },

  /**
   * 终止面试指南生成过程
   * @param {string} requestId - 要终止的请求ID
   * @returns {Promise<{status: string, message: string}>} - 终止结果
   */
  terminateInterviewGuide: (requestId) =>
    request('/interview_guide/terminate', 'POST', { request_id: requestId }),

  /**
   * 流式生成结构化简历
   * @param {Array} messagesHistory - 聊天历史记录
   * @returns {Promise<Response>} - 流式响应对象
   */
  generateResumeStream: (messagesHistory) => {
    const url = `${API_BASE_URL}/resume_chat_assistant/generate_resume_stream`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages_history: messagesHistory
      })
    });
  },

  /**
   * 基于面试指南进行AI面试
   * @param {Object} data - 面试数据
   * @param {Object} data.interview_guide - 面试指南数据
   * @param {string} [data.message] - 用户消息（可选）
   * @param {Array} [data.messages_history] - 消息历史记录（可选）
   * @returns {Promise<Object>} - 面试对话内容
   */
  conductAIInterview: (data) =>
    request('/interview_guide/ai_interview', 'POST', data),

  /**
   * 终止AI面试过程
   * @param {string} requestId - 要终止的请求ID
   * @returns {Promise<{status: string, message: string}>} - 终止结果
   */
  terminateAIInterview: (requestId) =>
    request('/interview_guide/terminate_ai_interview', 'POST', { request_id: requestId }),
    
  /**
   * 评估面试结果，生成面试评估报告
   * @param {Object} data - 面试评估数据
   * @param {Object} data.interview_guide - 面试指南数据
   * @param {Array} data.messages_history - 面试对话历史记录
   * @param {Object} [data.competency_model] - 胜任力模型数据（可选，如果提供则优先使用）
   * @param {string} [data.request_id] - 原始面试请求ID（可选，用于关联面试和评估）
   * @returns {Promise<Response>} - 流式响应对象
   */
  evaluateInterview: (data) =>
    request('/interview_guide/evaluate_interview', 'POST', data, true),

  /**
   * 上传简历文件并流式优化
   * @param {FormData} formData - 包含简历文件的FormData对象
   * @returns {Promise<Response>} - 流式响应对象
   */
  optimizeResumeFileStream: (formData) =>
    request('/resume_optimizer/optimize_file_stream', 'POST', formData, true, true),

  /**
   * 流式优化简历文本内容
   * @param {Object} data - 包含简历文本内容和职位描述的数据对象
   * @param {string} data.resume_content - 简历文本内容
   * @param {string} [data.job_description] - 职位描述文本内容（可选）
   * @returns {Promise<Response>} - 流式响应对象
   */
  optimizeResumeTextStream: (data) =>
    request('/resume_optimizer/optimize_text_stream', 'POST', data, true),

  /**
   * 终止简历优化生成过程
   * @param {string} requestId - 要终止的请求ID
   * @returns {Promise<{status: string, message: string}>} - 终止结果
   */
  terminateResumeOptimization: (requestId) =>
    request('/resume_optimizer/terminate', 'POST', { request_id: requestId }),
    
  /**
   * 根据请求ID获取简历优化结果
   * @param {string} requestId - 请求ID
   * @returns {Promise<Object>} - 优化结果对象
   */
  getResumeOptimizationResult: (requestId) => {
    console.log('获取简历优化结果，请求URL:', `${API_BASE_URL}/resume_optimizer/get_optimization_result/${requestId}`);
    return request(`/resume_optimizer/get_optimization_result/${requestId}`);
  },
    
  /**
   * 根据请求ID获取简历解析结果
   * @param {string} requestId - 请求ID
   * @returns {Promise<Object>} - 解析结果对象
   */
  getResumeParseResult: async (requestId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/resume_parser/parse_result/${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '获取简历解析结果失败');
      }

      return await response.json();
    } catch (error) {
      console.error('获取简历解析结果时出错:', error);
      throw error;
    }
  },
  
  /**
   * 根据请求ID获取职位胜任力模型
   * @param {string} requestId - 请求ID
   * @returns {Promise<Object>} - 胜任力模型数据
   */
  getJobCompetencyModel(requestId) {
    console.log(`获取职位胜任力模型，请求ID: ${requestId}`);
    return request(`/job_competency/parse_result/${requestId}`, 'GET');
  },
  
  /**
   * 通过请求ID获取简历匹配分数结果
   * @param {string} requestId - 请求ID
   * @returns {Promise<Object>} - 匹配分数结果
   */
  getMatchingScore: (requestId) =>
    request('/resume_match/get-matching-score', 'POST', { request_id: requestId }),
    
  /**
   * 获取面试指南
   * 
   * @param {string} requestId - 面试指南的请求ID
   * @returns {Promise<Object>} - 面试指南数据
   */
  getInterviewGuide: (requestId) => {
    return request(`/interview_guide/guide/${requestId}`, 'GET');
  },
  
  /**
   * 获取面试评估报告
   * 
   * @param {string} requestId - 面试评估报告的请求ID
   * @returns {Promise<Object>} - 面试评估报告数据
   */
  getInterviewEvaluation: (requestId) => {
    return request(`/interview_guide/evaluation/${requestId}`, 'GET');
  },
  
  /**
   * 获取可用的语音识别模型列表
   * @returns {Promise<{models: Array}>} - 模型列表
   */
  getSpeechRecognitionModels: () => {
    return request('/speech_recognition/models', 'POST');
  },

  /**
   * 上传音频文件进行识别
   * @param {FormData} formData - 包含音频文件的FormData对象
   * @param {string} [model="paraformer-realtime-v2"] - 识别模型
   * @param {boolean} [semanticPunctuationEnabled=true] - 是否启用语义标点
   * @returns {Promise<Object>} - 识别结果
   */
  recognizeAudioFile: (formData, model = "paraformer-realtime-v2", semanticPunctuationEnabled = true) => {
    formData.append('model', model);
    formData.append('semantic_punctuation_enabled', semanticPunctuationEnabled);
    return request('/speech_recognition/recognize-file', 'POST', formData, false, true);
  },
};
