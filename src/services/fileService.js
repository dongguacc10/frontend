/**
 * 文件解析服务
 * 提供与文件解析相关的功能服务
 */
import api from './api';

/**
 * 文件解析服务
 */
const fileService = {
  /**
   * 上传文件并解析为文本
   * @param {File} file - 要上传的文件对象
   * @returns {Promise<{file_id: string, filename: string, content: string, status: string, message: string}>} - 文件解析结果
   */
  parseFile: async (file) => {
    try {
      console.log('开始上传文件解析:', file.name);
      
      // 参数验证
      if (!file) {
        console.error('错误: 未提供文件');
        throw new Error('未提供文件');
      }
      
      // 文件大小验证 (100MB = 104,857,600 字节)
      if (file.size > 104857600) {
        console.error('错误: 文件过大', file.size);
        throw new Error('文件大小超过100MB限制');
      }
      
      // 文件格式验证
      const fileExtension = file.name.split('.').pop().toLowerCase();
      console.log('文件扩展名:', fileExtension);
      
      // 调用API上传文件
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await api.parseFile(formData);
      console.log('文件解析结果:', result);
      
      return result;
    } catch (error) {
      console.error('文件解析服务错误:', error);
      throw error;
    }
  }
};

export default fileService;
