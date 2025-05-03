import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Spinner,
  addToast
} from "@heroui/react";
import { motion } from "framer-motion";
import { 
  PaperPlaneTilt, 
  X, 
  Robot,
  StopCircle,
  Trash,
  Copy,
  Briefcase
} from "@phosphor-icons/react";
import { careerService } from "../services";
import JobPositionList from "./JobPositionList";

// 消息类型
const MessageType = {
  USER: 'user',
  ASSISTANT: 'assistant'
};

const CareerAssistant = () => {
  // 状态管理
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(true);
  const [jobSearchResult, setJobSearchResult] = useState(null);
  
  // 引用
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAssistantMessage]);
  
  // 加载历史消息
  useEffect(() => {
    const savedMessages = localStorage.getItem('careerAssistantMessages');
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
  }, []);
  
  // 保存消息到本地存储
  useEffect(() => {
    if (messages.length > 0) {
      // 只保存最近的20条消息
      const recentMessages = messages.slice(-20);
      localStorage.setItem('careerAssistantMessages', JSON.stringify(recentMessages));
    }
  }, [messages]);
  
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
      
      // 获取最近的消息历史
      const recentMessages = messages
        .slice(-10) // 只取最近的10条消息
        .map(msg => ({
          role: msg.type === MessageType.USER ? 'user' : 'assistant',
          content: msg.content
        }));
      
      // 调用API发送消息
      try {
        const { requestId } = await careerService.chatWithAssistant(
          userMessage.content,
          recentMessages,
          handleStreamResponse
        );
        
        setRequestId(requestId);
        console.log('请求ID:', requestId);
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
    console.log('收到流式响应事件:', eventData);
    
    const { event, status, data } = eventData;
    
    // 如果收到错误信息
    if (event === 'ERROR') {
      console.error('流式响应中的错误:', data.error);
      addToast({
        title: "错误",
        description: data.error,
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
      setIsLoading(false);
      return;
    }
    
    // 如果收到终止信号
    if (event === 'TERMINATED') {
      console.log('收到终止信号');
      addToast({
        title: "已终止",
        description: "助手回复已被终止",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "warning"
      });
      setIsLoading(false);
      return;
    }
    
    // 处理流式内容
    if (event === 'MESSAGE_CHUNK' && data.content) {
      console.log('收到流式内容:', data.content);
      setCurrentAssistantMessage(prev => prev + data.content);
    }
    
    // 处理完整响应
    if (event === 'MESSAGE_COMPLETE' && data.full_response) {
      console.log('收到完整响应:', data.full_response);
      // 添加助手消息到列表
      const assistantMessage = {
        type: MessageType.ASSISTANT,
        content: data.full_response,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setCurrentAssistantMessage('');
      setIsLoading(false);
      setRequestId(null);
      console.log('助手消息已添加到列表，状态已重置');
    }
    
    // 处理搜索结果事件
    if (event === 'SEARCH_RESULT' && status === 'SUCCESS') {
      console.log('收到搜索结果事件:', data);
      
      // 如果后端直接返回了搜索结果
      if (data.job_search_result) {
        console.log('直接收到职位搜索结果:', data.job_search_result);
        // 设置职位搜索结果
        setJobSearchResult(data.job_search_result);
      } 
      // 兼容旧版本：如果后端返回的是搜索参数和API地址
      else if (data.job_search_params && data.api_url) {
        console.log('收到搜索参数和API地址:', data.job_search_params, data.api_url);
        
        // 调用职位搜索API
        (async () => {
          try {
            // 使用api服务发送请求，而不是直接使用fetch
            const result = await careerService.getMorePositions(data.job_search_params);
            console.log('职位搜索API返回结果:', result);
            
            // 设置职位搜索结果
            setJobSearchResult(result);
          } catch (error) {
            console.error('调用职位搜索API失败:', error);
            addToast({
              title: "搜索错误",
              description: `调用职位搜索API失败: ${error.message}`,
              timeout: 3000,
              shouldshowtimeoutprogess: "true",
              color: "danger"
            });
          }
        })();
      }
    }
    
    // 处理搜索开始
    if (event === 'SEARCH_START') {
      console.log('开始搜索:', data.message);
      // 可以在这里添加搜索中的UI提示
    }
    
    // 处理搜索错误
    if (event === 'SEARCH_ERROR') {
      console.error('搜索错误:', data.error);
      addToast({
        title: "搜索错误",
        description: data.error,
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
    }
  };
  
  // 处理终止生成
  const handleTerminateGeneration = async () => {
    console.log('终止按钮被点击，当前requestId:', requestId);
    
    if (!requestId) {
      console.warn('没有可终止的请求ID');
      return;
    }
    
    try {
      console.log('准备发送终止请求，requestId:', requestId);
      await careerService.terminateChat(requestId);
      console.log('已发送终止请求，等待响应');
    } catch (error) {
      console.error('终止生成失败:', error);
      addToast({
        title: "错误",
        description: `终止生成失败: ${error.message}`,
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
    }
  };
  
  // 处理输入框按键事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // 清除历史记录
  const handleClearHistory = () => {
    if (isLoading) {
      addToast({
        title: "无法清除",
        description: "请等待当前回复生成完成后再清除历史记录",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "warning"
      });
      return;
    }
    
    setMessages([]);
    setShowWelcomeAnimation(true);
    localStorage.removeItem('careerAssistantMessages');
    
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
  
  // 检测消息内容是否包含JSON格式并格式化显示
  const formatMessageContent = (content) => {
    try {
      // 尝试检测消息是否为JSON格式
      if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
          // 尝试解析JSON
          const jsonObj = JSON.parse(content);
          // 如果解析成功，以代码块形式返回格式化的JSON
          return (
            <div>
              <pre className="bg-gray-800 text-white p-3 rounded-md overflow-auto text-xs">
                <code>{JSON.stringify(jsonObj, null, 2)}</code>
              </pre>
            </div>
          );
        } catch (e) {
          // 如果解析失败，可能不是有效的JSON，按原样返回
          return <div className="whitespace-pre-wrap">{content}</div>;
        }
      }
      
      return <div className="whitespace-pre-wrap">{content}</div>;
    } catch (error) {
      console.error('格式化消息内容时出错:', error);
      return <div className="whitespace-pre-wrap">{content}</div>;
    }
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
              <span className="text-xs font-semibold text-primary-700">职通未来助手</span>
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
              <Robot size={80} weight="duotone" />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center max-w-md"
            >
              <h3 className="text-xl font-semibold text-gray-700 mb-2">欢迎使用就业服务助手</h3>
              <p className="text-gray-500">
                我是"职通未来"，你的AI就业顾问。我可以帮助你解答关于求职、简历、面试、职业规划等方面的问题。
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("如何写一份优秀的简历？");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  如何写一份优秀的简历？
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("面试时如何回答薪资期望？");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  面试时如何回答薪资期望？
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("如何提高我的求职竞争力？");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  如何提高我的求职竞争力？
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  className="text-sm"
                  onClick={() => {
                    setInputMessage("职业规划应该考虑哪些因素？");
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                >
                  职业规划应该考虑哪些因素？
                </Button>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            
            {/* 正在生成的消息 */}
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
                    <span className="text-xs font-semibold text-primary-700">职通未来助手</span>
                  </div>
                  <div className="text-sm">{formatMessageContent(currentAssistantMessage)}</div>
                  <div className="text-xs text-right mt-1 opacity-70 flex items-center justify-end">
                    <Spinner size="xs" className="mr-2" />
                    <span>正在生成回复...</span>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* 职位搜索结果 */}
            {jobSearchResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-start mb-4"
              >
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center mr-2 mt-1">
                  <Briefcase size={20} weight="duotone" className="text-primary-500" />
                </div>
                <div className="max-w-[70%] rounded-lg p-3 bg-gray-100 text-gray-800 rounded-tl-none shadow-sm">
                  <div className="flex items-center mb-1">
                    <span className="text-xs font-semibold text-primary-700">职位搜索结果</span>
                  </div>
                  <JobPositionList searchResult={jobSearchResult} />
                </div>
              </motion.div>
            )}
            
            {/* 消息底部参考点 */}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardBody>
      
      <CardFooter className="border-t p-3 bg-white">
        <div className="flex items-center">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              color="danger"
              size="sm"
              className="mr-2"
              onClick={handleClearHistory}
              disabled={isLoading}
              title="清除历史记录"
            >
              <Trash size={18} weight="bold" />
            </Button>
          )}
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            disabled={isLoading}
            className="flex-grow"
          />
          
          {isLoading ? (
            <Button
              color="danger"
              variant="ghost"
              className="ml-2"
              onClick={handleTerminateGeneration}
              disabled={!requestId}
              title="停止生成"
            >
              <StopCircle size={20} weight="bold" />
            </Button>
          ) : (
            <Button
              color="primary"
              className="ml-2"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              title="发送消息"
            >
              <PaperPlaneTilt size={20} weight="bold" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default CareerAssistant;
