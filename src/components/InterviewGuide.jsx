import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Tabs,
  Tab,
  Textarea,
  Spinner,
  addToast,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from "@heroui/react";
import interviewGuideService from "../services/interview_guide_service";
import { 
  FileArrowUp, 
  Notepad, 
  XCircle, 
  CaretRight,
  User,
  Buildings,
  ListChecks,
  Warning,
  Strategy,
  ArrowClockwise,
  FileText,
  X,
  ChatCircleDots
} from "@phosphor-icons/react";
import AIInterview from "./AIInterview";

const InterviewGuide = () => {
  // 上传文件状态
  const [resumeFile, setResumeFile] = useState(null);
  const [positionFile, setPositionFile] = useState(null);
  
  // 文本输入状态
  const [resumeText, setResumeText] = useState("");
  const [positionText, setPositionText] = useState("");
  const [competencyModelInput, setCompetencyModelInput] = useState("");
  
  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [generationProgress, setGenerationProgress] = useState("");
  const [generationResult, setGenerationResult] = useState(null);
  const [competencyModel, setCompetencyModel] = useState(null);
  const [competencyModelLoading, setCompetencyModelLoading] = useState(false);
  const [competencyModelProgress, setCompetencyModelProgress] = useState("");
  
  // 面试指南结果
  const [interviewGuide, setInterviewGuide] = useState(null);
  
  // 面试问题数量选择
  const [interviewQuestionLevel, setInterviewQuestionLevel] = useState("balanced"); // 默认选择平衡模式
  
  // AI面试状态
  const [showAIInterview, setShowAIInterview] = useState(false);
  const [isAIInterviewing, setIsAIInterviewing] = useState(false);
  
  // 错误状态
  const [error, setError] = useState(null);
  
  // 文件输入引用
  const resumeFileInputRef = useRef(null);
  const positionFileInputRef = useRef(null);
  const competencyModelRef = useRef(null);
  const generationProgressRef = useRef(null);
  
  // 清除所有状态
  const resetAll = () => {
    setResumeFile(null);
    setPositionFile(null);
    setResumeText("");
    setPositionText("");
    setIsGenerating(false);
    setRequestId(null);
    setGenerationProgress("");
    setGenerationResult(null);
    setCompetencyModel(null);
    setCompetencyModelLoading(false);
    setCompetencyModelProgress("");
    setCompetencyModelInput("");
    setInterviewGuide(null);
    setInterviewQuestionLevel("balanced"); // 重置面试问题数量选择为默认值
    setError(null);
    setShowAIInterview(false);
    setIsAIInterviewing(false);
  };
  
  // 处理简历文件上传
  const handleResumeFileUpload = (files) => {
    if (files && files.length > 0) {
      const file = files[0];
      setResumeFile(file);
    }
  };

  // 处理职位描述文件上传
  const handlePositionFileUpload = (files) => {
    if (files && files.length > 0) {
      const file = files[0];
      setPositionFile(file);
    }
  };
  
  // 处理生成面试指南
  const handleGenerateGuide = async () => {
    // 验证输入
    if ((!resumeFile && !resumeText) || 
        (!positionFile && !positionText)) {
      setError("请提供简历和职位描述信息");
      addToast({
        title: "输入不完整",
        description: "请提供简历和职位描述信息",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    try {
      // 重置状态
      setIsGenerating(true);
      setInterviewGuide(null);
      setError(null);
      setGenerationProgress("");
      
      // 确定使用哪些输入
      const resumeInput = resumeText;
      const positionInput = positionText;
      const competencyModelInputData = competencyModelInput.trim();
      
      // 如果用户提供了胜任力模型，直接使用，不需要显示加载状态
      if (competencyModelInputData) {
        try {
          const parsedModel = JSON.parse(competencyModelInputData);
          setCompetencyModel(parsedModel);
          setCompetencyModelLoading(false);
          setCompetencyModelProgress("");
          setGenerationProgress("使用用户提供的胜任力模型，开始生成面试指南...");
        } catch (error) {
          console.error("解析用户提供的胜任力模型出错:", error);
          setError("胜任力模型JSON格式无效，请检查后重试");
          setIsGenerating(false);
          addToast({
            title: "格式错误",
            description: "胜任力模型JSON格式无效，请检查后重试",
            shouldshowtimeoutprogess: "true"
          });
          return;
        }
      } else {
        // 如果用户没有提供胜任力模型，显示加载状态
        setCompetencyModel(null);
        setCompetencyModelLoading(true);
        setCompetencyModelProgress("");
      }
      
      // 调用服务生成面试指南
      const { requestId } = await interviewGuideService.generateInterviewGuide(
        {
          resumeFile: resumeFile,
          positionFile: positionFile,
          resumeText: resumeInput,
          positionText: positionInput,
          competencyModel: competencyModelInputData ? JSON.parse(competencyModelInputData) : null,
          interviewQuestionLevel: interviewQuestionLevel === "simple" ? 
            "简单模式：约5个问题，面试时长约15分钟" : 
            interviewQuestionLevel === "deep" ? 
            "深度模式：约20个问题，面试时长约1小时" : 
            "平衡模式：约10个问题，面试时长约30分钟"
        },
        handleProgress
      );
      
      setRequestId(requestId);
      console.log("面试指南生成请求已发送，请求ID:", requestId);
      
    } catch (error) {
      console.error("生成面试指南时出错:", error);
      setError(`生成失败: ${error.message}`);
      setIsGenerating(false);
      addToast({
        title: "生成失败",
        description: error.message,
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 处理流式进度更新
  const handleProgress = (data) => {
    // 添加调试日志
    
    
    if (data.error) {
      setError(data.error);
      setIsGenerating(false);
      addToast({
        title: "生成失败",
        description: data.error,
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    if (data.terminated) {
      setIsGenerating(false);
      setGenerationProgress(prev => prev + "\n生成已取消");
      return;
    }
    
    // 处理消息
    if (data.message) {
      setGenerationProgress(prev => prev + "\n" + data.message);
      // 滚动到生成进度区域
      setTimeout(() => {
        generationProgressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      return;
    }
    
    // 处理胜任力模型数据
    if (data.competency_model && !competencyModelInput.trim()) {
      try {
        setCompetencyModelLoading(false);
        // 尝试解析胜任力模型数据
        let modelData = data.competency_model;
        if (typeof modelData === 'string') {
          modelData = JSON.parse(modelData);
        }
        setCompetencyModel(modelData);
        setGenerationProgress(prev => prev + "\n胜任力模型生成完成，开始生成面试指南...");
        
        // 滚动到胜任力模型组件
        setTimeout(() => {
          competencyModelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (error) {
        console.error("解析胜任力模型数据出错:", error, data.competency_model);
        setCompetencyModelLoading(false);
      }
      return;
    }
    
    // 处理胜任力模型生成过程中的内容块
    if (data.content_chunk && !data.interview_guide_stream) {
      
      setCompetencyModelProgress(prev => prev + data.content_chunk);
      
      // 更新总体进度信息，但不频繁更新UI
      if (!window.lastCompetencyUpdateTime || Date.now() - window.lastCompetencyUpdateTime > 1000) {
        window.lastCompetencyUpdateTime = Date.now();
        
        setGenerationProgress(prev => {
          // 如果之前没有提示胜任力模型正在生成，添加提示
          if (!prev.includes("正在生成胜任力模型...")) {
            return prev + "\n正在生成胜任力模型...";
          }
          return prev;
        });
        
        // 使用setTimeout确保DOM更新后再滚动，并且减少滚动频率
        setTimeout(() => {
          // 滚动胜任力模型内容容器
          const progressContainer = document.getElementById("competencyModelProgressContainer");
          if (progressContainer) {
            progressContainer.scrollTop = progressContainer.scrollHeight;
          }
          
          // 不再自动滚动整个页面，让用户可以自由控制抽屉的滚动
        }, 100);
      }
      return;
    }
    
    // 处理流式内容
    if (data.interview_guide_stream) {
      setGenerationProgress(prev => prev + data.interview_guide_stream);
      
      // 滚动到生成进度区域
      setTimeout(() => {
        generationProgressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
    
    // 处理成功状态和新的请求ID
    if (data.success && data.request_id) {
      console.log("面试指南生成成功，新请求ID:", data.request_id);
      setRequestId(data.request_id);
      setGenerationProgress(prev => prev + `\n面试指南生成成功，新请求ID: ${data.request_id}，开始获取完整数据...`);
      
      // 获取完整的面试指南数据
      fetchInterviewGuide(data.request_id);
      return; // 添加return，防止继续执行后面的逻辑
    }
    
    // 处理最终结果
    if (data.interview_guide) {
      // 确保将胜任力模型添加到面试指南对象中
      if (competencyModel && !data.interview_guide.competency_model) {
        data.interview_guide.competency_model = competencyModel;
      }
      setInterviewGuide(data.interview_guide);
    }
    
    if (data.finished) {
      setIsGenerating(false);
      setGenerationProgress(prev => prev + "\n面试指南生成完成");
      
      // 如果有请求ID但还没有获取到面试指南，尝试再次获取
      // 优先使用消息中的request_id，如果没有则使用组件状态中的requestId
      const latestRequestId = data.request_id || requestId;
      if (latestRequestId && !interviewGuide) {
        console.log("面试指南生成完成，但尚未获取数据，尝试使用最新请求ID获取:", latestRequestId);
        setGenerationProgress(prev => prev + `\n尝试使用最新请求ID: ${latestRequestId} 获取面试指南数据...`);
        fetchInterviewGuide(latestRequestId);
      }
      
      addToast({
        title: "生成成功",
        description: "面试指南已生成完成",
        shouldshowtimeoutprogess: "true"
      });
    }
  };
  
  // 获取面试指南数据
  const fetchInterviewGuide = async (guideRequestId) => {
    try {
      console.log("开始获取面试指南数据，请求ID:", guideRequestId);
      setGenerationProgress(prev => prev + `\n正在获取完整的面试指南数据，请求ID: ${guideRequestId}...`);
      
      const guideData = await interviewGuideService.getInterviewGuide(guideRequestId);
      console.log("获取到面试指南数据:", guideData);
      
      if (guideData && guideData.result) {
        // 确保将胜任力模型添加到面试指南对象中
        if (competencyModel && !guideData.result.competency_model) {
          guideData.result.competency_model = competencyModel;
        }
        setInterviewGuide(guideData.result);
        setGenerationProgress(prev => prev + `\n面试指南数据获取成功，请求ID: ${guideRequestId}`);
      } else {
        console.error("获取到的面试指南数据无效:", guideData);
        setGenerationProgress(prev => prev + `\n面试指南数据获取失败，请求ID: ${guideRequestId}`);
      }
    } catch (error) {
      console.error("获取面试指南数据出错:", error);
      setGenerationProgress(prev => prev + `\n获取面试指南数据出错，请求ID: ${guideRequestId}, 错误: ${error.message}`);
    }
  };
  
  // 处理取消生成
  const handleCancelGeneration = async () => {
    if (requestId) {
      try {
        await interviewGuideService.terminateInterviewGuide(requestId);
        setIsGenerating(false);
        addToast({
          title: "已取消",
          description: "面试指南生成已取消",
          shouldshowtimeoutprogess: "true"
        });
      } catch (error) {
        console.error("取消生成错误:", error);
      }
    }
  };
  
  // 渲染候选人摘要部分
  const renderCandidateSummary = () => {
    if (!interviewGuide || !interviewGuide.candidate_summary) return null;
    
    const { name, education, experience, key_skills } = interviewGuide.candidate_summary;
    
    return (
      <Card className="mb-6 shadow-md">
        <CardHeader className="bg-blue-50">
          <div className="flex items-center">
            <User size={24} weight="duotone" className="text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold text-blue-700">候选人摘要</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {name && (
              <div>
                <span className="font-semibold">姓名：</span>
                <span>{name}</span>
              </div>
            )}
            {education && (
              <div>
                <span className="font-semibold">教育背景：</span>
                <span>{education}</span>
              </div>
            )}
            {experience && (
              <div>
                <span className="font-semibold">工作经验：</span>
                <span>{experience}</span>
              </div>
            )}
            {key_skills && key_skills.length > 0 && (
              <div>
                <span className="font-semibold">关键技能：</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {key_skills.map((skill, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };
  
  // 渲染职位要求部分
  const renderPositionRequirements = () => {
    if (!interviewGuide || !interviewGuide.position_requirements) return null;
    
    const { title, department, key_responsibilities, required_skills } = interviewGuide.position_requirements;
    
    return (
      <Card className="mb-6 shadow-md">
        <CardHeader className="bg-indigo-50">
          <div className="flex items-center">
            <Buildings size={24} weight="duotone" className="text-indigo-500 mr-2" />
            <h3 className="text-lg font-semibold text-indigo-700">职位要求</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {title && (
              <div>
                <span className="font-semibold">职位名称：</span>
                <span>{title}</span>
              </div>
            )}
            {department && (
              <div>
                <span className="font-semibold">所属部门：</span>
                <span>{department}</span>
              </div>
            )}
            {key_responsibilities && key_responsibilities.length > 0 && (
              <div>
                <span className="font-semibold">关键职责：</span>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {key_responsibilities.map((responsibility, index) => (
                    <li key={index}>{responsibility}</li>
                  ))}
                </ul>
              </div>
            )}
            {required_skills && required_skills.length > 0 && (
              <div>
                <span className="font-semibold">所需技能：</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {required_skills.map((skill, index) => (
                    <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };
  
  // 渲染面试重点领域部分
  const renderInterviewFocusAreas = () => {
    // 兼容新旧两种数据结构
    if (!interviewGuide) return null;
    
    // 检查是否有新格式的数据
    const hasNewFormat = interviewGuide.interview_content_by_layer && 
                         Object.keys(interviewGuide.interview_content_by_layer).length > 0;
    
    // 检查是否有旧格式的数据
    const hasOldFormat = interviewGuide.interview_focus_areas && 
                         interviewGuide.interview_focus_areas.length > 0;
    
    // 如果两种格式都没有，则不渲染
    if (!hasNewFormat && !hasOldFormat) return null;
    
    return (
      <Card className="mb-6 shadow-md">
        <CardHeader className="bg-teal-50">
          <div className="flex items-center">
            <ListChecks size={24} weight="duotone" className="text-teal-500 mr-2" />
            <h3 className="text-lg font-semibold text-teal-700">面试重点领域</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {/* 处理新格式数据 */}
            {hasNewFormat && Object.entries(interviewGuide.interview_content_by_layer).map(([layerName, layerData], index) => (
              <div key={`layer-${index}`} className="border-b pb-4 last:border-b-0 last:pb-0">
                <h4 className="text-md font-semibold text-teal-700 mb-2 flex items-center">
                  <CaretRight size={16} weight="bold" className="mr-1" />
                  {layerName}
                </h4>
                
                {/* 层级描述 */}
                {layerData.description && (
                  <div className="mb-3 text-gray-700 text-sm">
                    <p>{layerData.description}</p>
                  </div>
                )}
                
                {/* 维度 */}
                {layerData.dimensions && layerData.dimensions.length > 0 && (
                  <div className="mb-3">
                    <span className="font-semibold text-sm text-gray-600">涵盖维度：</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {layerData.dimensions.map((dimension, dIndex) => (
                        <span key={dIndex} className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                          {dimension}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 显性问题 - 新格式可能有 questions 或 explicit_questions */}
                {layerData.questions && layerData.questions.length > 0 && (
                  <div className="mb-3">
                    <span className="font-semibold text-sm text-gray-600">问题：</span>
                    <ul className="list-disc pl-5 mt-1 space-y-2">
                      {layerData.questions.map((questionItem, qIndex) => {
                        // 检查问题是否为对象格式（包含问题内容和建议回答时长）
                        const isQuestionObject = typeof questionItem === 'object' && questionItem !== null;
                        const questionText = isQuestionObject ? questionItem.question : questionItem;
                        const suggestedDuration = isQuestionObject 
                          ? (questionItem.suggested_duration || questionItem.estimated_answer_time) 
                          : null;
                        
                        return (
                          <li key={qIndex} className="text-gray-700">
                            <div>{questionText}</div>
                            {suggestedDuration && (
                              <div className="text-xs text-teal-600 mt-1 italic flex items-center">
                                <span className="bg-teal-50 px-2 py-0.5 rounded-full">
                                  建议回答时长: {suggestedDuration}
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {/* 显性问题 - 新格式可能有 explicit_questions */}
                {layerData.explicit_questions && layerData.explicit_questions.length > 0 && (
                  <div className="mb-3">
                    <span className="font-semibold text-sm text-gray-600">显性层面问题（知识、技能）：</span>
                    <ul className="list-disc pl-5 mt-1 space-y-2">
                      {layerData.explicit_questions.map((questionItem, qIndex) => {
                        // 检查问题是否为对象格式（包含问题内容和建议回答时长）
                        const isQuestionObject = typeof questionItem === 'object' && questionItem !== null;
                        const questionText = isQuestionObject ? questionItem.question : questionItem;
                        const suggestedDuration = isQuestionObject 
                          ? (questionItem.suggested_duration || questionItem.estimated_answer_time) 
                          : null;
                        
                        return (
                          <li key={qIndex} className="text-gray-700">
                            <div>{questionText}</div>
                            {suggestedDuration && (
                              <div className="text-xs text-teal-600 mt-1 italic flex items-center">
                                <span className="bg-teal-50 px-2 py-0.5 rounded-full">
                                  建议回答时长: {suggestedDuration}
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {/* 隐性问题 */}
                {layerData.implicit_questions && layerData.implicit_questions.length > 0 && (
                  <div className="mb-3">
                    <span className="font-semibold text-sm text-gray-600">隐性层面问题（动机、价值观）：</span>
                    <ul className="list-disc pl-5 mt-1 space-y-2">
                      {layerData.implicit_questions.map((questionItem, qIndex) => {
                        // 检查问题是否为对象格式（包含问题内容和建议回答时长）
                        const isQuestionObject = typeof questionItem === 'object' && questionItem !== null;
                        const questionText = isQuestionObject ? questionItem.question : questionItem;
                        const suggestedDuration = isQuestionObject 
                          ? (questionItem.suggested_duration || questionItem.estimated_answer_time) 
                          : null;
                        
                        return (
                          <li key={qIndex} className="text-gray-700">
                            <div>{questionText}</div>
                            {suggestedDuration && (
                              <div className="text-xs text-teal-600 mt-1 italic flex items-center">
                                <span className="bg-teal-50 px-2 py-0.5 rounded-full">
                                  建议回答时长: {suggestedDuration}
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {/* 评估要点 */}
                {layerData.evaluation_points && layerData.evaluation_points.length > 0 && (
                  <div>
                    <span className="font-semibold text-sm text-gray-600">评估要点：</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {layerData.evaluation_points.map((point, pIndex) => (
                        <span key={pIndex} className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* 处理旧格式数据 */}
            {hasOldFormat && interviewGuide.interview_focus_areas.map((area, index) => (
              <div key={`area-${index}`} className="border-b pb-4 last:border-b-0 last:pb-0">
                <h4 className="text-md font-semibold text-teal-700 mb-2 flex items-center">
                  <CaretRight size={16} weight="bold" className="mr-1" />
                  {area.area}
                </h4>
                
                {/* 显性层面问题 */}
                {area.explicit_questions && area.explicit_questions.length > 0 && (
                  <div className="mb-3">
                    <span className="font-semibold text-sm text-gray-600">显性层面问题（知识、技能）：</span>
                    <ul className="list-disc pl-5 mt-1 space-y-2">
                      {area.explicit_questions.map((questionItem, qIndex) => {
                        // 检查问题是否为对象格式（包含问题内容和建议回答时长）
                        const isQuestionObject = typeof questionItem === 'object' && questionItem !== null;
                        const questionText = isQuestionObject ? questionItem.question : questionItem;
                        const suggestedDuration = isQuestionObject 
                          ? (questionItem.suggested_duration || questionItem.estimated_answer_time) 
                          : null;
                        
                        return (
                          <li key={qIndex} className="text-gray-700">
                            <div>{questionText}</div>
                            {suggestedDuration && (
                              <div className="text-xs text-teal-600 mt-1 italic flex items-center">
                                <span className="bg-teal-50 px-2 py-0.5 rounded-full">
                                  建议回答时长: {suggestedDuration}
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {/* 隐性层面问题 */}
                {area.implicit_questions && area.implicit_questions.length > 0 && (
                  <div className="mb-3">
                    <span className="font-semibold text-sm text-gray-600">隐性层面问题（动机、价值观）：</span>
                    <ul className="list-disc pl-5 mt-1 space-y-2">
                      {area.implicit_questions.map((questionItem, qIndex) => {
                        // 检查问题是否为对象格式（包含问题内容和建议回答时长）
                        const isQuestionObject = typeof questionItem === 'object' && questionItem !== null;
                        const questionText = isQuestionObject ? questionItem.question : questionItem;
                        const suggestedDuration = isQuestionObject 
                          ? (questionItem.suggested_duration || questionItem.estimated_answer_time) 
                          : null;
                        
                        return (
                          <li key={qIndex} className="text-gray-700">
                            <div>{questionText}</div>
                            {suggestedDuration && (
                              <div className="text-xs text-teal-600 mt-1 italic flex items-center">
                                <span className="bg-teal-50 px-2 py-0.5 rounded-full">
                                  建议回答时长: {suggestedDuration}
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {/* 兼容旧版数据结构 */}
                {area.questions && area.questions.length > 0 && (
                  <div className="mb-3">
                    <span className="font-semibold text-sm text-gray-600">建议问题：</span>
                    <ul className="list-disc pl-5 mt-1 space-y-2">
                      {area.questions.map((questionItem, qIndex) => {
                        // 检查问题是否为对象格式（包含问题内容和建议回答时长）
                        const isQuestionObject = typeof questionItem === 'object' && questionItem !== null;
                        const questionText = isQuestionObject ? questionItem.question : questionItem;
                        const suggestedDuration = isQuestionObject 
                          ? (questionItem.suggested_duration || questionItem.estimated_answer_time) 
                          : null;
                        
                        return (
                          <li key={qIndex} className="text-gray-700">
                            <div>{questionText}</div>
                            {suggestedDuration && (
                              <div className="text-xs text-teal-600 mt-1 italic flex items-center">
                                <span className="bg-teal-50 px-2 py-0.5 rounded-full">
                                  建议回答时长: {suggestedDuration}
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {area.evaluation_points && area.evaluation_points.length > 0 && (
                  <div>
                    <span className="font-semibold text-sm text-gray-600">评估要点：</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {area.evaluation_points.map((point, pIndex) => (
                        <span key={pIndex} className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  };
  
  // 渲染潜在顾虑点部分
  const renderPotentialConcerns = () => {
    if (!interviewGuide || !interviewGuide.potential_concerns) return null;
    
    return (
      <Card className="mb-6 shadow-md">
        <CardHeader className="bg-amber-50">
          <div className="flex items-center">
            <Warning size={24} weight="duotone" className="text-amber-500 mr-2" />
            <h3 className="text-lg font-semibold text-amber-700">潜在顾虑点</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {interviewGuide.potential_concerns.map((concern, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                <h4 className="text-md font-semibold text-amber-700 mb-2">{concern.concern}</h4>
                
                {concern.description && (
                  <div className="mb-3 text-gray-700">
                    <p>{concern.description}</p>
                  </div>
                )}
                
                {concern.verification_questions && concern.verification_questions.length > 0 && (
                  <div>
                    <span className="font-semibold text-sm text-gray-600">验证问题：</span>
                    <ul className="list-disc pl-5 mt-1 space-y-2">
                      {concern.verification_questions.map((questionItem, qIndex) => {
                        // 检查问题是否为对象格式
                        const isQuestionObject = typeof questionItem === 'object' && questionItem !== null;
                        const questionText = isQuestionObject ? questionItem.question : questionItem;
                        const suggestedDuration = isQuestionObject 
                          ? (questionItem.suggested_duration || questionItem.estimated_answer_time) 
                          : null;
                        
                        return (
                          <li key={qIndex} className="text-gray-700">
                            <div>{questionText}</div>
                            {suggestedDuration && (
                              <div className="text-xs text-amber-600 mt-1 italic flex items-center">
                                <span className="bg-amber-50 px-2 py-0.5 rounded-full">
                                  建议回答时长: {suggestedDuration}
                                </span>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  };
  
  // 渲染整体面试策略部分
  const renderOverallInterviewStrategy = () => {
    if (!interviewGuide || !interviewGuide.overall_interview_strategy) return null;
    
    const { 
      recommended_interviewers, 
      interview_structure, 
      key_decision_factors, 
      total_questions, 
      total_duration, 
      estimated_interview_duration 
    } = interviewGuide.overall_interview_strategy;
    
    // 确定要显示的时长值
    const displayDuration = estimated_interview_duration || total_duration;
    
    return (
      <Card className="mb-6 shadow-md">
        <CardHeader className="bg-purple-50">
          <div className="flex items-center">
            <Strategy size={24} weight="duotone" className="text-purple-500 mr-2" />
            <h3 className="text-lg font-semibold text-purple-700">整体面试策略</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {/* 问题总数和面试总时长 */}
            <div className="flex flex-wrap gap-4 mb-2">
              {total_questions && (
                <div className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg">
                  <span className="font-semibold">问题总数：</span>{total_questions}
                </div>
              )}
              {displayDuration && (
                <div className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg">
                  <span className="font-semibold">预计面试时长：</span>{displayDuration}
                </div>
              )}
            </div>
            
            {recommended_interviewers && recommended_interviewers.length > 0 && (
              <div>
                <span className="font-semibold">建议面试官：</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {recommended_interviewers.map((interviewer, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      {interviewer}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {interview_structure && interview_structure.length > 0 && (
              <div>
                <span className="font-semibold">面试结构：</span>
                <ol className="list-decimal pl-5 mt-1 space-y-1">
                  {interview_structure.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            
            {key_decision_factors && key_decision_factors.length > 0 && (
              <div>
                <span className="font-semibold">关键决策因素：</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {key_decision_factors.map((factor, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };
  
  // 渲染胜任力模型
  const renderCompetencyModel = () => {
    if (competencyModelLoading) {
      return (
        <div ref={competencyModelRef} className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 transition-all duration-300">
          <div className="flex items-center space-x-2 mb-3">
            <Strategy size={20} className="text-indigo-500" />
            <h3 className="text-lg font-medium">职位胜任力模型生成中...</h3>
          </div>
          <div className="text-gray-600 bg-gray-100 p-3 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto" id="competencyModelProgressContainer">
            {competencyModelProgress}
          </div>
        </div>
      );
    }
    
    if (!competencyModel) return null;
    
    console.log("渲染胜任力模型:", competencyModel);
    
    // 确定胜任力模型数据的结构
    let competencyData = competencyModel;
    
    // 如果数据包含在competency_model字段中，提取出来
    if (competencyModel.competency_model) {
      competencyData = competencyModel.competency_model;
    }
    
    // 确保competencyData是数组
    if (!Array.isArray(competencyData)) {
      competencyData = [competencyData];
    }
    
    return (
      <div ref={competencyModelRef} className="mt-6 mb-6 transition-all duration-300">
        <Card>
          <CardHeader className="bg-indigo-50">
            <div className="flex items-center">
              <Strategy size={20} className="text-indigo-600 mr-2" />
              <h3 className="text-lg font-medium">职位胜任力模型</h3>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-6">
              {/* 渲染各个层级（显性层、中间层、隐性层） */}
              {competencyData.map((layer, index) => (
                <div key={index} className="border-b pb-6 last:border-b-0 last:pb-0">
                  {/* 层级标题和分数 */}
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-indigo-700 text-lg">{layer.name}</h4>
                    {layer.score && (
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                        {layer.score}分
                      </span>
                    )}
                  </div>
                  
                  {/* 层级描述 */}
                  {layer.description && (
                    <p className="text-gray-600 mb-4 text-sm">{layer.description}</p>
                  )}
                  
                  {/* 渲染维度 */}
                  {layer.dimensions && layer.dimensions.length > 0 && (
                    <div className="space-y-4 mt-3">
                      <h5 className="text-md font-medium text-gray-700">能力维度</h5>
                      {layer.dimensions.map((dimension, dimIndex) => (
                        <div key={dimIndex} className="bg-gray-50 p-4 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
                          {/* 维度标题和分数 */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <span className="font-medium text-indigo-700">{dimension.name}</span>
                              {dimension.type && (
                                <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                                  {dimension.type}
                                </span>
                              )}
                              {dimension.importance && (
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                  dimension.importance === "核心" 
                                    ? "bg-red-100 text-red-700" 
                                    : "bg-blue-100 text-blue-700"
                                }`}>
                                  {dimension.importance}
                                </span>
                              )}
                            </div>
                            {dimension.score && (
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                                {dimension.score}分
                              </span>
                            )}
                          </div>
                          
                          {/* 维度描述 */}
                          {dimension.description && (
                            <p className="text-sm text-gray-600 mb-3">{dimension.description}</p>
                          )}
                          
                          {/* 评估方法 */}
                          {dimension.assessment_method && dimension.assessment_method.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs font-medium text-gray-500">评估方法：</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {dimension.assessment_method.map((method, methodIndex) => (
                                  <span key={methodIndex} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
                                    {method}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 行业适应性 */}
                          {dimension.industry_adaptation && (
                            <div className="mt-2">
                              <span className="text-xs font-medium text-gray-500">行业适应性：</span>
                              <span className="text-xs text-gray-600 ml-1">{dimension.industry_adaptation}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* 渲染拆分过程信息（如果有） */}
              {competencyModel.splitting_process && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-700 mb-3">模型构建过程</h4>
                  
                  {competencyModel.splitting_process.analysis && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-600">分析方法：</span>
                      <p className="text-sm text-gray-600 mt-1">{competencyModel.splitting_process.analysis}</p>
                    </div>
                  )}
                  
                  {competencyModel.splitting_process.key_factors && competencyModel.splitting_process.key_factors.length > 0 && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-600">关键因素：</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {competencyModel.splitting_process.key_factors.map((factor, factorIndex) => (
                          <span key={factorIndex} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {competencyModel.splitting_process.industry_insights && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-600">行业洞察：</span>
                      <p className="text-sm text-gray-600 mt-1">{competencyModel.splitting_process.industry_insights}</p>
                    </div>
                  )}
                  
                  {competencyModel.splitting_process.weight_distribution_rationale && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">权重分配理由：</span>
                      <p className="text-sm text-gray-600 mt-1">{competencyModel.splitting_process.weight_distribution_rationale}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  };
  
  // 渲染面试指南结果
  const renderInterviewGuideResult = () => {
    if (!interviewGuide) {
      if (isGenerating) {
        return (
          <div className="flex flex-col items-center justify-center py-10">
            <Spinner size="lg" color="primary" className="mb-4" />
            <p className="text-gray-600 mb-2">正在生成面试指南...</p>
            <div className="w-full max-w-2xl bg-gray-100 p-4 rounded-lg mb-4 max-h-60 overflow-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{generationProgress}</pre>
            </div>
            <Button color="danger" onClick={handleCancelGeneration}>
              取消生成
            </Button>
          </div>
        );
      }
      
      if (error) {
        return (
          <div className="flex flex-col items-center justify-center py-10">
            <XCircle size={48} weight="duotone" className="text-red-500 mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button color="primary" onClick={() => setError(null)}>
              重试
            </Button>
          </div>
        );
      }
      
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <Notepad size={48} weight="duotone" className="text-gray-400 mb-4" />
          <p className="text-gray-500 mb-2">请提供简历和职位描述信息，生成面试指南</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold flex items-center">
            <FileText size={24} className="text-indigo-500 mr-2" />
            面试指南
          </h3>
          <div className="flex space-x-2">
            <Button
              color="success"
              size="md"
              className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-medium"
              leftIcon={<ChatCircleDots size={20} weight="fill" className="animate-pulse" />}
              onClick={() => {
                // 防止重复点击
                if (showAIInterview) return;
                
                // 打印胜任力模型的日志
                console.log("开始AI面试 - interviewGuide:", interviewGuide);
                console.log("开始AI面试 - 胜任力模型:", competencyModel);
                
                // 确保面试指南对象中包含胜任力模型
                if (competencyModel && !interviewGuide.competency_model) {
                  interviewGuide.competency_model = competencyModel;
                  console.log("已添加胜任力模型到interviewGuide对象:", interviewGuide);
                }
                
                setShowAIInterview(true);
              }}
              disabled={showAIInterview}
            >
              开始AI面试
            </Button>
          </div>
        </div>
        
        {renderCandidateSummary()}
        {renderPositionRequirements()}
        {renderInterviewFocusAreas()}
        {renderPotentialConcerns()}
        {renderOverallInterviewStrategy()}
      </div>
    );
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 简历上传/输入 */}
        <Card>
          <CardHeader className="bg-blue-50">
            <div className="flex items-center">
              <User size={20} weight="duotone" className="text-blue-500 mr-2" />
              <h3 className="font-semibold">简历信息</h3>
            </div>
          </CardHeader>
          <CardBody>
            <Tabs aria-label="简历输入选项" size="sm">
              <Tab key="resume-file" title="文件上传">
                <div 
                  className="border-2 border-dashed border-blue-200 rounded-lg p-4 text-center cursor-pointer mt-3 hover:bg-blue-50 transition-colors duration-200 h-[180px] flex flex-col justify-center"
                  onClick={() => resumeFileInputRef.current?.click()}
                >
                  {resumeFile ? (
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded">
                      <div className="flex items-center">
                        <FileText size={24} className="text-blue-500 mr-2" />
                        <div className="text-left">
                          <p className="font-medium truncate max-w-xs">{resumeFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        color="danger"
                        size="sm"
                        isIconOnly
                        className="min-w-0 w-6 h-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResumeFile(null);
                        }}
                      >
                        <X size={14} weight="bold" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="flex justify-center items-center gap-4 mb-2">
                        <FileArrowUp size={36} weight="thin" className="text-blue-400" />
                      </div>
                      <p className="text-gray-500">点击选择简历文件上传</p>
                      <p className="text-xs text-gray-400 mt-1">支持 PDF, DOC, DOCX, TXT 等格式</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.json"
                    onChange={(e) => handleResumeFileUpload(e.target.files)}
                    ref={resumeFileInputRef}
                    className="hidden"
                  />
                </div>
              </Tab>
              <Tab key="resume-text" title="文本输入">
                <div className="mt-3">
                  <Textarea
                    placeholder="请粘贴简历内容..."
                    minRows={8}
                    maxRows={8}
                    className="min-h-[180px]"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
        
        {/* 职位描述上传/输入 */}
        <Card>
          <CardHeader className="bg-indigo-50">
            <div className="flex items-center">
              <Buildings size={20} weight="duotone" className="text-indigo-500 mr-2" />
              <h3 className="font-semibold">职位描述</h3>
            </div>
          </CardHeader>
          <CardBody>
            <Tabs aria-label="职位描述输入选项" size="sm">
              <Tab key="position-file" title="文件上传">
                <div 
                  className="border-2 border-dashed border-indigo-200 rounded-lg p-4 text-center cursor-pointer mt-3 hover:bg-indigo-50 transition-colors duration-200 h-[180px] flex flex-col justify-center"
                  onClick={() => positionFileInputRef.current?.click()}
                >
                  {positionFile ? (
                    <div className="flex items-center justify-between bg-indigo-50 p-3 rounded">
                      <div className="flex items-center">
                        <FileText size={24} className="text-indigo-500 mr-2" />
                        <div className="text-left">
                          <p className="font-medium truncate max-w-xs">{positionFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(positionFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        color="danger"
                        size="sm"
                        isIconOnly
                        className="min-w-0 w-6 h-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPositionFile(null);
                        }}
                      >
                        <X size={14} weight="bold" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="flex justify-center items-center gap-4 mb-2">
                        <FileArrowUp size={36} weight="thin" className="text-indigo-400" />
                      </div>
                      <p className="text-gray-500">点击选择职位描述文件上传</p>
                      <p className="text-xs text-gray-400 mt-1">支持 PDF, DOC, DOCX, TXT 等格式</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.json"
                    onChange={(e) => handlePositionFileUpload(e.target.files)}
                    ref={positionFileInputRef}
                    className="hidden"
                  />
                </div>
              </Tab>
              <Tab key="position-text" title="文本输入">
                <div className="mt-3">
                  <Textarea
                    placeholder="请粘贴职位描述内容..."
                    minRows={8}
                    maxRows={8}
                    className="min-h-[180px]"
                    value={positionText}
                    onChange={(e) => setPositionText(e.target.value)}
                  />
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
      
      {/* 面试问题数量选择 */}
      <Card className="mb-6">
        <CardHeader className="bg-green-50">
          <div className="flex items-center">
            <ListChecks size={20} weight="duotone" className="text-green-500 mr-2" />
            <h3 className="font-semibold">面试设置</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col space-y-2">
            <p className="text-sm text-gray-600 mb-2">请选择面试问题数量和时长：</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  interviewQuestionLevel === "simple" 
                    ? "border-green-500 bg-green-50 shadow-md" 
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
                onClick={() => setInterviewQuestionLevel("simple")}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">简单</h4>
                  <div className={`w-4 h-4 rounded-full border ${
                    interviewQuestionLevel === "simple" 
                      ? "border-green-500 bg-green-500" 
                      : "border-gray-300"
                  }`}>
                    {interviewQuestionLevel === "simple" && (
                      <div className="w-2 h-2 bg-white rounded-full m-auto mt-1"></div>
                    )}
                  </div>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 约5个问题</li>
                  <li>• 面试时长约15分钟</li>
                </ul>
              </div>
              
              <div 
                className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  interviewQuestionLevel === "balanced" 
                    ? "border-green-500 bg-green-50 shadow-md" 
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
                onClick={() => setInterviewQuestionLevel("balanced")}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">平衡</h4>
                  <div className={`w-4 h-4 rounded-full border ${
                    interviewQuestionLevel === "balanced" 
                      ? "border-green-500 bg-green-500" 
                      : "border-gray-300"
                  }`}>
                    {interviewQuestionLevel === "balanced" && (
                      <div className="w-2 h-2 bg-white rounded-full m-auto mt-1"></div>
                    )}
                  </div>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 约10个问题</li>
                  <li>• 面试时长约30分钟</li>
                </ul>
              </div>
              
              <div 
                className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  interviewQuestionLevel === "deep" 
                    ? "border-green-500 bg-green-50 shadow-md" 
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
                onClick={() => setInterviewQuestionLevel("deep")}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">深度</h4>
                  <div className={`w-4 h-4 rounded-full border ${
                    interviewQuestionLevel === "deep" 
                      ? "border-green-500 bg-green-500" 
                      : "border-gray-300"
                  }`}>
                    {interviewQuestionLevel === "deep" && (
                      <div className="w-2 h-2 bg-white rounded-full m-auto mt-1"></div>
                    )}
                  </div>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 约20个问题</li>
                  <li>• 面试时长约1小时</li>
                </ul>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {!isGenerating && (
        <div className="flex justify-center mt-6 mb-8 space-x-4">
          <Button 
            color="primary" 
            size="lg" 
            onClick={handleGenerateGuide}
            leftIcon={<Notepad size={20} />}
            disabled={(!resumeFile && !resumeText) || (!positionFile && !positionText)}
          >
            {interviewGuide ? "重新生成面试指南" : "生成面试指南"}
          </Button>
          
          {interviewGuide && (
            <Button
              color="success"
              size="lg"
              className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-medium"
              leftIcon={<ChatCircleDots size={20} weight="fill" className="animate-pulse" />}
              onClick={() => {
                if (showAIInterview) return;
                
                // 打印胜任力模型的日志
                console.log("开始AI面试 - interviewGuide:", interviewGuide);
                console.log("开始AI面试 - 胜任力模型:", competencyModel);
                
                // 确保面试指南对象中包含胜任力模型
                if (competencyModel && !interviewGuide.competency_model) {
                  interviewGuide.competency_model = competencyModel;
                  console.log("已添加胜任力模型到interviewGuide对象:", interviewGuide);
                }
                
                setShowAIInterview(true);
              }}
              disabled={showAIInterview || !interviewGuide}
            >
              开始AI面试
            </Button>
          )}
        </div>
      )}
      
      <Divider className="my-6" />
      
      {/* 面试指南结果展示区域 */}
      {isGenerating ? (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium">生成进度</h3>
            <Button 
              variant="outline" 
              color="danger" 
              size="sm"
              onClick={handleCancelGeneration}
              className="flex items-center space-x-1"
            >
              <X size={16} />
              <span>取消生成</span>
            </Button>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
            {generationProgress}
            <div ref={generationProgressRef} className="h-1"></div>
          </div>
          
          {/* 显示胜任力模型加载状态 - 仅在用户没有提供胜任力模型时显示 */}
          {competencyModelLoading && !competencyModelInput.trim() && renderCompetencyModel()}
        </div>
      ) : (
        <>
          {error ? (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          ) : (
            <>
              {/* 显示胜任力模型 */}
              {competencyModel && renderCompetencyModel()}
              
              {/* 显示面试指南结果 */}
              {interviewGuide && renderInterviewGuideResult()}
            </>
          )}
        </>
      )}
      
      {/* AI面试弹窗 */}
      <Modal 
        isOpen={showAIInterview} 
        onClose={() => setShowAIInterview(false)}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center">
                  <ChatCircleDots size={20} className="mr-2 text-indigo-500" />
                  <span className="font-medium">AI面试</span>
                </div>
              </ModalHeader>
              <ModalBody className="h-[600px] p-0 overflow-hidden">
                {interviewGuide && (
                  <AIInterview 
                    interviewGuide={interviewGuide} 
                    onClose={onClose} 
                  />
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default InterviewGuide;
