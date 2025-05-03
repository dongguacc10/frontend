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
  FileText
} from "@phosphor-icons/react";
import jobCompetencyService from "../services/job_competency_service";

/**
 * 职位胜任力模型解析组件
 * 提供两种解析方式：
 * 1. 文件上传解析 - 支持PDF、Word、TXT、图片等格式
 * 2. 文本输入解析 - 直接粘贴职位描述文本
 * 
 * 所有解析方法均采用流式处理，提供实时反馈
 */
const JobCompetency = () => {
  // 状态管理
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jobText, setJobText] = useState("");
  const [parsedJob, setParsedJob] = useState(null);
  const [streamContent, setStreamContent] = useState("");
  const [fileContent, setFileContent] = useState(""); // 存储文件内容
  const [activeTab, setActiveTab] = useState(0); // 0: 文件上传, 1: 文本输入
  const [requestId, setRequestId] = useState("");
  const [reader, setReader] = useState(null);
  const [inputMethod, setInputMethod] = useState("file"); // "file" 或 "paste"
  const [isLoadingResult, setIsLoadingResult] = useState(false); // 是否正在加载结果
  
  // 引用
  const fileInputRef = useRef(null);
  const streamContentRef = useRef(null);
  const uploadAreaRef = useRef(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (streamContent && streamContentRef.current) {
      streamContentRef.current.scrollTop = streamContentRef.current.scrollHeight;
    }
  }, [streamContent]);
  
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
      // 清空之前的解析结果
      setParsedJob(null);
      setStreamContent("");
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
      setFile(droppedFile);
      setInputMethod("file");
      // 清空之前的解析结果
      setParsedJob(null);
      setStreamContent("");
      setFileContent("");
    }
  };
  
  // 处理文本输入
  const handleTextChange = (e) => {
    setJobText(e.target.value);
    setInputMethod("paste");
    // 清空之前的解析结果
    setParsedJob(null);
    setStreamContent("");
  };
  
  // 处理文件上传解析
  const handleFileUpload = async (selectedFile) => {
    const fileToUpload = selectedFile || file;
    
    if (!fileToUpload) {
      addToast({
        title: "请先选择文件",
        description: "请上传职位描述文件后再进行解析",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setStreamContent("");
      setParsedJob(null);
      
      // 定义进度回调函数，用于处理流式返回的数据
      const handleProgress = (data) => {
        // 添加调试信息，查看接收到的数据
       
        
        // 如果是文件内容，保存到fileContent状态
        if (data.is_file_content && data.file_content) {
          console.log('收到文件内容:', data.file_content.substring(0, 100) + '...');
          setFileContent(data.file_content);
          // 添加提示消息，确认文件内容已设置
          addToast({
            title: "已接收文件内容",
            description: "文件内容已接收并设置到状态",
            status: "info",
            shouldshowtimeoutprogess: "true"
          });
          return; // 文件内容单独处理，不需要处理其他字段
        }
        
        if (data.content_chunk) {
          setStreamContent(prev => prev + data.content_chunk);
        }
        
        if (data.job_competency_data) {
          setParsedJob(data.job_competency_data);
        }
        
        if (data.error) {
          addToast({
            title: "解析出错",
            description: data.error,
            status: "error",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
        }
        
        // 处理终止信号
        if (data.terminated) {
          addToast({
            title: "解析已终止",
            description: "解析过程已被终止",
            status: "info",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
        }
        
        if (data.finished) {
          setIsLoading(false);
          
          // 解析完成后，自动获取胜任力模型
          if (data.request_id) {
            // 延迟1秒后获取，确保数据已保存到数据库
            setTimeout(() => {
              fetchJobCompetencyModel(data.request_id);
            }, 1000);
          }
        }
      };
      
      // 调用服务进行文件解析
      const { requestId, reader: streamReader } = await jobCompetencyService.parseJobCompetencyFileStream(fileToUpload, handleProgress);
      setRequestId(requestId);
      setReader(streamReader);
      
    } catch (error) {
      console.error("文件解析出错:", error);
      setIsLoading(false);
      addToast({
        title: "解析出错",
        description: error.message || "文件解析过程中发生错误",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 添加粘贴事件监听器
  useEffect(() => {
    const handlePaste = async (e) => {
      // 只在文件上传模式处理粘贴事件
      if (inputMethod !== "file") return;
      
      e.preventDefault();
      
      if (isLoading) return;
      
      const items = e.clipboardData.items;
      let hasHandled = false;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // 处理文件粘贴（包括图片和其他类型的文件）
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob) {
            console.log("粘贴文件:", blob.type, blob.size);
            
            // 根据文件类型生成合适的文件名
            let fileName = `pasted-file-${Date.now()}`;
            
            // 根据MIME类型添加适当的扩展名
            if (blob.type) {
              const extension = blob.type.split('/')[1];
              if (extension) {
                fileName += `.${extension}`;
              }
            }
            
            const pastedFile = new File([blob], fileName, { type: blob.type });
            
            // 清除之前的文件和解析结果
            setStreamContent("");
            setParsedJob(null);
            setRequestId("");
            setFile(pastedFile);
            hasHandled = true;
            
            // 添加成功提示
            addToast({
              title: "成功",
              description: `已粘贴文件: ${fileName}`,
              status: "success",
              shouldshowtimeoutprogess: "true"
            });
            
            // 自动执行文件解析
            setTimeout(() => {
              handleFileUpload(pastedFile);
            }, 100);
            
            break;
          }
        }
      }
      
      if (!hasHandled) {
        addToast({
          title: "提示",
          description: "未检测到可解析的文件，请粘贴文件或截图",
          status: "warning",
          shouldshowtimeoutprogess: "true"
        });
      }
    };
    
    // 添加全局粘贴事件监听
    window.addEventListener('paste', handlePaste);
    
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isLoading, inputMethod]);
  
  // 处理文本解析
  const handleTextParse = async () => {
    if (!jobText.trim()) {
      addToast({
        title: "请先输入文本",
        description: "请输入职位描述文本后再进行解析",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setStreamContent("");
      setParsedJob(null);
      
      // 定义进度回调函数，用于处理流式返回的数据
      const handleProgress = (data) => {
        if (data.content_chunk) {
          setStreamContent(prev => prev + data.content_chunk);
        }
        
        if (data.job_competency_data) {
          setParsedJob(data.job_competency_data);
        }
        
        if (data.error) {
          addToast({
            title: "解析出错",
            description: data.error,
            status: "error",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
        }
        
        // 处理终止信号
        if (data.terminated) {
          addToast({
            title: "解析已终止",
            description: "解析过程已被终止",
            status: "info",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
        }
        
        if (data.finished) {
          setIsLoading(false);
          
          // 解析完成后，自动获取胜任力模型
          if (data.request_id) {
            // 延迟1秒后获取，确保数据已保存到数据库
            setTimeout(() => {
              fetchJobCompetencyModel(data.request_id);
            }, 1000);
          }
        }
      };
      
      // 调用服务进行文本解析
      const { requestId, reader: streamReader } = await jobCompetencyService.parseJobCompetencyTextStream(jobText, handleProgress);
      setRequestId(requestId);
      setReader(streamReader);
      
    } catch (error) {
      console.error("文本解析失败:", error);
      addToast({
        title: "文本解析失败",
        description: error.message || "解析文本时发生错误",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
      setIsLoading(false);
    }
  };
  
  // 获取职位胜任力模型
  const fetchJobCompetencyModel = async (reqId) => {
    const idToUse = reqId || requestId;
    
    if (!idToUse) {
      console.error('无法获取结果: 请求ID不存在');
      return;
    }
    
    try {
      setIsLoadingResult(true);
      
      // 调用服务获取胜任力模型
      const result = await jobCompetencyService.getJobCompetencyModel(idToUse);
      console.log('获取到的胜任力模型数据:', result);
      
      if (result.success) {
        // 从 result.result 中获取胜任力模型数据
        if (result.result && result.result.competency_model) {
          setParsedJob(result.result);
        } else {
          console.error('胜任力模型数据结构不正确:', result);
        }
        
        // 如果没有文件内容但有job_content，则设置文件内容
        if (!fileContent && result.params && result.params.job_content) {
          setFileContent(result.params.job_content);
        }
        
        console.log('成功获取职位胜任力模型:', result);
      } else {
        console.error('获取职位胜任力模型失败:', result.message);
      }
    } catch (error) {
      console.error('获取职位胜任力模型时出错:', error);
    } finally {
      setIsLoadingResult(false);
    }
  };
  
  // 复制解析结果
  const copyResult = () => {
    if (parsedJob) {
      const resultText = JSON.stringify(parsedJob, null, 2);
      navigator.clipboard.writeText(resultText)
        .then(() => {
          addToast({
            title: "复制成功",
            description: "解析结果已复制到剪贴板",
            status: "success",
            shouldshowtimeoutprogess: "true"
          });
        })
        .catch(err => {
          console.error("复制失败:", err);
          addToast({
            title: "复制失败",
            description: "无法复制到剪贴板",
            status: "error",
            shouldshowtimeoutprogess: "true"
          });
        });
    }
  };
  
  // 重置所有状态
  const resetAll = () => {
    setFile(null);
    setJobText("");
    setParsedJob(null);
    setStreamContent("");
    setFileContent("");
    setIsLoading(false);
    
    if (reader) {
      reader.cancel("用户手动重置");
      setReader(null);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  // 直接展示大模型返回的内容
  const renderJobCompetencyData = () => {
    if (!parsedJob) {
      return <div className="text-center text-gray-500 py-4">暂无胜任力模型数据</div>;
    }
    
    // 检查是否有胜任力模型数据
    const competencyModel = parsedJob.competency_model;
    if (!competencyModel || !Array.isArray(competencyModel)) {
      return (
        <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
          {JSON.stringify(parsedJob, null, 2)}
        </pre>
      );
    }
    
    return (
      <div className="space-y-6">
        {/* 总览部分 */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <ChartPie size={20} className="text-primary-500 mr-2" />
            胜任力模型总览
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {competencyModel.map((layer, index) => (
              <div 
                key={index} 
                className="flex items-center bg-white px-3 py-1.5 rounded-full border shadow-sm"
              >
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  index === 0 ? "bg-blue-500" : index === 1 ? "bg-green-500" : "bg-purple-500"
                }`}></span>
                <span className="font-medium mr-1">{layer.name}</span>
                <span className="text-gray-500 text-sm">{layer.score}分</span>
              </div>
            ))}
          </div>
          
          {/* 如果有行业特定信息 */}
          {parsedJob.industry_specific && (
            <div className="mt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                <Lightning size={16} className="text-primary-500 mr-1" />
                行业特定要求
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(parsedJob.industry_specific).map(([industry, requirements], idx) => (
                  <div key={idx} className="bg-white p-2 rounded border text-sm">
                    <div className="font-medium text-xs text-gray-600 mb-1">{industry}</div>
                    <ul className="list-disc list-inside text-xs text-gray-700">
                      {requirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 如果有评估提示 */}
          {parsedJob.assessment_tips && (
            <div className="mt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                <ListChecks size={16} className="text-primary-500 mr-1" />
                评估提示
              </h4>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {parsedJob.assessment_tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* 分层展示胜任力模型 */}
        {competencyModel.map((layer, layerIndex) => (
          <div 
            key={layerIndex} 
            className={`border rounded-lg overflow-hidden ${
              layerIndex === 0 ? "border-blue-200" : 
              layerIndex === 1 ? "border-green-200" : "border-purple-200"
            }`}
          >
            {/* 层次标题 */}
            <div 
              className={`px-4 py-3 flex justify-between items-center ${
                layerIndex === 0 ? "bg-blue-50" : 
                layerIndex === 1 ? "bg-green-50" : "bg-purple-50"
              }`}
            >
              <div>
                <h3 className="font-medium flex items-center">
                  {layerIndex === 0 ? (
                    <FileText size={18} className="text-blue-500 mr-2" />
                  ) : layerIndex === 1 ? (
                    <Brain size={18} className="text-green-500 mr-2" />
                  ) : (
                    <Lightning size={18} className="text-purple-500 mr-2" />
                  )}
                  {layer.name}
                  <span className="ml-2 text-sm text-gray-500">{layer.score}分</span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">{layer.description}</p>
              </div>
              
              {/* 层次分数进度条 */}
              <div className="w-24 h-6 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    layerIndex === 0 ? "bg-blue-500" : 
                    layerIndex === 1 ? "bg-green-500" : "bg-purple-500"
                  }`}
                  style={{ width: `${layer.score}%` }}
                ></div>
              </div>
            </div>
            
            {/* 维度列表 */}
            <div className="p-4 bg-white">
              <div className="space-y-4">
                {layer.dimensions.map((dimension, dimIndex) => (
                  <div key={dimIndex} className="border rounded-md p-3 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <h4 className="font-medium">{dimension.name}</h4>
                        <span className="text-xs text-gray-500 ml-2">({dimension.type})</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          dimension.importance === "核心" 
                            ? "bg-red-100 text-red-700" 
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {dimension.importance}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium mr-2">{dimension.score}分</span>
                        <div className="w-16 h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              dimension.importance === "核心" ? "bg-red-500" : "bg-gray-400"
                            }`}
                            style={{ width: `${(dimension.score / layer.score) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-3">{dimension.description}</p>
                    
                    {/* 评估方法 */}
                    {dimension.assessment_method && (
                      <div className="mt-2">
                        <h5 className="text-xs text-gray-500 mb-1">评估方法</h5>
                        <div className="flex flex-wrap gap-1">
                          {dimension.assessment_method.map((method, i) => (
                            <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 行业适配 */}
                    {dimension.industry_adaptation && (
                      <div className="mt-2">
                        <h5 className="text-xs text-gray-500 mb-1">行业适配</h5>
                        <p className="text-xs text-gray-600">{dimension.industry_adaptation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        {/* 模型拆分过程 */}
        {parsedJob.splitting_process && (
          <div className="border rounded-lg overflow-hidden border-amber-200 mt-6">
            <div className="px-4 py-3 flex justify-between items-center bg-amber-50">
              <div>
                <h3 className="font-medium flex items-center">
                  <Brain size={18} className="text-amber-500 mr-2" />
                  职位模型拆分过程
                </h3>
                <p className="text-sm text-gray-600 mt-1">大模型是如何分析职位描述并构建胜任力模型的</p>
              </div>
            </div>
            
            <div className="p-4 bg-white">
              <div className="space-y-4">
                {/* 分析过程 */}
                {parsedJob.splitting_process.analysis && (
                  <div className="border rounded-md p-3 hover:shadow-sm transition-shadow">
                    <h4 className="font-medium mb-2 flex items-center">
                      <ChartPie size={16} className="text-amber-500 mr-2" />
                      分析过程
                    </h4>
                    <p className="text-sm text-gray-700">{parsedJob.splitting_process.analysis}</p>
                  </div>
                )}
                
                {/* 关键因素 */}
                {parsedJob.splitting_process.key_factors && Array.isArray(parsedJob.splitting_process.key_factors) && (
                  <div className="border rounded-md p-3 hover:shadow-sm transition-shadow">
                    <h4 className="font-medium mb-2 flex items-center">
                      <ListChecks size={16} className="text-amber-500 mr-2" />
                      关键影响因素
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {parsedJob.splitting_process.key_factors.map((factor, idx) => (
                        <li key={idx}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 行业洞察 */}
                {parsedJob.splitting_process.industry_insights && (
                  <div className="border rounded-md p-3 hover:shadow-sm transition-shadow">
                    <h4 className="font-medium mb-2 flex items-center">
                      <Lightning size={16} className="text-amber-500 mr-2" />
                      行业特殊考量
                    </h4>
                    <p className="text-sm text-gray-700">{parsedJob.splitting_process.industry_insights}</p>
                  </div>
                )}
                
                {/* 权重分配理由 */}
                {parsedJob.splitting_process.weight_distribution_rationale && (
                  <div className="border rounded-md p-3 hover:shadow-sm transition-shadow">
                    <h4 className="font-medium mb-2 flex items-center">
                      <Scales size={16} className="text-amber-500 mr-2" />
                      权重分配理由
                    </h4>
                    <p className="text-sm text-gray-700">{parsedJob.splitting_process.weight_distribution_rationale}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 原始JSON数据（可折叠） */}
        <div className="mt-4">
          <details className="bg-gray-50 rounded-md">
            <summary className="cursor-pointer p-3 font-medium text-sm text-gray-600 flex items-center">
              <ClipboardText size={16} className="mr-2" />
              查看原始JSON数据
            </summary>
            <pre className="p-4 overflow-auto text-xs border-t">
              {JSON.stringify(parsedJob, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  };
  
  // 添加调试信息，查看文件内容状态
  useEffect(() => {
    console.log('文件内容状态更新:', fileContent ? fileContent.substring(0, 100) + '...' : '无文件内容');
  }, [fileContent]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-auto">
        <div className="space-y-4">
          <div className="flex space-x-4 mb-4">
            <Button
              color={inputMethod === "file" ? "primary" : "secondary"}
              variant={inputMethod === "file" ? "solid" : "outline"}
              className="flex items-center"
              onClick={() => setInputMethod("file")}
            >
              <FileArrowUp size={18} className="mr-2" />
              文件上传
            </Button>
            <Button
              color={inputMethod === "paste" ? "primary" : "secondary"}
              variant={inputMethod === "paste" ? "solid" : "outline"}
              className="flex items-center"
              onClick={() => setInputMethod("paste")}
            >
              <TextT size={18} className="mr-2" />
              文本输入
            </Button>
          </div>
          
          {/* 文件上传面板 */}
          {inputMethod === "file" && (
            <div className="space-y-4">
              <div
                ref={uploadAreaRef}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors duration-200 hover:border-primary-500"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.json,.jpg,.jpeg,.png"
                />
                
                <div className="mb-3">
                  <UploadSimple size={40} className="mx-auto text-gray-400" />
                </div>
                
                <p className="mb-2 text-gray-700">
                  将文件拖放到此处，或
                  <Button
                    variant="link"
                    color="primary"
                    className="mx-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    点击上传
                  </Button>
                </p>
                
                <p className="text-xs text-gray-500">
                  支持的格式: PDF, Word, TXT, JSON, JPG, PNG (可直接Ctrl+V粘贴文件或截图)
                </p>
                
                {file && (
                  <div className="mt-4 p-2 bg-gray-50 rounded flex items-center justify-between">
                    <div className="flex items-center">
                      <ClipboardText size={20} className="text-primary-500 mr-2" />
                      <span className="text-sm font-medium truncate max-w-xs">
                        {file.name}
                      </span>
                    </div>
                    <Badge color="success" variant="subtle" className="mx-2">
                      已选择
                    </Badge>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  color="secondary"
                  variant="outline"
                  onClick={resetAll}
                  disabled={isLoading}
                >
                  <ArrowClockwise size={18} className="mr-1" />
                  重置
                </Button>
                
                <Button
                  color="primary"
                  onClick={handleFileUpload}
                  disabled={!file || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <Scales size={18} className="mr-1" />
                      解析职位胜任力模型
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* 文本输入面板 */}
          {inputMethod === "paste" && (
            <div className="space-y-4">
              <Textarea
                placeholder="请输入或粘贴职位描述文本..."
                value={jobText}
                onChange={handleTextChange}
                rows={10}
                disabled={isLoading}
                className="w-full"
              />
              
              <div className="flex justify-end space-x-2">
                <Button
                  color="secondary"
                  variant="outline"
                  onClick={resetAll}
                  disabled={isLoading}
                >
                  <ArrowClockwise size={18} className="mr-1" />
                  重置
                </Button>
                
                <Button
                  color="primary"
                  onClick={handleTextParse}
                  disabled={!jobText.trim() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <Scales size={18} className="mr-1" />
                      解析职位胜任力模型
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        
          {/* 解析过程和结果展示 */}
          {(isLoading || streamContent || parsedJob) && (
            <div className="mt-6 space-y-4">
              {/* 文件内容展示 */}
              {fileContent && (
                <Card className="border border-gray-200 mb-4">
                  <CardHeader className="bg-gray-50 py-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText size={18} className="text-primary-500 mr-2" />
                        <h3 className="text-sm font-medium">文件内容</h3>
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
              
              <div className="flex items-center justify-center my-4">
                <div className="flex-grow h-px bg-gray-200"></div>
                <Badge color="primary" variant="subtle" className="mx-2">
                  <Brain size={16} className="mr-1" />
                  解析结果
                </Badge>
                <div className="flex-grow h-px bg-gray-200"></div>
              </div>
              
              {(isLoading || streamContent) && (
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 py-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <ListChecks size={18} className="text-primary-500 mr-2" />
                        <h3 className="text-sm font-medium">解析过程</h3>
                      </div>
                      {isLoading && <Spinner size="sm" />}
                    </div>
                  </CardHeader>
                  <CardBody className="p-4">
                    <div
                      ref={streamContentRef}
                      className="bg-gray-50 rounded p-3 max-h-60 overflow-auto font-mono text-xs whitespace-pre-wrap"
                    >
                      {streamContent || "正在解析中..."}
                    </div>
                  </CardBody>
                </Card>
              )}
              
              {/* 胜任力模型数据 */}
              {parsedJob && (
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <ChartPie size={18} className="text-primary-500 mr-2" />
                        <h3 className="font-medium">职位胜任力模型</h3>
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
                    {renderJobCompetencyData()}
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

export default JobCompetency;
