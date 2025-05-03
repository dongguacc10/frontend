import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Spinner,
  addToast,
  Card,
  CardBody,
  CardHeader,
  Divider
} from "@heroui/react";
import { 
  PaperPlaneTilt, 
  X, 
  User, 
  Robot,
  ArrowClockwise,
  Buildings,
  FileText,
  ListChecks,
  Timer,
  Microphone,
  MicrophoneSlash,
  ChartBar
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import interviewGuideService from "../services/interview_guide_service";
import speechRecognitionService from "../services/speech_recognition_service";

/**
 * AI面试组件
 * 提供与AI面试官的聊天界面
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.interviewGuide - 面试指南数据
 * @param {function} props.onClose - 关闭面试界面的回调函数
 */
const AIInterview = ({ interviewGuide, onClose }) => {
  // 聊天状态
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [isInterviewFinished, setIsInterviewFinished] = useState(false);
  const [countdown, setCountdown] = useState(0); // 倒计时状态，单位为秒
  const [isTimeUp, setIsTimeUp] = useState(false); // 是否时间已到
  
  // 语音录制状态
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState(null);
  const [transcribedText, setTranscribedText] = useState("");
  
  // 评估状态
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationReport, setEvaluationReport] = useState(null);
  const [evaluationStreamContent, setEvaluationStreamContent] = useState("");
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showEvaluationProcess, setShowEvaluationProcess] = useState(false); // 是否显示评估生成过程
  
  // 引用
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const countdownIntervalRef = useRef(null); // 用于存储倒计时的interval ID
  
  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  // 当消息更新时自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // 解析预计回答时间字符串，返回最大时间（秒）
  const parseEstimatedTime = (timeString) => {
    if (!timeString) return 0;
    
    // 匹配格式如 "2-3分钟" 或 "3分钟" 或 "3-5秒"
    const match = timeString.match(/(\d+)(?:-(\d+))?([分秒])/);
    if (!match) return 0;
    
    const minTime = parseInt(match[1], 10);
    const maxTime = match[2] ? parseInt(match[2], 10) : minTime;
    const unit = match[3];
    
    // 转换为秒
    const multiplier = unit === '分' ? 60 : 1;
    return maxTime * multiplier;
  };
  
  // 格式化时间为 mm:ss 格式
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 当最新消息更新时，重置倒计时
  useEffect(() => {
    if (messages.length === 0) return;
    
    // 获取最新的助手消息
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.context);
    if (!lastAssistantMessage) return;
    
    // 解析上下文
    let context = lastAssistantMessage.context;
    if (typeof context === 'string') {
      try {
        context = JSON.parse(context);
      } catch (e) {
        console.error('无法解析context字符串:', e);
        return;
      }
    }
    
    // 获取当前问题的预计回答时间
    if (context.questions && context.current_question_index >= 0 && 
        context.questions[context.current_question_index] && 
        context.questions[context.current_question_index].suggested_duration) {
      
      const timeString = context.questions[context.current_question_index].suggested_duration;
      const maxSeconds = parseEstimatedTime(timeString);
      
      // 设置倒计时初始值
      setCountdown(maxSeconds);
      
      // 清除之前的倒计时
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // 开始新的倒计时
      if (maxSeconds > 0) {
        countdownIntervalRef.current = setInterval(() => {
          setCountdown(prevCount => {
            if (prevCount <= 1) {
              clearInterval(countdownIntervalRef.current);
              setIsTimeUp(true);
              return 0;
            }
            return prevCount - 1;
          });
        }, 1000);
      }
    }
    
    // 组件卸载时清除倒计时
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [messages]);
  
  // 组件加载时自动开始面试
  useEffect(() => {
    startInterview();
    // 组件卸载时终止面试
    return () => {
      if (requestId) {
        terminateInterview();
      }
    };
  }, []);
  
  // 开始面试
  const startInterview = async () => {
    try {
      setIsLoading(true);
      
      // 调用服务开始AI面试
      const { requestId: newRequestId } = await interviewGuideService.startAIInterview(
        interviewGuide,
        [],
        handleInterviewProgress
      );
      
      setRequestId(newRequestId);
    } catch (error) {
      console.error("开始AI面试出错:", error);
      addToast({
        title: "面试开始失败",
        description: error.message || "无法开始AI面试，请稍后重试",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 处理面试进度更新
  const handleInterviewProgress = (data) => {
    if (data.error) {
      addToast({
        title: "面试出错",
        description: data.error,
        shouldshowtimeoutprogess: "true"
      });
      setIsLoading(false);
      return;
    }
    
    if (data.terminated) {
      addToast({
        title: "面试已终止",
        description: "AI面试已被终止",
        shouldshowtimeoutprogess: "true"
      });
      setIsLoading(false);
      return;
    }
    
    if (data.role === 'assistant') {
      setMessages(prevMessages => {
        // 检查是否已经有相同内容的消息
        const isDuplicate = prevMessages.some(
          msg => msg.role === 'assistant' && msg.content === data.content
        );
        
        if (isDuplicate) {
          return prevMessages;
        }
        
        // 如果context是字符串，尝试解析为对象
        let contextData = data.context;
        if (typeof data.context === 'string') {
          try {
            contextData = JSON.parse(data.context);
          } catch (e) {
            console.error('无法解析context字符串:', e);
          }
        }
        
        return [...prevMessages, { 
          role: 'assistant', 
          content: data.content,
          context: contextData
        }];
      });
      
      setIsLoading(false);
      
      // 如果面试结束
      if (data.finished) {
        setIsInterviewFinished(true);
        addToast({
          title: "面试已结束",
          description: "AI面试已完成",
          shouldshowtimeoutprogess: "true"
        });
      }
    }
  };
  
  // 发送消息
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const message = inputMessage.trim();
    setInputMessage("");
    
    // 添加用户消息到列表
    setMessages(prevMessages => [...prevMessages, { role: 'user', content: message }]);
    
    try {
      setIsLoading(true);
      
      // 调用服务发送面试消息
      const { requestId: newRequestId } = await interviewGuideService.sendInterviewMessage(
        interviewGuide,
        messages,
        message,
        handleInterviewProgress
      );
      
      setRequestId(newRequestId);
    } catch (error) {
      console.error("发送面试消息出错:", error);
      setIsLoading(false);
      addToast({
        title: "发送消息失败",
        description: error.message || "无法发送消息，请稍后重试",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 终止面试
  const terminateInterview = async () => {
    if (!requestId) return;
    
    try {
      await interviewGuideService.terminateAIInterview(requestId);
      console.log("面试已终止");
    } catch (error) {
      console.error("终止面试出错:", error);
    }
  };
  
  // 处理输入框按键事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // 重新开始面试
  const restartInterview = () => {
    setMessages([]);
    setIsInterviewFinished(false);
    setRequestId(null);
    startInterview();
  };
  
  // 渲染候选人摘要
  const renderCandidateSummary = () => {
    if (!interviewGuide || !interviewGuide.candidate_summary) return null;
    
    // 检查candidate_summary是否为对象
    const candidateSummary = interviewGuide.candidate_summary;
    
    return (
      <Card className="mb-3 shadow-sm border border-blue-100">
        <CardHeader className="bg-blue-50 py-2 px-3">
          <div className="flex items-center">
            <User size={16} weight="duotone" className="text-blue-500 mr-1.5" />
            <span className="font-medium text-sm text-blue-700">候选人摘要</span>
          </div>
        </CardHeader>
        <CardBody className="py-2 px-3">
          {typeof candidateSummary === 'object' ? (
            <div className="grid gap-1.5 text-sm">
              {candidateSummary.name && (
                <div className="grid grid-cols-[80px_1fr] items-baseline">
                  <span className="text-gray-600 font-medium">姓名：</span>
                  <span className="text-gray-800">{candidateSummary.name}</span>
                </div>
              )}
              {candidateSummary.education && (
                <div className="grid grid-cols-[80px_1fr] items-baseline">
                  <span className="text-gray-600 font-medium">教育背景：</span>
                  <span className="text-gray-800">{candidateSummary.education}</span>
                </div>
              )}
              {candidateSummary.experience && (
                <div className="grid grid-cols-[80px_1fr] items-baseline">
                  <span className="text-gray-600 font-medium">工作经验：</span>
                  <span className="text-gray-800">{candidateSummary.experience}</span>
                </div>
              )}
              {candidateSummary.key_skills && (
                <div className="grid grid-cols-[80px_1fr] items-start">
                  <span className="text-gray-600 font-medium">关键技能：</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(candidateSummary.key_skills) 
                      ? candidateSummary.key_skills.map((skill, index) => (
                          <span key={index} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {skill}
                          </span>
                        ))
                      : <span className="text-gray-800">{candidateSummary.key_skills}</span>
                    }
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-700 text-sm whitespace-pre-wrap">{candidateSummary}</div>
          )}
        </CardBody>
      </Card>
    );
  };
  
  // 渲染职位要求
  const renderPositionRequirements = () => {
    if (!interviewGuide || !interviewGuide.position_requirements) return null;
    
    // 检查position_requirements是否为对象
    const positionRequirements = interviewGuide.position_requirements;
    
    return (
      <Card className="mb-3 shadow-sm border border-indigo-100">
        <CardHeader className="bg-indigo-50 py-2 px-3">
          <div className="flex items-center">
            <Buildings size={16} weight="duotone" className="text-indigo-500 mr-1.5" />
            <span className="font-medium text-sm text-indigo-700">职位要求</span>
          </div>
        </CardHeader>
        <CardBody className="py-2 px-3">
          {typeof positionRequirements === 'object' ? (
            <div className="grid gap-1.5 text-sm">
              {positionRequirements.title && (
                <div className="grid grid-cols-[80px_1fr] items-baseline">
                  <span className="text-gray-600 font-medium">职位名称：</span>
                  <span className="text-gray-800">{positionRequirements.title}</span>
                </div>
              )}
              {positionRequirements.department && (
                <div className="grid grid-cols-[80px_1fr] items-baseline">
                  <span className="text-gray-600 font-medium">所属部门：</span>
                  <span className="text-gray-800">{positionRequirements.department}</span>
                </div>
              )}
              {positionRequirements.responsibilities && (
                <div className="mt-1">
                  <div className="text-gray-600 font-medium mb-1">关键职责：</div>
                  {Array.isArray(positionRequirements.responsibilities) ? (
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-800">
                      {positionRequirements.responsibilities.map((item, index) => (
                        <li key={index} className="text-xs">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-800 text-xs pl-1">{positionRequirements.responsibilities}</div>
                  )}
                </div>
              )}
              {positionRequirements.required_skills && (
                <div className="grid grid-cols-[80px_1fr] items-start mt-1">
                  <span className="text-gray-600 font-medium">所需技能：</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(positionRequirements.required_skills) 
                      ? positionRequirements.required_skills.map((skill, index) => (
                          <span key={index} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                            {skill}
                          </span>
                        ))
                      : <span className="text-gray-800 text-xs">{positionRequirements.required_skills}</span>
                    }
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-700 text-sm whitespace-pre-wrap">{positionRequirements}</div>
          )}
        </CardBody>
      </Card>
    );
  };
  
  // 渲染预计回答时间卡片
  const renderEstimatedAnswerTimeCard = () => {
    if (!messages.length || !messages.some(m => m.role === 'assistant' && m.context)) return null;
    
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.context);
    if (!lastAssistantMessage) return null;
    
    let context = lastAssistantMessage.context;
    if (typeof context === 'string') {
      try {
        context = JSON.parse(context);
      } catch (e) {
        console.error('无法解析context字符串:', e);
        return null;
      }
    }
    
    if (!context.questions || context.current_question_index < 0 || 
        !context.questions[context.current_question_index] || 
        !context.questions[context.current_question_index].suggested_duration) {
      return null;
    }
    
    const suggestedDuration = context.questions[context.current_question_index].suggested_duration;
    const maxSeconds = parseEstimatedTime(suggestedDuration);
    const progressPercentage = maxSeconds > 0 ? Math.max(0, Math.min(100, (countdown / maxSeconds) * 100)) : 0;
    
    return (
      <Card className="mb-3 shadow-sm border border-yellow-100">
        <CardHeader className="bg-yellow-50 py-2 px-3">
          <div className="flex items-center">
            <Timer size={16} weight="duotone" className="text-yellow-500 mr-1.5" />
            <span className="font-medium text-sm text-yellow-700">本题可作答时间</span>
          </div>
        </CardHeader>
        <CardBody className="py-2 px-3">
          <div className="grid gap-1.5 text-sm">
            <div className="grid grid-cols-[80px_1fr] items-baseline">
              <span className="text-gray-600 font-medium">建议时长：</span>
              <span className="text-gray-800">{suggestedDuration}</span>
            </div>
            <div className="grid grid-cols-[80px_1fr] items-baseline">
              <span className="text-gray-600 font-medium">倒计时：</span>
              <span className="text-gray-800 font-medium">{formatTime(countdown)}</span>
            </div>
            <div className="mt-1">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-yellow-400 h-2.5 rounded-full transition-all duration-1000 ease-linear" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };
  
  // 当倒计时结束时的处理逻辑
  useEffect(() => {
    // 如果时间到了但没有输入内容
    if (isTimeUp && !isLoading) {
      if (!inputMessage.trim()) {
        // 如果输入为空，提示用户并重新开始计时
        addToast({
          title: "时间已到",
          description: "请尽快输入您的回答",
          shouldshowtimeoutprogess: "true"
        });
        
        // 获取最新的助手消息
        const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.context);
        if (lastAssistantMessage) {
          let context = lastAssistantMessage.context;
          if (typeof context === 'string') {
            try {
              context = JSON.parse(context);
            } catch (e) {
              console.error('无法解析context字符串:', e);
            }
          }
          
          // 获取当前问题的预计回答时间
          if (context.questions && context.current_question_index >= 0 && 
              context.questions[context.current_question_index] && 
              context.questions[context.current_question_index].suggested_duration) {
            
            const timeString = context.questions[context.current_question_index].suggested_duration;
            const maxSeconds = parseEstimatedTime(timeString);
            
            // 重新设置倒计时（给30秒的额外时间）
            setCountdown(30);
            
            // 开始新的倒计时
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            
            countdownIntervalRef.current = setInterval(() => {
              setCountdown(prevCount => {
                if (prevCount <= 1) {
                  clearInterval(countdownIntervalRef.current);
                  setIsTimeUp(true);
                  return 0;
                }
                return prevCount - 1;
              });
            }, 1000);
          }
        }
      } else {
        // 如果有输入内容，自动提交
        sendMessage();
      }
      
      // 重置时间到标志
      setIsTimeUp(false);
    }
  }, [isTimeUp, inputMessage, isLoading, messages]);
  
  // 开始录音
  const startRecording = async () => {
    try {
      // 创建实时语音识别实例
      const recognizer = new speechRecognitionService.RealtimeSpeechRecognition();
      
      // 设置回调函数
      recognizer.onReady(() => {
        console.log('实时语音识别服务已就绪');
      });
      
      recognizer.onResult((result) => {
        console.log('实时识别结果:', result);
        setInputMessage(result);
      });
      
      recognizer.onFinalResult((result) => {
        console.log('最终识别结果:', result);
        setInputMessage(result);
        setIsRecording(false);
        setIsProcessingSpeech(false);
        
        // 自动聚焦输入框
        inputRef.current?.focus();
        
        // 提示用户识别成功
        addToast({
          title: "识别成功",
          description: "语音已成功转换为文字",
          shouldshowtimeoutprogess: "true"
        });
        
        // 关闭识别器
        recognizer.disconnect();
        setSpeechRecognizer(null);
      });
      
      recognizer.onError((error) => {
        console.error('语音识别错误:', error);
        setIsRecording(false);
        setIsProcessingSpeech(false);
        
        // 提示用户识别失败
        addToast({
          title: "识别失败",
          description: `语音识别失败: ${error.message}`,
          variant: "destructive",
          shouldshowtimeoutprogess: "true"
        });
        
        // 关闭识别器
        recognizer.disconnect();
        setSpeechRecognizer(null);
      });
      
      // 连接WebSocket
      await recognizer.connect();
      
      // 开始录音
      await recognizer.startRecording();
      
      // 保存识别器实例
      setSpeechRecognizer(recognizer);
      setIsRecording(true);
      
      // 提示用户已开始录音
      addToast({
        title: "开始录音",
        description: "请开始说话，完成后点击停止按钮",
        shouldshowtimeoutprogess: "true"
      });
    } catch (error) {
      console.error('无法启动语音识别:', error);
      setIsRecording(false);
      setIsProcessingSpeech(false);
      
      // 提示用户错误
      addToast({
        title: "错误",
        description: `无法启动语音识别: ${error.message}`,
        variant: "destructive",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 停止录音
  const stopRecording = async () => {
    if (speechRecognizer && isRecording) {
      try {
        // 提示用户正在处理语音
        addToast({
          title: "处理中",
          description: "正在处理您的语音...",
          shouldshowtimeoutprogess: "true"
        });
        
        setIsProcessingSpeech(true);
        
        // 停止录音
        await speechRecognizer.stopRecording();
      } catch (error) {
        console.error('停止录音出错:', error);
        setIsRecording(false);
        setIsProcessingSpeech(false);
        
        // 提示用户错误
        addToast({
          title: "错误",
          description: `停止录音出错: ${error.message}`,
          variant: "destructive",
          shouldshowtimeoutprogess: "true"
        });
        
        // 关闭识别器
        speechRecognizer.disconnect();
        setSpeechRecognizer(null);
      }
    }
  };
  
  // 评估面试结果
  const evaluateInterview = async () => {
    if (messages.length === 0 || !isInterviewFinished) {
      addToast({
        title: "无法评估",
        description: "面试尚未完成，无法评估结果",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    setIsEvaluating(true);
    setEvaluationReport(null);
    setEvaluationStreamContent("");
    setShowEvaluation(true); // 立即显示评估界面
    setShowEvaluationProcess(true); // 显示评估生成过程
    
    try {
      // 从interviewGuide中获取competencyModel
      const competencyModel = interviewGuide.competency_model || null;
      
      // 确保消息中的context信息被正确处理
      const processedMessages = messages.map(msg => {
        // 创建消息的副本
        const processedMsg = { ...msg };
        
        // 如果context是对象，转换为字符串
        if (processedMsg.context && typeof processedMsg.context === 'object') {
          processedMsg.context = JSON.stringify(processedMsg.context);
        }
        
        // 如果是面试官消息，确保添加必要的标记
        if (processedMsg.role === 'assistant' && processedMsg.context) {
          let contextObj;
          
          // 尝试解析context
          if (typeof processedMsg.context === 'string') {
            try {
              contextObj = JSON.parse(processedMsg.context);
            } catch (e) {
              console.error('无法解析context字符串:', e);
              contextObj = {};
            }
          } else if (typeof processedMsg.context === 'object') {
            contextObj = processedMsg.context;
          }
          
          // 添加追问标记
          if (contextObj && contextObj.asked_followup) {
            processedMsg.is_follow_up = true;
            
            // 添加追问理由（如果存在）
            if (contextObj.followup_reason) {
              processedMsg.followup_reason = contextObj.followup_reason;
            }
          }
          
          // 添加问题索引
          if (contextObj && contextObj.current_question_index !== undefined) {
            processedMsg.question_index = contextObj.current_question_index;
          }
        }
        
        return processedMsg;
      });
      
      console.log('处理后的消息历史:', processedMessages);
      console.log('面试请求ID:', requestId); // 添加日志，查看面试请求ID
      
      await interviewGuideService.evaluateInterview(
        interviewGuide,
        processedMessages,
        competencyModel, // 传递胜任力模型
        requestId, // 传递面试的原始请求ID
        (data) => {
          if (data.error) {
            addToast({
              title: "评估出错",
              description: data.error,
              status: "error",
              shouldshowtimeoutprogess: "true"
            });
          } else if (data.content_chunk) {
            // 显示生成过程
            setEvaluationStreamContent(prev => prev + data.content_chunk);
          } else if (data.success && data.request_id) {
            // 收到成功消息，记录新的请求ID
            console.log("收到评估成功消息，新请求ID:", data.request_id);
            setEvaluationStreamContent(prev => prev + `\n评估生成成功，正在获取完整报告...\n`);
            
            // 使用新的请求ID获取完整评估报告
            fetchEvaluationReport(data.request_id);
          } else if (data.finished && data.request_id) {
            // 流式生成完成，使用请求ID获取完整评估报告
            console.log("评估生成完成，请求ID:", data.request_id);
            fetchEvaluationReport(data.request_id);
          }
        }
      );
    } catch (error) {
      addToast({
        title: "评估失败",
        description: error.message,
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
      setShowEvaluationProcess(false); // 出错时也关闭生成过程显示
    } finally {
      setIsEvaluating(false);
    }
  };
  
  // 获取完整的评估报告
  const fetchEvaluationReport = async (requestId) => {
    try {
      console.log("开始获取完整评估报告，请求ID:", requestId);
      setEvaluationStreamContent(prev => prev + `\n正在获取完整评估报告，请求ID: ${requestId}...\n`);
      
      // 调用获取评估报告的接口
      const result = await interviewGuideService.getInterviewEvaluation(requestId);
      
      if (result && result.result) {
        // 设置评估报告数据
        setEvaluationReport(result.result);
        setEvaluationStreamContent(prev => prev + `\n评估报告获取成功！\n`);
        setShowEvaluationProcess(false); // 评估完成后，不再显示生成过程
        
        // 显示成功提示
        addToast({
          title: "评估完成",
          description: "面试评估报告已生成",
          status: "success",
          shouldshowtimeoutprogess: "true"
        });
      } else {
        throw new Error("获取到的评估报告数据无效");
      }
    } catch (error) {
      console.error("获取评估报告出错:", error);
      setEvaluationStreamContent(prev => prev + `\n获取评估报告出错: ${error.message}\n`);
      
      addToast({
        title: "获取评估报告失败",
        description: error.message,
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 渲染评估报告
  const renderEvaluationReport = () => {
    if (!showEvaluation) return null;
    
    // 显示评估生成过程
    if (showEvaluationProcess) {
      return (
        <Card className="mt-4">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ChartBar size={20} className="mr-2 text-blue-600" />
                <span className="font-medium">面试评估生成中...</span>
              </div>
              <Button
                color="ghost"
                isIconOnly
                size="sm"
                onClick={() => setShowEvaluation(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="max-h-[400px] overflow-y-auto">
            <div className="flex justify-center items-center py-4">
              <Spinner size="md" className="mr-2" />
              <span>正在生成评估报告，请稍候...</span>
            </div>
            {evaluationStreamContent && (
              <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700 border border-gray-200">
                <pre className="whitespace-pre-wrap">{evaluationStreamContent}</pre>
              </div>
            )}
          </CardBody>
        </Card>
      );
    }
    
    // 显示最终评估报告
    if (evaluationReport) {
      const { 
        candidate_name, 
        position_title, 
        evaluation_by_layer, 
        potential_concerns_assessment, 
        overall_assessment 
      } = evaluationReport;
      
      return (
        <Card className="mt-4">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ChartBar size={20} className="mr-2 text-blue-600" />
                <span className="font-medium">面试评估报告</span>
              </div>
              <Button
                color="ghost"
                isIconOnly
                size="sm"
                onClick={() => setShowEvaluation(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="max-h-[500px] overflow-y-auto">
            {/* 候选人信息 */}
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">候选人信息</h3>
              <div className="bg-gray-50 p-3 rounded">
                <p><strong>姓名:</strong> {candidate_name}</p>
                <p><strong>应聘职位:</strong> {position_title}</p>
              </div>
            </div>
            
            {/* 总体评估 */}
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">总体评估</h3>
              <div className="bg-gray-50 p-3 rounded">
                <div className="flex flex-col space-y-2 mb-3">
                  <div className="flex items-center">
                    <strong className="mr-2 w-36">总分:</strong> 
                    <span className="ml-2">{overall_assessment?.total_score_achieved}/{overall_assessment?.total_model_max_score}</span>
                  </div>
                  <div className="flex items-center">
                    <strong className="mr-2 w-36">得分率:</strong> 
                    <div className="w-full max-w-[200px] bg-gray-200 rounded-full h-1.5 mr-2">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${overall_assessment?.percentage_achieved}%` }}
                      ></div>
                    </div>
                    <span>{overall_assessment?.percentage_achieved}%</span>
                  </div>
                  <div>
                    <strong className="mr-2">招聘建议:</strong> 
                    <span className={`px-2 py-1 rounded text-white ${
                      overall_assessment?.recommendation === "强烈推荐" ? "bg-green-500" :
                      overall_assessment?.recommendation === "推荐" ? "bg-blue-500" :
                      overall_assessment?.recommendation === "待定" ? "bg-yellow-500" :
                      "bg-red-500"
                    }`}>
                      {overall_assessment?.recommendation}
                    </span>
                  </div>
                  <div>
                    <strong className="mr-2">推荐理由:</strong> 
                    <p className="mt-1 text-sm">{overall_assessment?.rationale}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 按层级评估 */}
            {evaluation_by_layer && (
              <div className="mb-4">
                <h3 className="text-md font-medium mb-2">分层评估</h3>
                <div className="space-y-4">
                  {Object.entries(evaluation_by_layer).map(([layerName, layerData]) => (
                    <div key={layerName} className="border border-gray-200 rounded">
                      <div className="bg-gray-100 p-2 font-medium">
                        {layerName}
                        <span className="ml-2 text-sm font-normal text-gray-600">
                          ({layerData.layer_score_achieved}/{layerData.model_layer_max_score})
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm mb-2">{layerData.description_from_model}</p>
                        <p className="text-sm mb-2"><strong>总结:</strong> {layerData.layer_summary}</p>
                        <p className="text-sm mb-3"><strong>评估:</strong> {layerData.layer_assessment}</p>
                        
                        {layerData.dimensions_assessed && layerData.dimensions_assessed.length > 0 && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium mb-1">维度评估:</h4>
                            <div className="space-y-2">
                              {layerData.dimensions_assessed.map((dimension, index) => (
                                <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                                  <div className="flex justify-between">
                                    <strong>{dimension.name}</strong>
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      dimension.importance === "核心" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                                    }`}>
                                      {dimension.importance}
                                    </span>
                                  </div>
                                  <p className="text-xs mt-1">{dimension.description_from_model}</p>
                                  <div className="flex items-center mt-1">
                                    <span className="text-xs mr-2">得分:</span>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div 
                                        className="bg-blue-500 h-1.5 rounded-full" 
                                        style={{ width: `${(dimension.score_achieved / dimension.model_max_score) * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs ml-2">{dimension.score_achieved}/{dimension.model_max_score}</span>
                                  </div>
                                  <p className="text-xs mt-1"><strong>证据:</strong> {dimension.evidence_from_interview}</p>
                                  <p className="text-xs mt-1"><strong>评价:</strong> {dimension.assessment_comment}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 潜在顾虑评估 */}
            {potential_concerns_assessment && potential_concerns_assessment.length > 0 && (
              <div className="mb-4">
                <h3 className="text-md font-medium mb-2">潜在顾虑评估</h3>
                <div className="space-y-2">
                  {potential_concerns_assessment.map((concern, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <p><strong>顾虑:</strong> {concern.concern}</p>
                      {concern.verification_questions_asked && concern.verification_questions_asked.length > 0 && (
                        <div className="mt-1">
                          <p><strong>验证问题:</strong></p>
                          <ul className="list-disc list-inside text-sm ml-2">
                            {concern.verification_questions_asked.map((question, qIndex) => (
                              <li key={qIndex}>{question}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="mt-1"><strong>证据:</strong> {concern.evidence_from_interview}</p>
                      <p className="mt-1">
                        <strong>评估:</strong> 
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                          concern.assessment.includes("已消除") ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {concern.assessment}
                        </span>
                      </p>
                      {concern.comments && <p className="mt-1"><strong>备注:</strong> {concern.comments}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 优势与不足 */}
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">优势与不足</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 p-3 rounded">
                  <h4 className="font-medium text-green-700 mb-2">关键优势</h4>
                  <ul className="list-disc list-inside text-sm">
                    {overall_assessment?.strengths?.map((strength, index) => (
                      <li key={index} className="text-gray-700">{strength}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <h4 className="font-medium text-yellow-700 mb-2">待发展领域</h4>
                  <ul className="list-disc list-inside text-sm">
                    {overall_assessment?.areas_for_development?.map((area, index) => (
                      <li key={index} className="text-gray-700">{area}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            {/* 附加说明 */}
            {overall_assessment?.additional_notes && (
              <div className="mb-4">
                <h3 className="text-md font-medium mb-2">附加说明</h3>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm">{overall_assessment.additional_notes}</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      );
    }
    
    return null;
  };
  
  return (
    <div className="flex h-[600px]">
      {/* 左侧信息栏 */}
      <div className="w-1/3 border-r overflow-y-auto p-3 bg-gray-100">
        <div className="mb-3">
          {renderCandidateSummary()}
          {renderPositionRequirements()}
          {renderEstimatedAnswerTimeCard()}
          {renderEvaluationReport()}
        </div>
      </div>
      
      {/* 右侧聊天区域 */}
      <div className="flex flex-col flex-1">
        {/* 标题栏 */}
        
        
        {/* 面试对话区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
          {messages.length === 0 && isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Spinner size="lg" />
              <span className="ml-2 text-gray-500">正在开始面试...</span>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  <div className="flex items-center mb-1">
                    {message.role === 'user' ? (
                      <>
                        <span className="font-medium">您</span>
                        <User size={16} className="ml-1" />
                      </>
                    ) : (
                      <>
                        <Robot size={16} className="mr-1" />
                        <span className="font-medium">面试官</span>
                      </>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">
                    {typeof message.content === 'object' 
                      ? message.content.question || JSON.stringify(message.content) 
                      : message.content}
                  </div>
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* 输入区域 */}
        <div className="border-t p-3 bg-white">
          {isInterviewFinished ? (
            <div className="flex justify-center space-x-3">
              <Button
                color="primary"
                leftIcon={<ArrowClockwise size={18} />}
                onClick={restartInterview}
              >
                重新开始面试
              </Button>
              
              <Button
                color="secondary"
                leftIcon={<ChartBar size={18} />}
                onClick={evaluateInterview}
                disabled={isEvaluating}
              >
                {isEvaluating ? "评估中..." : (showEvaluation ? "更新评估" : "评估面试结果")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <textarea
                ref={inputRef}
                className="flex-1 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                placeholder="输入您的回答..."
                rows={2}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isRecording || isProcessingSpeech}
              />
              
              {/* 语音输入按钮 */}
              <Button
                color={isRecording ? "destructive" : "secondary"}
                isIconOnly
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isProcessingSpeech}
                className="shadow-md"
                title={isRecording ? "停止录音" : "语音输入"}
              >
                {isRecording ? 
                  <MicrophoneSlash size={20} weight="fill" /> : 
                  <Microphone size={20} weight="fill" />
                }
              </Button>
              
              {/* 发送按钮 */}
              <Button
                color="primary"
                isIconOnly
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading || isRecording || isProcessingSpeech}
                className="shadow-md"
              >
                {isLoading ? <Spinner size="sm" /> : <PaperPlaneTilt size={20} weight="fill" />}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInterview;
