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
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  useDisclosure,
  addToast
} from "@heroui/react";
import { motion } from "framer-motion";
import ReactECharts from 'echarts-for-react';
import { 
  Scales,
  MagnifyingGlass, 
  Sparkle, 
  Robot,
  ChartPie,
  Compass,
  VideoCamera,
  Calculator,
  CheckSquare,
  WarningCircle,
  CircleWavyCheck,
  XCircle,
  X,
  FileText,
  Rocket,
  FileDoc,
  Brain,
  Notepad,
  Buildings,
  SpeakerHigh,
  Microphone
} from "@phosphor-icons/react";
import LetterGlitchBackground from "./LetterGlitchBackground";
import CareerAssistant from "./CareerAssistant";
import FileParser from "./FileParser";
import ResumeParser from "./ResumeParser";
import ResumeChatAssistant from "./ResumeChatAssistant";
import JobCompetency from "./JobCompetency";
import AIJobMatch from "./AIJobMatch";
import InterviewGuide from "./InterviewGuide";
import ResumeOptimizer from "./ResumeOptimizer";
import TextToSpeech from "./TextToSpeech";
import SpeechRecognition from "./SpeechRecognition";
import { resumeService, careerService, fileService, resumeChatService } from "../services"; 

// 工具列表数据
const tools = [
  {
    id: 3,
    name: '文件解析工具',
    title: '文件解析工具',
    description: '上传文件，智能解析为文本内容，支持多种格式',
    icon: <FileText size={32} weight="duotone" />,
    status: 'active',
    color: 'info',
    available: true
  },
  {
    id: 4,
    name: 'AI简历解析PRO',
    title: 'AI简历解析PRO',
    description: '智能提取简历信息，快速生成结构化数据',
    icon: <MagnifyingGlass size={32} weight="duotone" />,
    status: 'active',
    color: 'warning',
    available: true
  },
  {
    id: 11,
    name: '简历生成助手（校园版）',
    title: '简历生成助手（校园版）',
    description: '通过对话方式引导创建专业简历，提供格式化输出',
    icon: <FileDoc size={32} weight="duotone" />,
    status: 'active',
    color: 'blue',  
    available: true
  },
  {
    id: 5,
    name: 'AI简历优化（校园版）',
    title: 'AI简历优化（校园版）',
    description: '基于职位需求智能优化简历内容',
    icon: <Sparkle size={32} weight="duotone" />,
    status: 'active',
    color: 'warning',
    available: true
  },
  {
    id: 12,
    name: '职位胜任力模型',
    title: '职位胜任力模型',
    description: '解析职位描述，生成结构化胜任力模型和能力维度',
    icon: <Brain size={32} weight="duotone" />,
    status: 'active',
    color: 'teal',
    available: true
  },
  {
    id: 1,
    name: 'AI人岗匹配',
    title: 'AI人岗匹配',
    description: '智能分析职位要求与人才特征的匹配程度',
    icon: <Scales size={32} weight="duotone" />,
    status: 'active',
    color: 'primary',
    available: true
  },
  {
    id: 13,
    name: 'AI面试',
    title: 'AI面试',
    description: '根据简历和职位描述，生成结构化面试指南，完成拟人化的面试，理性评估面试结果',
    icon: <Notepad size={32} weight="duotone" />,
    status: 'active',
    color: 'indigo',
    available: true
  },
  {
    id: 14,
    name: 'AI面试公务员版',
    title: 'AI面试公务员版',
    description: '专为公务员考试设计的面试模拟，基于行政能力和公共服务理念，提供结构化面试体验',
    icon: <Buildings size={32} weight="duotone" />,
    status: 'coming',
    color: 'cyan',
    available: false
  },
  {
    id: 15,
    name: 'MBTI人格测试AI版',
    title: 'MBTI人格测试AI版',
    description: 'AI驱动的MBTI人格测试，提供深度分析和职业匹配建议',
    icon: <VideoCamera size={32} weight="duotone" />,
    status: 'coming',
    color: 'purple',
    available: false
  },
  {
    id: 6,
    name: '人才画像分析',
    title: '人才画像分析',
    description: '基于多维数据构建全面人才画像，发掘潜在价值',
    icon: <ChartPie size={32} weight="duotone" />,
    status: 'coming',
    color: 'danger',
    available: false
  },
  {
    id: 7,
    name: 'AI职业规划咨询',
    title: 'AI职业规划咨询',
    description: 'AI推荐个性化职业发展路径，助力职业生涯规划',
    icon: <Compass size={32} weight="duotone" />,
    status: 'coming',
    color: 'primary',
    available: false
  },
  {
    id: 2,
    name: '就业服务助手',
    title: '就业服务助手',
    description: 'AI智能问答，解决就业过程中的各类问题',
    icon: <Robot size={32} weight="duotone" />,
    status: 'active',
    color: 'success',
    available: true
  },
  {
    id: 16,
    name: '文本转语音',
    title: '文本转语音',
    description: '将文本内容转换为自然流畅的语音，支持多种声音和情感',
    icon: <SpeakerHigh size={32} weight="duotone" />,
    status: 'active',
    color: 'cyan',
    available: true
  },
  {
    id: 17,
    name: '语音识别',
    title: '语音识别',
    description: '将语音内容转换为文本，支持文件上传和实时录音识别',
    icon: <Microphone size={32} weight="duotone" />,
    status: 'active',
    color: 'orange',
    available: true
  },
];

const HRToolsPage = () => {
  // 工具抽屉状态
  const [isCareerAssistantOpen, setIsCareerAssistantOpen] = useState(false);
  const [isFileParserOpen, setIsFileParserOpen] = useState(false);
  const [isResumeParserOpen, setIsResumeParserOpen] = useState(false);
  const [isResumeChatAssistantOpen, setIsResumeChatAssistantOpen] = useState(false);
  const [isResumeOptimizerOpen, setIsResumeOptimizerOpen] = useState(false);
  const [isJobCompetencyOpen, setIsJobCompetencyOpen] = useState(false);
  const [isAIJobMatchOpen, setIsAIJobMatchOpen] = useState(false);
  const [isAIInterviewGuideOpen, setIsAIInterviewGuideOpen] = useState(false);
  const [isTTSOpen, setIsTTSOpen] = useState(false);
  const [isSpeechRecognitionOpen, setIsSpeechRecognitionOpen] = useState(false);

  // 处理工具点击
  const handleToolClick = (tool) => {
    console.log('点击工具:', tool.name);
    
    if (!tool.available) {
      addToast({
        title: "即将推出",
        description: `${tool.name}功能正在开发中，敬请期待！`,
        status: "info",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    // 根据工具ID打开对应的抽屉
    switch (tool.id) {
      case 1: // AI人岗匹配
        setIsAIJobMatchOpen(true);
        break;
      case 3: // 文件解析工具
        setIsFileParserOpen(true);
        break;
      case 4: // AI简历解析PRO
        setIsResumeParserOpen(true);
        break;
      case 5: // AI简历优化（校园版）
        setIsResumeOptimizerOpen(true);
        break;
      case 11: // 简历生成助手（校园版）
        setIsResumeChatAssistantOpen(true);
        break;
      case 12: // 职位胜任力模型
        setIsJobCompetencyOpen(true);
        break;
      case 13: // AI面试
        setIsAIInterviewGuideOpen(true);
        break;
      case 7: // 就业服务助手
        setIsCareerAssistantOpen(true);
        break;
      case 16: // 文本转语音
        setIsTTSOpen(true);
        break;
      case 17: // 语音识别
        setIsSpeechRecognitionOpen(true);
        break;
      default:
        addToast({
          title: "功能开发中",
          description: `${tool.name}功能正在开发中，敬请期待！`,
          status: "info",
          shouldshowtimeoutprogess: "true"
        });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-x-hidden w-full flex flex-col">
      {/* 字母故障效果背景 */}
      <LetterGlitchBackground />
      
      {/* 内容容器 */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 flex-grow flex flex-col">
        {/* 顶部区域 - 公司信息 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <img
              src={process.env.PUBLIC_URL + '/logo.png'}
              alt="三顾云 Logo"
              className="h-12 w-auto"
            />
            <h2 className="ml-4 text-2xl font-bold">三顾云科技</h2>
          </div>
        </div>
        
        {/* 标题区域 */}
        <div className="text-center mb-16">
          <motion.h1 
            className="text-5xl font-bold mb-4 leading-relaxed bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="font-orbitron tracking-wide">HR AI Agent</span>{" "}
            <span className="font-noto-sc font-medium">智能助手</span>
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-300 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <span className="font-montserrat tracking-wider uppercase text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400/60 to-purple-400/60">Revolutionize HR Management with AI</span>
            <br />
            <span className="font-montserrat tracking-wide text-base text-gray-400">Boost Efficiency, Unlock Talent Potential</span>
          </motion.p>
        </div>
        
        {/* 工具卡片区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={tool.id}
              className="bg-gray-800 bg-opacity-70 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-blue-500/50 hover:scale-[1.02] flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="p-6 flex-grow">
                <div className="flex items-center justify-center mb-4 w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                  {tool.icon}
                </div>
                <h3 className="text-xl font-bold text-center mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">{tool.title}</h3>
                <p className="text-gray-300 text-sm text-center">{tool.description}</p>
              </div>
              <div className="p-4 border-t border-gray-700">
                {tool.available ? (
                  <Button
                    color="primary"
                    className="w-full py-2 rounded-lg font-medium transition-all duration-300 hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20"
                    onClick={() => handleToolClick(tool)}
                  >
                    立即使用
                  </Button>
                ) : (
                  <Button
                    color="secondary"
                    className="w-full py-2 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 transition-all duration-300"
                    disabled
                  >
                    即将推出
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 底部信息 */}
        <div className="mt-auto pt-16 text-center text-sm pb-4 space-y-2">
          <motion.p
            className="text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <span className="font-noto-sc">算力支持</span>{" "}
            <span className="font-montserrat tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-blue-400/60 to-purple-400/60">火山引擎 阿里百炼</span>
          </motion.p>
          <p className="text-gray-500">&copy; 2025 三顾云科技 版权所有</p>
          <p className="text-gray-500 text-xs space-x-2">
            <a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
              蜀ICP备2021007700号
            </a>
            <span>|</span>
            <span>川公网安备 1t1000002002053号</span>
            <span>|</span>
            <span>电子公告服务规则</span>
          </p>
        </div>
      </div>

      {/* 就业服务助手抽屉 */}
      <Drawer isOpen={isCareerAssistantOpen} onClose={() => setIsCareerAssistantOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <Robot size={24} weight="duotone" className="text-primary-500 mr-2" />
              <span className="font-semibold text-lg">就业服务助手</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-0 h-[80vh]">
            <CareerAssistant />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* 文件解析工具抽屉 */}
      <Drawer isOpen={isFileParserOpen} onClose={() => setIsFileParserOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <FileText size={24} weight="duotone" className="text-info-500 mr-2" />
              <span className="font-semibold text-lg">文件解析工具</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-4 h-[80vh] overflow-auto">
            <FileParser />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* 简历解析工具抽屉 */}
      <Drawer isOpen={isResumeParserOpen} onClose={() => setIsResumeParserOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <MagnifyingGlass size={24} weight="duotone" className="text-warning-500 mr-2" />
              <span className="font-semibold text-lg">AI简历解析</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-4 h-[80vh] overflow-auto">
            <ResumeParser />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* 简历生成助手抽屉 */}
      <Drawer isOpen={isResumeChatAssistantOpen} onClose={() => setIsResumeChatAssistantOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <FileDoc size={24} weight="duotone" className="text-blue-500 mr-2" />
              <span className="font-semibold text-lg">简历生成助手（校园版）</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-0 h-[80vh]">
            <ResumeChatAssistant />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* 简历优化抽屉 */}
      <Drawer isOpen={isResumeOptimizerOpen} onClose={() => setIsResumeOptimizerOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <Sparkle size={24} weight="duotone" className="text-warning-500 mr-2" />
              <span className="font-semibold text-lg">AI简历优化（校园版）</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-4 h-[80vh] overflow-auto">
            <ResumeOptimizer />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* 职位胜任力模型抽屉 */}
      <Drawer isOpen={isJobCompetencyOpen} onClose={() => setIsJobCompetencyOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <Brain size={24} weight="duotone" className="text-teal-500 mr-2" />
              <span className="font-semibold text-lg">职位胜任力模型</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-4 h-[80vh] overflow-auto">
            <JobCompetency />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* AI人岗测评抽屉 */}
      <Drawer isOpen={isAIJobMatchOpen} onClose={() => setIsAIJobMatchOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <Scales size={24} weight="duotone" className="text-primary-500 mr-2" />
              <span className="font-semibold text-lg">AI人岗匹配度</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-0 h-[80vh] overflow-auto">
            <AIJobMatch />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* AI面试指南抽屉 */}
      <Drawer isOpen={isAIInterviewGuideOpen} onClose={() => setIsAIInterviewGuideOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex flex-col">
              <div className="flex items-center">
                <Notepad size={24} weight="duotone" className="text-indigo-500 mr-2" />
                <span className="font-semibold text-lg">AI面试</span>
              </div>
              <p className="text-sm text-gray-600 mt-1 ml-7">面试理论框架：冰山模型与胜任力模型分层：冰山模型将胜任力分为显性（知识、技能）和隐性（动机、价值观、自我认知）</p>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-4 h-[80vh] overflow-auto">
            <InterviewGuide />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* 文本转语音抽屉 */}
      <Drawer isOpen={isTTSOpen} onClose={() => setIsTTSOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <SpeakerHigh size={24} weight="duotone" className="text-cyan-500 mr-2" />
              <span className="font-semibold text-lg">文本转语音</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-4 h-[80vh] overflow-auto">
            <TextToSpeech />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* 语音识别抽屉 */}
      <Drawer isOpen={isSpeechRecognitionOpen} onClose={() => setIsSpeechRecognitionOpen(false)} size="xl">
        <DrawerContent className="bg-white">
          <DrawerHeader className="border-b">
            <div className="flex items-center">
              <Microphone size={24} weight="duotone" className="text-orange-500 mr-2" />
              <span className="font-semibold text-lg">语音识别</span>
            </div>
          </DrawerHeader>
          <DrawerBody className="p-4 h-[80vh] overflow-auto">
            <SpeechRecognition />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default HRToolsPage;
