import React, { useEffect, useRef } from 'react';

const LetterGlitchBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // 设置canvas尺寸为窗口大小
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // 字符集
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    
    // 列数
    const fontSize = 14;
    const columns = Math.ceil(canvas.width / fontSize);
    
    // 每列的当前位置
    const drops = Array(columns).fill(1);
    
    // 绘制函数
    const draw = () => {
      // 半透明黑色背景，形成拖尾效果
      ctx.fillStyle = 'rgba(10, 15, 30, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 设置文字颜色和字体
      ctx.fillStyle = '#3b82f6';
      ctx.font = `${fontSize}px monospace`;
      
      // 绘制字符
      for (let i = 0; i < drops.length; i++) {
        // 随机字符
        const char = chars[Math.floor(Math.random() * chars.length)];
        
        // 绘制字符
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        
        // 随机重置一些列到顶部
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        
        // 移动到下一个位置
        drops[i]++;
      }
      
      // 故障效果 - 随机绘制一些不同颜色的字符
      if (Math.random() > 0.95) {
        ctx.fillStyle = '#8b5cf6';
        for (let i = 0; i < 20; i++) {
          const x = Math.floor(Math.random() * columns) * fontSize;
          const y = Math.floor(Math.random() * drops.length) * fontSize;
          const char = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(char, x, y);
        }
      }
      
      // 循环动画
      animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();
    
    // 清理
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 bg-gray-900"
      style={{ filter: 'blur(1px)' }}
    />
  );
};

export default LetterGlitchBackground;
