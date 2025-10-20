import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// 简单的内存级别限流器
class MemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // 定期清理过期记录
    setInterval(() => this.cleanup(), this.windowMs);
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // 过滤掉过期的请求
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // 添加当前请求
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.windowMs;
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < this.windowMs);
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

// 创建不同级别的限流器 - 开发环境放宽限制
const generalLimiter = new MemoryRateLimiter(60000, 10000); // 每分钟1000次
const authLimiter = new MemoryRateLimiter(900000, 20);     // 每15分钟20次
const bridgeLimiter = new MemoryRateLimiter(60000, 50);    // 每分钟50次

/**
 * 获取客户端标识
 */
function getClientId(req: Request): string {
  // 优先使用真实IP，然后是X-Forwarded-For，最后是连接IP
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress || 
             'unknown';
  
  return ip.toString();
}

/**
 * 创建限流中间件
 */
function createRateLimiter(limiter: MemoryRateLimiter, name: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 开发环境跳过限流
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    const clientId = getClientId(req);
    
    if (!limiter.isAllowed(clientId)) {
      const resetTime = limiter.getResetTime(clientId);
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      
      logger.warn(`限流触发 - ${name}:`, {
        clientId,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json({
        success: false,
        error: {
          message: '请求过于频繁，请稍后再试',
          type: 'RATE_LIMIT_EXCEEDED',
          retryAfter
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // 设置响应头
    const remaining = limiter.getRemainingRequests(clientId);
    const resetTime = limiter.getResetTime(clientId);
    
    res.set({
      'X-RateLimit-Limit': '1000',
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
    });
    
    next();
  };
}

/**
 * 通用限流中间件
 */
export const rateLimiter = createRateLimiter(generalLimiter, 'general');

/**
 * 认证相关限流中间件
 */
export const authRateLimiter = createRateLimiter(authLimiter, 'auth');

/**
 * 跨链桥接限流中间件
 */
export const bridgeRateLimiter = createRateLimiter(bridgeLimiter, 'bridge');

/**
 * 严格限流中间件（用于敏感操作）
 */
export const strictRateLimiter = createRateLimiter(
  new MemoryRateLimiter(60000, 5), // 每分钟5次
  'strict'
);
