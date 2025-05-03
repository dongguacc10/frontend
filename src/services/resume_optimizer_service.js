/**
 * 简历优化服务
 * 提供与简历优化相关的功能，包括文件上传优化和文本输入优化
 * 所有优化方法均采用流式处理方式，提供实时反馈
 */
import api from './api';

/**
 * 上传简历文件并流式优化
 * 
 * 功能说明：
 * 1. 接收用户上传的简历文件（支持PDF、Word、TXT、图片等格式）
 * 2. 验证文件格式和大小
 * 3. 通过API上传文件并获取流式响应
 * 4. 实时处理返回的数据并通过回调函数提供给调用者
 * 
 * 流程：
 * 1. 验证文件 -> 2. 创建FormData -> 3. 调用API -> 4. 获取流式响应 -> 5. 处理数据流
 * 
 * @param {File} file - 要上传的简历文件对象
 * @param {string} jobDescription - 职位描述文本内容（可选）
 * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
 *                               回调参数格式: {
 *                                 request_id: string,
 *                                 content_chunk: string,
 *                                 file_content: string,
 *                                 optimization_data: object,
 *                                 finished: boolean,
 *                                 error: string
 *                               }
 * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象，可用于控制流的读取
 * @throws {Error} 当文件验证失败或API调用出错时抛出异常
 */
const optimizeResumeFileStream = async (file, jobDescription = '', onProgress) => {
  try {
    console.log('开始上传简历文件流式优化:', file.name);
    
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
    const supportedFormats = ['pdf', 'txt', 'doc', 'docx', 'json', 'jpg', 'jpeg', 'png'];
    if (!supportedFormats.includes(fileExtension)) {
      console.error('错误: 不支持的文件格式', fileExtension);
      throw new Error(`不支持的文件格式: ${fileExtension}，支持的格式有: ${supportedFormats.join(', ')}`);
    }
    
    // 步骤2: 创建FormData并添加文件
    const formData = new FormData();
    formData.append('file', file);
    
    // 如果提供了职位描述，也添加到FormData中
    if (jobDescription) {
      formData.append('job_description', jobDescription);
    }
    
    // 步骤3: 调用API服务，获取流式响应
    const response = await api.optimizeResumeFileStream(formData);
    
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
        // 用于累积解析结果
        let fileContent = '';    // 文件内容
        // 跟踪最后接收到的优化ID
        let lastOptimizationRequestId = requestId;
        
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
                
                // 处理不同类型的数据
                if (data.is_file_content) {
                  // 如果是文件内容，保存文件内容
                  fileContent = data.file_content;
                  
                  // 调用进度回调函数，将数据传递给调用者
                  onProgress({
                    request_id: data.request_id,
                    content_chunk: '',
                    file_content: fileContent,
                    optimization_data: null,
                    finished: false,
                    error: null
                  });
                } else if (data.content_chunk) {
                  // 如果是内容块，传递内容块
                  // 更新最后接收到的优化ID
                  if (data.request_id) {
                    lastOptimizationRequestId = data.request_id;
                  }
                  
                  onProgress({
                    request_id: data.request_id,
                    content_chunk: data.content_chunk,
                    file_content: fileContent,
                    optimization_data: null,
                    finished: data.finished || false,
                    error: data.error || null
                  });
                } else if (data.optimization_data) {
                  // 如果包含优化结果，传递完整的优化结果
                  console.log('收到简历优化结果');
                  
                  // 调用进度回调函数，将优化结果传递给调用者
                  onProgress({
                    request_id: data.request_id,
                    content_chunk: '',
                    file_content: fileContent,
                    optimization_data: data.optimization_data,
                    finished: data.finished || false,
                    error: data.error || null
                  });
                } else if (data.error) {
                  // 如果有错误，传递错误信息
                  console.error('优化过程中出错:', data.error);
                  
                  // 调用进度回调函数，将错误信息传递给调用者
                  onProgress({
                    request_id: data.request_id,
                    content_chunk: '',
                    file_content: fileContent,
                    optimization_data: null,
                    finished: true,
                    error: data.error
                  });
                }
              }
            } catch (error) {
              console.error('处理数据行时出错:', error, line);
              // 继续处理下一行，不中断整个流程
            }
          }
        }
        
        // 数据流处理完成
        console.log('简历优化数据流处理完成');
        
        // 在数据流处理完成后，发送一个明确的完成通知
        onProgress({
          request_id: lastOptimizationRequestId, // 使用最后接收到的优化ID
          content_chunk: '',
          file_content: fileContent,
          optimization_data: null,
          finished: true,
          error: null
        });
        
      } catch (error) {
        console.error('读取数据流时出错:', error);
        // 调用进度回调函数，将错误信息传递给调用者
        onProgress({
          request_id: requestId,
          content_chunk: '',
          file_content: '',
          optimization_data: null,
          finished: true,
          error: `读取数据流时出错: ${error.message}`
        });
      }
    })();
    
    // 返回请求ID和读取器，便于调用者控制流的读取（如终止请求）
    return { requestId, reader };
    
  } catch (error) {
    console.error('简历优化过程中出错:', error);
    // 将错误信息传递给调用者
    onProgress({
      request_id: '',
      content_chunk: '',
      file_content: '',
      optimization_data: null,
      finished: true,
      error: error.message
    });
    // 重新抛出错误，让调用者可以捕获
    throw error;
  }
};

/**
 * 流式优化简历文本内容
 * 
 * 功能说明：
 * 1. 接收用户输入的简历文本内容和职位描述（可选）
 * 2. 验证文本内容是否为空
 * 3. 通过API发送文本并获取流式响应
 * 4. 实时处理返回的数据并通过回调函数提供给调用者
 * 
 * 流程：
 * 1. 验证文本 -> 2. 调用API -> 3. 获取流式响应 -> 4. 处理数据流
 * 
 * @param {string} resumeContent - 简历文本内容
 * @param {string} jobDescription - 职位描述文本内容（可选）
 * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
 *                               回调参数格式: {
 *                                 request_id: string,
 *                                 content_chunk: string,
 *                                 optimization_data: object,
 *                                 finished: boolean,
 *                                 error: string
 *                               }
 * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象
 * @throws {Error} 当文本验证失败或API调用出错时抛出异常
 */
const optimizeResumeTextStream = async (resumeContent, jobDescription = '', onProgress) => {
  try {
    console.log('开始简历文本流式优化');
    
    // 步骤1: 参数验证
    if (!resumeContent) {
      console.error('错误: 未提供简历文本内容');
      throw new Error('未提供简历文本内容');
    }
    
    // 步骤2: 调用API服务，获取流式响应
    const response = await api.optimizeResumeTextStream({
      resume_content: resumeContent,
      job_description: jobDescription || null
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
        // 跟踪最后接收到的优化ID
        let lastOptimizationRequestId = requestId;
        
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
                
                // 处理不同类型的数据
                if (data.content_chunk) {
                  // 如果是内容块，传递内容块
                  // 更新最后接收到的优化ID
                  if (data.request_id) {
                    lastOptimizationRequestId = data.request_id;
                  }
                  
                  onProgress({
                    request_id: data.request_id,
                    content_chunk: data.content_chunk,
                    optimization_data: null,
                    finished: data.finished || false,
                    error: data.error || null
                  });
                } else if (data.optimization_data) {
                  // 如果包含优化结果，传递完整的优化结果
                  console.log('收到简历优化结果');
                  
                  // 调用进度回调函数，将优化结果传递给调用者
                  onProgress({
                    request_id: data.request_id,
                    content_chunk: '',
                    optimization_data: data.optimization_data,
                    finished: data.finished || false,
                    error: data.error || null
                  });
                } else if (data.error) {
                  // 如果有错误，传递错误信息
                  console.error('优化过程中出错:', data.error);
                  
                  // 调用进度回调函数，将错误信息传递给调用者
                  onProgress({
                    request_id: data.request_id,
                    content_chunk: '',
                    optimization_data: null,
                    finished: true,
                    error: data.error
                  });
                }
              }
            } catch (error) {
              console.error('处理数据行时出错:', error, line);
              // 继续处理下一行，不中断整个流程
            }
          }
        }
        
        // 数据流处理完成
        console.log('简历优化数据流处理完成');
        
        // 在数据流处理完成后，发送一个明确的完成通知
        onProgress({
          request_id: lastOptimizationRequestId, // 使用最后接收到的优化ID
          content_chunk: '',
          optimization_data: null,
          finished: true,
          error: null
        });
        
      } catch (error) {
        console.error('读取数据流时出错:', error);
        // 调用进度回调函数，将错误信息传递给调用者
        onProgress({
          request_id: requestId,
          content_chunk: '',
          optimization_data: null,
          finished: true,
          error: `读取数据流时出错: ${error.message}`
        });
      }
    })();
    
    // 返回请求ID和读取器，便于调用者控制流的读取（如终止请求）
    return { requestId, reader };
    
  } catch (error) {
    console.error('简历优化过程中出错:', error);
    // 将错误信息传递给调用者
    onProgress({
      request_id: '',
      content_chunk: '',
      optimization_data: null,
      finished: true,
      error: error.message
    });
    // 重新抛出错误，让调用者可以捕获
    throw error;
  }
};

/**
 * 终止简历优化生成过程
 * 
 * @param {string} requestId - 要终止的请求ID
 * @returns {Promise<{status: string, message: string}>} - 终止结果
 */
const terminateResumeOptimization = async (requestId) => {
  try {
    console.log('终止简历优化请求:', requestId);
    const result = await api.terminateResumeOptimization(requestId);
    console.log('终止简历优化结果:', result);
    return result;
  } catch (error) {
    console.error('终止简历优化时出错:', error);
    throw error;
  }
};

/**
 * 获取简历优化结果
 * 
 * @param {string} requestId - 请求ID
 * @returns {Promise<Object>} - 优化结果对象
 */
const getResumeOptimizationResult = async (requestId) => {
  try {
    console.log('获取简历优化结果:', requestId);
    const result = await api.getResumeOptimizationResult(requestId);
    console.log('获取简历优化结果成功:', result);
    return result;
  } catch (error) {
    console.error('获取简历优化结果时出错:', error);
    throw error;
  }
};

/**
 * 获取简历解析结果
 * 
 * @param {string} requestId - 请求ID
 * @returns {Promise<Object>} - 解析结果对象
 */
const getResumeParseResult = async (requestId) => {
  try {
    console.log('获取简历解析结果:', requestId);
    const result = await api.getResumeParseResult(requestId);
    console.log('获取简历解析结果成功:', result);
    return result;
  } catch (error) {
    console.error('获取简历解析结果时出错:', error);
    throw error;
  }
};

/**
 * 简历优化服务对象
 * 提供五个主要功能：
 * 1. 文件上传流式优化 - optimizeResumeFileStream
 * 2. 文本输入流式优化 - optimizeResumeTextStream
 * 3. 终止优化生成过程 - terminateResumeOptimization
 * 4. 获取优化结果 - getResumeOptimizationResult
 * 5. 获取解析结果 - getResumeParseResult
 */
export default {
  optimizeResumeFileStream,
  optimizeResumeTextStream,
  terminateResumeOptimization,
  getResumeOptimizationResult,
  getResumeParseResult
};
