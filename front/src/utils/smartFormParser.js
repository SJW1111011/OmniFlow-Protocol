/**
 * 智能表单解析器
 * 用于从用户的自然语言输入中提取交易相关信息
 */

class SmartFormParser {
  constructor() {
    // 地址正则表达式 - 匹配以太坊地址
    this.addressRegex = /0x[a-fA-F0-9]{40}/g;
    
    // 金额正则表达式 - 匹配数字和小数
    this.amountRegex = /(\d+(?:\.\d+)?)\s*(ETH|USDC|USDT|DAI|BTC|BNB|MATIC|AVAX|FTM|OP|ARB)?/gi;
    
    // 常见的转账关键词
    this.transferKeywords = ['转账', '发送', '转', '给', '到', '向', '支付', '付款', 'transfer', 'send', 'pay'];
    
    // 常见的代币符号映射
    this.tokenSymbols = {
      'ETH': 'ETH',
      'ETHEREUM': 'ETH',
      'USDC': 'USDC',
      'USDT': 'USDT',
      'DAI': 'DAI',
      'BTC': 'BTC',
      'BITCOIN': 'BTC',
      'BNB': 'BNB',
      'MATIC': 'MATIC',
      'POLYGON': 'MATIC',
      'AVAX': 'AVAX',
      'AVALANCHE': 'AVAX'
    };
  }

  /**
   * 解析用户输入，提取交易信息
   * @param {string} input - 用户输入的自然语言
   * @returns {Object} 解析结果
   */
  parseTransactionIntent(input) {
    const result = {
      intent: 'unknown',
      transactions: [],
      confidence: 0,
      rawInput: input
    };

    // 检查是否是转账意图
    const isTransferIntent = this.transferKeywords.some(keyword => 
      input.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!isTransferIntent) {
      return result;
    }

    result.intent = 'batch_transfer';
    
    // 提取地址
    const addresses = this.extractAddresses(input);
    
    // 提取金额和代币
    const amounts = this.extractAmounts(input);
    
    // 生成交易列表
    result.transactions = this.generateTransactions(addresses, amounts, input);
    
    // 计算置信度
    result.confidence = this.calculateConfidence(result.transactions, input);
    
    return result;
  }

  /**
   * 提取以太坊地址
   * @param {string} input - 输入文本
   * @returns {Array} 地址数组
   */
  extractAddresses(input) {
    const matches = input.match(this.addressRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * 提取金额和代币信息
   * @param {string} input - 输入文本
   * @returns {Array} 金额信息数组
   */
  extractAmounts(input) {
    const amounts = [];
    const foundAmounts = new Set(); // 用于去重
    
    // 先移除地址，避免地址中的数字被误识别为金额
    const inputWithoutAddresses = input.replace(this.addressRegex, '');
    
    // 使用更精确的金额正则表达式
    const preciseAmountRegex = /(?:^|[^\d.])((\d+(?:\.\d+)?)\s*(ETH|USDC|USDT|DAI|BTC|BNB|MATIC|AVAX|FTM|OP|ARB)?)(?=[^\d.]|$)/gi;
    
    let match;
    while ((match = preciseAmountRegex.exec(inputWithoutAddresses)) !== null) {
      const amount = parseFloat(match[2]);
      const token = match[3] ? match[3].toUpperCase() : 'ETH';
      const normalizedToken = this.tokenSymbols[token] || token;
      
      // 创建唯一标识符来避免重复
      const uniqueKey = `${amount}-${normalizedToken}`;
      
      if (!foundAmounts.has(uniqueKey) && amount > 0) {
        foundAmounts.add(uniqueKey);
        amounts.push({
          value: amount.toString(),
          token: normalizedToken,
          raw: match[1]
        });
      }
    }
    
    return amounts;
  }

  /**
   * 生成交易列表
   * @param {Array} addresses - 地址数组
   * @param {Array} amounts - 金额数组
   * @param {string} input - 原始输入
   * @returns {Array} 交易数组
   */
  generateTransactions(addresses, amounts, input) {
    const transactions = [];
    
    // 如果没有找到地址或金额，返回空数组
    if (addresses.length === 0 || amounts.length === 0) {
      return transactions;
    }

    // 简单情况：一个地址，一个金额
    if (addresses.length === 1 && amounts.length === 1) {
      transactions.push({
        id: 1,
        to: addresses[0],
        value: amounts[0].value,
        token: amounts[0].token,
        data: '0x',
        description: `转账 ${amounts[0].value} ${amounts[0].token} 到 ${this.formatAddress(addresses[0])}`,
        enabled: true,
        confidence: 0.9
      });
    }
    // 多个地址，一个金额（批量转账相同金额）
    else if (addresses.length > 1 && amounts.length === 1) {
      addresses.forEach((address, index) => {
        transactions.push({
          id: index + 1,
          to: address,
          value: amounts[0].value,
          token: amounts[0].token,
          data: '0x',
          description: `转账 ${amounts[0].value} ${amounts[0].token} 到 ${this.formatAddress(address)}`,
          enabled: true,
          confidence: 0.8
        });
      });
    }
    // 一个地址，多个金额（多次转账到同一地址）
    else if (addresses.length === 1 && amounts.length > 1) {
      amounts.forEach((amount, index) => {
        transactions.push({
          id: index + 1,
          to: addresses[0],
          value: amount.value,
          token: amount.token,
          data: '0x',
          description: `转账 ${amount.value} ${amount.token} 到 ${this.formatAddress(addresses[0])}`,
          enabled: true,
          confidence: 0.8
        });
      });
    }
    // 多个地址，多个金额（一对一匹配）
    else if (addresses.length === amounts.length) {
      addresses.forEach((address, index) => {
        const amount = amounts[index];
        transactions.push({
          id: index + 1,
          to: address,
          value: amount.value,
          token: amount.token,
          data: '0x',
          description: `转账 ${amount.value} ${amount.token} 到 ${this.formatAddress(address)}`,
          enabled: true,
          confidence: 0.85
        });
      });
    }
    // 复杂情况：尝试智能匹配
    else {
      // 使用第一个金额作为默认值
      const defaultAmount = amounts[0];
      addresses.forEach((address, index) => {
        transactions.push({
          id: index + 1,
          to: address,
          value: defaultAmount.value,
          token: defaultAmount.token,
          data: '0x',
          description: `转账 ${defaultAmount.value} ${defaultAmount.token} 到 ${this.formatAddress(address)}`,
          enabled: true,
          confidence: 0.6
        });
      });
    }

    return transactions;
  }

  /**
   * 计算解析置信度
   * @param {Array} transactions - 交易数组
   * @param {string} input - 原始输入
   * @returns {number} 置信度 (0-1)
   */
  calculateConfidence(transactions, input) {
    let confidence = 0;
    
    // 基础分数
    if (transactions.length > 0) {
      confidence += 0.3;
    }
    
    // 地址格式正确性
    const validAddresses = transactions.filter(tx => 
      /^0x[a-fA-F0-9]{40}$/.test(tx.to)
    );
    confidence += (validAddresses.length / transactions.length) * 0.3;
    
    // 金额合理性
    const validAmounts = transactions.filter(tx => 
      !isNaN(parseFloat(tx.value)) && parseFloat(tx.value) > 0
    );
    confidence += (validAmounts.length / transactions.length) * 0.2;
    
    // 关键词匹配度
    const keywordMatches = this.transferKeywords.filter(keyword =>
      input.toLowerCase().includes(keyword.toLowerCase())
    );
    confidence += Math.min(keywordMatches.length * 0.1, 0.2);
    
    return Math.min(confidence, 1);
  }

  /**
   * 格式化地址显示
   * @param {string} address - 以太坊地址
   * @returns {string} 格式化后的地址
   */
  formatAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * 验证以太坊地址格式
   * @param {string} address - 地址字符串
   * @returns {boolean} 是否有效
   */
  isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * 解析批量转账指令的示例
   * 支持的格式：
   * - "转0.1ETH给0x123..."
   * - "发送100USDC到0x456..."
   * - "转账0.5ETH给0x789...和0x012..."
   * - "批量转账：0.1ETH到0x123..., 0.2ETH到0x456..."
   */
  getExampleFormats() {
    return [
      "转0.1ETH给0x1234567890123456789012345678901234567890",
      "发送100USDC到0x1234567890123456789012345678901234567890",
      "转账0.5ETH给0x1234567890123456789012345678901234567890和0x0987654321098765432109876543210987654321",
      "批量转账：0.1ETH到0x1234567890123456789012345678901234567890, 0.2ETH到0x0987654321098765432109876543210987654321"
    ];
  }
}

export default SmartFormParser;