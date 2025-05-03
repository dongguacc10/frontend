/**
 * 简历生成聊天助手服务
 * 提供与简历生成聊天助手相关的功能服务
 */
import api from './api';
import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * 简历生成聊天助手服务
 */
const resumeChatService = {
  /**
   * 与简历生成聊天助手进行对话
   * @param {string} message - 用户消息
   * @param {Array} messagesHistory - 历史对话记录
   * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
   * @param {string} conversationId - 会话ID，如果为空则创建新会话
   * @returns {Promise<{conversationId: string, reader: ReadableStreamDefaultReader, messagesHistory: Array}>} - 包含会话ID、流读取器和更新后的消息历史的对象
   */
  chatWithResumeAssistant: async (message, messagesHistory = [], onProgress, conversationId = null) => {
    try {
      console.log('简历生成聊天助手对话开始');
      console.log('用户消息:', message);
      console.log('历史记录:', messagesHistory);
      console.log('会话ID:', conversationId);
      
      // 参数验证
      if (!message) {
        console.error('错误: 消息内容为空');
        throw new Error('消息内容不能为空');
      }

      console.log('调用API服务，准备获取流式响应');
      // 调用API服务，获取流式响应
      const response = await api.chatWithResumeAssistant(message, messagesHistory, conversationId);
      console.log('API响应状态:', response.status);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      console.log('创建流读取器和解码器成功');
      
      // 用于存储完整的响应内容
      let fullContent = '';
      // 用于存储更新后的消息历史
      let updatedMessagesHistory = [...messagesHistory];
      // 用于存储会话ID
      let resultConversationId = conversationId;
      // 用于标记是否已经发送了完成事件
      let finishedEventSent = false;

      // 启动数据读取
      (async () => {
        try {
          console.log('开始读取流数据');
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              console.log('流数据读取完成');
              
              // 如果流结束但没有发送过完成事件，手动触发一个完成事件
              if (!finishedEventSent && fullContent && onProgress) {
                console.log('流结束，手动触发完成事件');
                onProgress({
                  finished: true,
                  content: fullContent,
                  messages_history: updatedMessagesHistory
                });
                finishedEventSent = true;
              }
              
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            
            const lines = chunk.split('\n').filter(line => line.trim());
            console.log('解析数据行数:', lines.length);

            for (const line of lines) {
              try {
                if (line.startsWith('data: ')) {
                  const eventData = JSON.parse(line.slice(6));
                  
                  // 检查事件数据中是否包含会话ID
                  if (eventData.conversation_id) {
                    resultConversationId = eventData.conversation_id;
                  }
                  
                  // 累积内容
                  if (eventData.content_chunk) {
                    fullContent += eventData.content_chunk;
                  }
                  
                  // 如果有完整的content，使用它替换累积的内容
                  if (eventData.content) {
                    fullContent = eventData.content;
                  }
                  
                  // 检查是否是最终响应
                  if (eventData.finished) {
                    finishedEventSent = true;
                    
                    if (eventData.messages_history) {
                      updatedMessagesHistory = eventData.messages_history;
                    } else if (fullContent) {
                      // 如果没有提供消息历史但有累积内容，手动构建
                      updatedMessagesHistory = [...messagesHistory];
                      
                      // 检查最后一条消息是否是助手，如果是且内容相同则不添加
                      const lastMessage = updatedMessagesHistory[updatedMessagesHistory.length - 1];
                      if (!(lastMessage && lastMessage.role === 'assistant' && lastMessage.content === fullContent)) {
                        updatedMessagesHistory.push({
                          role: 'assistant',
                          content: fullContent
                        });
                      }
                    }
                  }
                  
                  if (onProgress) {
                    // 直接传递事件数据，不需要额外处理
                    onProgress(eventData);
                  }
                }
              } catch (error) {
                console.error('解析流数据出错:', error);
              }
            }
          }
        } catch (error) {
          console.error('读取流数据出错:', error);
          if (onProgress && !finishedEventSent) {
            onProgress({
              error: error.message,
              finished: true
            });
            finishedEventSent = true;
          }
        }
      })();

      console.log('返回会话ID、reader和更新后的消息历史');
      // 返回会话ID、reader和更新后的消息历史
      return { conversationId: resultConversationId, reader, messagesHistory: updatedMessagesHistory };
    } catch (error) {
      console.error('简历生成聊天助手对话服务错误:', error);
      throw error;
    }
  },

  /**
   * 根据聊天历史生成结构化简历
   * @param {Array} messagesHistory - 聊天历史记录
   * @returns {Promise<{resume_data: object}>} - 生成的简历数据
   */
  generateResume: async (messagesHistory) => {
    try {
      console.log('开始生成简历，消息历史长度:', messagesHistory.length);
      const result = await api.generateResume(messagesHistory);
      console.log('生成简历成功');
      return result;
    } catch (error) {
      console.error('生成简历失败:', error);
      throw error;
    }
  },
  
  /**
   * 流式生成结构化简历
   * @param {Array} messagesHistory - 聊天历史记录
   * @param {function} onProgress - 进度回调函数，用于处理流式返回的数据
   * @returns {Promise<object>} - 生成的简历数据
   */
  generateResumeStream: async (messagesHistory, onProgress) => {
    try {
      console.log('开始流式生成简历，消息历史长度:', messagesHistory.length);
      
      // 获取流式响应
      const response = await api.generateResumeStream(messagesHistory);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // 跟踪请求ID
      let requestId = null;
      let resumeData = null;
      
      // 启动数据流处理
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
                  // 提取JSON数据部分
                  const jsonStr = line.substring(6);
                  // 解析JSON数据
                  const eventData = JSON.parse(jsonStr);
                  
                  // 保存请求ID
                  if (eventData.request_id) {
                    requestId = eventData.request_id;
                  }
                  
                  // 如果有错误，通知调用者
                  if (eventData.error) {
                    console.error('简历生成出错:', eventData.error);
                    onProgress({
                      request_id: requestId,
                      error: eventData.error,
                      finished: true
                    });
                    continue;
                  }
                  
                  // 处理内容块
                  if (eventData.content_chunk) {
                    onProgress({
                      request_id: requestId,
                      content_chunk: eventData.content_chunk,
                      finished: false
                    });
                  }
                  
                  // 如果是最终的完整JSON
                  if (eventData.is_complete_json && eventData.resume_data) {
                    resumeData = eventData.resume_data;
                    onProgress({
                      request_id: requestId,
                      resume_data: resumeData,
                      finished: false
                    });
                  }
                  
                  // 检查是否是最终响应
                  if (eventData.finished) {
                    onProgress({
                      request_id: requestId,
                      resume_data: resumeData,
                      finished: true
                    });
                  }
                }
              } catch (error) {
                // 这里我们不输出任何日志，因为这是正常的流程
                // 当我们收到不完整的JSON时，我们只需要等待下一个片段
              }
            }
          }
          
          // 数据流处理完成，发送最终完成通知
          if (requestId) {
            onProgress({
              request_id: requestId,
              resume_data: resumeData,
              finished: true
            });
          }
          
        } catch (error) {
          console.error('读取流数据出错:', error);
          onProgress({
            request_id: requestId,
            error: error.message,
            finished: true
          });
        }
      })();
      
      // 返回请求ID和读取器，便于调用者控制流的读取
      return { requestId, reader };
    } catch (error) {
      console.error('流式生成简历失败:', error);
      onProgress({
        error: error.message,
        finished: true
      });
      throw error;
    }
  },
  
  /**
   * 格式化消息内容，处理JSON等特殊格式
   * @param {string} content - 消息内容
   * @returns {React.ReactNode} - 格式化后的React节点
   */
  formatMessageContent: (content) => {
    try {
      // 检测消息是否为JSON格式
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
      
      // 检查是否包含Markdown代码块
      if (content.includes('```')) {
        return (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        );
      }
      
      // 默认情况下，保留换行符并返回文本内容
      return <div className="whitespace-pre-wrap">{content}</div>;
    } catch (error) {
      console.error('格式化消息内容时出错:', error);
      return <div className="whitespace-pre-wrap">{content}</div>;
    }
  }
};

export default resumeChatService;
