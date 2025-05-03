/**
 * 语音识别服务
 * 提供与讯飞语音识别API交互的功能
 */

// 后端API基础URL
// 根据环境自动切换API基础URL
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:8000/api/v1'  // 本地开发环境
  : 'https://toolapi.sangucloud.com/api/v1';  // 生产环境

// WebSocket基础URL
const WS_BASE_URL = isDevelopment
  ? 'ws://localhost:8000/api/v1'  // 本地开发环境
  : 'wss://toolapi.sangucloud.com/api/v1';  // 生产环境

/**
 * 上传音频文件进行语音识别
 * 
 * @param {Blob} audioBlob - 音频数据Blob对象
 * @returns {Promise<{task_id: string, message: string}>} - 包含任务ID的响应
 */
const recognizeSpeech = async (audioBlob) => {
  try {
    console.log('开始语音识别请求');
    
    // 验证输入
    if (!audioBlob) {
      throw new Error('未提供音频数据');
    }
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    
    // 发送请求
    const response = await fetch(`${API_BASE_URL}/speech_recognition/recognize_speech`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`语音识别请求失败: ${errorData.detail || response.statusText}`);
    }
    
    const result = await response.json();
    console.log('语音识别请求成功:', result);
    return result;
  } catch (error) {
    console.error('语音识别请求出错:', error);
    throw error;
  }
};

/**
 * 获取语音识别结果
 * 
 * @param {string} taskId - 任务ID
 * @returns {Promise<{status: string, success: boolean, result: string}>} - 识别结果
 */
const getRecognitionResult = async (taskId) => {
  try {
    console.log('获取语音识别结果:', taskId);
    
    if (!taskId) {
      throw new Error('未提供任务ID');
    }
    
    const response = await fetch(`${API_BASE_URL}/speech_recognition/recognition_result/${taskId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`获取语音识别结果失败: ${errorData.detail || response.statusText}`);
    }
    
    const result = await response.json();
    console.log('获取语音识别结果成功:', result);
    return result;
  } catch (error) {
    console.error('获取语音识别结果出错:', error);
    throw error;
  }
};

/**
 * 轮询获取语音识别结果
 * 
 * @param {string} taskId - 任务ID
 * @param {number} maxAttempts - 最大尝试次数
 * @param {number} interval - 轮询间隔(毫秒)
 * @param {function} onSuccess - 成功回调函数
 * @param {function} onError - 错误回调函数
 */
const pollRecognitionResult = async (taskId, maxAttempts = 30, interval = 1000, onSuccess, onError) => {
  let attempts = 0;
  
  const poll = async () => {
    try {
      if (attempts >= maxAttempts) {
        if (onError) {
          onError(new Error('语音识别超时'));
        }
        return;
      }
      
      attempts++;
      const result = await getRecognitionResult(taskId);
      
      // 检查结果状态
      if (result.status === 'pending') {
        // 继续轮询
        setTimeout(poll, interval);
        return;
      }
      
      // 如果结果已经准备好
      if (result.success === true) {
        if (onSuccess) {
          onSuccess(result.result);
        }
        return;
      } else if (result.success === false) {
        if (onError) {
          onError(new Error(result.error || '语音识别失败'));
        }
        return;
      }
      
      // 如果没有明确的成功或失败状态，继续轮询
      setTimeout(poll, interval);
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  };
  
  // 开始轮询
  poll();
};

/**
 * 实时语音识别类
 * 使用WebSocket与后端进行实时通信
 */
class RealtimeSpeechRecognition {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.isConnected = false;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.stream = null;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onReadyCallback = null;
    this.onFinalResultCallback = null;
  }
  
  /**
   * 初始化WebSocket连接
   * 
   * @returns {Promise<string>} - 会话ID
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // 生成会话ID
        this.sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // 创建WebSocket连接
        this.ws = new WebSocket(`${WS_BASE_URL}/speech_recognition/ws/speech/${this.sessionId}`);
        
        // 设置WebSocket事件处理
        this.ws.onopen = () => {
          console.log('WebSocket连接已打开');
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('收到WebSocket消息:', message);
            
            // 处理不同类型的消息
            switch (message.type) {
              case 'ready':
                this.isConnected = true;
                if (this.onReadyCallback) {
                  this.onReadyCallback(message.message);
                }
                resolve(this.sessionId);
                break;
                
              case 'partial_result':
                if (this.onResultCallback) {
                  this.onResultCallback(message.result);
                }
                break;
                
              case 'final_result':
                if (this.onFinalResultCallback) {
                  this.onFinalResultCallback(message.result);
                }
                break;
                
              case 'error':
                console.error('语音识别错误:', message.error);
                if (this.onErrorCallback) {
                  this.onErrorCallback(new Error(message.error));
                }
                break;
                
              default:
                console.log('未处理的消息类型:', message.type);
            }
          } catch (error) {
            console.error('处理WebSocket消息出错:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error);
          this.isConnected = false;
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error('WebSocket连接错误'));
          }
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket连接已关闭');
          this.isConnected = false;
        };
      } catch (error) {
        console.error('创建WebSocket连接出错:', error);
        reject(error);
      }
    });
  }
  
  /**
   * 开始录音并实时发送音频数据
   * 
   * @returns {Promise<void>}
   */
  async startRecording() {
    if (!this.isConnected) {
      throw new Error('WebSocket未连接');
    }
    
    if (this.isRecording) {
      throw new Error('已经在录音中');
    }
    
    try {
      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 检查浏览器支持的MIME类型
      let mimeType = 'audio/webm';
      const supportedTypes = [
        'audio/webm;codecs=pcm',
        'audio/wav',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];
      
      // 查找浏览器支持的最佳MIME类型
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log(`使用音频格式: ${mimeType}`);
          break;
        }
      }
      
      // 创建音频上下文
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 创建MediaRecorder实例
      this.mediaRecorder = new MediaRecorder(this.stream, { 
        mimeType,
        audioBitsPerSecond: 16000
      });
      
      // 设置数据可用事件处理
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.isRecording && this.ws && this.ws.readyState === WebSocket.OPEN) {
          // 将Blob转换为ArrayBuffer
          const arrayBuffer = await event.data.arrayBuffer();
          
          // 发送音频数据
          this.ws.send(arrayBuffer);
        }
      };
      
      // 设置录音结束事件处理
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        
        // 关闭麦克风
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        // 关闭音频上下文
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
      };
      
      // 开始录音，每100毫秒获取一次数据
      this.mediaRecorder.start(100);
      this.isRecording = true;
      
      console.log('开始实时语音识别录音');
    } catch (error) {
      console.error('开始录音出错:', error);
      throw error;
    }
  }
  
  /**
   * 停止录音
   * 
   * @returns {Promise<void>}
   */
  async stopRecording() {
    if (!this.isRecording) {
      return;
    }
    
    try {
      // 停止MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      // 发送结束会话请求
      await fetch(`${API_BASE_URL}/speech_recognition/end_session/${this.sessionId}`, {
        method: 'POST'
      });
      
      console.log('停止实时语音识别录音');
    } catch (error) {
      console.error('停止录音出错:', error);
      throw error;
    }
  }
  
  /**
   * 关闭WebSocket连接
   */
  disconnect() {
    try {
      // 先停止录音
      if (this.isRecording) {
        this.stopRecording();
      }
      
      // 关闭WebSocket连接
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.isConnected = false;
      this.sessionId = null;
      
      console.log('已断开WebSocket连接');
    } catch (error) {
      console.error('断开连接出错:', error);
    }
  }
  
  /**
   * 设置实时结果回调
   * 
   * @param {function} callback - 回调函数，参数为识别结果文本
   */
  onResult(callback) {
    this.onResultCallback = callback;
  }
  
  /**
   * 设置最终结果回调
   * 
   * @param {function} callback - 回调函数，参数为最终识别结果文本
   */
  onFinalResult(callback) {
    this.onFinalResultCallback = callback;
  }
  
  /**
   * 设置错误回调
   * 
   * @param {function} callback - 回调函数，参数为错误对象
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }
  
  /**
   * 设置就绪回调
   * 
   * @param {function} callback - 回调函数，参数为就绪消息
   */
  onReady(callback) {
    this.onReadyCallback = callback;
  }
}

/**
 * 语音识别服务对象
 * 提供以下功能：
 * 1. 上传音频进行识别 - recognizeSpeech
 * 2. 获取识别结果 - getRecognitionResult
 * 3. 轮询获取识别结果 - pollRecognitionResult
 * 4. 实时语音识别 - RealtimeSpeechRecognition
 */
export default {
  recognizeSpeech,
  getRecognitionResult,
  pollRecognitionResult,
  RealtimeSpeechRecognition
};
