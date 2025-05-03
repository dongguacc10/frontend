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
  ClipboardText
} from "@phosphor-icons/react";
import { fileService } from "../services";

const FileParser = () => {
  // 状态管理
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileContent, setFileContent] = useState("");
  const [fileId, setFileId] = useState("");
  const [inputMethod, setInputMethod] = useState("file"); // "file" 或 "paste"
  
  // 文件输入引用
  const fileInputRef = useRef(null);
  const uploadAreaRef = useRef(null);
  
  // 当文件变化时自动解析
  useEffect(() => {
    if (file) {
      handleFileUpload();
    }
  }, [file]);

  // 添加粘贴事件监听器
  useEffect(() => {
    const handlePaste = async (e) => {
      e.preventDefault();
      
      if (isLoading) return;
      
      const items = e.clipboardData.items;
      let hasHandled = false;
      
      for (let i = 0; i <items.length; i++) {
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
            setFileContent("");
            setFileId("");
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
            
            // 手动触发文件解析 - 确保粘贴后自动执行解析
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
  }, [isLoading]);
  
  // 处理文件选择
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // 清除之前的解析结果
      setFileContent("");
      setFileId("");
      setFile(selectedFile);
      setInputMethod("file");
    }
  };
  
  // 处理文件上传和解析
  const handleFileUpload = async (selectedFile) => {
    const fileToProcess = selectedFile || file;
    
    if (!fileToProcess) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 调用文件解析服务
      const result = await fileService.parseFile(fileToProcess);
      
      // 更新状态
      setFileContent(result.content);
      setFileId(result.file_id);
      
      addToast({
        title: "成功",
        description: "文件解析成功",
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "success"
      });
    } catch (error) {
      console.error("文件解析失败:", error);
      addToast({
        title: "错误",
        description: `文件解析失败: ${error.message}`,
        timeout: 3000,
        shouldshowtimeoutprogess: "true",
        color: "danger"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // 处理清除文件
  const handleClearFile = () => {
    setFile(null);
    setFileContent("");
    setFileId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardBody className="p-4">
        <div className="mb-6">
          <div className="text-xs text-gray-500">
            <p>注意：单个文件大小不超过100MB，支持格式：.pdf .txt .csv .doc .docx .xls .xlsx .ppt .pptx .md .jpeg .png .bmp .gif .svg .svgz .webp .ico .xbm .dib .pjp .tif .pjpeg .avif .dot .apng .epub .tiff .jfif .html .json .mobi .log .go .h .c .cpp .cxx .cc .cs .java .js .css .jsp .php .py .py3 .asp .yaml .yml .ini .conf .ts .tsx</p>
          </div>
        </div>
        
        <div className="flex flex-col space-y-4">
          {/* 文件上传/粘贴区域 */}
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
                    if (e && typeof e.stopPropagation === 'function') {
                      e.stopPropagation();
                    }
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
                </div>
                <p className="text-gray-500">点击选择文件或直接 Ctrl+V 粘贴文件或者截图</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.jpg,.jpeg,.png,.bmp,.gif"
            />
          </div>
          
          {/* 加载指示器 */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Spinner size="md" className="mr-2" />
              <span className="text-gray-600">
                {inputMethod === "file" ? "文件解析中..." : "文件解析中..."}
              </span>
            </div>
          )}
          
          {/* 文件内容展示区域 */}
          {fileContent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-700">解析结果</h3>
              </div>
              <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto">
                <pre className="text-sm whitespace-pre-wrap">{fileContent}</pre>
              </div>
              {fileId && (
                <div className="mt-2 text-xs text-gray-500 flex items-center">
                  <CheckCircle size={14} className="text-green-500 mr-1" />
                  文件ID: {fileId}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default FileParser;
