const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const router = express.Router();

// 模拟用户数据库（实际项目中应使用真实数据库）
const users = new Map();

// 生成JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

// 验证以太坊签名
const verifySignature = (message, signature, address) => {
  try {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
};

// 钱包连接登录
router.post('/wallet-login', async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    // 验证签名
    const isValidSignature = verifySignature(message, signature, address);
    if (!isValidSignature) {
      return res.status(401).json({
        success: false,
        message: '签名验证失败'
      });
    }

    // 检查用户是否存在，不存在则创建
    let user = users.get(address.toLowerCase());
    if (!user) {
      user = {
        id: address.toLowerCase(),
        address: address.toLowerCase(),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      users.set(address.toLowerCase(), user);
    } else {
      user.lastLogin = new Date().toISOString();
    }

    // 生成JWT Token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          address: user.address,
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('钱包登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败'
    });
  }
});

// 获取登录消息
router.post('/get-login-message', (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    const timestamp = Date.now();
    const message = `欢迎使用 OmniFlow Protocol!\n\n请签名此消息以验证您的身份。\n\n地址: ${address}\n时间戳: ${timestamp}`;

    res.json({
      success: true,
      data: {
        message,
        timestamp
      }
    });

  } catch (error) {
    console.error('获取登录消息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取登录消息失败'
    });
  }
});

// 验证Token中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '访问令牌缺失'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '访问令牌无效'
      });
    }
    req.user = user;
    next();
  });
};

// 获取用户信息
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const user = users.get(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        address: user.address,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

// 导出认证中间件供其他路由使用
router.authenticateToken = authenticateToken;

module.exports = router;