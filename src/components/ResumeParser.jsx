import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Spinner,
  addToast
} from "@heroui/react";
import { motion } from "framer-motion";
import { 
  FileArrowUp, 
  X, 
  FileText,
  Copy,
  CheckCircle,
  TextT,
  ArrowClockwise,
  ClipboardText,
  Database
} from "@phosphor-icons/react";
import resumeParseService from "../services/resume_Parise_Service";

/**
 * 简历解析组件
 * 提供两种解析方式：
 * 1. 文件上传解析 - 支持PDF、Word、TXT等格式
 * 2. 文本输入解析 - 直接粘贴简历文本
 * 
 * 所有解析方法均采用流式处理，提供实时反馈
 */
const ResumeParser = () => {
  // 状态管理
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [parsedResume, setParsedResume] = useState(null);
  const [streamContent, setStreamContent] = useState("");
  const [fileContent, setFileContent] = useState(""); // 新增：存储文件内容
  const [activeTab, setActiveTab] = useState(0); // 0: 文件上传, 1: 文本输入
  const [requestId, setRequestId] = useState("");
  const [reader, setReader] = useState(null);
  const [inputMethod, setInputMethod] = useState("file"); // "file" 或 "paste"
  const [customSchema, setCustomSchema] = useState(""); // 新增：自定义JSON结构模板
  const [showCustomSchema, setShowCustomSchema] = useState(false); // 新增：是否显示自定义模板输入框
  const [isLoadingResult, setIsLoadingResult] = useState(false); // 新增：是否正在加载解析结果
  
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
  
  // 监听requestId变化，自动获取解析结果
  useEffect(() => {
    if (requestId && !isLoading && !parsedResume && !isLoadingResult) {
      // 当获取到requestId且解析完成后，自动获取解析结果
      const timer = setTimeout(() => {
        fetchParseResult();
      }, 1500); // 延迟1.5秒，确保数据已经保存到数据库
      
      return () => clearTimeout(timer);
    }
  }, [requestId, isLoading, parsedResume, isLoadingResult]);
  
  // 清理函数 - 组件卸载时取消流式读取
  useEffect(() => {
    return () => {
      if (reader) {
        reader.cancel("组件卸载，取消流式读取");
      }
    };
  }, [reader]);
  
  // 添加粘贴事件监听器
  useEffect(() => {
    const handlePaste = async (e) => {
      // 只在文件上传标签页处理粘贴事件
      if (activeTab !== 0) return;
      
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
            setParsedResume(null);
            setRequestId("");
            setFile(pastedFile);
            setInputMethod("paste");
            hasHandled = true;
            
            // 添加成功提示
            addToast({
              title: "成功",
              description: `已粘贴文件: ${fileName}`,
              timeout: 3000,
              shouldshowtimeoutprogess: "true",
              color: "success"
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
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "warning"
        });
      }
    };
    
    // 添加全局粘贴事件监听
    window.addEventListener('paste', handlePaste);
    
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isLoading, activeTab]);
  
  // 处理自定义模板变化
  const handleCustomSchemaChange = (e) => {
    setCustomSchema(e.target.value);
  };
  
  // 处理自定义模板切换
  const toggleCustomSchema = () => {
    setShowCustomSchema(!showCustomSchema);
    if (!showCustomSchema && !customSchema) {
      // 提供默认模板示例
      setCustomSchema(`{
  "name": "姓名",
  "age": "年龄(数字)",
  "email": "电子邮箱",
  "education": [
    {
      "school": "学校名称",
      "major": "专业"
    }
  ],
  "work_experience": [
    {
      "company": "公司名称",
      "position": "职位"
    }
  ]
}`);
    }
  };
  
  /**
   * 处理文件选择
   */
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // 清除之前的解析结果
      setStreamContent("");
      setParsedResume(null);
      setRequestId("");
      setInputMethod("file");
      
      // 自动执行文件解析
      setTimeout(() => {
        handleFileUpload(selectedFile);
      }, 100);
    }
  };
  
  /**
   * 处理简历文本输入变化
   */
  const handleTextChange = (e) => {
    setResumeText(e.target.value);
    // 清除之前的解析结果
    if (parsedResume) {
      setStreamContent("");
      setParsedResume(null);
      setRequestId("");
    }
  };
  
  /**
   * 处理文件上传和解析
   */
  const handleFileUpload = async (selectedFile) => {
    try {
      if (!selectedFile) {
        addToast({
          title: "错误",
          description: "请先选择文件",
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "danger"
        });
        return;
      }
      
      setIsLoading(true);
      setStreamContent("");
      setParsedResume(null);
      
      // 调用简历解析服务
      const { requestId, reader: streamReader } = await resumeParseService.parseResumeFileStream(
        selectedFile, 
        handleParseProgress,
        showCustomSchema ? customSchema : null // 传递自定义模板（如果启用）
      );
      
      setRequestId(requestId);
      setReader(streamReader);
      
    } catch (error) {
      console.error("文件解析错误:", error);
      
      addToast({
        title: "解析失败",
        description: error.message || "文件解析失败，请重试",
        timeout: 5000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
      
      setIsLoading(false);
    }
  };
  
  /**
   * 处理文本解析
   */
  const handleTextParse = async () => {
    try {
      if (!resumeText.trim()) {
        addToast({
          title: "错误",
          description: "请先输入简历文本",
          timeout: 3000,
          shouldshowtimeoutprogess: "true",
          color: "danger"
        });
        return;
      }
      
      setIsLoading(true);
      setStreamContent("");
      setParsedResume(null);
      
      // 调用简历解析服务
      const { requestId, reader: streamReader } = await resumeParseService.parseResumeTextStream(
        resumeText, 
        handleParseProgress,
        showCustomSchema ? customSchema : null // 传递自定义模板（如果启用）
      );
      
      setRequestId(requestId);
      setReader(streamReader);
      
    } catch (error) {
      console.error("文本解析错误:", error);
      
      addToast({
        title: "解析失败",
        description: error.message || "文本解析失败，请重试",
        timeout: 5000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
      
      setIsLoading(false);
    }
  };
  
  /**
   * 处理解析进度回调
   */
  const handleParseProgress = (data) => {
    console.log('接收到解析进度数据:', data);
    
    // 如果是文件内容，保存到fileContent状态
    if (data.is_file_content && data.file_content) {
      setFileContent(data.file_content);
      return;
    }
    
    // 如果有内容块，添加到流式内容中
    if (data.content_chunk) {
      setStreamContent(prev => prev + data.content_chunk);
    }
    
    // 如果有解析结果数据
    if (data.resume_data) {
      // 不再设置解析结果，只展示解析过程
      // setParsedResume(resumeParseService.formatResumeData(data.resume_data));
    }
    
    // 处理错误情况
    if (data.error) {
      setIsLoading(false);
      addToast({
        title: "错误",
        description: data.error,
        timeout: 5000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
    }
    
    // 处理终止信号
    if (data.terminated) {
      setIsLoading(false);
      addToast({
        title: "已终止",
        description: "简历解析过程已被终止",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "warning"
      });
    }
    
    // 如果解析完成
    if (data.finished) {
      setIsLoading(false);
      
      addToast({
        title: "成功",
        description: "简历解析完成",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "success"
      });
      
      // 解析完成后自动获取解析结果
      if (requestId) {
        setTimeout(() => {
          fetchParseResult();
        }, 1000); // 延迟1秒，确保数据已经保存到数据库
      }
    } else if (!data.error && !data.terminated) {
      setIsLoading(true);
    }
  };
  
  /**
   * 复制解析结果
   */
  const handleCopyContent = () => {
    if (streamContent) {
      navigator.clipboard.writeText(streamContent)
        .then(() => {
          addToast({
            title: "复制成功",
            description: "解析内容已复制到剪贴板",
            timeout: 2000,
            shouldshowtimeoutprogess: "true",
            color: "success"
          });
        })
        .catch((error) => {
          console.error("复制失败:", error);
          addToast({
            title: "复制失败",
            description: "请手动选择并复制内容",
            timeout: 2000,
            shouldshowtimeoutprogess: "true",
            color: "danger"
          });
        });
    }
  };
  
  /**
   * 从数据库获取解析结果
   */
  const fetchParseResult = async () => {
    if (!requestId) {
      addToast({
        title: "错误",
        description: "没有可用的请求ID，无法获取解析结果",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "warning"
      });
      return;
    }
    
    try {
      setIsLoadingResult(true);
      
      // 调用API获取解析结果
      const result = await resumeParseService.getParseResult(requestId);
      
      if (result.success) {
        // 直接设置解析结果，不进行格式化
        setParsedResume(result.result);
        
        // 获取结果成功后，清空流式内容，隐藏解析过程区域
        setStreamContent("");
        
      }
    } catch (error) {
      console.error("获取解析结果时出错:", error);
      
      addToast({
        title: "错误",
        description: error.message || "获取解析结果失败，请重试",
        timeout: 5000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
    } finally {
      setIsLoadingResult(false);
    }
  };
  
  /**
   * 渲染操作按钮
   */
  const renderActionButtons = () => {
    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {/* 复制内容按钮 */}
        {streamContent && (
          <Button
            color="secondary"
            size="sm"
            onClick={handleCopyContent}
            className="flex items-center gap-1"
          >
            <Copy size={16} />
            <span>复制内容</span>
          </Button>
        )}
        
        {/* 重新解析按钮 - 只在有解析结果或流式内容时显示 */}
        {(parsedResume || streamContent) && (
          <Button
            color="primary"
            size="sm"
            onClick={handleReset}
            className="flex items-center gap-1"
          >
            <ArrowClockwise size={16} />
            <span>重新解析</span>
          </Button>
        )}
        
        {/* 获取解析结果按钮 - 只在自动获取失败且有requestId时显示 */}
        {requestId && !isLoadingResult && !parsedResume && !isLoading && (
          <Button
            color="info"
            size="sm"
            onClick={fetchParseResult}
            className="flex items-center gap-1"
          >
            <Database size={16} />
            <span>获取解析结果</span>
          </Button>
        )}
        
        {/* 加载中状态 */}
        {isLoadingResult && (
          <Button
            color="info"
            size="sm"
            disabled
            className="flex items-center gap-1"
          >
            <Spinner size="sm" />
            <span>加载解析结果...</span>
          </Button>
        )}
      </div>
    );
  };
  
  /**
   * 渲染流式内容
   */
  const renderStreamContent = () => {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mt-4"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-700">解析过程</h3>
          <Button
            variant="ghost"
            color="primary"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(streamContent);
              addToast({
                title: "复制成功",
                description: "解析内容已复制到剪贴板",
                timeout: 2000,
                shouldshowtimeoutprogess: "true",
                color: "success"
              });
            }}
            title="复制内容"
          >
            <Copy size={18} weight="bold" />
          </Button>
        </div>
        <div 
          ref={streamContentRef}
          className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto"
        >
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">{streamContent}</pre>
        </div>
      </motion.div>
    );
  };
  
  /**
   * 处理清除文件
   */
  const handleClearFile = () => {
    setFile(null);
    setStreamContent("");
    setFileContent(""); // 清除文件内容
    setParsedResume(null);
    setRequestId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    
    // 如果有正在进行的解析，取消它
    if (reader) {
      reader.cancel("用户取消");
      setReader(null);
      setIsLoading(false);
    }
  };
  
  /**
   * 处理清除文本
   */
  const handleClearText = () => {
    setResumeText("");
    setStreamContent("");
    setFileContent(""); // 清除文件内容
    setParsedResume(null);
    setRequestId("");
    
    // 如果有正在进行的解析，取消它
    if (reader) {
      reader.cancel("用户取消");
      setReader(null);
    }
    
    setIsLoading(false);
  };
  
  /**
   * 处理重置解析
   */
  const handleReset = () => {
    // 根据当前活动标签页决定调用哪个清除函数
    if (activeTab === 0) {
      handleClearFile();
    } else {
      handleClearText();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardBody className="p-4">
        <div className="mb-6">
          <div className="text-xs text-gray-500">
            <p>注意：文件大小不超过100MB，支持.pdf .txt .csv .doc .docx .xls .xlsx .ppt .pptx .md .jpeg .png .bmp .gif .svg .svgz .webp .ico .xbm .dib .pjp .tif .pjpeg .avif .dot .apng .epub .tiff .jfif .html .json .mobi .log .go .h .c .cpp .cxx .cc .cs .java .js .css .jsp .php .py .py3 .asp .yaml .yml .ini .conf .ts .tsx等格式。</p>
          </div>
        </div>
        
        {/* 自定义选项卡，不使用Tabs组件 */}
        <div className="mb-6">
          <div className="flex border-b">
            <button 
              onClick={() => setActiveTab(0)} 
              className={`px-4 py-2 focus:outline-none ${activeTab === 0 
                ? 'border-b-2 border-primary-500 text-primary-600 font-medium' 
                : 'text-gray-500 hover:text-gray-700'}`}
            >
              文件上传
            </button>
            <button 
              onClick={() => setActiveTab(1)} 
              className={`px-4 py-2 focus:outline-none ${activeTab === 1 
                ? 'border-b-2 border-primary-500 text-primary-600 font-medium' 
                : 'text-gray-500 hover:text-gray-700'}`}
            >
              文本输入
            </button>
          </div>
        </div>
        
        {/* 自定义JSON模板切换按钮 */}
        <div className="mt-4 mb-2">
          <Button
            variant={showCustomSchema ? "solid" : "outline"}
            color={showCustomSchema ? "primary" : "gray"}
            size="sm"
            onClick={toggleCustomSchema}
            className="flex items-center"
          >
            {showCustomSchema ? (
              <>
                <CheckCircle size={16} className="mr-1" />
                使用自定义JSON模板
              </>
            ) : (
              <>
                <TextT size={16} className="mr-1" />
                自定义JSON模板
              </>
            )}
          </Button>
        </div>
        
        {/* 自定义JSON模板输入区域 */}
        {showCustomSchema && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <div className="p-3 border border-blue-200 rounded-md bg-blue-50">
              <div className="mb-2 text-sm font-medium text-blue-700">
                自定义JSON结构模板（可选）
              </div>
              <textarea
                className="w-full h-40 p-2 text-sm font-mono border border-gray-300 rounded-md focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                value={customSchema}
                onChange={handleCustomSchemaChange}
                placeholder="输入自定义的JSON结构模板..."
                disabled={isLoading}
              />
              <div className="mt-2 text-xs text-blue-600">
                提示：自定义模板将覆盖默认模板，用于控制解析结果的结构和字段。留空则使用系统默认模板。
              </div>
            </div>
          </motion.div>
        )}
        
        {/* 文件上传面板 */}
        {activeTab === 0 && (
          <div className="flex flex-col space-y-4">
            {/* 文件上传区域 */}
            <div 
              ref={uploadAreaRef}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer"
              tabIndex={0}
              onClick={() => {
                if (!file) {
                  uploadAreaRef.current?.focus();
                  fileInputRef.current?.click();
                }
              }}
            >
              {file ? (
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <div className="flex items-center">
                    <FileText size={24} className="text-primary-500 mr-2" />
                    <div className="text-left">
                      <p className="font-medium truncate max-w-xs">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    color="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    disabled={isLoading}
                  >
                    <X size={18} weight="bold" />
                  </Button>
                </div>
              ) : (
                <div className="py-8">
                  <div className="flex justify-center items-center gap-4 mb-2">
                    <FileArrowUp size={48} weight="thin" className="text-gray-400" />
                    <ClipboardText size={48} weight="thin" className="text-gray-400" />
                  </div>
                  <p className="text-gray-500">点击选择文件或直接 Ctrl+V 粘贴文件或截图</p>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,.json"
              />
            </div>
            
            {/* 加载指示器 - 替代上传按钮 */}
            {isLoading && activeTab === 0 && (
              <div className="flex items-center justify-center py-4">
                <Spinner size="md" className="mr-2" />
                <span className="text-gray-600">
                  {inputMethod === "file" ? "文件解析中..." : "粘贴内容解析中..."}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* 文本输入面板 */}
        {activeTab === 1 && (
          <div className="flex flex-col space-y-4">
            <textarea
              placeholder="请粘贴简历文本内容..."
              rows={8}
              value={resumeText}
              onChange={handleTextChange}
              disabled={isLoading}
              className="w-full border border-gray-300 rounded-md p-2 focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
            />
            
            <div className="flex space-x-2">
              <Button
                color={resumeText.trim() ? "primary" : "gray"}
                onClick={handleTextParse}
                disabled={!resumeText.trim() || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <Spinner size="sm" className="mr-2" />
                    <span>解析中...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <TextT size={20} weight="bold" className="mr-2" />
                    <span>解析文本</span>
                  </div>
                )}
              </Button>
              
              <Button
                variant="outline"
                color="danger"
                onClick={handleClearText}
                disabled={!resumeText.trim() || isLoading}
              >
                <X size={18} weight="bold" className="mr-1" />
                清除
              </Button>
            </div>
          </div>
        )}
        
        {/* 解析结果展示区域 */}
        {(streamContent || fileContent) && !parsedResume && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            <Card className="w-full">
              <CardHeader className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">解析过程</h3>
                <div className="flex space-x-2">
                  <Button
                    color="primary"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyContent}
                    title="复制内容"
                  >
                    <Copy size={18} />
                    <span className="ml-1">复制</span>
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                {/* 文件内容展示 */}
                {fileContent && (
                  <div className="mb-4">
                    <h4 className="text-md font-semibold mb-2 flex items-center">
                      <FileText size={18} className="mr-1" />
                      文件内容
                    </h4>
                    <div className="bg-gray-50 p-3 rounded-md max-h-60 overflow-auto text-sm">
                      <pre className="whitespace-pre-wrap">{fileContent}</pre>
                    </div>
                  </div>
                )}
                
                {/* 解析过程展示 */}
                <div>
                  <h4 className="text-md font-semibold mb-2 flex items-center">
                    <ClipboardText size={18} className="mr-1" />
                    解析过程
                  </h4>
                  <div 
                    ref={streamContentRef}
                    className="bg-gray-50 p-3 rounded-md max-h-96 overflow-auto text-sm"
                  >
                    {isLoading && !streamContent ? (
                      <div className="flex justify-center items-center p-4">
                        <Spinner size="sm" className="mr-2" />
                        <span>正在解析中...</span>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap">{streamContent}</pre>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
        
        {/* 解析结果展示区域 */}
        {parsedResume && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            <Card className="w-full">
              <CardHeader className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">解析结果</h3>
              </CardHeader>
              <CardBody>
                <div className="bg-gray-50 p-3 rounded-md max-h-96 overflow-auto text-sm">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(parsedResume, null, 2)}</pre>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
        
        {/* 操作按钮 */}
        {renderActionButtons()}
      </CardBody>
    </Card>
  );
};

export default ResumeParser;
