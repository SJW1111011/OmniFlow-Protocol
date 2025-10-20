/**
 * API响应辅助工具
 * 统一API响应格式
 */

class ResponseHelper {
  /**
   * 成功响应
   * @param {Object} res - Express响应对象
   * @param {*} data - 响应数据
   * @param {string} message - 响应消息
   * @param {number} statusCode - HTTP状态码
   */
  static success(res, data = null, message = '操作成功', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 错误响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   * @param {number} statusCode - HTTP状态码
   * @param {*} error - 错误详情
   */
  static error(res, message = '操作失败', statusCode = 500, error = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    // 在开发环境中包含错误详情
    if (process.env.NODE_ENV === 'development' && error) {
      response.error = error;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * 验证错误响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   * @param {*} errors - 验证错误详情
   */
  static validationError(res, message = '参数验证失败', errors = null) {
    return res.status(400).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 未授权响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   */
  static unauthorized(res, message = '未授权访问') {
    return res.status(401).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 禁止访问响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   */
  static forbidden(res, message = '禁止访问') {
    return res.status(403).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 资源未找到响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   */
  static notFound(res, message = '资源未找到') {
    return res.status(404).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 冲突响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   */
  static conflict(res, message = '资源冲突') {
    return res.status(409).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 分页响应
   * @param {Object} res - Express响应对象
   * @param {Array} data - 数据数组
   * @param {number} total - 总数量
   * @param {number} page - 当前页码
   * @param {number} limit - 每页数量
   * @param {string} message - 响应消息
   */
  static paginated(res, data, total, page, limit, message = '获取成功') {
    const totalPages = Math.ceil(total / limit);
    
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 创建响应
   * @param {Object} res - Express响应对象
   * @param {*} data - 响应数据
   * @param {string} message - 响应消息
   */
  static created(res, data = null, message = '创建成功') {
    return this.success(res, data, message, 201);
  }

  /**
   * 无内容响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 响应消息
   */
  static noContent(res, message = '操作成功') {
    return res.status(204).json({
      success: true,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理异步路由错误
   * @param {Function} fn - 异步函数
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = ResponseHelper;