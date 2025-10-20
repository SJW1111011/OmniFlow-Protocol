const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const smartAccountRoutes = require('./routes/smartAccount');
const authRoutes = require('./routes/auth');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// AI服务代理路由
app.post('/api/ai/chat', async (req, res) => {
  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable'
        },
        timeout: 30000
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('AI Service Proxy Error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message || '服务暂时不可用'
    });
  }
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/smart-account', smartAccountRoutes);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'OmniFlow Protocol Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : '服务器错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 OmniFlow Protocol Backend API 运行在端口 ${PORT}`);
  console.log(`📖 API文档: http://localhost:${PORT}/health`);
  console.log(`🌐 前端地址: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

module.exports = app;