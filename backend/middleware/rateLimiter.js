/**
 * API限流中间件
 * 防止API滥用和DDoS攻击
 */

class RateLimiter {
  constructor() {
    // 存储客户端请求记录
    this.clients = new Map();
    
    // 清理过期记录的定时器
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 创建限流中间件
   * @param {Object} options - 配置选项
   * @returns {Function}
   */
  createLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15分钟窗口
      maxRequests = 100,          // 最大请求数
      message = '请求过于频繁，请稍后再试',
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      keyGenerator = null
    } = options;

    return (req, res, next) => {
      try {
        // 生成客户端标识
        const key = keyGenerator ? keyGenerator(req) : this.getClientKey(req);
        
        // 获取客户端记录
        const now = Date.now();
        let clientData = this.clients.get(key);
        
        if (!clientData) {
          clientData = {
            requests: [],
            windowStart: now
          };
          this.clients.set(key, clientData);
        }
        
        // 清理过期请求
        const windowStart = now - windowMs;
        clientData.requests = clientData.requests.filter(
          timestamp => timestamp > windowStart
        );
        
        // 检查是否超过限制
        if (clientData.requests.length >= maxRequests) {
          return res.status(429).json({
            success: false,
            message,
            retryAfter: Math.ceil(windowMs / 1000),
            timestamp: new Date().toISOString()
          });
        }
        
        // 记录请求
        clientData.requests.push(now);
        
        // 设置响应头
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.requests.length),
          'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
        });
        
        // 监听响应完成事件
        if (skipSuccessfulRequests || skipFailedRequests) {
          res.on('finish', () => {
            const shouldSkip = 
              (skipSuccessfulRequests && res.statusCode < 400) ||
              (skipFailedRequests && res.statusCode >= 400);
            
            if (shouldSkip) {
              // 移除最后一个请求记录
              clientData.requests.pop();
            }
          });
        }
        
        next();
      } catch (error) {
        console.error('限流中间件错误:', error);
        next();
      }
    };
  }

  /**
   * 获取客户端标识
   * @param {Object} req - 请求对象
   * @returns {string}
   */
  getClientKey(req) {
    // 优先使用用户ID（如果已认证）
    if (req.user && req.user.userId) {
      return `user:${req.user.userId}`;
    }
    
    // 使用IP地址
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
    return `ip:${ip}`;
  }

  /**
   * 清理过期记录
   */
  cleanup() {
    const now = Date.now();
    const expireTime = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [key, clientData] of this.clients.entries()) {
      // 如果客户端超过24小时没有请求，删除记录
      const lastRequest = Math.max(...clientData.requests, clientData.windowStart);
      if (now - lastRequest > expireTime) {
        this.clients.delete(key);
      }
    }
  }

  /**
   * 重置客户端限制
   * @param {string} key - 客户端标识
   */
  reset(key) {
    this.clients.delete(key);
  }

  /**
   * 获取客户端状态
   * @param {string} key - 客户端标识
   * @returns {Object}
   */
  getStatus(key) {
    const clientData = this.clients.get(key);
    if (!clientData) {
      return null;
    }
    
    return {
      requests: clientData.requests.length,
      windowStart: clientData.windowStart,
      lastRequest: Math.max(...clientData.requests)
    };
  }

  /**
   * 销毁限流器
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clients.clear();
  }
}

// 创建全局限流器实例
const globalLimiter = new RateLimiter();

// 预定义的限流配置
const presets = {
  // 严格限制（登录、注册等敏感操作）
  strict: {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 5,
    message: '操作过于频繁，请15分钟后再试'
  },
  
  // 中等限制（一般API操作）
  moderate: {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 100,
    message: '请求过于频繁，请稍后再试'
  },
  
  // 宽松限制（查询操作）
  loose: {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 1000,
    message: '请求过于频繁，请稍后再试'
  }
};

module.exports = {
  RateLimiter,
  globalLimiter,
  presets,
  
  // 便捷方法
  strict: () => globalLimiter.createLimiter(presets.strict),
  moderate: () => globalLimiter.createLimiter(presets.moderate),
  loose: () => globalLimiter.createLimiter(presets.loose),
  
  // 自定义限流器
  custom: (options) => globalLimiter.createLimiter(options)
};