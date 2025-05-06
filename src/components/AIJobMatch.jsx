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
  addToast,
  Tabs,
  Tab,
  Progress
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
  CheckSquare,
  WarningCircle,
  CircleWavyCheck,
  XCircle,
  X
} from "@phosphor-icons/react";
import resumeMatchService from "../services/resume_match_service";
import ReactECharts from 'echarts-for-react';

/**
 * AI人岗测评组件
 * 提供两种匹配方式：
 * 1. 文件上传匹配 - 支持上传简历和职位描述文件
 * 2. 文本输入匹配 - 直接粘贴简历和职位描述文本
 * 
 * 所有匹配方法均采用流式处理，提供实时反馈
 */
const AIJobMatch = () => {
  // 状态管理
  const [resumeFile, setResumeFile] = useState(null);
  const [positionFile, setPositionFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [competencyModelText, setCompetencyModelText] = useState(""); // 新增：用户输入的胜任力模型文本
  const [hardRequirements, setHardRequirements] = useState(""); // 新增：用户输入的硬性条件
  const [competencyModel, setCompetencyModel] = useState("");
  const [competencyModelStream, setCompetencyModelStream] = useState("");
  const [matchingScore, setMatchingScore] = useState(null);
  const [matchingScoreStream, setMatchingScoreStream] = useState("");
  const [requestId, setRequestId] = useState(null); // 添加requestId状态
  const [reader, setReader] = useState(null);
  const [matchingStep, setMatchingStep] = useState(0); // 0: 初始状态, 1: 生成胜任力模型, 2: 计算匹配分数
  const [resumeContent, setResumeContent] = useState(""); // 存储简历内容
  const [positionContent, setPositionContent] = useState(""); // 存储职位描述内容
  const [resumeInputType, setResumeInputType] = useState("file"); // "file" 或 "text"
  const [positionInputType, setPositionInputType] = useState("file"); // "file" 或 "text"
  
  // 引用
  const resumeFileInputRef = useRef(null);
  const positionFileInputRef = useRef(null);
  const competencyModelStreamRef = useRef(null);
  const matchingScoreStreamRef = useRef(null);
  const resumeUploadAreaRef = useRef(null);
  const positionUploadAreaRef = useRef(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (competencyModelStream && competencyModelStreamRef.current) {
      competencyModelStreamRef.current.scrollTop = competencyModelStreamRef.current.scrollHeight;
    }
  }, [competencyModelStream]);
  
  useEffect(() => {
    if (matchingScoreStream && matchingScoreStreamRef.current) {
      matchingScoreStreamRef.current.scrollTop = matchingScoreStreamRef.current.scrollHeight;
    }
  }, [matchingScoreStream]);
  
  // 清理函数 - 组件卸载时取消流式读取
  useEffect(() => {
    return () => {
      if (reader) {
        reader.cancel("组件卸载，取消流式读取");
      }
    };
  }, [reader]);
  
  // 处理简历文件选择
  const handleResumeFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setResumeFile(selectedFile);
      // 清空之前的解析结果
      setResumeContent("");
      setCompetencyModel("");
      setCompetencyModelStream("");
      setMatchingScore(null);
      setMatchingScoreStream("");
      setMatchingStep(0);
    }
  };
  
  // 处理职位描述文件选择
  const handlePositionFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setPositionFile(selectedFile);
      // 清空之前的解析结果
      setPositionContent("");
      setCompetencyModel("");
      setCompetencyModelStream("");
      setMatchingScore(null);
      setMatchingScoreStream("");
      setMatchingStep(0);
    }
  };
  
  // 处理简历文件拖放
  const handleResumeDragOver = (e) => {
    e.preventDefault();
    if (resumeUploadAreaRef.current) {
      resumeUploadAreaRef.current.classList.add("border-primary-500");
    }
  };
  
  const handleResumeDragLeave = (e) => {
    e.preventDefault();
    if (resumeUploadAreaRef.current) {
      resumeUploadAreaRef.current.classList.remove("border-primary-500");
    }
  };
  
  const handleResumeDrop = (e) => {
    e.preventDefault();
    if (resumeUploadAreaRef.current) {
      resumeUploadAreaRef.current.classList.remove("border-primary-500");
    }
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setResumeFile(droppedFile);
      // 清空之前的解析结果
      setResumeContent("");
      setCompetencyModel("");
      setCompetencyModelStream("");
      setMatchingScore(null);
      setMatchingScoreStream("");
      setMatchingStep(0);
    }
  };
  
  // 处理职位描述文件拖放
  const handlePositionDragOver = (e) => {
    e.preventDefault();
    if (positionUploadAreaRef.current) {
      positionUploadAreaRef.current.classList.add("border-primary-500");
    }
  };
  
  const handlePositionDragLeave = (e) => {
    e.preventDefault();
    if (positionUploadAreaRef.current) {
      positionUploadAreaRef.current.classList.remove("border-primary-500");
    }
  };
  
  const handlePositionDrop = (e) => {
    e.preventDefault();
    if (positionUploadAreaRef.current) {
      positionUploadAreaRef.current.classList.remove("border-primary-500");
    }
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setPositionFile(droppedFile);
      // 清空之前的解析结果
      setPositionContent("");
      setCompetencyModel("");
      setCompetencyModelStream("");
      setMatchingScore(null);
      setMatchingScoreStream("");
      setMatchingStep(0);
    }
  };
  
  // 处理简历文本输入
  const handleResumeTextChange = (e) => {
    setResumeText(e.target.value);
    // 清空之前的解析结果
    setCompetencyModel("");
    setCompetencyModelStream("");
    setMatchingScore(null);
    setMatchingScoreStream("");
    setMatchingStep(0);
  };
  
  // 处理职位描述文本输入
  const handleJobDescriptionTextChange = (e) => {
    setJobDescriptionText(e.target.value);
    // 清空之前的解析结果
    setCompetencyModel("");
    setCompetencyModelStream("");
    setMatchingScore(null);
    setMatchingScoreStream("");
    setMatchingStep(0);
  };
  
  // 处理硬性条件文本输入
  const handleHardRequirementsChange = (e) => {
    setHardRequirements(e.target.value);
  };
  
  // 混合模式匹配 - 支持文件和文本的任意组合
  const handleMatch = async () => {
    // 验证输入 - 至少需要一种简历输入和一种职位描述输入
    const hasResumeInput = resumeFile || resumeText.trim();
    const hasPositionInput = positionFile || jobDescriptionText.trim();
    const hasCompetencyModelInput = competencyModelText.trim();
    
    if (!hasResumeInput) {
      addToast({
        title: "请提供简历",
        description: "请上传简历文件或输入简历文本",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    if (!hasPositionInput && !hasCompetencyModelInput) {
      addToast({
        title: "请提供职位描述或胜任力模型",
        description: "请上传职位描述文件、输入职位描述文本或输入胜任力模型",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setCompetencyModelStream("");
      setMatchingScoreStream("");
      setCompetencyModel("");
      setMatchingScore(null);
      setMatchingStep(0);
      
      // 初始化一个错误标志变量，用于跟踪是否有错误发生
      let hasError = false;
      
      // 定义进度回调函数，用于处理流式返回的数据
      const handleProgress = (data) => {
        // 添加详细的调试信息，查看接收到的数据
        
        
        // 处理胜任力模型流式数据 - 支持两种字段名
        if (data.competency_model_stream || data.content_chunk) {
          const streamContent = data.competency_model_stream || data.content_chunk;
        
          setCompetencyModelStream(prev => prev + streamContent);
          setMatchingStep(1); // 正在生成胜任力模型
        }
        
        // 不再直接设置胜任力模型，将在获取匹配分数后从数据库中查询
        // 处理匹配分数流式数据
        if (data.matching_score_stream) {
          
          setMatchingScoreStream(prev => prev + data.matching_score_stream);
          setMatchingStep(2); // 正在计算匹配分数
          
          // 检查matching_score_stream中是否包含request_id
          if (data.matching_score_stream.includes('request_id')) {
            try {
              // 尝试从matching_score_stream中提取JSON对象
              const match = data.matching_score_stream.match(/data: ({.*})/);
              if (match && match[1]) {
                const innerData = JSON.parse(match[1]);
                if (innerData.request_id) {
                  // 将request_id保存到组件状态中
                  setRequestId(innerData.request_id);
                  console.log('从matching_score_stream中提取到request_id:', innerData.request_id);
                }
              }
            } catch (error) {
              console.error('从matching_score_stream中提取request_id时出错:', error);
            }
          }
        }
        
        // 处理完整的匹配分数
        if (data.matching_score) {
          console.log('收到完整的匹配分数:', data.matching_score);
          try {
            // 尝试解析JSON字符串
            const scoreData = typeof data.matching_score === 'string' 
              ? JSON.parse(data.matching_score) 
              : data.matching_score;
            
            console.log('解析后的匹配分数数据:', scoreData);
            setMatchingScore(scoreData);
            // 当收到完整的匹配分数时，认为匹配已完成，设置loading状态为false
            setIsLoading(false);
            setMatchingStep(3); // 设置匹配步骤为完成状态
            // 显示成功提示
            addToast({
              title: "匹配完成",
              description: "人岗匹配分析已完成",
              status: "success",
              shouldshowtimeoutprogess: "true"
            });
          } catch (error) {
            console.error('解析匹配分数JSON时出错:', error);
            console.error('出错的原始数据:', data.matching_score);
            setMatchingScore(data.matching_score);
            setIsLoading(false);
          }
        }
        
        // 处理错误情况
        if (data.error) {
          console.log('收到错误信息:', data.error);
          // 设置错误标志
          hasError = true;
          addToast({
            title: "匹配出错",
            description: data.error,
            status: "error",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
          return; // 收到错误后直接返回，不再处理其他消息
        }
        
        // 处理终止情况
        if (data.terminated) {
          console.log('收到终止信号');
          // 设置错误标志
          hasError = true;
          addToast({
            title: "匹配已终止",
            description: "匹配过程已被终止",
            status: "info",
            shouldshowtimeoutprogess: "true"
          });
          setIsLoading(false);
        }
        
        // 处理完成情况
        if (data.finished) {
          console.log('收到完成信号');
          setIsLoading(false);
          
          // 只有在没有错误的情况下才获取匹配结果
          if (!hasError && data.success !== false) {
            // 获取匹配结果
            console.log('自动获取匹配结果');
            
            // 使用定时器延迟执行，确保后端有足够时间保存数据
            setTimeout(async () => {
            try {
              // 优先使用从finished消息中获取的匹配分数请求ID
              const matchRequestId = data.matching_score_request_id || requestId;
              console.log('使用请求ID获取匹配结果:', matchRequestId);
              
              if (!matchRequestId) {
                throw new Error('未能获取到有效的请求ID');
              }
              
              const matchingResult = await resumeMatchService.getMatchingScore(matchRequestId);
              console.log('获取到的匹配结果:', matchingResult);
              
              // 检查匹配结果是否成功
              if (matchingResult.success) {
                // 设置匹配分数
                const resultData = matchingResult.result;
                setMatchingScore(resultData);
                
                // 直接从匹配结果中获取胜任力模型数据
                try {
                  // 打印完整的结果数据结构，帮助调试
                  console.log('匹配结果完整数据结构:', JSON.stringify(matchingResult, null, 2));
                  
                  // 根据JSON数据结构，正确获取胜任力模型数据
                  if (matchingResult.params && matchingResult.params.competency_model) {
                    console.log('从匹配结果中获取胜任力模型数据');
                    
                    // 设置胜任力模型，使用正确的数据结构
                    const competencyModelData = matchingResult.params.competency_model;
                    
                    setCompetencyModel(JSON.stringify(competencyModelData, null, 2));
                    console.log('成功设置胜任力模型数据:', competencyModelData);
                  } else {
                    console.warn('匹配结果中未包含胜任力模型数据，完整matchingResult:', matchingResult);
                  }
                } catch (modelError) {
                  console.error('处理胜任力模型数据时出错:', modelError);
                  addToast({
                    title: "处理胜任力模型数据出错",
                    description: `处理胜任力模型数据时出错: ${modelError.message}`,
                    status: "warning",
                    shouldshowtimeoutprogess: "true"
                  });
                }
                
                // 显示成功提示
                addToast({
                  title: "匹配完成",
                  description: "人岗匹配分析已完成，结果已加载",
                  status: "success",
                  shouldshowtimeoutprogess: "true"
                });
              } else {
                // 匹配结果获取失败
                addToast({
                  title: "获取匹配结果失败",
                  description: matchingResult.message || "未知错误",
                  status: "error",
                  shouldshowtimeoutprogess: "true"
                });
              }
            } catch (error) {
              console.error('获取匹配结果时出错:', error);
              addToast({
                title: "获取匹配结果出错",
                description: `获取匹配结果时出错: ${error.message}`,
                status: "error",
                shouldshowtimeoutprogess: "true"
              });
            }
          }, 1000); // 延迟1秒执行
          }
        }
      };
      
      // 准备匹配选项
      const matchOptions = {
        resumeFile: resumeInputType === "file" ? resumeFile : null,
        positionFile: positionInputType === "file" ? positionFile : null,
        resumeText: resumeInputType === "text" ? resumeText : null,
        positionText: positionInputType === "text" ? jobDescriptionText : null,
        competencyModelText: positionInputType === "competency" ? competencyModelText : null,
        hardRequirements: hardRequirements.trim() || null
      };
      
      // 调用混合模式匹配服务
      console.log('开始调用matchResumeMixed服务，选项:', matchOptions);
      const { requestId, reader: streamReader } = await resumeMatchService.matchResumeMixed(matchOptions, handleProgress);
      console.log('成功获取requestId:', requestId);
      setRequestId(requestId);
      setReader(streamReader);
      
    } catch (error) {
      console.error("匹配失败:", error);
      addToast({
        title: "匹配失败",
        description: error.message || "处理匹配请求时发生错误",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
      setIsLoading(false);
    }
  };
  
  // 终止匹配过程
  const handleTerminate = async () => {
    if (!requestId) {
      addToast({
        title: "无法终止",
        description: "没有正在进行的匹配过程",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      await resumeMatchService.terminateResumeMatch(requestId);
      
      if (reader) {
        reader.cancel("用户手动终止");
      }
      
      addToast({
        title: "已终止",
        description: "匹配过程已成功终止",
        status: "success",
        shouldshowtimeoutprogess: "true"
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("终止匹配失败:", error);
      addToast({
        title: "终止失败",
        description: error.message || "终止匹配过程时发生错误",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 复制匹配结果
  const handleCopyResult = () => {
    if (!matchingScore) {
      addToast({
        title: "无法复制",
        description: "没有可复制的匹配结果",
        status: "warning",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      const resultText = JSON.stringify(matchingScore, null, 2);
      navigator.clipboard.writeText(resultText);
      
      addToast({
        title: "复制成功",
        description: "匹配结果已复制到剪贴板",
        status: "success",
        shouldshowtimeoutprogess: "true"
      });
    } catch (error) {
      console.error("复制匹配结果失败:", error);
      addToast({
        title: "复制失败",
        description: "复制匹配结果时发生错误",
        status: "error",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 重置所有状态
  const handleReset = () => {
    // 重置文件状态
    setResumeFile(null);
    setPositionFile(null);
    
    // 重置文本状态
    setResumeText("");
    setJobDescriptionText("");
    setCompetencyModelText("");
    setHardRequirements("");
    
    // 重置解析结果
    setResumeContent("");
    setPositionContent("");
    setCompetencyModel("");
    setCompetencyModelStream("");
    setMatchingScore(null);
    setMatchingScoreStream("");
    
    // 重置其他状态
    setRequestId(null);
    setMatchingStep(0);
    
    // 保持当前的输入类型选择
    // setResumeInputType("file");
    // setPositionInputType("file");
    
    // 重置文件输入
    if (resumeFileInputRef.current) {
      resumeFileInputRef.current.value = "";
    }
    
    if (positionFileInputRef.current) {
      positionFileInputRef.current.value = "";
    }
    
    addToast({
      title: "已重置",
      description: "所有状态已重置",
      status: "info",
      shouldshowtimeoutprogess: "true"
    });
  };
  
  // 渲染匹配结果图表
  const renderMatchingChart = () => {
    if (!matchingScore || !matchingScore.candidate_evaluation) return null;
    
    const layerEvaluation = matchingScore.candidate_evaluation.layer_evaluation || [];
    
    // 准备图表数据 - 从每个层次中提取维度
    const chartData = [];
    layerEvaluation.forEach(layer => {
      if (layer.dimensions_evaluation && layer.dimensions_evaluation.length > 0) {
        layer.dimensions_evaluation.forEach(dimension => {
          chartData.push({
            name: `${layer.layer_name}-${dimension.dimension_name}`,
            value: dimension.score,
            max: 100 // 假设满分为100
          });
        });
      }
    });
    
    // 图表配置
    const option = {
      tooltip: {
        trigger: 'item'
      },
      radar: {
        indicator: chartData.map(item => ({
          name: item.name,
          max: item.max
        })),
        radius: '65%'
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: chartData.map(item => item.value),
              name: '匹配分数',
              areaStyle: {
                color: 'rgba(65, 105, 225, 0.3)'
              },
              lineStyle: {
                color: 'rgba(65, 105, 225, 0.8)'
              },
              itemStyle: {
                color: 'rgba(65, 105, 225, 1)'
              }
            }
          ]
        }
      ]
    };
    
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <ChartPie size={20} weight="duotone" className="mr-2 text-primary-500" />
          胜任力维度匹配分析
        </h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <ReactECharts option={option} style={{ height: '400px' }} />
        </div>
      </div>
    );
  };

  // 渲染匹配结果详情
  const renderMatchingDetails = () => {
    if (!matchingScore || !matchingScore.candidate_evaluation) return null;
    
    const { 
      overall_assessment_summary,
      is_recommended_for_interview,
      total_score,
      strengths_aligned_with_model,
      weaknesses_gaps_aligned_with_model,
      layer_evaluation,
      potential_flags_notes
    } = matchingScore.candidate_evaluation;
    
    return (
      <div className="space-y-6">
        {/* 总体评价 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <CheckSquare size={20} weight="duotone" className="mr-2 text-primary-500" />
            总体评价
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* 匹配度和推荐 */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center mb-3">
                <div className="text-gray-700 font-medium mb-2 md:mb-0 md:w-32">总体匹配度：</div>
                <div className="flex-1">
                  <Progress 
                    value={total_score} 
                    max={100} 
                    color={total_score >= 80 ? "success" : total_score >= 60 ? "warning" : "danger"}
                    className="h-5"
                  />
                  <div className="flex justify-between text-sm mt-1">
                    <span className="font-medium">{total_score}分</span>
                    <span className="text-gray-500">满分100分</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center">
                <div className="text-gray-700 font-medium mb-2 md:mb-0 md:w-32">是否推荐：</div>
                <div>
                  {is_recommended_for_interview === "Yes" ? (
                    <Badge color="success" className="flex items-center">
                      <CircleWavyCheck size={16} weight="duotone" className="mr-1" />
                      建议面试
                    </Badge>
                  ) : is_recommended_for_interview === "Maybe" ? (
                    <Badge color="warning" className="flex items-center">
                      <WarningCircle size={16} weight="duotone" className="mr-1" />
                      需进一步评估
                    </Badge>
                  ) : (
                    <Badge color="danger" className="flex items-center">
                      <XCircle size={16} weight="duotone" className="mr-1" />
                      不建议面试
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* 评估详情 */}
            <div className="p-4">
              <div className="mb-3">
                <div className="text-gray-700 font-medium mb-1">总体评估</div>
                <div className="bg-gray-50 p-3 rounded text-sm">{overall_assessment_summary}</div>
              </div>
              
              {/* 优势 */}
              {strengths_aligned_with_model && strengths_aligned_with_model.length > 0 && (
                <div className="mb-3">
                  <div className="text-gray-700 font-medium mb-1">主要优势</div>
                  <div className="bg-success-50 text-success-700 p-3 rounded text-sm">
                    <ul className="list-disc pl-5">
                      {strengths_aligned_with_model.map((strength, index) => (
                        <li key={index} className="mb-2">
                          <strong>{strength.dimension_name}：</strong> {strength.description}
                          {(strength.evidence_from_resume || strength.resume_evidence) && (strength.evidence_from_resume || strength.resume_evidence).length > 0 && (
                            <div className="mt-1 text-xs text-gray-600">
                              <span className="font-medium">依据：</span>
                              {(strength.evidence_from_resume || strength.resume_evidence).join('; ')}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* 劣势 */}
              {weaknesses_gaps_aligned_with_model && weaknesses_gaps_aligned_with_model.length > 0 && (
                <div>
                  <div className="text-gray-700 font-medium mb-1">主要不足</div>
                  <div className="bg-danger-50 text-danger-700 p-3 rounded text-sm">
                    <ul className="list-disc pl-5">
                      {weaknesses_gaps_aligned_with_model.map((weakness, index) => (
                        <li key={index} className="mb-2">
                          <strong>{weakness.dimension_name}：</strong> {weakness.description}
                          {(weakness.evidence_from_resume || weakness.resume_evidence) && (weakness.evidence_from_resume || weakness.resume_evidence).length > 0 && (
                            <div className="mt-1 text-xs text-gray-600">
                              <span className="font-medium">依据：</span>
                              {(weakness.evidence_from_resume || weakness.resume_evidence).join('; ')}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 潜在风险提示 */}
        {potential_flags_notes && potential_flags_notes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <WarningCircle size={20} weight="duotone" className="mr-2 text-warning-500" />
              潜在风险提示
            </h3>
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <ul className="list-disc pl-5 text-warning-700">
                {potential_flags_notes.map((note, index) => (
                  <li key={index} className="mb-1">{note}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {/* 胜任力模型评估 */}
        {layer_evaluation && layer_evaluation.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Brain size={20} weight="duotone" className="mr-2 text-primary-500" />
              胜任力模型评估
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              {layer_evaluation.map((layer, layerIndex) => (
                <div key={layerIndex} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2 bg-white p-3 rounded-lg shadow-sm">
                    <h4 className="font-medium text-primary-700">{layer.layer_name}</h4>
                    <div className="text-sm">
                      <span className="font-semibold">{layer.weighted_score}</span>
                      <span className="text-gray-500"> / {layer.weight_percentage}%</span>
                    </div>
                  </div>
                  
                  {layer.dimensions_evaluation && layer.dimensions_evaluation.length > 0 && (
                    <div className="pl-4 space-y-3">
                      {layer.dimensions_evaluation.map((dimension, dimIndex) => (
                        <div key={dimIndex} className="border-l-2 border-gray-300 pl-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center">
                              <h4 className="font-medium">{dimension.dimension_name || dimension.name}</h4>
                              {dimension.type && dimension.type.trim() !== "" && (
                                <span className="text-xs text-gray-500 ml-2">({dimension.type})</span>
                              )}
                              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                dimension.importance === "核心" 
                                  ? "bg-red-100 text-red-700" 
                                  : "bg-gray-100 text-gray-700"
                              }`}>
                                {dimension.importance}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm font-medium mr-2">
                                {dimension.score}分{dimension.total_score ? `/${dimension.total_score}分` : ''}
                              </span>
                              <div className="w-16 h-4 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    dimension.importance === "核心" ? "bg-red-500" : "bg-gray-400"
                                  }`}
                                  style={{ width: `${(dimension.score / (dimension.total_score || layer.weighted_score)) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-3">{dimension.description}</p>
                          
                          {/* 评估方法 */}
                          {dimension.assessment_method && dimension.assessment_method.length > 0 && (
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
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                {dimension.industry_adaptation}
                              </span>
                            </div>
                          )}
                          
                          {/* 简历依据 */}
                          {(dimension.evidence_from_resume || dimension.resume_evidence) && 
                           (dimension.evidence_from_resume || dimension.resume_evidence).length > 0 && (
                            <div className="text-sm text-gray-600">
                              <span className="text-gray-800 font-medium">简历依据：</span>
                              <ul className="list-disc pl-5 mt-1">
                                {(dimension.evidence_from_resume || dimension.resume_evidence).map((evidence, evIndex) => (
                                  <li key={evIndex} className="text-xs">{evidence}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // 渲染流式生成内容
  const renderStreamContent = () => {
    if (!competencyModelStream && !matchingScoreStream) return null;
    
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <Lightning size={20} weight="duotone" className="mr-2 text-primary-500" />
          实时生成内容
        </h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          {matchingStep === 1 && (
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <Badge color="primary" className="mr-2">步骤1</Badge>
                <span className="font-medium">正在生成职位胜任力模型...</span>
              </div>
              <div 
                ref={competencyModelStreamRef}
                className="bg-gray-100 p-3 rounded-md text-sm font-mono whitespace-pre-wrap max-h-40 overflow-auto"
              >
                {competencyModelStream || "等待生成中..."}
              </div>
            </div>
          )}
          
          {matchingStep === 2 && (
            <div>
              <div className="flex items-center mb-2">
                <Badge color="success" className="mr-2">步骤1</Badge>
                <span className="font-medium">职位胜任力模型生成完成</span>
              </div>
              <div className="flex items-center mb-2">
                <Badge color="primary" className="mr-2">步骤2</Badge>
                <span className="font-medium">正在计算匹配分数...</span>
              </div>
              <div 
                ref={matchingScoreStreamRef}
                className="bg-gray-100 p-3 rounded-md text-sm font-mono whitespace-pre-wrap max-h-40 overflow-auto"
              >
                {matchingScoreStream || "等待生成中..."}
              </div>
            </div>
          )}
          
          {matchingScore && (
            <div className="mt-2 flex items-center">
              <Badge color="success" className="mr-2">完成</Badge>
              <span className="font-medium">匹配分析已完成</span>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // 渲染胜任力模型
  const renderCompetencyModel = () => {
    if (!competencyModel) return null;
    
    // 解析胜任力模型数据
    const modelData = typeof competencyModel === 'string' 
      ? JSON.parse(competencyModel) 
      : competencyModel;
    
    // 确保数据结构正确
    if (!modelData || !modelData.competency_model) {
      return <div className="text-center text-gray-500 py-4">无法解析胜任力模型数据</div>;
    }
    
    const competencies = modelData.competency_model;
    const splittingProcess = modelData.splitting_process;
    
    // 准备柱状图数据 - 层次柱状图
    const barChartOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params) {
          const data = params[0];
          const competency = competencies[data.dataIndex];
          let tooltip = `<div>${competency.name}: ${competency.score}分</div>`;
          tooltip += '<div style="margin-top:5px;border-top:1px solid #ccc;padding-top:5px;">';
          tooltip += '<strong>维度：</strong><br/>';
          
          if (competency.dimensions && competency.dimensions.length > 0) {
            competency.dimensions.forEach(dimension => {
              tooltip += `· ${dimension.name}: ${dimension.score}分<br/>`;
            });
          }
          
          tooltip += '</div>';
          return tooltip;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: competencies.map(item => item.name),
        axisLabel: {
          interval: 0,
          rotate: 30,
          fontSize: 12
        }
      },
      yAxis: {
        type: 'value',
        name: '分数',
        nameLocation: 'end'
      },
      series: [
        {
          name: '能力分数',
          type: 'bar',
          barWidth: '60%',
          data: competencies.map(item => ({
            value: item.score,
            itemStyle: {
              color: '#' + Math.floor(Math.random()*16777215).toString(16)
            }
          })),
          label: {
            show: true,
            position: 'top',
            formatter: '{c}分'
          }
        }
      ]
    };
    
    // 辅助函数：根据名称查找维度
    const findDimensionByName = (fullName) => {
      for (const layer of competencies) {
        if (layer.dimensions && layer.dimensions.length > 0) {
          for (const dimension of layer.dimensions) {
            if (`${layer.name}-${dimension.name}` === fullName) {
              return dimension;
            }
          }
        }
      }
      return null;
    };
    
    // 准备维度雷达图数据
    const dimensionsData = [];
    const dimensionNames = [];
    
    // 从各层次中提取所有维度
    competencies.forEach(layer => {
      if (layer.dimensions && layer.dimensions.length > 0) {
        layer.dimensions.forEach(dimension => {
          dimensionsData.push(dimension.score);
          dimensionNames.push(`${layer.name}-${dimension.name}`);
        });
      }
    });
    
    const radarOption = {
      title: {
        text: '维度分数雷达图',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          const index = params.dataIndex;
          const dimensionName = dimensionNames[index];
          const score = dimensionsData[index];
          const dimension = findDimensionByName(dimensionName);
          const totalScore = dimension?.total_score || 100;
          return `${dimensionName}<br/>得分: ${score}/${totalScore}分`;
        }
      },
      radar: {
        indicator: dimensionNames.map((name, index) => {
          const dimension = findDimensionByName(name);
          const max = dimension?.total_score || 100; // 使用维度的总分作为最大值
          return {
            name: name,
            max: max
          };
        }),
        radius: '65%'
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: dimensionsData,
              name: '维度分数',
              areaStyle: {
                color: 'rgba(65, 105, 225, 0.3)'
              },
              lineStyle: {
                color: 'rgba(65, 105, 225, 0.8)'
              },
              itemStyle: {
                color: 'rgba(65, 105, 225, 1)'
              }
            }
          ]
        }
      ]
    };
    
    return (
      <div>
        <div className="border border-gray-200 rounded-lg p-2 mb-4">
          <h4 className="text-base font-medium mb-2">层次分数分布</h4>
          <ReactECharts 
            option={barChartOption} 
            style={{ height: '300px', width: '100%' }} 
            className="py-2"
          />
        </div>
        
        <div className="border border-gray-200 rounded-lg p-2 mb-4">
          <h4 className="text-base font-medium mb-2">维度分数雷达图</h4>
          <ReactECharts 
            option={radarOption} 
            style={{ height: '400px', width: '100%' }} 
            className="py-2"
          />
        </div>
        
        {/* 层次与维度详细说明 */}
        <div className="mt-4">
          <h4 className="text-base font-medium mb-3">能力详细说明</h4>
          <div className="space-y-4">
            {competencies.map((competency, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg">
                <div className="font-medium text-primary-700 mb-2">
                  {competency.name} ({competency.score}分)
                </div>
                {competency.description && (
                  <div className="text-sm text-gray-600 mb-3 bg-white p-2 rounded">
                    {competency.description}
                  </div>
                )}
                {competency.dimensions && competency.dimensions.length > 0 ? (
                  <div className="pl-4 space-y-2">
                    {competency.dimensions.map((dimension, dimIndex) => (
                      <div key={dimIndex} className="border-l-2 border-gray-300 pl-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center">
                            <h4 className="font-medium">{dimension.name}</h4>
                            {dimension.type && dimension.type.trim() !== "" && (
                              <span className="text-xs text-gray-500 ml-2">({dimension.type})</span>
                            )}
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                              dimension.importance === "核心" 
                                ? "bg-red-100 text-red-700" 
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {dimension.importance}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-2">
                              {dimension.score}分{dimension.total_score ? `/${dimension.total_score}分` : ''}
                            </span>
                            <div className="w-16 h-4 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  dimension.importance === "核心" ? "bg-red-500" : "bg-gray-400"
                                }`}
                                style={{ width: `${(dimension.score / (dimension.total_score || competency.score)) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-700 mb-3">{dimension.description}</p>
                        
                        {/* 评估方法 */}
                        {dimension.assessment_method && dimension.assessment_method.length > 0 && (
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
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {dimension.industry_adaptation}
                            </span>
                          </div>
                        )}
                        
                        {/* 简历依据 */}
                        {(dimension.evidence_from_resume || dimension.resume_evidence) && 
                         (dimension.evidence_from_resume || dimension.resume_evidence).length > 0 && (
                          <div className="text-sm text-gray-600">
                            <span className="text-gray-800 font-medium">简历依据：</span>
                            <ul className="list-disc pl-5 mt-1">
                              {(dimension.evidence_from_resume || dimension.resume_evidence).map((evidence, evIndex) => (
                                <li key={evIndex} className="text-xs">{evidence}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">无维度</div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* 模型构建过程 */}
        {splittingProcess && (
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-medium mb-3">胜任力模型构建过程</h4>
            
            {splittingProcess.analysis && (
              <div className="mb-4">
                <div className="font-medium text-gray-700 mb-1">分析过程</div>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {splittingProcess.analysis}
                </div>
              </div>
            )}
            
            {splittingProcess.key_factors && splittingProcess.key_factors.length > 0 && (
              <div className="mb-4">
                <div className="font-medium text-gray-700 mb-1">关键因素</div>
                <div className="bg-gray-50 p-3 rounded">
                  <ul className="list-disc pl-5 text-sm text-gray-600">
                    {splittingProcess.key_factors.map((factor, index) => (
                      <li key={index}>{factor}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            {splittingProcess.industry_insights && (
              <div className="mb-4">
                <div className="font-medium text-gray-700 mb-1">行业洞察</div>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {splittingProcess.industry_insights}
                </div>
              </div>
            )}
            
            {splittingProcess.weight_distribution_rationale && (
              <div>
                <div className="font-medium text-gray-700 mb-1">权重分配理由</div>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {splittingProcess.weight_distribution_rationale}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* JSON数据查看按钮 */}
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            color="primary"
            className="flex items-center"
            onClick={() => {
              navigator.clipboard.writeText(typeof competencyModel === 'string' ? competencyModel : JSON.stringify(competencyModel, null, 2));
              addToast({
                title: "复制成功",
                description: "胜任力模型已复制到剪贴板",
                status: "success",
                shouldshowtimeoutprogess: "true"
              });
            }}
          >
            <Copy size={16} className="mr-1" />
            复制完整模型
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="flex justify-end mb-6">
        <div className="flex space-x-2">
          {isLoading && (
            <Button
              color="danger"
              variant="outline"
              onClick={handleTerminate}
              className="flex items-center"
              disabled={!requestId}
            >
              <X size={18} className="mr-1" />
              终止生成
            </Button>
          )}
        </div>
      </div>
      
      <Card className="mb-4 shadow-sm">
        <CardHeader className="py-3 px-4 bg-white border-b border-gray-100">
          <div className="flex items-center">
            <FileArrowUp size={18} weight="duotone" className="text-primary-500 mr-2" />
            <h3 className="font-medium text-base">输入方式</h3>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 简历输入部分 */}
            <div className="bg-white rounded-md">
              <h4 className="text-base font-medium mb-3">简历信息</h4>
              
              {/* 简历输入方式选择 */}
              <div className="mb-3 flex space-x-2">
                <Button
                  size="sm"
                  color={resumeInputType === "file" ? "primary" : "secondary"}
                  variant={resumeInputType === "file" ? "solid" : "outline"}
                  onClick={() => setResumeInputType("file")}
                  disabled={isLoading}
                  className="flex items-center"
                >
                  文件上传
                </Button>
                <Button
                  size="sm"
                  color={resumeInputType === "text" ? "primary" : "secondary"}
                  variant={resumeInputType === "text" ? "solid" : "outline"}
                  onClick={() => setResumeInputType("text")}
                  disabled={isLoading}
                  className="flex items-center"
                >
                  文本输入
                </Button>
              </div>
              
              {/* 简历文件上传 */}
              {resumeInputType === "file" && (
                <div>
                  <div 
                    ref={resumeUploadAreaRef}
                    className="border border-gray-200 rounded-md p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => resumeFileInputRef.current?.click()}
                    onDragOver={handleResumeDragOver}
                    onDragLeave={handleResumeDragLeave}
                    onDrop={handleResumeDrop}
                  >
                    <input
                      type="file"
                      ref={resumeFileInputRef}
                      onChange={handleResumeFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.json,.jpg,.jpeg,.png"
                      disabled={isLoading}
                    />
                    
                    {resumeFile ? (
                      <div className="flex flex-col items-center">
                        <FileText size={32} weight="duotone" className="text-primary-500 mb-1" />
                        <p className="text-sm font-medium">{resumeFile.name}</p>
                        <p className="text-xs text-gray-500">{(resumeFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <>
                        <UploadSimple size={32} weight="duotone" className="mx-auto text-gray-400 mb-1" />
                        <p className="text-sm">点击或拖拽文件到此处上传</p>
                        <p className="text-xs text-gray-500 mt-1">支持PDF、Word、TXT等格式</p>
                      </>
                    )}
                  </div>
                  
                  {resumeContent && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">简历内容</label>
                      <div className="bg-gray-50 p-2 rounded-md max-h-[150px] overflow-auto text-xs">
                        <pre className="whitespace-pre-wrap">{resumeContent}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 简历文本输入 */}
              {resumeInputType === "text" && (
                <div>
                  <Textarea
                    placeholder="请粘贴简历文本内容..."
                    minRows={5}
                    maxRows={5}
                    value={resumeText}
                    onChange={handleResumeTextChange}
                    disabled={isLoading}
                    className="w-full text-sm"
                  />
                </div>
              )}
            </div>
            
            {/* 职位描述输入部分 */}
            <div className="bg-white rounded-md">
              <h4 className="text-base font-medium mb-3">职位描述</h4>
              
              {/* 职位描述输入方式选择 */}
              <div className="mb-3 flex space-x-2">
                <Button
                  size="sm"
                  color={positionInputType === "file" ? "primary" : "secondary"}
                  variant={positionInputType === "file" ? "solid" : "outline"}
                  onClick={() => setPositionInputType("file")}
                  disabled={isLoading}
                  className="flex items-center"
                >
                  <UploadSimple size={16} className="mr-1" />
                  文件上传
                </Button>
                <Button
                  size="sm"
                  color={positionInputType === "text" ? "primary" : "secondary"}
                  variant={positionInputType === "text" ? "solid" : "outline"}
                  onClick={() => setPositionInputType("text")}
                  disabled={isLoading}
                  className="flex items-center"
                >
                  <TextT size={16} className="mr-1" />
                  文本输入
                </Button>
                <Button
                  size="sm"
                  color={positionInputType === "competency" ? "primary" : "secondary"}
                  variant={positionInputType === "competency" ? "solid" : "outline"}
                  onClick={() => setPositionInputType("competency")}
                  disabled={isLoading}
                  className="flex items-center"
                >
                  <FileText size={16} className="mr-1" />
                  胜任力模型输入
                </Button>
              </div>
              
              {/* 职位描述文件上传 */}
              {positionInputType === "file" && (
                <div>
                  <div 
                    ref={positionUploadAreaRef}
                    className="border border-gray-200 rounded-md p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => positionFileInputRef.current?.click()}
                    onDragOver={handlePositionDragOver}
                    onDragLeave={handlePositionDragLeave}
                    onDrop={handlePositionDrop}
                  >
                    <input
                      type="file"
                      ref={positionFileInputRef}
                      onChange={handlePositionFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.json,.jpg,.jpeg,.png"
                      disabled={isLoading}
                    />
                    
                    {positionFile ? (
                      <div className="flex flex-col items-center">
                        <FileText size={32} weight="duotone" className="text-primary-500 mb-1" />
                        <p className="text-sm font-medium">{positionFile.name}</p>
                        <p className="text-xs text-gray-500">{(positionFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <>
                        <UploadSimple size={32} weight="duotone" className="mx-auto text-gray-400 mb-1" />
                        <p className="text-sm">点击或拖拽文件到此处上传</p>
                        <p className="text-xs text-gray-500 mt-1">支持PDF、Word、TXT等格式</p>
                      </>
                    )}
                  </div>
                  
                  {positionContent && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">职位描述内容</label>
                      <div className="bg-gray-50 p-2 rounded-md max-h-[150px] overflow-auto text-xs">
                        <pre className="whitespace-pre-wrap">{positionContent}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 职位描述文本输入 */}
              {positionInputType === "text" && (
                <div>
                  <Textarea
                    placeholder="请粘贴职位描述文本内容..."
                    minRows={5}
                    maxRows={5}
                    value={jobDescriptionText}
                    onChange={handleJobDescriptionTextChange}
                    disabled={isLoading}
                    className="w-full text-sm"
                  />
                </div>
              )}
              
              {/* 胜任力模型文本输入 */}
              {positionInputType === "competency" && (
                <div>
                  <Textarea
                    placeholder="请粘贴胜任力模型文本内容..."
                    minRows={5}
                    maxRows={5}
                    value={competencyModelText}
                    onChange={(e) => setCompetencyModelText(e.target.value)}
                    disabled={isLoading}
                    className="w-full text-sm"
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* 硬性条件输入 */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              硬性条件（可选）
              <span className="text-gray-400 ml-1 text-xs">用于指定必须满足的条件</span>
            </label>
            <Textarea
              placeholder="可设置通过初筛的硬性条件，比如必须是本科以上。如果设置了匹配结果中的推荐建议会严格遵循此条件，如果没有设置，则会综合考量。设置的时候传字符串就行。"
              minRows={5}
              maxRows={5}
              value={hardRequirements}
              onChange={handleHardRequirementsChange}
              disabled={isLoading}
              className="w-full text-sm"
            />
          </div>
          
          {/* 匹配按钮 */}
          <div className="mt-4 flex justify-center space-x-3">
            <Button
              color="primary"
              size="md"
              className="flex items-center"
              onClick={handleMatch}
              disabled={isLoading || 
                (resumeInputType === "file" && !resumeFile) || 
                (resumeInputType === "text" && !resumeText.trim()) || 
                (positionInputType === "file" && !positionFile) || 
                (positionInputType === "text" && !jobDescriptionText.trim()) ||
                (positionInputType === "competency" && !competencyModelText.trim())
              }
            >
              {isLoading ? (
                <>
                  <Spinner size="xs" className="mr-1" />
                  正在匹配中...
                </>
              ) : (
                <>
                  <Scales size={18} className="mr-1" />
                  开始人岗匹配分析
                </>
              )}
            </Button>
            <Button
              color="secondary"
              size="md"
              variant="outline"
              onClick={handleReset}
              className="flex items-center"
              disabled={isLoading}
            >
              <ArrowClockwise size={18} className="mr-1" />
              重置
            </Button>
          </div>
        </CardBody>
      </Card>
      
      {/* 流式生成内容 */}
      {renderStreamContent()}
      
      {/* 匹配结果 */}
      {matchingScore && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center">
              <ClipboardText size={20} weight="duotone" className="text-primary-500 mr-2" />
              <h3 className="font-semibold">匹配结果</h3>
            </div>
          </CardHeader>
          <CardBody>
            {/* 胜任力模型 */}
            {competencyModel && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <FileText size={20} weight="duotone" className="mr-2 text-primary-500" />
                  胜任力模型
                </h3>
                {renderCompetencyModel()}
              </div>
            )}
            
            {/* 匹配图表 */}
            {renderMatchingChart()}
            
            {/* 匹配详情 */}
            {renderMatchingDetails()}
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default AIJobMatch;
