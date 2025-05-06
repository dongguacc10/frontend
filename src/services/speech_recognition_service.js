/**
 * 语音识别服务
 * 提供与阿里云语音识别API交互的方法
 */
import api from './api';

/**
 * 获取可用的语音识别模型列表
 * @returns {Promise<Array>} - 模型列表
 */
const getAvailableModels = async () => {
  try {
    const response = await api.getSpeechRecognitionModels();
    return response.models || [];
  } catch (error) {
    console.error('获取语音识别模型列表失败:', error);
    // 返回一个默认的模型列表，以防API调用失败
    return [
      {
        "id": "paraformer-realtime-v2",
        "name": "实时语音识别模型 V2",
        "description": "最新版实时语音识别模型，支持16kHz采样率"
      }
    ];
  }
};

/**
 * 上传音频文件进行识别
 * @param {File} file - 音频文件
 * @param {Object} options - 识别选项
 * @param {string} [options.model="paraformer-realtime-v2"] - 识别模型
 * @param {boolean} [options.semanticPunctuationEnabled=true] - 是否启用语义标点
 * @returns {Promise<Object>} - 识别结果
 */
const recognizeAudioFile = async (file, options = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const model = options.model || 'paraformer-realtime-v2';
    const semanticPunctuationEnabled = options.semanticPunctuationEnabled !== false;
    
    console.log(`识别音频文件: ${file.name}, 模型: ${model}, 语义标点: ${semanticPunctuationEnabled}`);
    
    const response = await api.recognizeAudioFile(formData, model, semanticPunctuationEnabled);
    return response;
  } catch (error) {
    console.error('识别音频文件失败:', error);
    throw error;
  }
};

/**
 * 创建WebSocket连接进行实时语音识别
 * @param {Object} options - 连接选项
 * @param {string} [options.model="paraformer-realtime-v2"] - 识别模型
 * @param {boolean} [options.semanticPunctuationEnabled=true] - 是否启用语义标点
 * @param {Function} [options.onOpen] - 连接打开回调
 * @param {Function} [options.onMessage] - 消息接收回调
 * @param {Function} [options.onError] - 错误回调
 * @param {Function} [options.onClose] - 连接关闭回调
 * @returns {WebSocket} - WebSocket连接对象
 */
const createRecognitionSocket = (options = {}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseUrl = isDevelopment 
    ? 'ws://localhost:8000/api/v1'  // 本地开发环境
    : 'wss://toolapi.sangucloud.com/api/v1';  // 生产环境
  
  const wsUrl = `${baseUrl}/speech_recognition/stream`;
  console.log(`创建WebSocket连接: ${wsUrl}`);
  
  const socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log('WebSocket连接已打开');
    
    try {
      // 添加延时，确保连接完全建立
      setTimeout(() => {
        // 发送初始化参数
        const initParams = {
          model: options.model || 'paraformer-realtime-v2',
          semantic_punctuation_enabled: options.semanticPunctuationEnabled !== false
        };
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(initParams));
          console.log('发送初始化参数:', initParams);
          
          if (options.onOpen) {
            options.onOpen();
          }
        } else {
          console.error('WebSocket连接已关闭，无法发送初始化参数');
          if (options.onError) {
            options.onError(new Error('WebSocket连接已关闭，无法发送初始化参数'));
          }
        }
      }, 100); // 添加100ms的延时
    } catch (error) {
      console.error('WebSocket初始化错误:', error);
      if (options.onError) {
        options.onError(error);
      }
    }
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('收到WebSocket消息:', data);
      
      // 打印更详细的消息信息，帮助调试
      if (data.type === 'text' && data.data) {
        console.log(`收到识别文本消息: ${JSON.stringify(data.data)}`);
      }
      
      if (options.onMessage) {
        // 确保消息正确传递给回调函数
        options.onMessage(data);
      }
    } catch (error) {
      console.error('解析WebSocket消息失败:', error);
      console.error('原始消息数据:', event.data);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket错误:', error);
    
    if (options.onError) {
      options.onError(error);
    }
  };
  
  socket.onclose = (event) => {
    console.log(`WebSocket连接已关闭: 代码=${event.code}, 原因=${event.reason}`);
    
    if (options.onClose) {
      options.onClose(event);
    }
  };
  
  return socket;
};

/**
 * 发送音频数据进行识别
 * @param {WebSocket} socket - WebSocket连接对象
 * @param {Blob|ArrayBuffer} audioData - 音频数据
 * @returns {boolean} - 是否发送成功
 */
const sendAudioData = async (socket, audioData) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    // 检查数据大小是否在推荐范围内
    const sizeKB = audioData.size / 1024;
    
    // 如果数据包超过推荐大小，将其分割成更小的包
    if (sizeKB > 16) {
      console.warn(`音频数据包大小 ${sizeKB.toFixed(2)}KB 超过推荐范围，将分割发送`);
      
      // 将Blob转换为ArrayBuffer
      const arrayBuffer = await audioData.arrayBuffer();
      const chunkSize = 12 * 1024; // 12KB的分割大小，确保在推荐范围内
      
      // 分割并发送数据
      for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
        const chunk = arrayBuffer.slice(i, Math.min(i + chunkSize, arrayBuffer.byteLength));
        const chunkBlob = new Blob([chunk], { type: audioData.type });
        const chunkSizeKB = chunkBlob.size / 1024;
        
        console.log(`发送分割数据包 ${i/chunkSize + 1}/${Math.ceil(arrayBuffer.byteLength/chunkSize)}, 大小: ${chunkSizeKB.toFixed(2)}KB`);
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(chunkBlob);
          // 添加小延迟，避免服务器过载
          await new Promise(resolve => setTimeout(resolve, 10));
        } else {
          console.error('发送分割数据包时WebSocket连接已关闭');
          return false;
        }
      }
      
      return true;
    } else if (sizeKB < 1) {
      console.warn(`音频数据包大小 ${sizeKB.toFixed(2)}KB 小于推荐范围`);
      // 对于过小的数据包，仍然发送，因为可能是录音结束时的最后一小块数据
      socket.send(audioData);
      return true;
    } else {
      // 数据包大小在推荐范围内，直接发送
      socket.send(audioData);
      return true;
    }
  }
  return false;
};

/**
 * 关闭WebSocket连接
 * @param {WebSocket} socket - WebSocket连接对象
 */
const closeRecognitionSocket = (socket) => {
  if (socket) {
    socket.close();
  }
};

// 导出服务对象
const speechRecognitionService = {
  getAvailableModels,
  recognizeAudioFile,
  createRecognitionSocket,
  sendAudioData,
  closeRecognitionSocket
};

export default speechRecognitionService;
