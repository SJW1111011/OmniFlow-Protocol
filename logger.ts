import winston from 'winston';

// 定义日志级别颜色
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  http: 'magenta',
  debug: 'cyan',
};

// 添加颜色到winston
winston.addColors(colors);

// 定义日志格式
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message} ${info.stack ? `\n${info.stack}` : ''}`
  )
);

// 生产环境格式（JSON格式，便于日志分析）
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 定义传输方式
const transports = [
  // 控制台输出
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? productionFormat : format,
  }),
  
  // 错误日志文件
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
  }),
  
  // 所有日志文件
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
  }),
];

// 创建logger实例
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format,
  transports,
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  // 处理未捕获的Promise拒绝
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
  // 在处理异常后不退出进程
  exitOnError: false,
});

// 添加流接口，用于HTTP请求日志
const loggerStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// 直接给logger添加stream属性
(logger as any).stream = loggerStream;

export { logger as default, logger };

// 导出日志级别常量
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  DEBUG: 'debug',
} as const;

// 性能监控工具
export class PerformanceLogger {
  private static timers = new Map<string, number>();

  static start(label: string): void {
    this.timers.set(label, Date.now());
  }

  static end(label: string): void {
    const startTime = this.timers.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      logger.debug(`⏱️  ${label}: ${duration}ms`);
      this.timers.delete(label);
    }
  }

  static measure<T>(label: string, fn: () => T): T;
  static async measure<T>(label: string, fn: () => Promise<T>): Promise<T>;
  static measure<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    this.start(label);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => this.end(label));
      } else {
        this.end(label);
        return result;
      }
    } catch (error) {
      this.end(label);
      throw error;
    }
  }
}

// 结构化日志工具
export class StructuredLogger {
  static logTransaction(data: {
    txHash?: string;
    from?: string;
    to?: string;
    value?: string;
    gasUsed?: string;
    status: 'pending' | 'success' | 'failed';
    chainId?: number;
  }): void {
    logger.info('Transaction', {
      type: 'transaction',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  static logCrossChain(data: {
    sourceChain: number;
    destinationChain: number;
    token: string;
    amount: string;
    bridge: string;
    status: 'pending' | 'success' | 'failed';
    txHash?: string;
  }): void {
    logger.info('Cross-chain transfer', {
      type: 'cross_chain',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  static logYieldOptimization(data: {
    user: string;
    fromProtocol: string;
    toProtocol: string;
    token: string;
    amount: string;
    yieldImprovement: number;
    gasCost: string;
  }): void {
    logger.info('Yield optimization', {
      type: 'yield_optimization',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  static logError(error: Error, context: Record<string, any> = {}): void {
    logger.error('Application error', {
      type: 'error',
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  static logAPICall(data: {
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    userAgent?: string;
    ip?: string;
  }): void {
    logger.http('API call', {
      type: 'api_call',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}

// 创建日志目录
import { existsSync, mkdirSync } from 'fs';
if (!existsSync('logs')) {
  mkdirSync('logs');
}
