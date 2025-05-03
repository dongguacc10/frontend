/**
 * 简历解析服务
 * 提供与简历解析相关的功能，包括文件上传解析和文本输入解析
 * 所有解析方法均采用流式处理方式，提供实时反馈
 */
import api from './api';

/**
 * 上传简历文件并流式解析为结构化数据
 * 
 * 功能说明：
 * 1. 接收用户上传的简历文件（支持PDF、Word、TXT等格式）
 * 2. 验证文件格式和大小
 * 3. 通过API上传文件并获取流式响应
 * 4. 实时处理返回的数据并通过回调函数提供给调用者
 * 
 * 流程：
 * 1. 验证文件 -> 2. 创建FormData -> 3. 调用API -> 4. 获取流式响应 -> 5. 处理数据流
 * 
 * @param {File} file - 要上传的简历文件对象
 * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
 *                               回调参数格式: {
 *                                 request_id: string,
 *                                 content_chunk: string,
 *                                 resume_data: object,
 *                                 raw_content: string,
 *                                 finished: boolean,
 *                                 error: string
 *                               }
 * @param {string} [customSchema] - 可选，自定义的JSON结构模板，如果不提供则使用默认模板
 * @param {string} [userId] - 可选，用户ID，用于记录执行结果
 * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象，可用于控制流的读取
 * @throws {Error} 当文件验证失败或API调用出错时抛出异常
 */
const parseResumeFileStream = async (file, onProgress, customSchema = null, userId = null) => {
  try {
    console.log('开始上传简历文件流式解析:', file.name);
    
    // 步骤1: 参数验证
    if (!file) {
      console.error('错误: 未提供文件');
      throw new Error('未提供文件');
    }
    
    // 文件大小验证 (100MB = 104,857,600 字节)
    if (file.size > 104857600) {
      console.error('错误: 文件过大', file.size);
      throw new Error('文件大小超过100MB限制');
    }
    
    // 文件格式验证
    const fileExtension = file.name.split('.').pop().toLowerCase();
    console.log('文件扩展名:', fileExtension);
    
    // 支持的文件格式
    const supportedFormats = ['pdf', 'txt', 'doc', 'docx', 'json'];
    if (!supportedFormats.includes(fileExtension)) {
      console.error('错误: 不支持的文件格式', fileExtension);
      throw new Error(`不支持的文件格式: ${fileExtension}，支持的格式有: ${supportedFormats.join(', ')}`);
    }
    
    // 步骤2: 创建FormData并添加文件
    const formData = new FormData();
    formData.append('file', file);
    
    // 步骤3: 调用API服务，获取流式响应
    // 这里调用api.js中的parseResumeFileStream方法，该方法会向后端发送请求
    const response = await api.parseResumeFileStream(formData, customSchema, userId);
    
    // 步骤4: 获取请求ID，用于后续可能的操作（如终止请求）
    const requestId = response.headers.get('X-Request-ID');
    if (!requestId) {
      throw new Error('未获取到请求ID');
    }

    // 获取响应体的读取器和解码器，用于读取流数据
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // 步骤5: 启动数据流处理
    // 注意：这是一个异步自执行函数，会在后台持续处理数据流
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
                // 获取原始数据
                const rawLine = line.slice(6);
               
                
                // 尝试解析 JSON 数据，但使用 try-catch 捕获可能的错误
                let data;
                try {
                  data = JSON.parse(rawLine);
                } catch (jsonError) {
                  console.warn('JSON 解析错误，使用安全格式:', jsonError);
                  // 创建一个安全的数据对象
                  data = {
                    request_id: requestId,
                    content_chunk: rawLine,
                    error: `JSON 解析错误: ${jsonError.message}`,
                    finished: false
                  };
                }
                
               
                
                // 调用进度回调函数，直接传递解析后的数据
                if (onProgress) {
                  onProgress(data);
                }
                
                // 如果收到终止信号或完成信号，结束流读取
                if (data.terminated || data.finished) {
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
        
        // 数据流处理完成
        console.log('简历解析数据流处理完成');
        
      } catch (streamError) {
        console.error('读取数据流时出错:', streamError);
        // 通知调用者出错了
        if (onProgress) {
          onProgress({ error: `读取数据流时出错: ${streamError.message}` });
        }
      }
    })();

    // 返回请求ID和reader，以便外部可以控制终止
    return { requestId, reader };
  } catch (error) {
    console.error('简历文本流式解析服务错误:', error);
    throw error;
  }
};

/**
 * 流式解析简历文本为结构化数据
 * 
 * 功能说明：
 * 1. 接收用户输入的简历文本内容
 * 2. 验证文本内容是否为空
 * 3. 通过API发送文本并获取流式响应
 * 4. 实时处理返回的数据并通过回调函数提供给调用者
 * 
 * 流程：
 * 1. 验证文本 -> 2. 调用API -> 3. 获取流式响应 -> 4. 处理数据流
 * 
 * 与文件上传解析的区别：
 * - 不需要文件格式和大小验证
 * - 直接发送文本内容而非FormData
 * - 其他流程基本相同
 * 
 * @param {string} content - 简历文本内容
 * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
 *                               回调参数格式与parseResumeFileStream相同
 * @param {string} [customSchema] - 可选，自定义的JSON结构模板，如果不提供则使用默认模板
 * @param {string} [userId] - 可选，用户ID，用于记录执行结果
 * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象
 * @throws {Error} 当文本验证失败或API调用出错时抛出异常
 */
const parseResumeTextStream = async (content, onProgress, customSchema = null, userId = null) => {
  try {
    
    // 步骤1: 参数验证
    if (!content) {
      console.error('错误: 未提供文本内容');
      throw new Error('未提供文本内容');
    }
    
    // 步骤2: 调用API服务，获取流式响应
    // 这里调用api.js中的parseResumeTextStream方法，该方法会向后端发送请求
    const response = await api.parseResumeTextStream(content, customSchema, userId);
    
    // 步骤3: 获取请求ID，用于后续可能的操作（如终止请求）
    const requestId = response.headers.get('X-Request-ID');
    if (!requestId) {
      throw new Error('未获取到请求ID');
    }

    // 获取响应体的读取器和解码器，用于读取流数据
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // 步骤4: 启动数据流处理
    // 注意：这是一个异步自执行函数，会在后台持续处理数据流
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
                // 获取原始数据
                const rawLine = line.slice(6);
                
                // 尝试解析 JSON 数据，但使用 try-catch 捕获可能的错误
                let data;
                try {
                  data = JSON.parse(rawLine);
                } catch (jsonError) {
                  console.warn('JSON 解析错误，使用安全格式:', jsonError);
                  // 创建一个安全的数据对象
                  data = {
                    request_id: requestId,
                    content_chunk: rawLine,
                    error: `JSON 解析错误: ${jsonError.message}`,
                    finished: false
                  };
                }
                
                // 调用进度回调函数，直接传递解析后的数据
                if (onProgress) {
                  onProgress(data);
                }
                
                // 如果收到终止信号或完成信号，结束流读取
                if (data.terminated || data.finished) {
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
        
        // 数据流处理完成
        console.log('简历解析数据流处理完成');
        
      } catch (streamError) {
        console.error('读取数据流时出错:', streamError);
        // 通知调用者出错了
        if (onProgress) {
          onProgress({ error: `读取数据流时出错: ${streamError.message}` });
        }
      }
    })();

    // 返回请求ID和reader，以便外部可以控制终止
    return { requestId, reader };
  } catch (error) {
    console.error('简历文本流式解析服务错误:', error);
    throw error;
  }
};

/**
 * 获取简历解析结果
 * @param {string} requestId - 请求ID
 * @returns {Promise<Object>} - 解析结果对象
 */
export const getParseResult = async (requestId) => {
  try {
    // 调用API获取解析结果
    const result = await api.getResumeParseResult(requestId);
    
    if (!result.success) {
      throw new Error(result.message || '获取解析结果失败');
    }
    
    return result;
  } catch (error) {
    console.error('获取简历解析结果时出错:', error);
    throw error;
  }
};

/**
 * 简历解析服务对象
 * 提供三个主要功能：
 * 1. 文件上传流式解析 - parseResumeFileStream
 * 2. 文本内容流式解析 - parseResumeTextStream
 * 3. 获取解析结果 - getParseResult
 */
const resumeParseService = {
  parseResumeFileStream,
  parseResumeTextStream,
  getParseResult
};

export default resumeParseService;
