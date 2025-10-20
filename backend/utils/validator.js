const { ethers } = require('ethers');

/**
 * 参数验证工具类
 */
class Validator {
  /**
   * 验证以太坊地址
   * @param {string} address - 地址
   * @returns {boolean}
   */
  static isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  /**
   * 验证私钥格式
   * @param {string} privateKey - 私钥
   * @returns {boolean}
   */
  static isValidPrivateKey(privateKey) {
    try {
      if (!privateKey || typeof privateKey !== 'string') {
        return false;
      }
      
      // 移除0x前缀
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      
      // 检查长度（64个十六进制字符）
      if (cleanKey.length !== 64) {
        return false;
      }
      
      // 检查是否为有效的十六进制
      return /^[0-9a-fA-F]+$/.test(cleanKey);
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证交易哈希
   * @param {string} txHash - 交易哈希
   * @returns {boolean}
   */
  static isValidTxHash(txHash) {
    try {
      if (!txHash || typeof txHash !== 'string') {
        return false;
      }
      
      // 检查格式：0x开头，64个十六进制字符
      return /^0x[0-9a-fA-F]{64}$/.test(txHash);
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证数字
   * @param {*} value - 值
   * @param {Object} options - 选项
   * @returns {boolean}
   */
  static isValidNumber(value, options = {}) {
    const { min, max, integer = false } = options;
    
    if (value === null || value === undefined || value === '') {
      return false;
    }
    
    const num = Number(value);
    
    if (isNaN(num)) {
      return false;
    }
    
    if (integer && !Number.isInteger(num)) {
      return false;
    }
    
    if (min !== undefined && num < min) {
      return false;
    }
    
    if (max !== undefined && num > max) {
      return false;
    }
    
    return true;
  }

  /**
   * 验证字符串
   * @param {*} value - 值
   * @param {Object} options - 选项
   * @returns {boolean}
   */
  static isValidString(value, options = {}) {
    const { minLength = 0, maxLength = Infinity, pattern } = options;
    
    if (typeof value !== 'string') {
      return false;
    }
    
    if (value.length < minLength || value.length > maxLength) {
      return false;
    }
    
    if (pattern && !pattern.test(value)) {
      return false;
    }
    
    return true;
  }

  /**
   * 验证数组
   * @param {*} value - 值
   * @param {Object} options - 选项
   * @returns {boolean}
   */
  static isValidArray(value, options = {}) {
    const { minLength = 0, maxLength = Infinity, itemValidator } = options;
    
    if (!Array.isArray(value)) {
      return false;
    }
    
    if (value.length < minLength || value.length > maxLength) {
      return false;
    }
    
    if (itemValidator) {
      return value.every(item => itemValidator(item));
    }
    
    return true;
  }

  /**
   * 验证邮箱
   * @param {string} email - 邮箱
   * @returns {boolean}
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return this.isValidString(email) && emailRegex.test(email);
  }

  /**
   * 验证URL
   * @param {string} url - URL
   * @returns {boolean}
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证以太币金额
   * @param {string} amount - 金额
   * @returns {boolean}
   */
  static isValidEtherAmount(amount) {
    try {
      if (!amount || typeof amount !== 'string') {
        return false;
      }
      
      const parsed = ethers.utils.parseEther(amount);
      return parsed.gte(0);
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证批量交易数据
   * @param {Array} transactions - 交易数组
   * @returns {Object}
   */
  static validateBatchTransactions(transactions) {
    const errors = [];
    
    if (!Array.isArray(transactions)) {
      return { isValid: false, errors: ['交易数据必须是数组'] };
    }
    
    if (transactions.length === 0) {
      return { isValid: false, errors: ['交易数组不能为空'] };
    }
    
    if (transactions.length > 100) {
      return { isValid: false, errors: ['批量交易数量不能超过100个'] };
    }
    
    transactions.forEach((tx, index) => {
      if (!tx.target || !this.isValidAddress(tx.target)) {
        errors.push(`交易${index + 1}: 目标地址无效`);
      }
      
      if (tx.value !== undefined && tx.value !== null) {
        if (!this.isValidNumber(tx.value, { min: 0 })) {
          errors.push(`交易${index + 1}: 金额无效`);
        }
      }
      
      if (tx.data !== undefined && tx.data !== null) {
        if (typeof tx.data !== 'string' || !tx.data.startsWith('0x')) {
          errors.push(`交易${index + 1}: 数据格式无效`);
        }
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证守护者列表
   * @param {Array} guardians - 守护者地址数组
   * @returns {Object}
   */
  static validateGuardians(guardians) {
    const errors = [];
    
    if (!Array.isArray(guardians)) {
      return { isValid: false, errors: ['守护者列表必须是数组'] };
    }
    
    if (guardians.length > 10) {
      return { isValid: false, errors: ['守护者数量不能超过10个'] };
    }
    
    const uniqueGuardians = new Set();
    
    guardians.forEach((guardian, index) => {
      if (!this.isValidAddress(guardian)) {
        errors.push(`守护者${index + 1}: 地址格式无效`);
      } else {
        const lowerGuardian = guardian.toLowerCase();
        if (uniqueGuardians.has(lowerGuardian)) {
          errors.push(`守护者${index + 1}: 地址重复`);
        } else {
          uniqueGuardians.add(lowerGuardian);
        }
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 创建验证中间件
   * @param {Object} schema - 验证模式
   * @returns {Function}
   */
  static createValidationMiddleware(schema) {
    return (req, res, next) => {
      const errors = [];
      
      Object.keys(schema).forEach(field => {
        const rules = schema[field];
        const value = req.body[field];
        
        // 检查必填字段
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field}是必填字段`);
          return;
        }
        
        // 如果字段不是必填且为空，跳过验证
        if (!rules.required && (value === undefined || value === null || value === '')) {
          return;
        }
        
        // 类型验证
        if (rules.type) {
          switch (rules.type) {
            case 'address':
              if (!this.isValidAddress(value)) {
                errors.push(`${field}必须是有效的以太坊地址`);
              }
              break;
            case 'privateKey':
              if (!this.isValidPrivateKey(value)) {
                errors.push(`${field}必须是有效的私钥`);
              }
              break;
            case 'string':
              if (!this.isValidString(value, rules.options)) {
                errors.push(`${field}格式无效`);
              }
              break;
            case 'number':
              if (!this.isValidNumber(value, rules.options)) {
                errors.push(`${field}必须是有效的数字`);
              }
              break;
            case 'array':
              if (!this.isValidArray(value, rules.options)) {
                errors.push(`${field}必须是有效的数组`);
              }
              break;
          }
        }
        
        // 自定义验证器
        if (rules.validator && typeof rules.validator === 'function') {
          const result = rules.validator(value);
          if (result !== true) {
            errors.push(result || `${field}验证失败`);
          }
        }
      });
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: '参数验证失败',
          errors,
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    };
  }
}

module.exports = Validator;