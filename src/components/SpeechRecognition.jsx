import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Input,
  Form,
  Switch,
  Textarea,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Progress,
  addToast,
  Tooltip
} from "@heroui/react";
import { 
  MicrophoneStage, 
  Copy, 
  Trash, 
  CircleNotch,
  CheckCircle,
  WarningCircle,
  Globe
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { speechRecognitionService } from "../services";

const SpeechRecognition = () => {
  // 状态变量
  const [activeTab, setActiveTab] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState("");

  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("paraformer-realtime-v2");
  const [semanticPunctuationEnabled, setSemanticPunctuationEnabled] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState("准备就绪");
  
  // 引用

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasContextRef = useRef(null);
  const completeSentencesRef = useRef(""); // 用于存储完整句子的历史记录
  const timerRef = useRef(null);
  
  // 加载可用模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await speechRecognitionService.getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error("加载模型失败:", error);
      }
    };
    
    loadModels();
    
    // 组件卸载时清理资源
    return () => {
      stopRecording();
    };
  }, []);
  

  
  // 开始录音
  const startRecording = async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,  // 设置采样率为16kHz，与后端匹配
          channelCount: 1,    // 单声道
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // 设置音频分析器
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000  // 确保采样率为16kHz
      });
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // 设置音频分析参数
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // 创建音频分析定时器
      const analyzeAudio = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
          setAudioLevel(Math.min(100, average * 2)); // 将平均值映射到0-100范围
        }
        requestAnimationFrame(analyzeAudio);
      };
      analyzeAudio();
      
      // 创建WebSocket连接
      socketRef.current = speechRecognitionService.createRecognitionSocket({
        model: selectedModel,
        semanticPunctuationEnabled,
        onOpen: () => {
          setRecordingStatus("正在录音...");
        },
        onMessage: (data) => {
          console.log('收到 WebSocket 消息:', JSON.stringify(data));
          
          // 检查消息类型
          if (data.type === 'text' && data.data) {
            const { text, is_end } = data.data;
            
            // 将is_end转换为布尔值，处理可能的字符串“true”或“True”
            const isEndBoolean = is_end === true || is_end === 'true' || is_end === 'True';
            
            console.log(`收到识别文本: ${text}, 原始is_end: ${is_end}, 类型: ${typeof is_end}, 转换后: ${isEndBoolean}`);
            
            // 如果收到的文本为空，则不处理
            if (!text) {
              return;
            }
            
            // 处理识别结果
            if (isEndBoolean) {
              // 收到完整句子
              console.log(`收到完整句子: ${text}`);
              
              // 判断是否是新的识别会话
              const isNewSession = completeSentencesRef.current === "";
              
              // 完整句子直接替换中间状态
              if (isNewSession) {
                // 新会话，直接设置完整句子
                console.log(`新识别会话，设置完整句子: ${text}`);
                completeSentencesRef.current = text;
              } else {
                // 现有会话，添加新的完整句子
                const newResult = `${completeSentencesRef.current} ${text}`;
                console.log(`添加新的完整句子: ${text}`);
                console.log(`更新识别结果为: ${newResult}`);
                completeSentencesRef.current = newResult;
              }
              
              // 始终使用完整句子历史替换识别结果，清除中间状态
              setRecognitionResult(completeSentencesRef.current);
              
              // 更新状态
              setRecordingStatus('识别完成');
            } else {
              // 中间结果，在完整句子后显示当前的中间结果
              const currentResult = completeSentencesRef.current ? `${completeSentencesRef.current} ${text}` : text;
              setRecognitionResult(currentResult);  // 将中间结果显示在完整句子后面
              setRecordingStatus(`正在识别: ${text}`);
            }
          } else if (data.type === 'status') {
            console.log('状态消息:', data.data);
            if (data.data.status === 'complete') {
              setRecordingStatus("识别完成");

            } else if (data.data.status === 'closed') {
              setRecordingStatus("连接已关闭");
            }
          } else if (data.type === 'error') {
            console.error('识别错误:', data.data);
            setRecordingStatus("识别错误");

          }
        },
        onError: (error) => {
          console.error("WebSocket错误:", error);
          setRecordingStatus("连接错误");
          stopRecording();
        },
        onClose: () => {
          setRecordingStatus("连接已关闭");
        }
      });
      
      // 创建 AudioContext 和 ScriptProcessor 来直接获取原始 PCM 数据
      // 这与阿里云 DashScope 示例更加接近
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const audioInput = audioContext.createMediaStreamSource(stream);
      const bufferSize = 4096; // 缓冲区大小
      
      // 创建 ScriptProcessor 节点
      const recorder = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // 保存引用以便后续清理
      mediaRecorderRef.current = {
        audioContext,
        audioInput,
        recorder,
        stream,
        state: 'recording'
      };
      
      console.log("使用 AudioContext 直接采集原始 PCM 数据，采样率：16000Hz，单声道，16位深度");
      
      // 音频数据缓冲区
      let audioChunks = [];
      let chunkCounter = 0;
      
      // 处理音频数据
      recorder.onaudioprocess = (e) => {
        if (socketRef.current && mediaRecorderRef.current?.state === 'recording') {
          // 获取输入缓冲区中的数据
          const inputBuffer = e.inputBuffer;
          const inputData = inputBuffer.getChannelData(0); // 获取第一个通道（单声道）
          
          // 将 Float32Array 转换为 Int16Array (16位深度)
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // 将 -1.0 到 1.0 的浮点数转换为 -32768 到 32767 的整数
            pcmData[i] = Math.min(1, Math.max(-1, inputData[i])) * 32767;
          }
          
          // 收集数据块
          audioChunks.push(pcmData);
          chunkCounter++;
          
          // 每收集到足够的数据（约 3200 个样本，对应 200ms 的 16kHz 音频）就发送一次
          // 这与阿里云示例中的 block_size = 3200 相匹配
          if (chunkCounter >= 1) { // 每个缓冲区约 4096 个样本，已经超过 3200
            // 合并所有数据块
            let totalLength = 0;
            for (const chunk of audioChunks) {
              totalLength += chunk.length;
            }
            
            const mergedData = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks) {
              mergedData.set(chunk, offset);
              offset += chunk.length;
            }
            
            // 创建 Blob 对象
            const audioBlob = new Blob([mergedData], { type: 'audio/pcm' });
            
            try {
              // 发送音频数据
              const dataSize = audioBlob.size / 1024; // 转换为KB
              
              
              speechRecognitionService.sendAudioData(socketRef.current, audioBlob);
            } catch (error) {
              console.error("处理音频数据时出错:", error);
              addToast({
                title: "音频处理错误",
                description: `处理音频数据时出错: ${error.message}`,
                status: "error"
              });
            }
            
            // 重置数据块
            audioChunks = [];
            chunkCounter = 0;
          }
        }
      };
      
      // 连接节点
      audioInput.connect(recorder);
      recorder.connect(audioContext.destination);
      setIsRecording(true);
      
      // 设置计时器
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("启动录音失败:", error);
      addToast({
        title: "麦克风访问失败",
        description: "无法访问麦克风，请确保已授予麦克风权限",
        status: "error"
      });
    }
  };
  
  // 停止录音
  const stopRecording = () => {
    // 停止 AudioContext 和 ScriptProcessor
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.recorder) {
        mediaRecorderRef.current.recorder.disconnect();
      }
      if (mediaRecorderRef.current.audioInput) {
        mediaRecorderRef.current.audioInput.disconnect();
      }
      if (mediaRecorderRef.current.audioContext && mediaRecorderRef.current.audioContext.state !== 'closed') {
        mediaRecorderRef.current.audioContext.close();
      }
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      mediaRecorderRef.current.state = 'inactive';
    }
    
    // 关闭WebSocket
    if (socketRef.current) {
      speechRecognitionService.closeRecognitionSocket(socketRef.current);
      socketRef.current = null;
    }
    
    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    
    // 清除计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setIsRecording(false);
    setAudioLevel(0);
    setRecordingStatus("准备就绪");
  };
  
  // 切换录音状态
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setRecordingSeconds(0);
      setRecognitionResult("");
      completeSentencesRef.current = ""; // 重置完整句子历史记录
      startRecording();
    }
  };
  
  // 复制识别结果
  const copyResult = () => {
    if (recognitionResult) {
      navigator.clipboard.writeText(recognitionResult)
        .then(() => {
          addToast({
            title: "复制成功",
            description: "识别结果已复制到剪贴板",
            status: "success"
          });
        })
        .catch(error => {
          console.error("复制失败:", error);
          addToast({
            title: "复制失败",
            description: "无法复制到剪贴板",
            status: "error"
          });
        });
    }
  };
  
  // 清空识别结果
  const clearResult = () => {
    setRecognitionResult("");
  };
  
  // 格式化录音时间
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* 标签页 */}
      <div className="w-full flex items-center mb-2">
        <MicrophoneStage weight="duotone" className="mr-2" />
        <h2 className="text-lg font-medium">实时语音识别</h2>
      </div>
      
      {/* 实时识别面板 */}
        <Card className="mb-4">
          <CardBody>
            <div className="flex flex-col space-y-4">
              {/* 模型选择和设置 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <div className="mb-2 text-sm font-medium flex items-center justify-between">
                    <span>识别模型</span>
                    <Tooltip 
                      content={
                        <div className="max-w-md p-2">
                          <div className="font-medium mb-2">支持的语种：</div>
                          <div className="mb-3">中文（普通话及方言）、英文、日语、韩语</div>
                          
                          <div className="font-medium mb-2">支持的中文方言：</div>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
                            <span className="bg-gray-50 px-2 py-1 rounded">上海话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">吴语</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">闽南语</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">东北话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">甘肃话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">贵州话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">河南话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">湖北话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">湖南话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">江西话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">宁夏话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">山西话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">陕西话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">山东话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">四川话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">天津话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">云南话</span>
                            <span className="bg-gray-50 px-2 py-1 rounded">粤语</span>
                          </div>
                        </div>
                      }
                      placement="bottom"
                      className="custom-tooltip"
                    >
                      <div className="flex items-center text-blue-500 cursor-help hover:text-blue-600 transition-colors">
                        <Globe size={18} weight="duotone" className="mr-1" />
                        <span className="text-xs font-medium">支持的语言</span>
                      </div>
                    </Tooltip>
                  </div>
                  <Select 
                    selectedKeys={[selectedModel]}
                    onSelectionChange={(keys) => setSelectedModel(Array.from(keys)[0])}
                    isDisabled={isRecording}
                    aria-label="识别模型选择"
                    className="w-full min-w-[400px]"
                  >
                    {availableModels.map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                    {availableModels.length === 0 && (
                      <SelectItem key="paraformer-realtime-v2" value="paraformer-realtime-v2">
                        实时语音识别模型 V2
                      </SelectItem>
                    )}
                  </Select>
                </div>
              </div>
              
              {/* 录音控制区域 */}
              <div className="flex flex-col items-center justify-center py-6">
                {/* 音量指示器 */}
                {isRecording && (
                  <div className="w-full max-w-md mb-4">
                    <Progress 
                      value={audioLevel} 
                      color={audioLevel > 70 ? "danger" : audioLevel > 30 ? "success" : "primary"}
                      className="rounded-full max-w-md"
                      aria-label="音量指示器"
                    />
                  </div>
                )}
                
                {/* 录音状态 */}
                <div className="text-sm text-gray-600 mb-2">
                  {isRecording ? (
                    <div className="flex items-center">
                      <CircleNotch size={16} weight="bold" className="text-red-500 mr-2 animate-spin" />
                      <span>{recordingStatus} {formatRecordingTime(recordingSeconds)}</span>
                    </div>
                  ) : (
                    <span>{recordingStatus}</span>
                  )}
                </div>
                
                {/* 录音按钮 */}
                <motion.button
                  className={`w-20 h-20 rounded-full flex items-center justify-center ${
                    isRecording 
                      ? "bg-red-500 hover:bg-red-600" 
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white shadow-lg transition-colors`}
                  onClick={toggleRecording}
                  whileTap={{ scale: 0.95 }}
                >
                  <MicrophoneStage size={32} weight={isRecording ? "fill" : "duotone"} />
                </motion.button>
                
                <p className="text-sm text-gray-500 mt-3">
                  {isRecording ? "点击停止录音" : "点击开始录音"}
                </p>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={clearResult}
                  isDisabled={isRecording || !recognitionResult}
                >
                  <Trash size={18} className="mr-1" />
                  清空
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      
      {/* 识别结果区域 */}
      <Card className="flex-grow mt-4">
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-lg font-medium">识别结果</h3>
          {recognitionResult && (
            <Button
              size="sm"
              variant="ghost"
              onClick={copyResult}
            >
              <Copy size={16} className="mr-1" />
              复制
            </Button>
          )}
        </CardHeader>
        <Divider />
        <CardBody className="flex-grow overflow-auto">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <CircleNotch size={32} weight="bold" className="text-blue-500 animate-spin mb-3" />
              <p className="text-gray-600">正在处理音频，请稍候...</p>
            </div>
          ) : recognitionResult ? (
            <Textarea
              value={recognitionResult}
              onChange={(e) => setRecognitionResult(e.target.value)}
              placeholder="识别结果将显示在这里..."
              className="w-full h-full min-h-[200px]"
              resize="none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8 text-gray-400">
              <MicrophoneStage size={48} weight="duotone" className="mb-3" />
              <p>点击麦克风按钮开始录音以获取识别结果</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default SpeechRecognition;
