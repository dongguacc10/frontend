import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Textarea,
  Spinner,
  Divider,
  Badge,
  addToast
} from "@heroui/react";
import {
  UploadSimple,
  FileArrowUp,
  Copy,
  CheckCircle,
  TextT,
  ArrowClockwise,
  ClipboardText,
  Scales,
  ChartPie,
  ListChecks,
  Brain,
  Lightning,
  FileText,
  Sparkle
} from "@phosphor-icons/react";
import resumeOptimizerService from "../services/resume_optimizer_service";

/**
 * AI简历优化（校园版）组件
 * 提供两种优化方式：
 * 1. 文件上传优化 - 支持PDF、Word、TXT、图片等格式
 * 2. 文本输入优化 - 直接粘贴简历文本
 * 
 * 所有优化方法均采用流式处理，提供实时反馈
 */
const ResumeOptimizer = () => {
  // 状态管理
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [optimizedResume, setOptimizedResume] = useState(null);
  const [parsedResume, setParsedResume] = useState(null); // 添加解析结果状态
  const [streamContent, setStreamContent] = useState("");
  const [parsingContent, setParsingContent] = useState(""); // 添加解析过程内容状态
  const [fileContent, setFileContent] = useState(""); // 存储文件内容
  const [activeTab, setActiveTab] = useState(0); // 0: 文件上传, 1: 文本输入
  const [requestId, setRequestId] = useState("");
  const [reader, setReader] = useState(null);
  const [inputMethod, setInputMethod] = useState("file"); // "file" 或 "paste"
  const [isParsing, setIsParsing] = useState(false); // 添加是否正在解析状态
  
  // 引用
  const fileInputRef = useRef(null);
  const streamContentRef = useRef(null);
  const parsingContentRef = useRef(null); // 添加解析内容引用
  const uploadAreaRef = useRef(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (streamContent && streamContentRef.current) {
      streamContentRef.current.scrollTop = streamContentRef.current.scrollHeight;
    }
  }, [streamContent]);
  
  // 解析内容自动滚动到底部
  useEffect(() => {
    if (parsingContent && parsingContentRef.current) {
      parsingContentRef.current.scrollTop = parsingContentRef.current.scrollHeight;
    }
  }, [parsingContent]);
  
  // 清理函数 - 组件卸载时取消流式读取
  useEffect(() => {
    return () => {
      if (reader) {
        reader.cancel("组件卸载，取消流式读取");
      }
    };
  }, [reader]);
  
  // 处理文件选择
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setInputMethod("file");
      // 清空之前的优化结果
      setOptimizedResume(null);
      setStreamContent("");
      setParsingContent("");
      setFileContent("");
    }
  };
  
  // 处理文件拖放
  const handleDragOver = (e) => {
    e.preventDefault();
    if (uploadAreaRef.current) {
      uploadAreaRef.current.classList.add("border-primary-500");
    }
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    if (uploadAreaRef.current) {
      uploadAreaRef.current.classList.remove("border-primary-500");
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    if (uploadAreaRef.current) {
      uploadAreaRef.current.classList.remove("border-primary-500");
    }
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      e.preventDefault();
      setFile(droppedFile);
      setInputMethod("file");
      // 清空之前的优化结果
      setOptimizedResume(null);
      setStreamContent("");
      setParsingContent("");
      setFileContent("");
    }
  };
  
  // 处理简历文本输入
  const handleResumeTextChange = (e) => {
    setResumeText(e.target.value);
    setInputMethod("paste");
    // 清空之前的优化结果
    setOptimizedResume(null);
    setStreamContent("");
    setParsingContent("");
  };
  
  // 处理职位描述文本输入
  const handleJobDescriptionChange = (e) => {
    setJobDescription(e.target.value);
  };
  
  // 处理文件上传优化
  const handleFileUpload = async (selectedFile) => {
    const fileToUpload = selectedFile || file;
    
    if (!fileToUpload) {
      addToast({
        title: "请先选择文件",
        description: "请上传简历文件后再进行优化",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setStreamContent("");
      setParsingContent("");
      setOptimizedResume(null);
      
      // 定义进度回调函数，用于处理流式返回的数据
      const handleProgress = (data) => {
        // 添加调试信息，查看接收到的数据
    
        
        // 如果是文件内容，保存到fileContent状态
        if (data.file_content) {
          setFileContent(data.file_content);
        }
        
        // 如果是解析过程，添加到解析内容中
        if (data.is_parsing_process) {
          setIsParsing(true);
          if (data.content_chunk) {
            setParsingContent(prev => prev + data.content_chunk);
          }
        }
        // 如果是解析通知，更新状态
        else if (data.is_parsing_notification) {
          setIsParsing(false);
          // 解析完成后，如果没有进一步的优化内容，也应该停止加载状态
          if (!data.content_chunk && data.finished) {
            setIsLoading(false);
          }
          if (data.content_chunk) {
            setStreamContent(prev => prev + data.content_chunk + "\n");
          }
        }
        // 如果是内容块，添加到流内容中
        else if (data.content_chunk) {
          setStreamContent(prev => prev + data.content_chunk);
        }
        
        // 如果包含优化结果，设置优化结果
        if (data.optimization_data) {
          setOptimizedResume(data.optimization_data);
          setIsLoading(false); // 收到优化结果时停止加载状态
          setIsParsing(false); // 确保解析状态也被重置
        }
        
        // 如果有错误，显示错误信息
        if (data.error) {
          addToast({
            title: "优化过程中出错",
            description: data.error,
            status: "error",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
          setIsParsing(false); // 确保解析状态也被重置
        }
        
        // 如果完成，更新加载状态
        if (data.finished) {
          setIsLoading(false);
          setIsParsing(false); // 确保解析状态也被重置
          
          // 如果有请求ID，从数据库获取完整的优化结果
          if (data.request_id && !optimizedResume) {
            console.log('优化完成，从数据库获取完整结果，请求ID:', data.request_id);
            
            // 使用异步函数获取优化结果
            (async () => {
              try {
                const optimizationResult = await resumeOptimizerService.getResumeOptimizationResult(data.request_id);
                console.log('从数据库获取的优化结果:', optimizationResult);
                
                // 如果结果中包含result字段，说明是完整的优化结果
                if (optimizationResult && optimizationResult.result) {
                  setOptimizedResume(optimizationResult.result);
                  
                  // 如果包含解析请求ID，获取解析结果
                  if (optimizationResult.parse_resume_request_id) {
                    try {
                      console.log('获取简历解析结果，请求ID:', optimizationResult.parse_resume_request_id);
                      const parseResult = await resumeOptimizerService.getResumeParseResult(optimizationResult.parse_resume_request_id);
                      console.log('获取到的简历解析结果:', parseResult);
                      
                      // 如果解析结果中包含result字段，设置解析结果
                      if (parseResult && parseResult.result) {
                        setParsedResume(parseResult.result);
                      }
                    } catch (parseError) {
                      console.error('获取简历解析结果时出错:', parseError);
                    }
                  }
                  
                  addToast({
                    title: "优化完成",
                    description: "已从数据库获取完整的优化结果",
                    status: "success",
                    shouldshowtimeoutprogess: "true"
                  });
                }
              } catch (error) {
                console.error('获取优化结果时出错:', error);
              }
            })();
          }
        }
      };
      
      // 调用服务，上传文件并获取流式响应
      const { requestId, reader: streamReader } = await resumeOptimizerService.optimizeResumeFileStream(
        fileToUpload,
        jobDescription,
        handleProgress
      );
      
      // 保存请求ID和读取器，以便后续可能的操作（如终止请求）
      setRequestId(requestId);
      setReader(streamReader);
      
    } catch (error) {
      console.error('文件上传优化错误:', error);
      setIsLoading(false);
      setIsParsing(false); // 确保解析状态也被重置
      addToast({
        title: "优化失败",
        description: error.message || "上传文件进行优化时出错",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 处理粘贴操作
  const handlePaste = (e) => {
    // 如果有剪贴板数据
    if (e.clipboardData) {
      // 检查是否有文件
      const items = e.clipboardData.items;
      let hasFile = false;
      
      if (items) {
        // 遍历剪贴板项
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
            const pastedFile = items[i].getAsFile();
            if (pastedFile) {
              e.preventDefault();
              setFile(pastedFile);
              setInputMethod("file");
              // 清空之前的优化结果
              setOptimizedResume(null);
              setStreamContent("");
              setParsingContent("");
              setFileContent("");
              hasFile = true;
              break;
            }
          }
        }
      }
      
      // 如果没有文件，检查文本
      if (!hasFile && activeTab === 1) {
        const text = e.clipboardData.getData('text');
        if (text) {
          setResumeText(text);
          setInputMethod("paste");
          // 清空之前的优化结果
          setOptimizedResume(null);
          setStreamContent("");
          setParsingContent("");
        }
      }
    }
  };
  
  // 处理文本优化
  const handleTextOptimize = async () => {
    if (!resumeText.trim()) {
      addToast({
        title: "请先输入简历内容",
        description: "请在文本框中输入或粘贴简历内容后再进行优化",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setStreamContent("");
      setParsingContent("");
      setOptimizedResume(null);
      
      // 定义进度回调函数，用于处理流式返回的数据
      const handleProgress = (data) => {
        // 添加调试信息，查看接收到的数据
       
        
        // 如果是解析过程，添加到解析内容中
        if (data.is_parsing_process) {
          setIsParsing(true);
          if (data.content_chunk) {
            setParsingContent(prev => prev + data.content_chunk);
          }
        }
        // 如果是解析通知，更新状态
        else if (data.is_parsing_notification) {
          setIsParsing(false);
          // 解析完成后，如果没有进一步的优化内容，也应该停止加载状态
          if (!data.content_chunk && data.finished) {
            setIsLoading(false);
          }
          if (data.content_chunk) {
            setStreamContent(prev => prev + data.content_chunk + "\n");
          }
        }
        // 如果是内容块，添加到流内容中
        else if (data.content_chunk) {
          setStreamContent(prev => prev + data.content_chunk);
        }
        
        // 如果包含优化结果，设置优化结果
        if (data.optimization_data) {
          setOptimizedResume(data.optimization_data);
          setIsLoading(false); // 收到优化结果时停止加载状态
          setIsParsing(false); // 确保解析状态也被重置
        }
        
        // 如果有错误，显示错误信息
        if (data.error) {
          addToast({
            title: "优化过程中出错",
            description: data.error,
            status: "error",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
          setIsParsing(false); // 确保解析状态也被重置
        }
        
        // 如果完成，更新加载状态
        if (data.finished) {
          setIsLoading(false);
          setIsParsing(false); // 确保解析状态也被重置
          
          // 如果有请求ID，从数据库获取完整的优化结果
          if (data.request_id && !optimizedResume) {
            console.log('优化完成，从数据库获取完整结果，请求ID:', data.request_id);
            
            // 使用异步函数获取优化结果
            (async () => {
              try {
                const optimizationResult = await resumeOptimizerService.getResumeOptimizationResult(data.request_id);
                console.log('从数据库获取的优化结果:', optimizationResult);
                
                // 如果结果中包含result字段，说明是完整的优化结果
                if (optimizationResult && optimizationResult.result) {
                  setOptimizedResume(optimizationResult.result);
                  
                  // 如果包含解析请求ID，获取解析结果
                  if (optimizationResult.parse_resume_request_id) {
                    try {
                      console.log('获取简历解析结果，请求ID:', optimizationResult.parse_resume_request_id);
                      const parseResult = await resumeOptimizerService.getResumeParseResult(optimizationResult.parse_resume_request_id);
                      console.log('获取到的简历解析结果:', parseResult);
                      
                      // 如果解析结果中包含result字段，设置解析结果
                      if (parseResult && parseResult.result) {
                        setParsedResume(parseResult.result);
                      }
                    } catch (parseError) {
                      console.error('获取简历解析结果时出错:', parseError);
                    }
                  }
                  
                  addToast({
                    title: "优化完成",
                    description: "已从数据库获取完整的优化结果",
                    status: "success",
                    shouldshowtimeoutprogess: "true"
                  });
                }
              } catch (error) {
                console.error('获取优化结果时出错:', error);
              }
            })();
          }
        }
      };
      
      // 调用服务，发送文本并获取流式响应
      const { requestId, reader: streamReader } = await resumeOptimizerService.optimizeResumeTextStream(
        resumeText,
        jobDescription,
        handleProgress
      );
      
      // 保存请求ID和读取器，以便后续可能的操作（如终止请求）
      setRequestId(requestId);
      setReader(streamReader);
      
    } catch (error) {
      console.error('文本优化错误:', error);
      setIsLoading(false);
      setIsParsing(false); // 确保解析状态也被重置
      addToast({
        title: "优化失败",
        description: error.message || "优化简历文本时出错",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 复制优化结果
  const copyResult = () => {
    if (!optimizedResume) return;
    
    try {
      // 将优化结果转换为格式化的文本
      const resultText = JSON.stringify(optimizedResume, null, 2);
      navigator.clipboard.writeText(resultText);
      
      addToast({
        title: "复制成功",
        description: "优化结果已复制到剪贴板",
        status: "success",
        shouldshowtimeoutprogess: "true"
      });
    } catch (error) {
      console.error('复制错误:', error);
      addToast({
        title: "复制失败",
        description: error.message || "复制优化结果时出错",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 重置所有状态
  const resetAll = () => {
    // 如果正在加载，先取消请求
    if (isLoading && reader) {
      reader.cancel("用户取消请求");
    }
    
    // 重置所有状态
    setFile(null);
    setIsLoading(false);
    setIsParsing(false); // 重置解析状态
    setResumeText("");
    setJobDescription("");
    setOptimizedResume(null);
    setStreamContent("");
    setParsingContent(""); // 重置解析内容
    setFileContent("");
    setRequestId("");
    setReader(null);
    
    // 如果有文件输入引用，重置它
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  // 渲染优化结果
  const renderOptimizationResult = () => {
    if (!optimizedResume) return null;
    
    return (
      <div className="space-y-4">
        {/* 优化过程摘要 */}
        {optimizedResume.optimization_process_summary && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center">
              <FileText size={20} className="text-primary-500 mr-2" />
              优化过程摘要
            </h3>
            <div className="bg-primary-50 border border-primary-200 rounded-md p-4">
              <div className="whitespace-pre-wrap text-gray-700">
                {optimizedResume.optimization_process_summary}
              </div>
            </div>
          </div>
        )}
        
        {/* 优化建议 */}
        {optimizedResume.optimization_suggestions && Array.isArray(optimizedResume.optimization_suggestions) && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center">
              <Sparkle size={20} className="text-warning-500 mr-2" />
              优化建议
            </h3>
            <div className="space-y-4">
              {optimizedResume.optimization_suggestions.map((suggestionGroup, groupIndex) => (
                <div key={groupIndex} className="bg-warning-50 border border-warning-200 rounded-md p-4">
                  <h4 className="font-medium text-warning-700 mb-2">{suggestionGroup.category}</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {Array.isArray(suggestionGroup.details) && suggestionGroup.details.map((suggestion, index) => (
                      <li key={index} className="text-gray-700">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 优化后的简历内容 */}
        {optimizedResume.optimized_resume_content && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center">
              <FileText size={20} className="text-success-500 mr-2" />
              优化后的简历内容
            </h3>
            <div className="bg-white border border-gray-200 rounded-md p-6 shadow-sm">
              {typeof optimizedResume.optimized_resume_content === 'string' 
                ? optimizedResume.optimized_resume_content
                : renderBeautifulResume(optimizedResume.optimized_resume_content)
              }
            </div>
          </div>
        )}
        
        {/* 原始简历解析结果 */}
        {parsedResume && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center">
              <Brain size={20} className="text-blue-500 mr-2" />
              原始简历解析结果
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              {renderBeautifulResume(parsedResume)}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染精美简历
  const renderBeautifulResume = (resumeData) => {
    if (!resumeData) return null;
    
    return (
      <div className="resume-container font-sans">
        {/* 基本信息 */}
        {resumeData.basic_info && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {resumeData.basic_info.name || ''}
            </h1>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-600">
              {resumeData.basic_info.gender && (
                <span className="flex items-center">
                  <span className="mr-1">•</span>
                  {resumeData.basic_info.gender}
                </span>
              )}
              {resumeData.basic_info.phone && (
                <span className="flex items-center">
                  <span className="mr-1">•</span>
                  {resumeData.basic_info.phone}
                </span>
              )}
              {resumeData.basic_info.email && (
                <span className="flex items-center">
                  <span className="mr-1">•</span>
                  {resumeData.basic_info.email}
                </span>
              )}
            </div>
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
            <p className="text-gray-700 leading-relaxed">
              {resumeData.self_evaluation}
            </p>
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
                      <h5 className="text-sm font-medium text-gray-700 mb-1">工作职责:</h5>
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
                    {edu.start_time} - {edu.end_time || '至今'}
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
            <div className="flex flex-wrap gap-2">
              {resumeData.skills.map((skill, index) => {
                // 处理不同的数据结构
                if (typeof skill === 'string') {
                  return (
                    <span key={index} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                      {skill}
                    </span>
                  );
                } else if (skill && typeof skill === 'object') {
                  // 处理对象形式的技能
                  if (skill.category && skill.items && Array.isArray(skill.items)) {
                    // 如果是带有类别和项目的对象
                    return (
                      <div key={index} className="w-full mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">{skill.category}</h3>
                        <div className="flex flex-wrap gap-2">
                          {skill.items.map((item, itemIndex) => (
                            <span key={itemIndex} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                              {typeof item === 'string' ? item : (item.name || JSON.stringify(item))}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    // 如果是简单对象
                    return (
                      <span key={index} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                        {skill.name || skill.skill || Object.values(skill).join(', ') || JSON.stringify(skill)}
                      </span>
                    );
                  }
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

  // 渲染简历解析结果
  const renderResumeParsingResult = () => {
    // 检查是否有解析内容
    if (!parsingContent) {
      return null;
    }
    
    // 尝试从解析内容中提取JSON数据
    let resumeData = null;
    try {
      // 查找最后一个包含resume_data的JSON对象
      const lines = parsingContent.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && line.includes('resume_data')) {
          const jsonMatch = line.match(/\{.*\}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            const data = JSON.parse(jsonStr);
            if (data.resume_data) {
              resumeData = data.resume_data;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('解析JSON数据时出错:', error);
    }
    
    // 如果没有提取到结构化数据，返回null
    if (!resumeData) {
      return null;
    }
    
    return (
      <Card className="border border-gray-200 mt-4">
        <CardHeader className="bg-gray-50 py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Brain size={18} className="text-blue-500 mr-2" />
              <h3 className="font-medium">简历解析结果</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              color="primary"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(resumeData, null, 2));
                addToast({
                  title: "复制成功",
                  description: "解析结果已复制到剪贴板",
                  status: "success",
                  shouldshowtimeoutprogess: "true"
                });
              }}
            >
              <Copy size={16} className="mr-1" />
              复制结果
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <div className="space-y-6">
            {/* 基本信息 */}
            {resumeData.basic_info && (
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <FileText size={20} className="text-blue-500 mr-2" />
                  基本信息
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(resumeData.basic_info).map(([key, value]) => (
                    value && (
                      <div key={key} className="flex">
                        <span className="text-gray-600 min-w-[100px]">{formatFieldName(key)}:</span>
                        <span className="text-gray-800 font-medium">{value}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
            
            {/* 求职意向 */}
            {resumeData.job_intention && (
              <div className="bg-purple-50 p-4 rounded-md border border-purple-200">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <Scales size={20} className="text-purple-500 mr-2" />
                  求职意向
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(resumeData.job_intention).map(([key, value]) => (
                    value && (
                      <div key={key} className="flex">
                        <span className="text-gray-600 min-w-[100px]">{formatFieldName(key)}:</span>
                        <span className="text-gray-800 font-medium">{value}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
            
            {/* 教育经历 */}
            {resumeData.education && resumeData.education.length > 0 && (
              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <Brain size={20} className="text-green-500 mr-2" />
                  教育经历
                </h3>
                <div className="space-y-4">
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className="border border-green-100 rounded-md p-3 bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{edu.school}</h4>
                          <p className="text-sm text-gray-600">{edu.major} | {edu.degree}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {edu.start_date} - {edu.end_date || '至今'}
                        </div>
                      </div>
                      {edu.gpa && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600">GPA:</span> <span className="font-medium">{edu.gpa}</span>
                        </div>
                      )}
                      {edu.ranking && (
                        <div className="mt-1 text-sm">
                          <span className="text-gray-600">排名:</span> <span className="font-medium">{edu.ranking}</span>
                        </div>
                      )}
                      {edu.courses && edu.courses.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm text-gray-600 mb-1">相关课程:</h5>
                          <div className="flex flex-wrap gap-1">
                            {edu.courses.map((course, i) => (
                              <span key={i} className="text-xs bg-green-100 px-2 py-0.5 rounded">
                                {course}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 工作/实习经历 */}
            {resumeData.experience && resumeData.experience.length > 0 && (
              <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <Lightning size={20} className="text-amber-500 mr-2" />
                  工作/实习经历
                </h3>
                <div className="space-y-4">
                  {resumeData.experience.map((exp, index) => (
                    <div key={index} className="border border-amber-100 rounded-md p-3 bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{exp.company}</h4>
                          <p className="text-sm text-gray-600">{exp.position}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {exp.start_date} - {exp.end_date || '至今'}
                        </div>
                      </div>
                      {exp.description && typeof exp.description === 'string' && (
                        <p className="text-gray-700 text-sm ml-2">{exp.description}</p>
                      )}
                      {exp.description && Array.isArray(exp.description) && (
                        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 ml-2">
                          {exp.description.map((desc, i) => (
                            <li key={i}>{desc}</li>
                          ))}
                        </ul>
                      )}
                      {exp.achievements && exp.achievements.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm text-gray-600 mb-1">成就:</h5>
                          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                            {exp.achievements.map((achievement, i) => (
                              <li key={i}>{achievement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {exp.skills && exp.skills.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm text-gray-600 mb-1">相关技能:</h5>
                          <div className="flex flex-wrap gap-1">
                            {exp.skills.map((skill, i) => (
                              <span key={i} className="text-xs bg-amber-100 px-2 py-0.5 rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {exp.responsibilities && exp.responsibilities.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm text-gray-600 mb-1">工作职责:</h5>
                          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
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
            
            {/* 项目经历 */}
            {resumeData.projects && resumeData.projects.length > 0 && (
              <div className="bg-indigo-50 p-4 rounded-md border border-indigo-200">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <ChartPie size={20} className="text-indigo-500 mr-2" />
                  项目经历
                </h3>
                <div className="space-y-4">
                  {resumeData.projects.map((project, index) => (
                    <div key={index} className="border border-indigo-100 rounded-md p-3 bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{project.name}</h4>
                          <p className="text-sm text-gray-600">{project.role}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {project.start_date} - {project.end_date || '至今'}
                        </div>
                      </div>
                      {project.description && typeof project.description === 'string' && (
                        <p className="text-gray-700 text-sm ml-2">{project.description}</p>
                      )}
                      {project.description && Array.isArray(project.description) && (
                        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 ml-2">
                          {project.description.map((desc, i) => (
                            <li key={i}>{desc}</li>
                          ))}
                        </ul>
                      )}
                      {project.technologies && project.technologies.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm text-gray-600 mb-1">技术栈:</h5>
                          <div className="flex flex-wrap gap-1">
                            {project.technologies.map((tech, i) => (
                              <span key={i} className="text-xs bg-indigo-100 px-2 py-0.5 rounded">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 技能 */}
            {resumeData.skills && resumeData.skills.length > 0 && (
              <div className="bg-red-50 p-4 rounded-md border border-red-200">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <ListChecks size={20} className="text-red-500 mr-2" />
                  技能
                </h3>
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills.map((skill, index) => {
                    // 处理不同的数据结构
                    if (typeof skill === 'string') {
                      return (
                        <span key={index} className="bg-white px-3 py-1.5 rounded-full border border-red-100 shadow-sm text-sm">
                          {skill}
                        </span>
                      );
                    } else if (skill && typeof skill === 'object') {
                      // 处理对象形式的技能
                      if (skill.category && skill.items && Array.isArray(skill.items)) {
                        // 如果是带有类别和项目的对象
                        return (
                          <div key={index} className="w-full mb-3">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">{skill.category}</h3>
                            <div className="flex flex-wrap gap-2">
                              {skill.items.map((item, itemIndex) => (
                                <span key={itemIndex} className="bg-white px-3 py-1.5 rounded-full border border-red-100 shadow-sm text-sm">
                                  {typeof item === 'string' ? item : (item.name || JSON.stringify(item))}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      } else {
                        // 如果是简单对象
                        return (
                          <span key={index} className="bg-white px-3 py-1.5 rounded-full border border-red-100 shadow-sm text-sm">
                            {skill.name || skill.skill || Object.values(skill).join(', ') || JSON.stringify(skill)}
                          </span>
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
              <div className="bg-teal-50 p-4 rounded-md border border-teal-200">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <CheckCircle size={20} className="text-teal-500 mr-2" />
                  证书
                </h3>
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
        </CardBody>
      </Card>
    );
  };
  
  // 格式化字段名称
  const formatFieldName = (key) => {
    const nameMap = {
      'name': '姓名',
      'gender': '性别',
      'age': '年龄',
      'phone': '电话',
      'email': '邮箱',
      'address': '地址',
      'expected_position': '期望职位',
      'expected_salary': '期望薪资',
      'expected_location': '期望地点',
      'expected_industry': '期望行业',
      'graduation_date': '毕业时间',
      'birth_date': '出生日期',
      'website': '个人网站',
      'linkedin': '领英',
      'github': 'GitHub',
      'summary': '个人总结'
    };
    
    return nameMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  return (
    <div className="container mx-auto py-4">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4">
          <div className="mb-4">
            <div className="flex space-x-2 mb-4">
              <Button
                variant={activeTab === 0 ? "solid" : "outline"}
                color="primary"
                onClick={() => setActiveTab(0)}
                className="flex-1"
              >
                <UploadSimple size={18} className="mr-1" />
                文件上传
              </Button>
              <Button
                variant={activeTab === 1 ? "solid" : "outline"}
                color="primary"
                onClick={() => setActiveTab(1)}
                className="flex-1"
              >
                <TextT size={18} className="mr-1" />
                文本输入
              </Button>
            </div>
            
            {/* 职位描述输入 - 两种方式都需要 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                职位描述（可选）
              </label>
              <Textarea
                placeholder="请输入职位描述，帮助AI更精准地优化简历..."
                rows={3}
                value={jobDescription}
                onChange={handleJobDescriptionChange}
                disabled={isLoading}
                className="w-full"
              />
            </div>
            
            {/* 文件上传区域 */}
            {activeTab === 0 && (
              <div
                ref={uploadAreaRef}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  file ? "border-primary-300 bg-primary-50" : "border-gray-300 hover:border-primary-300"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.json,.jpg,.jpeg,.png"
                />
                
                {file ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center">
                      <CheckCircle size={24} className="text-primary-500 mr-2" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <div className="flex justify-center space-x-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        color="primary"
                        onClick={() => fileInputRef.current.click()}
                      >
                        更换文件
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      <FileArrowUp size={36} className="text-gray-400" />
                    </div>
                    <p className="text-gray-600">
                      拖放文件到这里，或
                      <button
                        className="text-primary-500 hover:text-primary-600 font-medium mx-1"
                        onClick={() => fileInputRef.current.click()}
                      >
                        浏览文件
                      </button>
                      选择
                    </p>
                    <p className="text-xs text-gray-500">
                      支持格式: PDF, Word, TXT, 图片等
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* 文本输入区域 */}
            {activeTab === 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  简历内容
                </label>
                <Textarea
                  placeholder="请输入或粘贴简历内容..."
                  rows={10}
                  value={resumeText}
                  onChange={handleResumeTextChange}
                  onPaste={handlePaste}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            )}
            
            {/* 操作按钮 */}
            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                color="gray"
                onClick={resetAll}
                disabled={isLoading}
              >
                <ArrowClockwise size={18} className="mr-1" />
                重置
              </Button>
              
              <div className="flex space-x-2">
                {activeTab === 0 ? (
                  <Button
                    color="primary"
                    onClick={() => handleFileUpload(file)}
                    disabled={!file || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        优化中...
                      </>
                    ) : (
                      <>
                        <Sparkle size={18} className="mr-1" />
                        优化简历
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    onClick={handleTextOptimize}
                    disabled={!resumeText.trim() || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        优化中...
                      </>
                    ) : (
                      <>
                        <Sparkle size={18} className="mr-1" />
                        优化简历
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* 优化过程和结果展示 */}
          {(isLoading || isParsing || streamContent || parsingContent || optimizedResume) && (
            <div className="mt-6 space-y-4">
              {/* 文件内容展示 */}
              {fileContent && (
                <Card className="border border-gray-200 mb-4">
                  <CardHeader className="bg-gray-50 py-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText size={18} className="text-primary-500 mr-2" />
                        <h3 className="text-sm font-medium">简历内容</h3>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="p-4">
                    <div className="bg-gray-50 rounded p-3 max-h-60 overflow-auto font-mono text-xs whitespace-pre-wrap">
                      <pre>{fileContent}</pre>
                    </div>
                  </CardBody>
                </Card>
              )}
              
              {/* 解析过程展示 */}
              {(isParsing || parsingContent) && (
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 py-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Brain size={18} className="text-blue-500 mr-2" />
                        <h3 className="text-sm font-medium">简历解析过程</h3>
                      </div>
                      {isParsing && <Spinner size="sm" />}
                    </div>
                  </CardHeader>
                  <CardBody className="p-4">
                    <div
                      ref={parsingContentRef}
                      className="bg-gray-50 rounded p-3 max-h-60 overflow-auto font-mono text-xs whitespace-pre-wrap"
                    >
                      {parsingContent || "正在解析简历..."}
                    </div>
                  </CardBody>
                </Card>
              )}
              
              {/* 解析结果展示 */}
              {parsingContent && !isParsing && renderResumeParsingResult()}
              
              <div className="flex items-center justify-center my-4">
                <div className="flex-grow h-px bg-gray-200"></div>
                <Badge color="warning" variant="subtle" className="mx-2">
                  <Sparkle size={16} className="mr-1" />
                  优化结果
                </Badge>
                <div className="flex-grow h-px bg-gray-200"></div>
              </div>
              
              {/* 优化过程展示 */}
              {(isLoading || streamContent) && (
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 py-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <ListChecks size={18} className="text-primary-500 mr-2" />
                        <h3 className="text-sm font-medium">优化过程</h3>
                      </div>
                      {isLoading && <Spinner size="sm" />}
                    </div>
                  </CardHeader>
                  <CardBody className="p-4">
                    <div
                      ref={streamContentRef}
                      className="bg-gray-50 rounded p-3 max-h-60 overflow-auto font-mono text-xs whitespace-pre-wrap"
                    >
                      {streamContent || "正在优化中..."}
                    </div>
                  </CardBody>
                </Card>
              )}
              
              {/* 优化结果数据 */}
              {optimizedResume && (
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Sparkle size={18} className="text-warning-500 mr-2" />
                        <h3 className="font-medium">简历优化结果</h3>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        color="primary"
                        onClick={copyResult}
                      >
                        <Copy size={16} className="mr-1" />
                        复制结果
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody className="p-4">
                    {renderOptimizationResult()}
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeOptimizer;
