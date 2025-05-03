/**
 * 简历匹配服务
 * 提供与简历匹配相关的功能，包括文件上传匹配和文本输入匹配
 * 所有匹配方法均采用流式处理方式，提供实时反馈
 */
import api from './api';

/**
 * 终止简历匹配生成过程
 * 
 * @param {string} requestId - 要终止的请求ID
 * @returns {Promise<{status: string, message: string}>} - 终止结果
 */
const terminateResumeMatch = async (requestId) => {
  try {
    console.log('终止简历匹配请求:', requestId);
    
    if (!requestId) {
      throw new Error('未提供请求ID');
    }
    
    const result = await api.terminateResumeMatch(requestId);
    return result;
  } catch (error) {
    console.error('终止简历匹配请求出错:', error);
    throw error;
  }
};

/**
 * 解析上传的简历文件
 * 
 * @param {File} file - 要解析的简历文件
 * @returns {Promise<{status: string, content: string, is_resume: boolean}>} - 解析结果
 */
const parseResumeFile = async (file) => {
  try {
    console.log('开始解析简历文件:', file.name);
    
    // 参数验证
    if (!file) {
      console.error('错误: 未提供文件');
      throw new Error('请提供简历文件');
    }
    
    // 文件大小验证 (100MB = 104,857,600 字节)
    if (file.size > 104857600) {
      console.error('错误: 文件过大', file.size);
      throw new Error('文件大小超过100MB限制');
    }
    
    // 创建FormData并添加文件
    const formData = new FormData();
    formData.append('file', file);
    
    // 调用API服务
    const result = await api.parseResumeFile(formData);
    return result;
  } catch (error) {
    console.error('解析简历文件出错:', error);
    throw error;
  }
};

/**
 * 解析上传的职位描述文件
 * 
 * @param {File} file - 要解析的职位描述文件
 * @returns {Promise<{status: string, content: string, is_position: boolean}>} - 解析结果
 */
const parsePositionFile = async (file) => {
  try {
    console.log('开始解析职位描述文件:', file.name);
    
    // 参数验证
    if (!file) {
      console.error('错误: 未提供文件');
      throw new Error('请提供职位描述文件');
    }
    
    // 文件大小验证 (100MB = 104,857,600 字节)
    if (file.size > 104857600) {
      console.error('错误: 文件过大', file.size);
      throw new Error('文件大小超过100MB限制');
    }
    
    // 创建FormData并添加文件
    const formData = new FormData();
    formData.append('file', file);
    
    // 调用API服务
    const result = await api.parsePositionFile(formData);
    return result;
  } catch (error) {
    console.error('解析职位描述文件出错:', error);
    throw error;
  }
};

/**
 * 混合模式匹配简历和职位描述
 * 支持文件和文本的任意组合
 * 
 * 功能说明：
 * 1. 支持四种输入组合：
 *    - 简历文件 + 职位描述文件
 *    - 简历文件 + 职位描述文本
 *    - 简历文本 + 职位描述文件
 *    - 简历文本 + 职位描述文本
 * 2. 也支持直接提供胜任力模型文本，此时不需要提供职位描述
 * 3. 验证输入内容是否有效
 * 4. 通过API发送数据并获取流式响应
 * 5. 实时处理返回的数据并通过回调函数提供给调用者
 * 
 * @param {Object} options - 匹配选项
 * @param {File} [options.resumeFile] - 简历文件（可选）
 * @param {File} [options.positionFile] - 职位描述文件（可选）
 * @param {string} [options.resumeText] - 简历文本内容（可选）
 * @param {string} [options.positionText] - 职位描述文本内容（可选）
 * @param {string} [options.competencyModelText] - 胜任力模型文本（可选，如果提供则直接使用，不再生成）
 * @param {string} [options.hardRequirements] - 硬性条件（可选），用于指定必须满足的条件
 * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
 * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象
 * @throws {Error} 当输入验证失败或API调用出错时抛出异常
 */
const matchResumeMixed = async (options, onProgress) => {
  try {
    console.log('开始混合模式匹配简历和职位描述');
    console.log('匹配选项:', options);
    
    // 步骤1: 参数验证 - 至少需要提供一种简历输入
    const hasResumeInput = options.resumeFile || (options.resumeText && options.resumeText.trim());
    const hasPositionInput = options.positionFile || (options.positionText && options.positionText.trim());
    const hasCompetencyModel = options.competencyModelText && options.competencyModelText.trim();
    
    if (!hasResumeInput) {
      console.error('错误: 未提供简历输入');
      throw new Error('请提供简历文件或文本内容');
    }
    
    // 如果没有提供胜任力模型，则必须提供职位描述
    if (!hasCompetencyModel && !hasPositionInput) {
      console.error('错误: 未提供职位描述输入或胜任力模型');
      throw new Error('请提供职位描述文件、文本内容或胜任力模型');
    }
    
    // 文件大小验证 (100MB = 104,857,600 字节)
    if (options.resumeFile && options.resumeFile.size > 104857600) {
      console.error('错误: 简历文件过大', options.resumeFile.size);
      throw new Error('简历文件大小超过100MB限制');
    }
    
    if (options.positionFile && options.positionFile.size > 104857600) {
      console.error('错误: 职位描述文件过大', options.positionFile.size);
      throw new Error('职位描述文件大小超过100MB限制');
    }
    
    // 文件格式验证
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
    const response = await api.matchResumeMixed({
      resumeFile: options.resumeFile,
      positionFile: options.positionFile,
      resumeText: options.resumeText,
      positionText: options.positionText,
      competencyModelText: options.competencyModelText,
      hardRequirements: options.hardRequirements
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
                  reader.cancel("收到终止或完成信号");
                  
                  // 如果是完成信号，并且包含request_id，自动获取匹配结果
                  if (data.finished && data.request_id) {
                    console.log('匹配完成，自动获取匹配结果，请求ID:', data.request_id);
                    try {
                      const matchingResult = await getMatchingScore(data.request_id);
                      // 通过回调函数传递完整的匹配结果
                      if (onProgress) {
                        onProgress({
                          ...data,
                          matching_result: matchingResult
                        });
                      }
                    } catch (fetchError) {
                      console.error('自动获取匹配结果出错:', fetchError);
                      if (onProgress) {
                        onProgress({
                          error: `获取匹配结果出错: ${fetchError.message}`,
                          finished: true
                        });
                      }
                    }
                  }
                  
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
    console.error('混合模式简历匹配出错:', error);
    throw error;
  }
};

/**
 * 通过请求ID获取简历匹配分数结果
 * 
 * @param {string} requestId - 请求ID
 * @returns {Promise<Object>} - 匹配分数结果
 */
const getMatchingScore = async (requestId) => {
  try {
    console.log('获取匹配分数结果，请求ID:', requestId);
    
    if (!requestId) {
      throw new Error('未提供请求ID');
    }
    
    const result = await api.getMatchingScore(requestId);
    console.log('获取到的匹配分数结果:', result);
    return result;
  } catch (error) {
    console.error('获取匹配分数结果出错:', error);
    throw error;
  }
};

/**
 * 简历匹配服务对象
 * 提供以下功能：
 * 1. 混合模式匹配 - matchResumeMixed（支持文件和文本的任意组合）
 * 2. 终止匹配请求 - terminateResumeMatch
 * 3. 解析简历文件 - parseResumeFile
 * 4. 解析职位描述文件 - parsePositionFile
 * 5. 获取匹配分数结果 - getMatchingScore
 */
export default {
  matchResumeMixed,
  terminateResumeMatch,
  parseResumeFile,
  parsePositionFile,
  getMatchingScore
};
