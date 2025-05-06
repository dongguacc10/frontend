import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Divider,
  addToast,
  Select,
  SelectItem
} from '@heroui/react';
import { Play, Pause, X, SpeakerHigh, CloudArrowUp, Download } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import textToSpeechService from '../services/text_to_speech_service';

const TextToSpeech = () => {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState([]);
  const [emotions, setEmotions] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('male-qn-qingse');
  const [selectedEmotion, setSelectedEmotion] = useState('neutral');
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [history, setHistory] = useState([]);
  const [maxHistoryItems] = useState(10);
  const [useTimberWeights, setUseTimberWeights] = useState(false);
  const [selectedTimberPreset, setSelectedTimberPreset] = useState('');
  const [timberPresets, setTimberPresets] = useState([]);
  const [useStreamMode, setUseStreamMode] = useState(false);
  const [uploadToOss, setUploadToOss] = useState(true);

  // 获取可用的声音、情感和混合音色预设列表
  useEffect(() => {
    const fetchVoicesAndEmotions = async () => {
      try {
        const voicesData = await textToSpeechService.getAvailableVoices();
        const emotionsData = await textToSpeechService.getAvailableEmotions();
        const timberPresetsData = await textToSpeechService.getTimberPresets();
        
        setVoices(voicesData);
        setEmotions(emotionsData);
        setTimberPresets(timberPresetsData);
        if (timberPresetsData.length > 0) {
          setSelectedTimberPreset(timberPresetsData[0].id);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        addToast({
          title: '获取数据失败',
          description: '无法获取可用的声音、情感和混合音色列表',
          status: 'error',
          duration: 3000,
          isclosable: "true",
          shouldshowtimeoutprogess: "true"
        });
      }
    };

    fetchVoicesAndEmotions();
  }, []);

  // 处理音频播放状态变化
  useEffect(() => {
    if (audioPlayer) {
      const handleEnded = () => setIsPlaying(false);
      audioPlayer.addEventListener('ended', handleEnded);
      
      return () => {
        audioPlayer.removeEventListener('ended', handleEnded);
        audioPlayer.pause();
      };
    }
  }, [audioPlayer]);

  // 合成语音
  const handleSynthesis = async () => {
    if (!text.trim()) {
      addToast({
        title: '请输入文本',
        description: '请输入要转换为语音的文本内容',
        status: 'warning',
        duration: 3000,
        isclosable: "true",
        shouldshowtimeoutprogess: "true"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 构建合成参数
      const synthesisParams = {
        text: text,
        speed: speed,
        vol: volume,
        pitch: pitch,
        emotion: selectedEmotion,
        uploadToOss: !useStreamMode && uploadToOss // 流式模式不上传OSS，非流式模式根据用户选择决定
      };

      // 根据选择的模式设置音色参数
      if (useTimberWeights) {
        // 使用混合音色
        const selectedPreset = timberPresets.find(preset => preset.id === selectedTimberPreset);
        if (selectedPreset) {
          synthesisParams.timberWeights = selectedPreset.weights;
        }
      } else {
        // 使用单一音色
        synthesisParams.voiceId = selectedVoice;
      }
      
      let result;
      
      if (useStreamMode) {
        // 流式合成
        try {
          // 使用简化的流式合成方法，直接返回音频URL
          const audioUrl = await textToSpeechService.synthesizeSpeechStream(synthesisParams);
          console.log('获取到音频URL:', audioUrl);
          
          // 保存到状态中，用于UI显示
          setAudioUrl(audioUrl);
          
          // 创建音频元素并播放
          const audioElement = new Audio(audioUrl);
          
          // 监听错误事件
          audioElement.onerror = (e) => {
            console.error('音频播放错误:', e);
            addToast({
              title: '音频播放失败',
              description: '无法播放音频，请重试',
              status: 'error',
              duration: 3000,
              isclosable: "true",
              shouldshowtimeoutprogess: "true"
            });
          };
          
          // 监听加载事件
          audioElement.onloadeddata = () => {
            console.log('音频数据已加载，准备播放');
            audioElement.play().catch(e => console.error('播放失败:', e));
          };
          
          // 添加到历史记录
          const newHistoryItem = {
            id: Date.now(),
            text: text.length > 50 ? `${text.substring(0, 50)}...` : text,
            fullText: text,
            url: audioUrl,
            voice: useTimberWeights ? selectedTimberPreset : selectedVoice,
            voiceName: useTimberWeights 
              ? timberPresets.find(p => p.id === selectedTimberPreset)?.name || selectedTimberPreset
              : voices.find(v => v.id === selectedVoice)?.name || selectedVoice,
            emotion: selectedEmotion,
            emotionName: emotions.find(e => e.id === selectedEmotion)?.name || selectedEmotion,
            duration: 0, // 流式模式无法获取准确时长
            isTimberPreset: useTimberWeights,
            isStream: true,
            audioElement: audioElement // 保存Audio元素，便于控制播放
          };
          
          setHistory(prev => {
            const newHistory = [newHistoryItem, ...prev].slice(0, maxHistoryItems);
            return newHistory;
          });
          
          result = { success: true };
        } catch (error) {
          console.error('流式语音合成失败:', error);
          addToast({
            title: '语音合成失败',
            description: error.message || '请重试',
            status: 'error',
            duration: 3000,
            isclosable: "true",
            shouldshowtimeoutprogess: "true"
          });
          result = { success: false, error: error.message };
        }
      } else {
        // 非流式合成
        result = await textToSpeechService.synthesizeSpeech(synthesisParams);
        
        if (result.success && result.url) {
          setAudioUrl(result.url);
          
          // 添加到历史记录
          const newHistoryItem = {
            id: Date.now(),
            text: text.length > 50 ? `${text.substring(0, 50)}...` : text,
            fullText: text,
            url: result.url,
            voice: useTimberWeights ? selectedTimberPreset : selectedVoice,
            voiceName: useTimberWeights 
              ? timberPresets.find(p => p.id === selectedTimberPreset)?.name || selectedTimberPreset
              : voices.find(v => v.id === selectedVoice)?.name || selectedVoice,
            emotion: selectedEmotion,
            emotionName: emotions.find(e => e.id === selectedEmotion)?.name || selectedEmotion,
            duration: result.duration || 0,
            isTimberPreset: useTimberWeights,
            isStream: false
          };
          
          setHistory(prev => {
            const newHistory = [newHistoryItem, ...prev].slice(0, maxHistoryItems);
            return newHistory;
          });
          
          // 自动播放
          playAudio(result.url);
        } else {
          throw new Error(result.error || '语音合成失败');
        }
      }
      
      addToast({
        title: '语音合成成功',
        description: '语音已生成并准备播放',
        status: 'success',
        duration: 3000,
        isclosable: "true",
        shouldshowtimeoutprogess: "true"
      });
    } catch (error) {
      console.error('语音合成失败:', error);
      addToast({
        title: '语音合成失败',
        description: error.message || '无法合成语音，请稍后再试',
        status: 'error',
        duration: 3000,
        isclosable: "true",
        shouldshowtimeoutprogess: "true"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 播放音频
  const playAudio = (url) => {
    if (audioPlayer) {
      audioPlayer.pause();
    }
    
    const audio = new Audio(url);
    audio.play();
    setAudioPlayer(audio);
    setIsPlaying(true);
  };

  // 暂停音频
  const pauseAudio = () => {
    if (audioPlayer) {
      audioPlayer.pause();
      setIsPlaying(false);
    }
  };

  // 播放历史记录中的音频
  const playHistoryItem = (url) => {
    playAudio(url);
  };

  // 从历史记录中删除项目
  const removeHistoryItem = (id) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // 从历史记录中加载文本
  const loadTextFromHistory = (item) => {
    setText(item.fullText);
    if (item.voice && timberPresets.some(preset => preset.id === item.voice)) {
      setUseTimberWeights(true);
      setSelectedTimberPreset(item.voice);
    } else {
      setUseTimberWeights(false);
      setSelectedVoice(item.voice);
    }
    setSelectedEmotion(item.emotion);
  };

  // 处理声音选择变化
  const handleVoiceChange = (key) => {
    setSelectedVoice(key);
  };

  // 处理情感选择变化
  const handleEmotionChange = (key) => {
    setSelectedEmotion(key);
  };

  // 处理音调变化
  const handlePitchChange = (e) => {
    // 确保pitch是整数
    setPitch(Math.round(parseFloat(e.target.value)));
  };

  // 处理混合音色预设变化
  const handleTimberPresetChange = (key) => {
    setSelectedTimberPreset(key);
  };

  // 切换音色模式
  const toggleTimberMode = () => {
    setUseTimberWeights(!useTimberWeights);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <SpeakerHigh size={24} weight="duotone" className="text-primary-500 mr-2" />
              <h3 className="text-lg font-medium">文本转语音</h3>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">输入文本</label>
                <Textarea
                  placeholder="请输入要转换为语音的文本内容..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  resize="vertical"
                />
              </div>
              
              <div className="flex items-center mb-2">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={useTimberWeights}
                    onChange={toggleTimberMode}
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  <span className="ml-3 text-sm font-medium">
                    {useTimberWeights ? '使用混合音色' : '使用标准音色'}
                  </span>
                </label>
              </div>
              
              <div className="flex items-center mb-4">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={useStreamMode}
                    onChange={() => setUseStreamMode(!useStreamMode)}
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  <span className="ml-3 text-sm font-medium">
                    {useStreamMode ? '使用流式合成（更快）' : '使用标准合成（上传OSS）'}
                  </span>
                </label>
              </div>
              
              <div className="flex items-center mb-4">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={uploadToOss}
                    onChange={() => setUploadToOss(!uploadToOss)}
                  />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  <span className="ml-3 text-sm font-medium">
                    {uploadToOss ? '上传到OSS' : '不上传到OSS'}
                  </span>
                </label>
              </div>
              
              <div className="flex space-x-4">
                <div className="flex-1">
                  {useTimberWeights ? (
                    <>
                      <label className="block text-sm font-medium mb-1" id="timber-preset-label">选择混合音色</label>
                      <Select 
                        aria-labelledby="timber-preset-label"
                        selectedKeys={[selectedTimberPreset]}
                        onSelectionChange={(keys) => handleTimberPresetChange(Array.from(keys)[0])}
                        className="w-full"
                      >
                        {timberPresets.map((preset) => (
                          <SelectItem key={preset.id} textValue={preset.name}>
                            <div>
                              <p className="text-sm">{preset.name}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </Select>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium mb-1" id="voice-label">选择声音</label>
                      <Select 
                        aria-labelledby="voice-label"
                        selectedKeys={[selectedVoice]}
                        onSelectionChange={(keys) => handleVoiceChange(Array.from(keys)[0])}
                        className="w-full"
                      >
                        {voices.map((voice) => (
                          <SelectItem key={voice.id} textValue={`${voice.name} - ${voice.description}`}>
                            <div>
                              <p className="text-sm">{voice.name}</p>
                              <p className="text-xs text-gray-500">{voice.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </Select>
                    </>
                  )}
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1" id="emotion-label">选择情感</label>
                  <Select 
                    aria-labelledby="emotion-label"
                    selectedKeys={[selectedEmotion]}
                    onSelectionChange={(keys) => handleEmotionChange(Array.from(keys)[0])}
                    className="w-full"
                  >
                    {emotions.map((emotion) => (
                      <SelectItem key={emotion.id} textValue={`${emotion.name} - ${emotion.description}`}>
                        <div>
                          <p className="text-sm">{emotion.name}</p>
                          <p className="text-xs text-gray-500">{emotion.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">语速: {speed.toFixed(1)}</label>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">音量: {volume.toFixed(1)}</label>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">音调: {pitch}</label>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={pitch}
                      onChange={handlePitchChange}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-4 mt-2">
                <Button
                  colorScheme="primary"
                  leftIcon={<CloudArrowUp size={20} />}
                  onClick={handleSynthesis}
                  isLoading={isLoading}
                  loadingText="合成中..."
                  className="flex-1"
                >
                  生成语音
                </Button>
                
                {audioUrl && (
                  <Button
                    colorScheme={isPlaying ? "red" : "green"}
                    leftIcon={isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    onClick={isPlaying ? pauseAudio : () => playAudio(audioUrl)}
                    className="flex-1"
                  >
                    {isPlaying ? "暂停" : "播放"}
                  </Button>
                )}
                
                {audioUrl && (
                  <Button
                    colorScheme="blue"
                    leftIcon={<Download size={20} />}
                    as="a"
                    href={audioUrl}
                    target="_blank"
                    download
                    className="flex-1"
                  >
                    下载
                  </Button>
                )}
              </div>
            </div>
            
            {history.length > 0 && (
              <div className="mt-8">
                <Divider className="mb-4" />
                <h4 className="text-md font-medium mb-4">历史记录</h4>
                
                <div className="flex flex-col space-y-2">
                  {history.map(item => (
                    <Card key={item.id} variant="outline" size="sm">
                      <CardBody className="p-3">
                        <div className="flex items-center">
                          <div className="flex flex-col space-y-1 flex-1">
                            <p className="text-sm truncate">{item.text}</p>
                            <div className="flex items-center space-x-2">
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                {item.voiceName}
                              </span>
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                {item.emotionName}
                              </span>
                              <span className="text-xs text-gray-500">{item.duration.toFixed(1)}秒</span>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              className="p-1 rounded-full hover:bg-gray-100 text-green-600"
                              onClick={() => playHistoryItem(item.url)}
                              title="播放"
                            >
                              <Play size={16} />
                            </button>
                            <a
                              className="p-1 rounded-full hover:bg-gray-100 text-blue-600"
                              href={item.url}
                              target="_blank"
                              download
                              title="下载"
                              rel="noreferrer"
                            >
                              <Download size={16} />
                            </a>
                            <button
                              className="p-1 rounded-full hover:bg-gray-100 text-red-600"
                              onClick={() => removeHistoryItem(item.id)}
                              title="删除"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
};

export default TextToSpeech;
