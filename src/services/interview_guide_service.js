/**
 * 面试指南服务
 * 提供与面试指南相关的功能，包括文件上传和文本输入方式生成面试指南
 * 所有生成方法均采用流式处理方式，提供实时反馈
 */
import api from './api';

/**
 * 终止面试指南生成过程
 * 
 * @param {string} requestId - 要终止的请求ID
 * @returns {Promise<{status: string, message: string}>} - 终止结果
 */
const terminateInterviewGuide = async (requestId) => {
  try {
    console.log('终止面试指南生成请求:', requestId);
    
    if (!requestId) {
      throw new Error('未提供请求ID');
    }
    
    const result = await api.terminateInterviewGuide(requestId);
    return result;
  } catch (error) {
    console.error('终止面试指南生成请求出错:', error);
    throw error;
  }
};

/**
 * 生成面试指南
 * 支持文件和文本的任意组合
 * 
 * 功能说明：
 * 1. 支持四种输入组合：
 *    - 简历文件 + 职位描述文件
 *    - 简历文件 + 职位描述文本
 *    - 简历文本 + 职位描述文件
 *    - 简历文本 + 职位描述文本
 * 2. 验证输入内容是否有效
 * 3. 通过API发送数据并获取流式响应
 * 4. 实时处理返回的数据并通过回调函数提供给调用者
 * 5. 可选择直接提供胜任力模型数据，跳过自动生成步骤
 * 
 * @param {Object} options - 生成选项
 * @param {File} [options.resumeFile] - 简历文件（可选）
 * @param {File} [options.positionFile] - 职位描述文件（可选）
 * @param {string} [options.resumeText] - 简历文本内容（可选）
 * @param {string} [options.positionText] - 职位描述文本内容（可选）
 * @param {Object} [options.competencyModel] - 胜任力模型数据（可选，如果提供则跳过自动生成）
 * @param {string} [options.interviewQuestionLevel] - 面试题目难度等级（可选）
 * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
 * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象
 * @throws {Error} 当输入验证失败或API调用出错时抛出异常
 */
const generateInterviewGuide = async (options, onProgress) => {
  try {
    console.log('开始生成面试指南，选项:', options);
    
    // 步骤1: 验证输入
    // 至少需要提供一种简历输入和一种职位描述输入
    const hasResumeInput = !!(options.resumeFile || options.resumeText);
    const hasPositionInput = !!(options.positionFile || options.positionText);
    
    if (!hasResumeInput) {
      console.error('错误: 未提供简历输入');
      throw new Error('请提供简历文件或文本');
    }
    
    if (!hasPositionInput) {
      console.error('错误: 未提供职位描述输入');
      throw new Error('请提供职位描述文件或文本');
    }
    
    // 验证文件格式
    if (options.resumeFile) {
      const resumeExtension = options.resumeFile.name.split('.').pop().toLowerCase();
      console.log('简历文件扩展名:', resumeExtension);
      
      // 支持的文件格式
      const supportedFormats = ['pdf', 'txt', 'doc', 'docx', 'json', 'jpg', 'jpeg', 'png'];
      if (!supportedFormats.includes(resumeExtension)) {
        console.error('错误: 不支持的简历文件格式', resumeExtension);
        throw new Error(`不支持的简历文件格式: ${resumeExtension}，支持的格式有: ${supportedFormats.join(', ')}`);
      }
    }
    
    if (options.positionFile) {
      const positionExtension = options.positionFile.name.split('.').pop().toLowerCase();
      console.log('职位文件扩展名:', positionExtension);
      
      // 支持的文件格式
      const supportedFormats = ['pdf', 'txt', 'doc', 'docx', 'json', 'jpg', 'jpeg', 'png'];
      if (!supportedFormats.includes(positionExtension)) {
        console.error('错误: 不支持的职位描述文件格式', positionExtension);
        throw new Error(`不支持的职位描述文件格式: ${positionExtension}，支持的格式有: ${supportedFormats.join(', ')}`);
      }
    }
    
    // 步骤2: 调用API服务，获取流式响应
    const response = await api.generateInterviewGuide({
      resumeFile: options.resumeFile,
      positionFile: options.positionFile,
      resumeText: options.resumeText,
      positionText: options.positionText,
      competencyModel: options.competencyModel,
      interviewQuestionLevel: options.interviewQuestionLevel
    });
    
    // 步骤3: 获取请求ID，用于后续可能的操作（如终止请求）
    const requestId = response.headers.get('X-Request-ID');
    if (!requestId) {
      throw new Error('未获取到请求ID');
    }

    // 获取响应体的读取器和解码器，用于读取流数据
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // 步骤4: 启动数据流处理
    (async () => {
      try {
        // 循环读取数据流
        while (true) {
          // 从流中读取一块数据
          const { value, done } = await reader.read();
          // 如果数据流结束，退出循环
          if (done) break;

          // 解码二进制数据为文本
          const chunk = decoder.decode(value, { stream: true });
          // 按SSE格式分割数据行
          const lines = chunk.split('\n\n').filter(line => line.trim());

          // 处理每一行数据
          for (const line of lines) {
            try {
              // SSE格式的数据行以"data: "开头
              if (line.startsWith('data: ')) {
                // 提取JSON数据部分
                const jsonStr = line.substring(6);
                
                
                // 解析JSON数据
                const data = JSON.parse(jsonStr);
                
                
                // 调用进度回调函数，传递解析后的数据
                if (onProgress) {
                  onProgress(data);
                }
                
                // 如果收到终止信号或完成信号，结束流读取
                if (data.terminated || data.finished) {
                  console.log('收到终止或完成信号，结束流读取:', data);
                  reader.cancel("收到终止或完成信号");
                  break;
                }
              }
            } catch (parseError) {
              console.error('解析SSE数据行时出错:', parseError);
              console.error('出错的数据行:', line);
            }
          }
        }
      } catch (streamError) {
        console.error('读取流数据时出错:', streamError);
        // 通知调用者出错了
        if (onProgress) {
          onProgress({ error: `读取流数据时出错: ${streamError.message}` });
        }
      }
    })();

    // 返回请求ID和读取器，以便调用者可以控制流读取
    return { requestId, reader };
  } catch (error) {
    console.error('生成面试指南出错:', error);
    throw error;
  }
};

/**
 * 获取面试指南数据
 * 
 * @param {string} requestId - 面试指南的请求ID
 * @returns {Promise<Object>} - 面试指南数据
 */
const getInterviewGuide = async (requestId) => {
  try {
    console.log('获取面试指南数据，请求ID:', requestId);
    
    if (!requestId) {
      throw new Error('未提供请求ID');
    }
    
    const result = await api.getInterviewGuide(requestId);
    return result;
  } catch (error) {
    console.error('获取面试指南数据出错:', error);
    throw error;
  }
};

/**
 * 开始AI面试
 * 
 * @param {Object} interviewGuide - 面试指南数据
 * @param {Array} messagesHistory - 聊天历史记录（可选）
 * @param {function} onProgress - 回调函数，用于处理返回的数据
 * @returns {Promise<{requestId: string}>} - 包含请求ID的对象
 * @throws {Error} 当输入验证失败或API调用出错时抛出异常
 */
const startAIInterview = async (interviewGuide, messagesHistory = [], onProgress) => {
  try {
    console.log('开始AI面试，面试指南:', interviewGuide);
    
    // 验证面试指南
    if (!interviewGuide) {
      throw new Error('未提供面试指南数据');
    }
    
    // 处理消息历史记录中的context对象，将其转换为字符串
    const processedHistory = messagesHistory.map(msg => {
      if (msg.context && typeof msg.context === 'object') {
        return {
          ...msg,
          context: JSON.stringify(msg.context)
        };
      }
      return msg;
    });
    
    // 调用API服务，获取响应
    const response = await api.conductAIInterview({
      interview_guide: interviewGuide,
      messages_history: processedHistory
    });
    
    // 获取请求ID
    const requestId = response.request_id;
    
    // 直接调用回调函数处理响应数据
                if (onProgress) {
      onProgress(response);
            }

    // 返回请求ID
    return { requestId };
  } catch (error) {
    console.error('开始AI面试出错:', error);
    // 通知调用者出错了
    if (onProgress) {
      onProgress({ error: `开始AI面试出错: ${error.message}` });
    }
    throw error;
  }
};

/**
 * 发送面试消息
 * 
 * @param {Object} interviewGuide - 面试指南数据
 * @param {Array} messagesHistory - 聊天历史记录
 * @param {string} message - 用户消息
 * @param {function} onProgress - 回调函数，用于处理返回的数据
 * @returns {Promise<{requestId: string}>} - 包含请求ID的对象
 * @throws {Error} 当输入验证失败或API调用出错时抛出异常
 */
const sendInterviewMessage = async (interviewGuide, messagesHistory, message, onProgress) => {
  try {
    console.log('发送面试消息:', message);
    
    // 验证输入
    if (!interviewGuide) {
      throw new Error('未提供面试指南数据');
    }
    
    if (!message) {
      throw new Error('未提供消息内容');
    }
    
    // 优化发送到后端的数据
    // 1. 提取面试指南中的必要信息
    const optimizedGuide = {
      candidate_summary: interviewGuide.candidate_summary || {},
      position_requirements: {
        title: interviewGuide.position_requirements?.title || ''
      }
    };
    
    // 2. 获取最后一个助手消息的context，它包含了问题列表和当前状态
    let lastAssistantContext = null;
    for (let i = messagesHistory.length - 1; i >= 0; i--) {
      if (messagesHistory[i].role === 'assistant' && messagesHistory[i].context) {
        lastAssistantContext = messagesHistory[i].context;
        break;
      }
    }
    
    // 3. 构建优化后的请求数据 - 只发送必要的信息
    const optimizedRequest = {
      messages_history: lastAssistantContext ? [
        // 只发送助手消息的内容和最小化的上下文
        (() => {
          // 查找最后一条助手消息的内容
          let lastAssistantContent = '';
          for (let i = messagesHistory.length - 1; i >= 0; i--) {
            if (messagesHistory[i].role === 'assistant') {
              lastAssistantContent = messagesHistory[i].content;
              break;
            }
          }
          
          // 从上下文中只提取必要的信息
          const minimalContext = {};
          if (typeof lastAssistantContext === 'object') {
            // 保留当前问题索引、追问状态和问题列表
            if (lastAssistantContext.current_question_index !== undefined) {
              minimalContext.current_question_index = lastAssistantContext.current_question_index;
            }
            
            if (lastAssistantContext.asked_followup !== undefined) {
              minimalContext.asked_followup = lastAssistantContext.asked_followup;
            }
            
            // 保留问题列表
            if (lastAssistantContext.questions) {
              minimalContext.questions = lastAssistantContext.questions.map(q => {
                // 确保保留core_evaluation_point字段
                if (q.core_evaluation_point) {
                  return { ...q };
                }
                return q;
              });
            }
            
            // 如果有followup_reason，则添加到上下文中
            if (lastAssistantContext.followup_reason !== undefined) {
              minimalContext.followup_reason = lastAssistantContext.followup_reason;
            }
          } else if (typeof lastAssistantContext === 'string') {
            try {
              const parsedContext = JSON.parse(lastAssistantContext);
              if (parsedContext.current_question_index !== undefined) {
                minimalContext.current_question_index = parsedContext.current_question_index;
              }
              
              if (parsedContext.asked_followup !== undefined) {
                minimalContext.asked_followup = parsedContext.asked_followup;
              }
              
              // 保留问题列表
              if (parsedContext.questions) {
                minimalContext.questions = parsedContext.questions.map(q => {
                  // 确保保留core_evaluation_point字段
                  if (q.core_evaluation_point) {
                    return { ...q };
                  }
                  return q;
                });
              }
              
              // 如果有followup_reason，则添加到上下文中
              if (parsedContext.followup_reason !== undefined) {
                minimalContext.followup_reason = parsedContext.followup_reason;
              }
            } catch (e) {
              console.error('解析上下文时出错:', e);
            }
          }
          
          return {
            role: 'assistant',
            content: lastAssistantContent,
            context: minimalContext
          };
        })(),
        { role: 'user', content: message }  // 添加用户消息到历史记录
      ] : [
        { role: 'user', content: message }  // 如果没有上下文，只发送用户消息
      ]
    };
    
    // 第一次面试时需要发送面试指南信息
    if (!lastAssistantContext) {
      optimizedRequest.interview_guide = optimizedGuide;
    }
    
    console.log('优化后的请求数据:', optimizedRequest);
    
    // 调用API服务，获取响应
    const response = await api.conductAIInterview(optimizedRequest);
    
    // 获取请求ID
    const requestId = response.request_id;
    
    // 直接调用回调函数处理响应数据
                if (onProgress) {
      onProgress(response);
            }
    
    return { requestId };
  } catch (error) {
    console.error('发送面试消息出错:', error);
    // 通知调用者出错了
    if (onProgress) {
      onProgress({ error: `发送面试消息出错: ${error.message}` });
    }
    throw error;
  }
};

/**
 * 终止AI面试过程
 * 
 * @param {string} requestId - 要终止的请求ID
 * @returns {Promise<{status: string, message: string}>} - 终止结果
 */
const terminateAIInterview = async (requestId) => {
  try {
    console.log('终止AI面试请求:', requestId);
    
    if (!requestId) {
      throw new Error('未提供请求ID');
    }
    
    const result = await api.terminateAIInterview(requestId);
    return result;
  } catch (error) {
    console.error('终止AI面试请求出错:', error);
    throw error;
  }
};

/**
 * 评估面试结果，生成面试评估报告
 * 
 * @param {Object} interviewGuide - 面试指南数据
 * @param {Array} messagesHistory - 面试对话历史记录
 * @param {Object} [competencyModel] - 胜任力模型数据（可选，如果提供则优先使用）
 * @param {string} [originalRequestId] - 原始面试请求ID（可选）
 * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
 * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象
 * @throws {Error} 当输入验证失败或API调用出错时抛出异常
 */
const evaluateInterview = async (interviewGuide, messagesHistory, competencyModel, originalRequestId, onProgress) => {
  // 处理参数顺序调整的情况
  if (typeof competencyModel === 'function') {
    onProgress = competencyModel;
    competencyModel = undefined;
    originalRequestId = undefined;
  } else if (typeof originalRequestId === 'function') {
    onProgress = originalRequestId;
    originalRequestId = undefined;
  }
  
  try {
    console.log('开始评估面试结果，面试指南:', interviewGuide);
    console.log('面试对话历史:', messagesHistory);
    if (competencyModel) {
      console.log('使用自定义胜任力模型:', competencyModel);
    }
    if (originalRequestId) {
      console.log('原始面试请求ID:', originalRequestId);
    }
    
    // 验证输入
    if (!interviewGuide) {
      throw new Error('请提供面试指南数据');
    }
    
    if (!messagesHistory || !Array.isArray(messagesHistory) || messagesHistory.length === 0) {
      throw new Error('请提供有效的面试对话历史记录');
    }
    
    // 优化面试指南数据，只保留必要的信息
    const optimizedGuide = {
      candidate_summary: interviewGuide.candidate_summary || {},
      position_requirements: interviewGuide.position_requirements || {},
      interview_content_by_layer: interviewGuide.interview_content_by_layer || {},
      potential_concerns: interviewGuide.potential_concerns || [],
      competency_model: competencyModel || interviewGuide.competency_model || {}
    };
    
    // 优化消息历史记录，减少数据量
    const optimizedHistory = messagesHistory.map(msg => {
      // 创建基础消息对象
      const optimizedMsg = {
        role: msg.role,
        content: msg.content
      };
      
      // 如果有context对象，进行处理
      if (msg.context) {
        // 如果context是对象，提取关键信息
        if (typeof msg.context === 'object') {
          // 提取关键信息，如问题类型、是否是追问等
          const optimizedContext = {};
          
          // 保留问题索引信息
          if (msg.context.currentQuestionIndex !== undefined) {
            optimizedContext.questionIndex = msg.context.currentQuestionIndex;
          }
          
          // 标记是否为追问
          if (msg.context.isFollowUp !== undefined) {
            optimizedContext.isFollowUp = msg.context.isFollowUp;
          }
          
          // 保留问题类型信息
          if (msg.context.questionType) {
            optimizedContext.questionType = msg.context.questionType;
          }
          
          // 如果有followup_reason，则添加到上下文中
          if (msg.context.followup_reason !== undefined) {
            optimizedContext.followup_reason = msg.context.followup_reason;
          }
          
          // 如果有core_evaluation_point，则添加到上下文中
          if (msg.context.core_evaluation_point !== undefined) {
            optimizedContext.core_evaluation_point = msg.context.core_evaluation_point;
          }
          
          // 只有当有内容时才添加context
          if (Object.keys(optimizedContext).length > 0) {
            optimizedMsg.context = JSON.stringify(optimizedContext);
          }
        } else if (typeof msg.context === 'string') {
          // 如果已经是字符串，尝试解析并优化
          try {
            const parsedContext = JSON.parse(msg.context);
            const optimizedContext = {};
            
            // 提取关键信息
            if (parsedContext.currentQuestionIndex !== undefined) {
              optimizedContext.currentQuestionIndex = parsedContext.currentQuestionIndex;
            }
            
            if (parsedContext.isFollowUp !== undefined) {
              optimizedContext.isFollowUp = parsedContext.isFollowUp;
            }
            
            if (parsedContext.questionType) {
              optimizedContext.questionType = parsedContext.questionType;
            }
            
            // 如果有followup_reason，则添加到上下文中
            if (parsedContext.followup_reason !== undefined) {
              optimizedContext.followup_reason = parsedContext.followup_reason;
            }
            
            // 如果有core_evaluation_point，则添加到上下文中
            if (parsedContext.core_evaluation_point !== undefined) {
              optimizedContext.core_evaluation_point = parsedContext.core_evaluation_point;
            }
            
            // 只有当有内容时才添加context
            if (Object.keys(optimizedContext).length > 0) {
              optimizedMsg.context = JSON.stringify(optimizedContext);
            }
          } catch (e) {
            // 如果解析失败，保留原始字符串
            optimizedMsg.context = msg.context;
          }
        }
      }
      
      // 添加额外的标记信息
      if (msg.is_follow_up !== undefined) {
        optimizedMsg.is_follow_up = msg.is_follow_up;
      }
      
      if (msg.followup_reason !== undefined) {
        optimizedMsg.followup_reason = msg.followup_reason;
      }
      
      if (msg.core_evaluation_point !== undefined) {
        optimizedMsg.core_evaluation_point = msg.core_evaluation_point;
      }
      
      if (msg.question_index !== undefined) {
        optimizedMsg.question_index = msg.question_index;
      }
      
      if (msg.question_type) {
        optimizedMsg.question_type = msg.question_type;
      }
      
      return optimizedMsg;
    });
    
    // 调用API服务，获取流式响应
    const response = await api.evaluateInterview({
      interview_guide: optimizedGuide,
      messages_history: optimizedHistory,
      competency_model: competencyModel,
      request_id: originalRequestId // 添加原始请求ID
    });
    
    // 获取请求ID，用于后续可能的操作
    const requestId = response.headers.get('X-Request-ID');
    if (!requestId) {
      console.warn('未获取到请求ID');
    }

    // 获取响应体的读取器和解码器，用于读取流数据
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // 启动数据流处理
    (async () => {
      try {
        // 循环读取数据流
        while (true) {
          // 从流中读取一块数据
          const { value, done } = await reader.read();
          // 如果数据流结束，退出循环
          if (done) break;

          // 解码二进制数据为文本
          const chunk = decoder.decode(value, { stream: true });
          // 按SSE格式分割数据行
          const lines = chunk.split('\n\n').filter(line => line.trim());

          // 处理每一行数据
          for (const line of lines) {
            try {
              // SSE格式的数据行以"data: "开头
              if (line.startsWith('data: ')) {
                // 提取JSON数据部分
                const jsonStr = line.substring(6);
                
                
                // 解析JSON数据
                const data = JSON.parse(jsonStr);
                
                
                // 调用进度回调函数，传递解析后的数据
                if (onProgress) {
                  onProgress(data);
                }
                
                // 如果收到终止信号或完成信号，结束流读取
                if (data.terminated || data.finished) {
                  console.log('收到终止或完成信号，结束流读取:', data);
                  reader.cancel("收到终止或完成信号");
                  break;
                }
              }
            } catch (parseError) {
              console.error('解析SSE数据行时出错:', parseError);
              console.error('出错的数据行:', line);
            }
          }
        }
      } catch (streamError) {
        console.error('读取流数据时出错:', streamError);
        // 通知调用者出错了
        if (onProgress) {
          onProgress({ error: `读取流数据时出错: ${streamError.message}` });
        }
      }
    })();

    // 返回请求ID和读取器，以便调用者可以控制流读取
    return { requestId, reader };
  } catch (error) {
    console.error('评估面试结果出错:', error);
    throw error;
  }
};

/**
 * 获取面试评估报告
 * 
 * @param {string} requestId - 面试评估报告的请求ID
 * @returns {Promise<Object>} - 面试评估报告数据
 * @throws {Error} 当API调用出错时抛出异常
 */
const getInterviewEvaluation = async (requestId) => {
  try {
    console.log('获取面试评估报告，请求ID:', requestId);
    
    if (!requestId) {
      throw new Error('未提供请求ID');
    }
    
    const result = await api.getInterviewEvaluation(requestId);
    return result;
  } catch (error) {
    console.error('获取面试评估报告出错:', error);
    throw error;
  }
};

/**
 * 面试指南服务对象
 * 提供以下功能：
 * 1. 生成面试指南 - generateInterviewGuide（支持文件和文本的任意组合）
 * 2. 终止生成请求 - terminateInterviewGuide
 * 3. 开始AI面试 - startAIInterview
 * 4. 发送面试消息 - sendInterviewMessage
 * 5. 终止AI面试 - terminateAIInterview
 * 6. 评估面试结果 - evaluateInterview
 * 7. 获取面试指南 - getInterviewGuide
 * 8. 获取面试评估报告 - getInterviewEvaluation
 */
export default {
  generateInterviewGuide,
  getInterviewGuide,
  terminateInterviewGuide,
  startAIInterview,
  sendInterviewMessage,
  terminateAIInterview,
  evaluateInterview,
  getInterviewEvaluation
};
