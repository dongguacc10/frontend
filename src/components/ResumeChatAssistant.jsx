import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Spinner,
  addToast,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@heroui/react";
import { motion } from "framer-motion";
import { 
  PaperPlaneTilt, 
  X, 
  Robot,
  StopCircle,
  Trash,
  Copy,
  FileText,
  CheckCircle,
  SuitcaseSimple,
  GraduationCap,
  Sparkle,
  Quotes,
  Phone,
  Envelope,
  MapPin,
  Calendar
} from "@phosphor-icons/react";
import { resumeChatService } from "../services";
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

// 消息类型
const MessageType = {
  USER: 'user',
  ASSISTANT: 'assistant'
};

const ResumeChatAssistant = () => {
  // 状态管理
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(true);
  const [messagesHistory, setMessagesHistory] = useState([]);
  const [generatedResume, setGeneratedResume] = useState(null);
  const [tempResumeData, setTempResumeData] = useState(null);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState("idle"); // idle, optimizing, completed
  const [optimizationResult, setOptimizationResult] = useState("");
  const [optimizedResumeData, setOptimizedResumeData] = useState(null);
  const [showOptimizationContent, setShowOptimizationContent] = useState(true);
  const [optimizationRequestId, setOptimizationRequestId] = useState(null);
  
  // 弹窗控制
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [resumeGenerationStep, setResumeGenerationStep] = useState("generating"); // generating, optimizing, completed
  const [generationProgress, setGenerationProgress] = useState("");
  
  // 引用
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const resumeContentRef = useRef(null);
  const optimizationContentRef = useRef(null);
  const generationProgressRef = useRef(null);
  const tempResumeDataRef = useRef(null);
  
  // 自动滚动到底部
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 自动滚动生成进度内容到底部
  const scrollProgressToBottom = () => {
    if (generationProgressRef.current) {
      const element = generationProgressRef.current;
      element.scrollTop = element.scrollHeight;
    }
    if (tempResumeDataRef.current) {
      const element = tempResumeDataRef.current;
      element.scrollTop = element.scrollHeight;
    }
  };

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAssistantMessage]);
  
  // 自动滚动到简历内容底部
  const scrollResumeToBottom = () => {
    if (resumeContentRef.current) {
      resumeContentRef.current.scrollTop = resumeContentRef.current.scrollHeight;
    }
  };
  
  // 监听tempResumeData变化，自动滚动到底部
  useEffect(() => {
    if (tempResumeData) {
      scrollResumeToBottom();
    }
  }, [tempResumeData]);
  
  // 自动滚动优化建议
  useEffect(() => {
    if (optimizationContentRef.current && optimizationResult) {
      optimizationContentRef.current.scrollTop = optimizationContentRef.current.scrollHeight;
    }
  }, [optimizationResult]);
  
  // 监听生成进度变化，自动滚动到底部
  useEffect(() => {
    if (generationProgress) {
      // 使用requestAnimationFrame确保DOM已更新
      requestAnimationFrame(() => {
        scrollProgressToBottom();
      });
    }
  }, [generationProgress]);

  // 监听临时简历数据变化，自动滚动到底部
  useEffect(() => {
    if (tempResumeData && tempResumeData.content) {
      // 使用requestAnimationFrame确保DOM已更新
      requestAnimationFrame(() => {
        scrollProgressToBottom();
      });
    }
  }, [tempResumeData]);

  // 使用MutationObserver监听内容变化并自动滚动
  useEffect(() => {
    // 只有当弹窗打开时才设置观察器
    if (!isOpen) return;

    // 创建MutationObserver实例
    const progressObserver = new MutationObserver(() => {
      scrollProgressToBottom();
    });
    
    const resumeObserver = new MutationObserver(() => {
      scrollProgressToBottom();
    });

    // 开始观察
    if (generationProgressRef.current) {
      progressObserver.observe(generationProgressRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    if (tempResumeDataRef.current) {
      resumeObserver.observe(tempResumeDataRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // 组件卸载时断开观察
    return () => {
      progressObserver.disconnect();
      resumeObserver.disconnect();
    };
  }, [isOpen]);
  
  // 加载历史消息
  useEffect(() => {
    const savedMessages = localStorage.getItem('resumeChatAssistantMessages');
    const savedConversationId = localStorage.getItem('resumeChatAssistantConversationId');
    const savedMessagesHistory = localStorage.getItem('resumeChatAssistantMessagesHistory');
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
        // 如果有历史消息，不显示欢迎动画
        if (parsedMessages.length > 0) {
          setShowWelcomeAnimation(false);
        }
      } catch (error) {
        console.error('解析历史消息失败:', error);
      }
    }
    
    if (savedConversationId) {
      setConversationId(savedConversationId);
    }
    
    if (savedMessagesHistory) {
      try {
        const parsedMessagesHistory = JSON.parse(savedMessagesHistory);
        setMessagesHistory(parsedMessagesHistory);
      } catch (error) {
        console.error('解析消息历史记录失败:', error);
      }
    }
  }, []);
  
  // 保存消息到本地存储
  useEffect(() => {
    if (messages.length > 0) {
      // 只保存最近的20条消息
      const recentMessages = messages.slice(-20);
      localStorage.setItem('resumeChatAssistantMessages', JSON.stringify(recentMessages));
    }
    
    if (conversationId) {
      localStorage.setItem('resumeChatAssistantConversationId', conversationId);
    }
    
    if (messagesHistory.length > 0) {
      localStorage.setItem('resumeChatAssistantMessagesHistory', JSON.stringify(messagesHistory));
    }
  }, [messages, conversationId, messagesHistory]);
  
  // 处理消息发送
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    try {
      setIsLoading(true);
      
      // 创建用户消息对象
      const userMessage = {
        type: MessageType.USER,
        content: inputMessage.trim(),
        timestamp: new Date()
      };
      
      // 添加到消息列表
      setMessages(prev => [...prev, userMessage]);
      
      // 清空输入框
      setInputMessage('');
      
      // 准备消息历史记录
      const currentMessagesHistory = [...messagesHistory];
      currentMessagesHistory.push({
        role: 'user',
        content: userMessage.content
      });
      
      // 调用API发送消息
      try {
        const { conversationId: newConversationId, messagesHistory: updatedMessagesHistory } = await resumeChatService.chatWithResumeAssistant(
          userMessage.content,
          currentMessagesHistory,
          handleStreamResponse,
          conversationId
        );
        
        if (newConversationId) {
          setConversationId(newConversationId);
        }
        
        if (updatedMessagesHistory) {
          setMessagesHistory(updatedMessagesHistory);
        }
        
        console.log('会话ID:', newConversationId);
      } catch (error) {
        console.error('发送消息失败:', error);
        addToast({
          title: "错误",
          description: `发送消息失败: ${error.message}`,
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "danger"
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('处理消息发送失败:', error);
      addToast({
        title: "错误",
        description: `处理消息发送失败: ${error.message}`,
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
      setIsLoading(false);
    }
  };
  
  // 处理流式响应
  const handleStreamResponse = (eventData) => {

    
    // 处理流式内容 - 只在非完成事件时更新流式内容
    if (eventData.content_chunk && !eventData.finished) {
   
      setCurrentAssistantMessage(prev => prev + eventData.content_chunk);
    }
    
    // 处理完整响应
    if (eventData.finished) {
      console.log('收到完整响应');
      
      // 如果有完整的content，优先使用它，否则使用累积的内容
      let finalContent = '';
      if (eventData.content) {
        finalContent = eventData.content;
        console.log('使用完整返回的content:', finalContent);
      } else {
        finalContent = currentAssistantMessage + (eventData.content_chunk || '');
        console.log('使用累积的content:', finalContent);
      }
      
      // 添加助手消息到列表，同时清除当前消息
      const assistantMessage = {
        type: MessageType.ASSISTANT,
        content: finalContent,
        timestamp: new Date()
      };
      
      // 使用函数形式的setState确保获取最新状态
      setMessages(prev => {
        // 检查是否已经有相同内容的消息，避免重复添加
        const isDuplicate = prev.some(msg => 
          msg.type === MessageType.ASSISTANT && msg.content === finalContent
        );
        
        if (isDuplicate) {
          console.log('检测到重复消息，不添加');
          return prev;
        }
        
        console.log('添加新消息到列表');
        return [...prev, assistantMessage];
      });
      
      // 更新消息历史
      if (eventData.messages_history) {
        setMessagesHistory(eventData.messages_history);
      } else {
        // 如果没有返回完整的消息历史，手动添加助手回复
        setMessagesHistory(prev => {
          const updatedHistory = [...prev];
          // 检查是否已经有相同的最后一条消息
          const lastMessage = updatedHistory[updatedHistory.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === finalContent) {
            console.log('消息历史中已有相同内容，不添加');
            return updatedHistory;
          }
          
          updatedHistory.push({
            role: 'assistant',
            content: finalContent
          });
          return updatedHistory;
        });
      }
      
      // 立即清除当前消息，不使用延迟
      setCurrentAssistantMessage('');
      setIsLoading(false);
    }
    
    // 处理错误
    if (eventData.error) {
      console.error('流式响应中的错误:', eventData.error);
      addToast({
        title: "错误",
        description: eventData.error,
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
      setIsLoading(false);
    }
    
    // 处理优化状态
    if (eventData.status === "optimizing") {
      setOptimizationStatus("optimizing");
    }
    
    // 处理优化后的简历数据
    if (eventData.resume_data && eventData.status === "optimized") {
      setOptimizedResumeData(eventData.resume_data);
    }
  };
  
  // 处理输入框按键事件
  const handleInputKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // 清除历史记录
  const handleClearHistory = () => {
    if (isLoading) {
      addToast({
        title: "警告",
        description: "请等待当前对话完成后再清除历史记录",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "warning"
      });
      return;
    }
    
    setMessages([]);
    setMessagesHistory([]);
    setConversationId(null);
    setShowWelcomeAnimation(true);
    localStorage.removeItem('resumeChatAssistantMessages');
    localStorage.removeItem('resumeChatAssistantConversationId');
    localStorage.removeItem('resumeChatAssistantMessagesHistory');
    
    addToast({
      title: "已清除",
      description: "历史对话记录已清除",
      timeout: 3000,
      shouldshowtimeoutprogess: "true",
      color: "success"
    });
  };
  
  // 复制回答
  const handleCopyResponse = (content) => {
    navigator.clipboard.writeText(content).then(
      () => {
        addToast({
          title: "已复制",
          description: "回答内容已复制到剪贴板",
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "success"
        });
      },
      (err) => {
        console.error('复制失败:', err);
        addToast({
          title: "复制失败",
          description: "无法复制内容到剪贴板",
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "danger"
        });
      }
    );
  };
  
  // 生成简历
  const handleGenerateResume = async () => {
    if (messagesHistory.length === 0) {
      addToast({
        title: "警告",
        description: "需要先进行对话才能生成简历",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "warning"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setIsGeneratingResume(true);
      setTempResumeData(null);
      setOptimizationResult("");
      setOptimizationStatus("idle");
      setShowOptimizationContent(true);
      setGenerationProgress("");
      setResumeGenerationStep("generating");
      
      // 打开弹窗
      onOpen();
      
      // 使用流式生成简历
      const handleResumeStreamResponse = (eventData) => {
        
        if (eventData.error) {
          addToast({
            title: "错误",
            description: `生成简历失败: ${eventData.error}`,
            timeout: 3000,
            shouldshowtimeoutprogess: "true",
            color: "danger"
          });
          return;
        }
        
        // 处理优化状态
        if (eventData.status === "optimizing") {
          setOptimizationStatus("optimizing");
          setResumeGenerationStep("optimizing");
        }
        
        // 处理内容块
        if (eventData.content_chunk) {
          
          // 只更新生成进度
          setGenerationProgress(prev => {
            const newProgress = prev + eventData.content_chunk;
            // 在下一个微任务中滚动到底部
            setTimeout(() => scrollProgressToBottom(), 0);
            return newProgress;
          });
        }
        
        // 处理优化建议
        if (eventData.optimization_advice) {
          setOptimizationResult(eventData.optimization_advice);
        }
        
        // 处理优化后的简历数据
        if (eventData.resume_data && eventData.status === "optimized") {
          setOptimizedResumeData(eventData.resume_data);
        }
        
        // 如果是最终结果
        if (eventData.finished) {
          console.log("收到最终结果事件，finished=true:", eventData);
          setIsGeneratingResume(false);
          setOptimizationStatus("completed");
          setResumeGenerationStep("completed");
          
          if (eventData.resume_data) {
            setGeneratedResume(eventData.resume_data);
          }
          
          // 保存完整的优化结果
          if (eventData.full_content) {
            setOptimizationResult(eventData.full_content);
          }
          
          // 强制执行查询操作，使用事件中的request_id或保存的optimizationRequestId
          const requestIdToUse = eventData.request_id || optimizationRequestId;
          console.log("强制执行查询操作，使用requestId:", requestIdToUse);
          if (requestIdToUse) {
            // 使用setTimeout确保在状态更新后执行
            setTimeout(() => {
              console.log("延迟执行fetchOptimizationResult");
              fetchOptimizationResult(requestIdToUse);
              
              // 只在获取优化结果后显示成功提示
              addToast({
                title: "成功",
                description: "简历生成完成",
                timeout: 3000,
                shouldshowtimeoutprogess: "true",
                color: "success"
              });
            }, 500);
          } else {
            console.warn("没有可用的requestId，无法获取优化结果");
          }
        }
        
        // 保存请求ID
        if (eventData.request_id) {
          setOptimizationRequestId(eventData.request_id);
        }
        
        // 更新临时简历数据（用于显示生成进度）
        if (eventData.content) {
          setTempResumeData({
            content: eventData.content,
            is_complete_json: eventData.is_complete_json || false
          });
          // 在下一个微任务中滚动到底部
          setTimeout(() => scrollProgressToBottom(), 0);
        }
      };
      
      await resumeChatService.generateResumeStream(messagesHistory, handleResumeStreamResponse);
      
    } catch (error) {
      console.error('生成简历失败:', error);
      addToast({
        title: "错误",
        description: `生成简历失败: ${error.message}`,
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
    } finally {
      setIsLoading(false);
      setIsGeneratingResume(false);
    }
  };
  
  // 复制生成的简历
  const handleCopyResume = () => {
    const resumeData = tempResumeData || generatedResume;
    if (!resumeData) {
      return;
    }
    
    navigator.clipboard.writeText(JSON.stringify(resumeData, null, 2)).then(
      () => {
        addToast({
          title: "已复制",
          description: "简历内容已复制到剪贴板",
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "success"
        });
      },
      (err) => {
        console.error('复制失败:', err);
        addToast({
          title: "复制失败",
          description: "无法复制简历内容到剪贴板",
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "danger"
        });
      }
    );
  };
  
  // 检测消息内容是否包含JSON格式并格式化显示
  const formatMessageContent = (content) => {
    return resumeChatService.formatMessageContent(content);
  };

  // 渲染美观的简历（全新设计）
  const sectionIcon = {
    '工作/项目经历': <SuitcaseSimple size={20} className="text-primary-500 mr-2" />,
    '教育背景': <GraduationCap size={20} className="text-primary-500 mr-2" />,
    '技能特长': <Sparkle size={20} className="text-primary-500 mr-2" />,
    '个人评价': <Quotes size={20} className="text-primary-500 mr-2" />,
  };
  const renderBeautifulResume = (resumeData) => {
    if (!resumeData) return null;
    return (
      <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl shadow-lg border border-blue-100 max-w-3xl mx-auto">
        {/* 顶部信息 */}
        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl font-extrabold text-gray-900 tracking-wide">{resumeData.basic_info?.name || '未填写姓名'}</div>
          <div className="flex flex-wrap gap-4 mt-3 text-gray-600 text-sm items-center justify-center">
            {resumeData.basic_info?.phone && <span><Phone size={16} className="inline-block mr-1" />{resumeData.basic_info.phone}</span>}
            {resumeData.basic_info?.email && <span><Envelope size={16} className="inline-block mr-1" />{resumeData.basic_info.email}</span>}
            {resumeData.basic_info?.location && <span><MapPin size={16} className="inline-block mr-1" />{resumeData.basic_info.location}</span>}
            {resumeData.basic_info?.expected_graduation && <span><Calendar size={16} className="inline-block mr-1" />预计毕业: {resumeData.basic_info.expected_graduation}</span>}
          </div>
        </div>

        {/* 工作/项目经历 */}
        {resumeData.experiences && resumeData.experiences.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center text-lg font-bold mb-3 text-primary-700">
              {sectionIcon['工作/项目经历']} 工作/项目经历
            </div>
            <div className="space-y-4">
              {resumeData.experiences.map((exp, idx) => (
                <div key={idx} className="bg-white rounded-xl shadow border border-gray-100 p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold text-base">{exp.name}</div>
                    <div className="text-xs text-gray-400">{exp.start_time} - {exp.end_time || '至今'}</div>
                  </div>
                  <div className="text-gray-700 mb-2">
                    <span className="font-medium">{exp.role}</span>
                  </div>
                  {exp.description && <div className="text-gray-700 mb-1">{exp.description}</div>}
                  {exp.responsibilities && <div className="text-gray-600 mb-1"><span className="font-semibold">职责：</span>{exp.responsibilities}</div>}
                  {exp.achievements && <div className="text-gray-600"><span className="font-semibold">成就：</span>{exp.achievements}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 教育背景 */}
        {resumeData.education && resumeData.education.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center text-lg font-bold mb-3 text-primary-700">
              {sectionIcon['教育背景']} 教育背景
            </div>
            <div className="space-y-3">
              {resumeData.education.map((edu, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 flex justify-between items-center shadow hover:shadow-md transition">
                  <div>
                    <div className="font-semibold">{edu.school}</div>
                    <div className="text-sm text-gray-600">{edu.major} {edu.degree && `| ${edu.degree}`}</div>
                  </div>
                  <div className="text-xs text-gray-400">{edu.start_time} - {edu.end_time}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 技能特长 */}
        {resumeData.skills && resumeData.skills.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center text-lg font-bold mb-3 text-primary-700">
              {sectionIcon['技能特长']} 技能特长
            </div>
            <div className="flex flex-wrap gap-4">
              {resumeData.skills.map((group, idx) => (
                <div key={idx} className="min-w-[120px]">
                  <div className="text-xs font-semibold text-white bg-primary-400 rounded-t px-2 py-1">{group.category}</div>
                  <div className="bg-blue-50 rounded-b px-2 py-2 flex flex-wrap gap-2">
                    {group.items && group.items.map((item, i) => (
                      <span key={i} className="bg-white border border-blue-200 rounded-full px-3 py-1 text-xs text-primary-700 shadow-sm">{typeof item === 'string' ? item : item.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 个人评价 */}
        {resumeData.self_evaluation && (
          <div className="mb-8">
            <div className="flex items-center text-lg font-bold mb-3 text-primary-700">
              {sectionIcon['个人评价']} 个人评价
            </div>
            {Array.isArray(resumeData.self_evaluation) ? (
              <ul className="list-disc list-inside space-y-2">
                {resumeData.self_evaluation.map((item, index) => (
                  <li key={index} className="text-gray-700 leading-relaxed">{item}</li>
                ))}
              </ul>
            ) : (
              <blockquote className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-gray-700 italic">
                “{resumeData.self_evaluation}”
              </blockquote>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染美观的简历（全新设计）
  const renderBeautifulResumeNew = (resumeData) => {
    if (!resumeData) return null;
    
    return (
      <div className="resume-container font-sans">
        {/* 基本信息 */}
        {resumeData.basic_info && (
          <div className="mb-6">
            {/* 标题栏 */}
            <div className="text-center bg-gradient-to-r from-primary-50 to-primary-100 py-6 px-4 rounded-lg border border-primary-200 shadow-sm mb-4">
              <h1 className="text-3xl font-bold text-primary-700 mb-2">
                个人简历
              </h1>
              <h2 className="text-2xl font-semibold text-gray-800">
                {resumeData.basic_info.name || ''}
              </h2>
              {resumeData.job_intention && resumeData.job_intention.position && (
                <div className="mt-2 inline-block bg-primary-100 text-primary-700 px-4 py-1 rounded-full text-sm font-medium border border-primary-200">
                  {resumeData.job_intention.position}
                </div>
              )}
            </div>
            
            {/* 联系信息 */}
            {(resumeData.basic_info.gender || 
              resumeData.basic_info.phone || 
              resumeData.basic_info.email || 
              resumeData.basic_info.location || 
              resumeData.basic_info.expected_graduation) && (
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 bg-gray-50 py-3 px-4 rounded-md border border-gray-200">
                {resumeData.basic_info.gender && (
                  <span className="flex items-center">
                    <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                      <span className="text-xs">性</span>
                    </span>
                    {resumeData.basic_info.gender}
                  </span>
                )}
                {resumeData.basic_info.phone && (
                  <span className="flex items-center">
                    <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                      <Phone size={12} className="text-blue-500" />
                    </span>
                    {resumeData.basic_info.phone}
                  </span>
                )}
                {resumeData.basic_info.email && (
                  <span className="flex items-center">
                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-2">
                      <Envelope size={12} className="text-green-500" />
                    </span>
                    {resumeData.basic_info.email}
                  </span>
                )}
                {resumeData.basic_info.location && (
                  <span className="flex items-center">
                    <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mr-2">
                      <MapPin size={12} className="text-red-500" />
                    </span>
                    {resumeData.basic_info.location}
                  </span>
                )}
                {resumeData.basic_info.expected_graduation && (
                  <span className="flex items-center">
                    <span className="w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center mr-2">
                      <Calendar size={12} className="text-yellow-500" />
                    </span>
                    预计毕业: {resumeData.basic_info.expected_graduation}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* 求职意向 */}
        {resumeData.job_intention && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-primary-600 border-b border-primary-200 pb-1 mb-3">
              求职意向
            </h2>
            <div className="flex flex-wrap gap-3">
              {resumeData.job_intention.position && (
                <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm">
                  {resumeData.job_intention.position}
                </div>
              )}
              {resumeData.job_intention.industry && (
                <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm">
                  {resumeData.job_intention.industry}
                </div>
              )}
              {resumeData.job_intention.location && (
                <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm">
                  {resumeData.job_intention.location}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 个人评价 */}
        {resumeData.self_evaluation && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-primary-600 border-b border-primary-200 pb-1 mb-3">
              个人评价
            </h2>
            {Array.isArray(resumeData.self_evaluation) ? (
              <ul className="list-disc list-inside space-y-2">
                {resumeData.self_evaluation.map((item, index) => (
                  <li key={index} className="text-gray-700 leading-relaxed">{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-700 leading-relaxed">
                {resumeData.self_evaluation}
              </p>
            )}
          </div>
        )}

        {/* 工作经历 */}
        {resumeData.experiences && resumeData.experiences.length > 0 && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-primary-600 border-b border-primary-200 pb-1 mb-3">
              工作经历
            </h2>
            <div className="space-y-4">
              {resumeData.experiences.map((exp, index) => (
                <div key={index} className="pb-3">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-gray-800">{exp.name}</h3>
                    <span className="text-sm text-gray-600">
                      {exp.start_time} - {exp.end_time || '至今'}
                    </span>
                  </div>
                  <div className="text-gray-700 mb-2">
                    <span className="font-medium">{exp.role}</span>
                  </div>
                  {exp.description && typeof exp.description === 'string' && (
                    <p className="text-gray-700 text-sm ml-2">{exp.description}</p>
                  )}
                  {exp.description && Array.isArray(exp.description) && exp.description.length > 0 && (
                    <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 ml-2">
                      {exp.description.map((desc, i) => (
                        <li key={i}>{desc}</li>
                      ))}
                    </ul>
                  )}
                  {exp.responsibilities && Array.isArray(exp.responsibilities) && exp.responsibilities.length > 0 && (
                    <div className="mt-2">
                      <h5 className="text-sm font-medium text-gray-700 mb-1">工作职责：</h5>
                      <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 ml-2">
                        {exp.responsibilities.map((resp, i) => (
                          <li key={i}>{resp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 教育背景 */}
        {resumeData.education && resumeData.education.length > 0 && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-primary-600 border-b border-primary-200 pb-1 mb-3">
              教育背景
            </h2>
            <div className="space-y-3">
              {resumeData.education.map((edu, index) => (
                <div key={index} className="flex justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">{edu.school}</div>
                    <div className="text-gray-700">{edu.major} · {edu.degree}</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {edu.start_time} - {edu.end_time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 技能特长 */}
        {resumeData.skills && resumeData.skills.length > 0 && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-primary-600 border-b border-primary-200 pb-1 mb-3">
              技能特长
            </h2>
            <div className="space-y-4">
              {Array.isArray(resumeData.skills) && resumeData.skills.map((skillCategory, categoryIndex) => {
                // 处理数组形式的技能分类
                if (skillCategory && typeof skillCategory === 'object' && !Array.isArray(skillCategory)) {
                  // 如果是带有category字段的对象
                  if (skillCategory.category) {
                    return (
                      <div key={categoryIndex} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <h3 className="text-md font-semibold text-primary-600 mb-2">{skillCategory.category}</h3>
                        
                        {/* 处理level字段 */}
                        {skillCategory.level && (
                          <div className="mb-2">
                            <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                              熟练度: {skillCategory.level}
                            </span>
                          </div>
                        )}
                        
                        {/* 处理name字段 */}
                        {skillCategory.name && (
                          <div className="text-gray-700 mb-2">{skillCategory.name}</div>
                        )}
                        
                        {/* 处理details数组 */}
                        {skillCategory.details && Array.isArray(skillCategory.details) && skillCategory.details.length > 0 && (
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {skillCategory.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="text-gray-700">
                                {typeof detail === 'string' ? detail : JSON.stringify(detail)}
                              </li>
                            ))}
                          </ul>
                        )}
                        
                        {/* 处理items数组 */}
                        {skillCategory.items && Array.isArray(skillCategory.items) && skillCategory.items.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {skillCategory.items.map((item, itemIndex) => (
                              <span key={itemIndex} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                                {typeof item === 'string' ? item : (item.name || JSON.stringify(item))}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  } else if (Array.isArray(skillCategory)) {
                    // 如果是数组，递归处理
                    return (
                      <div key={categoryIndex} className="space-y-2">
                        {skillCategory.map((subSkill, subIndex) => (
                          <div key={subIndex} className="bg-gray-50 p-2 rounded border border-gray-200">
                            {typeof subSkill === 'string' ? (
                              <span>{subSkill}</span>
                            ) : (
                              <>
                                {subSkill.name && <div className="font-medium">{subSkill.name}</div>}
                                {subSkill.level && <div className="text-sm text-gray-600">熟练度: {subSkill.level}</div>}
                                {subSkill.category && <div className="text-sm text-primary-600">{subSkill.category}</div>}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  } else {
                    // 处理简单对象
                    return (
                      <div key={categoryIndex} className="bg-gray-50 p-2 rounded border border-gray-200">
                        {skillCategory.category && <div className="font-medium text-primary-600">{skillCategory.category}</div>}
                        {skillCategory.name && <div className="font-medium">{skillCategory.name}</div>}
                        {skillCategory.level && <div className="text-sm text-gray-600">熟练度: {skillCategory.level}</div>}
                      </div>
                    );
                  }
                } else if (Array.isArray(skillCategory)) {
                  // 处理数组中的数组
                  return (
                    <div key={categoryIndex} className="space-y-2">
                      {skillCategory.map((subSkill, subIndex) => (
                        <div key={subIndex} className="bg-gray-50 p-2 rounded border border-gray-200">
                          {typeof subSkill === 'string' ? (
                            <span>{subSkill}</span>
                          ) : (
                            <>
                              {subSkill.name && <div className="font-medium">{subSkill.name}</div>}
                              {subSkill.level && <div className="text-sm text-gray-600">熟练度: {subSkill.level}</div>}
                              {subSkill.category && <div className="text-sm text-primary-600">{subSkill.category}</div>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                } else if (typeof skillCategory === 'string') {
                  // 处理字符串类型
                  return (
                    <span key={categoryIndex} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm inline-block mr-2">
                      {skillCategory}
                    </span>
                  );
                } else {
                  return null;
                }
              })}
            </div>
          </div>
        )}

        {/* 语言能力 */}
        {resumeData.languages && resumeData.languages.length > 0 && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-primary-600 border-b border-primary-200 pb-1 mb-3">
              语言能力
            </h2>
            <div className="space-y-2">
              {resumeData.languages.map((lang, index) => {
                if (typeof lang === 'string') {
                  return (
                    <div key={index} className="text-gray-700">
                      {lang}
                    </div>
                  );
                } else if (lang && typeof lang === 'object') {
                  // 处理对象形式的语言能力
                  const langName = lang.name || lang.language || '';
                  const proficiency = lang.proficiency || lang.level || '';
                  
                  if (langName) {
                    return (
                      <div key={index} className="flex items-center">
                        <span className="font-medium text-gray-800 mr-2">{langName}:</span>
                        <span className="text-gray-700">{proficiency}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div key={index} className="text-gray-700">
                        {Object.values(lang).join(' - ')}
                      </div>
                    );
                  }
                } else {
                  return null;
                }
              })}
            </div>
          </div>
        )}

        {/* 证书 */}
        {resumeData.certificates && resumeData.certificates.length > 0 && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-primary-600 border-b border-primary-200 pb-1 mb-3">
              证书
            </h2>
            <ul className="list-disc list-inside space-y-2">
              {resumeData.certificates.map((cert, index) => (
                <li key={index} className="text-gray-700">
                  <span className="font-medium">{cert.name}</span>
                  {cert.date && <span className="text-gray-500 text-sm ml-2">({cert.date})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  
  // 渲染消息气泡
  const renderMessage = (message, index) => {
    const isUser = message.type === MessageType.USER;
    
    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center mr-2 mt-1">
            <Robot size={20} weight="duotone" className="text-primary-500" />
          </div>
        )}
        <div 
          className={`max-w-[70%] rounded-lg p-3 ${
            isUser 
              ? 'bg-primary-500 text-white rounded-tr-none shadow-sm shadow-primary-500/20' 
              : 'bg-gray-100 text-gray-800 rounded-tl-none shadow-sm'
          }`}
        >
          {!isUser && (
            <div className="flex items-center mb-1 justify-between">
              <span className="text-xs font-semibold text-primary-700">简历生成助手</span>
              <Button
                variant="ghost"
                color="default"
                size="xs"
                className="p-1 rounded-full"
                onClick={() => handleCopyResponse(message.content)}
                title="复制回答"
              >
                <Copy size={14} weight="bold" />
              </Button>
            </div>
          )}
          <div className="text-sm">{formatMessageContent(message.content)}</div>
          <div className="text-xs text-right mt-1 opacity-70">
            {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center ml-2 mt-1">
            <span className="text-white text-xs font-bold">我</span>
          </div>
        )}
      </motion.div>
    );
  };
  
  // 获取优化结果
  const fetchOptimizationResult = async (requestId) => {
    if (!requestId) return;
    
    try {
      console.log("获取优化结果，请求ID:", requestId);
      const result = await api.getResumeOptimizationResult(requestId);
      console.log("获取到优化结果:", result);
      
      if (result && result.result) {
        console.log("设置优化结果:", result.result);
        // 保存原始JSON对象，而不是字符串化的JSON
        setOptimizedResumeData(result.result.optimized_resume_content || result.result);
        setOptimizationResult(JSON.stringify(result.result, null, 2));
      } else {
        console.warn("优化结果为空或格式不正确:", result);
      }
    } catch (error) {
      console.error("获取优化结果时出错:", error);
    }
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none rounded-none">
      <CardBody className="flex-grow overflow-y-auto p-4">
        {showWelcomeAnimation && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-6 p-4 rounded-full bg-primary-50 text-primary-500"
            >
              <FileText size={80} weight="duotone" />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center max-w-md"
            >
              <h3 className="text-xl font-semibold text-gray-700 mb-2">欢迎使用简历生成助手</h3>
              <p className="text-gray-500">
                我是专业的简历生成助手，将通过一系列问题引导你创建一份专业的简历。让我们开始吧！
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("你好，我想创建一份简历");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  开始创建简历
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("我是应届毕业生，没有工作经验，如何写好简历？");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  应届生简历建议
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("如何突出我的项目经历？");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  突出项目经历
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("简历中应该包含哪些技能？");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  技能部分建议
                </Button>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            
            {currentAssistantMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-start mb-4"
              >
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center mr-2 mt-1">
                  <Robot size={20} weight="duotone" className="text-primary-500" />
                </div>
                <div className="max-w-[70%] rounded-lg p-3 bg-gray-100 text-gray-800 rounded-tl-none shadow-sm">
                  <div className="flex items-center mb-1">
                    <span className="text-xs font-semibold text-primary-700">简历生成助手</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {currentAssistantMessage}
                    <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-1"></span>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </CardBody>
      
      <CardFooter className="border-t p-4">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="outline"
            color="default"
            size="sm"
            className="shrink-0"
            onClick={handleClearHistory}
            title="清除历史记录"
            disabled={isLoading}
          >
            <Trash size={18} weight="bold" />
          </Button>
          
          <Button
            variant="outline"
            color="primary"
            size="sm"
            className="shrink-0"
            onClick={handleGenerateResume}
            title="生成简历"
            disabled={isLoading || messagesHistory.length === 0 || isGeneratingResume}
          >
            <FileText size={18} weight="bold" className="mr-1" />
            生成简历
          </Button>
          
          <Input
            placeholder="输入消息..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleInputKeyPress}
            disabled={isLoading}
            ref={inputRef}
            className="flex-grow"
          />
          
          <Button
            variant="solid"
            color="primary"
            size="sm"
            className="shrink-0"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
          >
            {isLoading ? (
              <Spinner size="sm" color="white" />
            ) : (
              <PaperPlaneTilt size={18} weight="bold" />
            )}
          </Button>
        </div>
      </CardFooter>
      
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="4xl" scrollBehavior="inside" className="h-[90vh] max-h-[90vh]">
        <ModalContent className="h-full">
          {(onClose) => (
            <>
              <ModalHeader className="border-b">
                <div className="flex items-center">
                  <FileText size={24} className="text-primary-500 mr-2" />
                  <span>简历生成</span>
                </div>
              </ModalHeader>
              <ModalBody className="py-6 flex-grow overflow-auto">
                <div className="flex flex-col gap-6">
                  {/* 生成进度内容 */}
                  {generationProgress && (
                    <div ref={generationProgressRef} className="mt-4 border rounded-lg p-4 bg-gray-50 h-[200px] max-h-[300px] overflow-auto">
                      <p className="text-sm font-semibold mb-2 text-gray-700">生成进度实时内容：</p>
                      <div className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{generationProgress}</div>
                    </div>
                  )}

                  {/* 生成的简历预览 */}
                  {tempResumeData && tempResumeData.content && (
                    <div className="mt-6">
                      <p className="text-sm font-semibold mb-2 text-gray-700">生成的简历预览：</p>
                      <div ref={tempResumeDataRef} className="border rounded-lg p-4 bg-white h-[200px] max-h-[300px] overflow-auto">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap">{tempResumeData.content}</pre>
                      </div>
                    </div>
                  )}
                  
                  {/* 优化结果 */}
                  {optimizationResult && (
                    <div className="mt-6">
                      <p className="text-sm font-semibold mb-2 text-gray-700">优化结果：</p>
                      <div className="border rounded-lg p-4 bg-white h-[400px] max-h-[500px] overflow-auto shadow-sm">
                        {optimizedResumeData ? (
                          renderBeautifulResumeNew(optimizedResumeData)
                        ) : (
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap">{optimizationResult}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  );
};

export default ResumeChatAssistant;
