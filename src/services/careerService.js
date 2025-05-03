/**
 * 就业服务助手服务
 * 提供与就业服务助手相关的功能服务
 */
import api from './api';

/**
 * 就业服务助手服务
 */
const careerService = {
  /**
   * 与就业服务助手进行对话
   * @param {string} message - 用户消息
   * @param {Array} history - 历史对话记录
   * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
   * @param {string} location - 用户位置信息（可选）
   * @returns {Promise<{requestId: string, reader: ReadableStreamDefaultReader}>} - 包含请求ID和流读取器的对象
   */
  chatWithAssistant: async (message, history = [], onProgress, location = '南溪') => {
    try {
      console.log('就业服务助手对话开始');
      console.log('用户消息:', message);
      console.log('历史记录:', history);
      console.log('位置信息:', location);
      
      // 参数验证
      if (!message) {
        console.error('错误: 消息内容为空');
        throw new Error('消息内容不能为空');
      }

      console.log('调用API服务，准备获取流式响应');
      // 调用API服务，获取流式响应
      const response = await api.chatWithAssistant(message, history, true, location);
      console.log('API响应状态:', response.status);
      
      // 尝试从响应头获取请求ID
      let requestId = response.headers.get('X-Request-ID');
      console.log('从响应头获取到请求ID:', requestId);
      
      // 如果从响应头无法获取请求ID，将在首个SSE事件中获取
      // 创建一个Promise，用于在获取到请求ID后解析
      let requestIdPromise;
      let requestIdResolver;
      
      // 如果没有从响应头获取到请求ID，则创建一个Promise等待从SSE事件中获取
      if (!requestId) {
        console.log('从响应头未获取到请求ID，将从SSE事件中获取');
        requestIdPromise = new Promise((resolve) => {
          requestIdResolver = resolve;
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      console.log('创建流读取器和解码器成功');

      // 启动数据读取
      (async () => {
        try {
          console.log('开始读取流数据');
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              console.log('流数据读取完成');
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            console.log('接收到数据块:', chunk);
            const lines = chunk.split('\n').filter(line => line.trim());
            console.log('解析数据行数:', lines.length);

            for (const line of lines) {
              try {
                if (line.startsWith('data: ')) {
                  const eventData = JSON.parse(line.slice(6));
                  console.log('解析到事件数据:', eventData);
                  
                  // 检查事件数据中是否包含请求ID
                  if (!requestId && eventData.request_id) {
                    requestId = eventData.request_id;
                    console.log('从SSE事件中获取到请求ID:', requestId);
                    
                    // 如果有等待请求ID的Promise，则解析它
                    if (requestIdResolver) {
                      requestIdResolver(requestId);
                    }
                  }
                  
                  if (onProgress) {
                    // 将标准化的事件数据传递给回调函数
                    onProgress(eventData);
                  }
                  
                  // 检查是否收到终止信号
                  if (eventData.event === 'TERMINATED') {
                    console.log('收到终止信号');
                    return;
                  }
                }
              } catch (error) {
                console.error('解析流数据出错:', error);
              }
            }
          }
        } catch (error) {
          console.error('读取流数据出错:', error);
          throw error;
        }
      })();

      // 如果需要等待从SSE事件中获取请求ID，则等待Promise解析
      if (requestIdPromise) {
        console.log('等待从SSE事件中获取请求ID');
        requestId = await requestIdPromise;
      }
      
      if (!requestId) {
        console.error('错误: 未能从响应头或SSE事件中获取到请求ID');
        throw new Error('未能获取到请求ID');
      }

      console.log('返回请求ID和reader');
      // 返回请求ID和reader，以便外部可以控制终止
      return { requestId, reader };
    } catch (error) {
      console.error('就业服务助手对话服务错误:', error);
      throw error;
    }
  },

  /**
   * 终止就业服务助手对话生成
   * @param {string} requestId - 要终止的请求ID
   * @returns {Promise<void>}
   */
  terminateChat: async (requestId) => {
    try {
      console.log('开始终止对话生成，请求ID:', requestId);
      const response = await api.terminateCareerChat(requestId);
      console.log('终止请求成功，响应:', response);
      return response;
    } catch (error) {
      console.error('终止请求失败:', error);
      throw error;
    }
  },
  
  /**
   * 获取更多职位信息
   * @param {object} params - 搜索参数
   * @returns {Promise<object>} - 职位搜索结果
   */
  getMorePositions: async (params) => {
    try {
      console.log('获取更多职位信息，参数:', params);
      const result = await api.getMorePositions(params);
      console.log('获取更多职位信息成功:', result);
      return result;
    } catch (error) {
      console.error('获取更多职位信息失败:', error);
      throw error;
    }
  }
};

export default careerService;
