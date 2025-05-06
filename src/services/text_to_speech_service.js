/**
 * 语音合成服务
 * 提供与MiniMax语音合成API交互的方法
 */
import api from './api';

/**
 * 将文本转换为语音
 * @param {Object} params - 语音合成参数
 * @param {string} params.text - 要转换的文本内容
 * @param {string} [params.voiceId="male-qn-qingse"] - 声音ID
 * @param {number} [params.speed=1.0] - 语速，范围 0.5-2.0
 * @param {number} [params.vol=1.0] - 音量，范围 0.5-2.0
 * @param {number} [params.pitch=0.0] - 音调，范围 -12-12（需为整数）
 * @param {string} [params.emotion="neutral"] - 情感，可选值包括 neutral, happy, sad, angry 等
 * @param {number} [params.sampleRate=32000] - 采样率
 * @param {number} [params.bitrate=128000] - 比特率
 * @param {string} [params.audioFormat="mp3"] - 音频格式，可选值 mp3, wav
 * @param {number} [params.channel=1] - 声道数
 * @param {Object} [params.pronunciationDict=null] - 发音词典
 * @param {boolean} [params.uploadToOss=true] - 是否上传到OSS并返回链接
 * @param {Array} [params.timberWeights=null] - 音色权重列表，用于混合多种音色
 * @returns {Promise<Object>} - 语音合成结果
 */
const synthesizeSpeech = async (params) => {
  try {
    console.log('调用语音合成API，参数:', params);
    
    const response = await api.synthesizeSpeech({
      text: params.text,
      voice_id: params.voiceId || 'male-qn-qingse',
      speed: params.speed || 1.0,
      vol: params.vol || 1.0,
      pitch: Math.round(params.pitch || 0), // 确保pitch是整数
      emotion: params.emotion || 'neutral',
      sample_rate: params.sampleRate || 32000,
      bitrate: params.bitrate || 128000,
      audio_format: params.audioFormat || 'mp3',
      channel: params.channel || 1,
      pronunciation_dict: params.pronunciationDict || null,
      upload_to_oss: params.uploadToOss !== undefined ? params.uploadToOss : true,
      timber_weights: params.timberWeights || null
    });
    
    // 检查响应是否为Response对象（二进制音频数据）
    if (response instanceof Response) {
      console.log('收到二进制音频数据响应');
      
      // 获取音频格式
      const audioFormat = params.audioFormat || 'mp3';
      const contentType = response.headers.get('Content-Type');
      console.log(`响应Content-Type: ${contentType}`);
      
      // 将响应数据转换为ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      console.log(`接收到音频数据，大小: ${arrayBuffer.byteLength} 字节`);
      
      // 确定正确的MIME类型
      const mimeType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      
      // 创建Blob对象
      const blob = new Blob([arrayBuffer], { type: mimeType });
      console.log(`创建了 ${blob.size} 字节的 ${mimeType} Blob`);
      
      // 创建URL
      const url = URL.createObjectURL(blob);
      console.log(`创建了音频URL: ${url}`);
      
      // 返回成功结果，包含音频URL
      return {
        success: true,
        url: url,
        duration: 0, // 无法获取准确时长
        format: audioFormat,
        isBlob: true // 标记为Blob URL
      };
    }
    
    console.log('语音合成API响应:', response);
    return response;
  } catch (error) {
    console.error('语音合成失败:', error);
    throw error;
  }
};

/**
 * 流式将文本转换为语音
 * @param {Object} params - 语音合成参数，与synthesizeSpeech相同
 * @returns {Promise<string>} - 音频URL
 */
const synthesizeSpeechStream = async (params) => {
  try {
    console.log('调用流式语音合成API，参数:', params);
    
    // 发送API请求
    const response = await api.synthesizeSpeechStream({
      text: params.text,
      voice_id: params.voiceId || 'male-qn-qingse',
      speed: params.speed || 1.0,
      vol: params.vol || 1.0,
      pitch: Math.round(params.pitch || 0), // 确保pitch是整数
      emotion: params.emotion || 'neutral',
      sample_rate: params.sampleRate || 32000,
      bitrate: params.bitrate || 128000,
      audio_format: params.audioFormat || 'mp3',
      channel: params.channel || 1,
      pronunciation_dict: params.pronunciationDict || null,
      timber_weights: params.timberWeights || null
    });
    
    console.log('流式语音合成API响应状态:', response.status);
    
    // 将响应数据转换为ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    console.log(`接收到音频数据，大小: ${arrayBuffer.byteLength} 字节`);
    
    // 确定正确的MIME类型
    const audioFormat = params.audioFormat || 'mp3';
    const mimeType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    
    // 创建Blob对象
    const blob = new Blob([arrayBuffer], { type: mimeType });
    console.log(`创建了 ${blob.size} 字节的 ${mimeType} Blob`);
    
    // 创建URL
    const url = URL.createObjectURL(blob);
    console.log(`创建了音频URL: ${url}`);
    
    return url;
  } catch (error) {
    console.error('流式语音合成失败:', error);
    throw error;
  }
};

/**
 * 获取可用的声音列表
 * @returns {Promise<Array>} - 声音列表
 */
const getAvailableVoices = async () => {
  try {
    const response = await api.getAvailableVoices();
    return response.voices || [];
  } catch (error) {
    console.error('获取声音列表失败:', error);
    // 返回一个默认的声音列表，以防API调用失败
    return [
      {"id": "male-qn-qingse", "name": "青涩青年音色", "description": "适合年轻男性角色"},
      {"id": "female-shaonv", "name": "少女音色", "description": "适合年轻女性角色"}
    ];
  }
};

/**
 * 获取可用的情感列表
 * @returns {Promise<Array>} - 情感列表
 */
const getAvailableEmotions = async () => {
  try {
    const response = await api.getAvailableEmotions();
    return response.emotions || [];
  } catch (error) {
    console.error('获取情感列表失败:', error);
    // 返回一个默认的情感列表，以防API调用失败
    return [
      {"id": "neutral", "name": "中性", "description": "表达平静、中立的情绪"},
      {"id": "happy", "name": "高兴", "description": "表达愉悦、开心的情绪"}
    ];
  }
};

/**
 * 获取预设的混合音色列表
 * @returns {Promise<Array>} - 混合音色预设列表
 */
const getTimberPresets = async () => {
  try {
    const response = await api.getTimberPresets();
    return response.presets || [];
  } catch (error) {
    console.error('获取混合音色预设列表失败:', error);
    // 返回一个默认的混合音色预设列表，以防API调用失败
    return [
      {
        "id": "male_announcer",
        "name": "男性播音员",
        "description": "专业播音风格",
        "weights": [
          { "voice_id": "Boyan_new_platform", "weight": 100 }
        ]
      },
      {
        "id": "female_warm",
        "name": "温暖女声",
        "description": "亲切温暖的女性声音",
        "weights": [
          { "voice_id": "Chinese (Mandarin)_Warm_Bestie", "weight": 100 }
        ]
      }
    ];
  }
};

/**
 * 播放音频URL
 * @param {string} url - 音频URL
 * @returns {HTMLAudioElement} - 音频元素
 */
const playAudio = (url) => {
  const audio = new Audio(url);
  audio.play();
  return audio;
};

// 导出服务对象
const textToSpeechService = {
  synthesizeSpeech,
  synthesizeSpeechStream,
  getAvailableVoices,
  getAvailableEmotions,
  getTimberPresets,
  playAudio
};

export default textToSpeechService;
