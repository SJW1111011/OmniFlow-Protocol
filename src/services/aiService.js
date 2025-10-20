import axios from 'axios';

class AIService {
  constructor() {
    // 禁用本地模拟模式，使用真实AI服务
    this.useLocalMode = false;
    this.apiKey = 'sk-52bbb3af80b8448f8016d8347de6d400';
    // 使用后端代理
    this.baseURL = 'http://localhost:3001/api/ai/chat';
    this.model = 'qwen-turbo';
  }

  // 本地模拟AI响应
  generateLocalResponse(message) {
    const responses = {
      '创建智能账户': {
        message: '🚀 智能账户创建指南\n\n智能账户是基于 ERC-4337 标准的下一代以太坊账户，具有以下优势：\n\n✨ **核心功能**\n• Gas 抽象 - 可用任意代币支付 Gas 费\n• 批量操作 - 一次签名执行多个交易\n• 社交恢复 - 通过朋友找回账户\n• 自定义逻辑 - 可编程的账户行为\n\n🔧 **创建步骤**\n1. 确保钱包已连接\n2. 点击"创建智能账户"按钮\n3. 确认交易签名\n4. 等待账户部署完成\n\n💡 **提示**: 创建后您将获得一个功能强大的智能合约账户！',
        suggestions: ['开始创建', '了解更多', '查看费用']
      },
      '查询账户余额': {
        message: '💰 账户余额查询\n\n我可以帮您查询以下信息：\n\n📊 **支持查询**\n• ETH 主网余额\n• 多链资产分布\n• 代币持仓详情\n• 历史交易记录\n\n🔍 **查询方式**\n• 输入代币符号 (如: ETH, USDC)\n• 指定查询链 (如: Ethereum, Polygon)\n• 查看总资产价值\n\n请告诉我您想查询哪个代币的余额？',
        suggestions: ['查询 ETH', '查询 USDC', '查看所有资产']
      },
      '跨链转账': {
        message: '🌉 智能跨链转账\n\n OmniFlow 提供 AI 驱动的跨链解决方案：\n\n⚡ **智能路由**\n• AI 分析最优路径\n• 自动选择最佳桥接协议\n• 实时费用和时间估算\n• 安全性评估\n\n🎯 **支持链**\n• Ethereum 主网\n• Polygon\n• Arbitrum\n• Optimism\n• Base\n\n请告诉我：\n1. 从哪条链转出？\n2. 转到哪条链？\n3. 转账金额和代币？',
        suggestions: ['ETH → Polygon', 'USDC → Arbitrum', '查看费用']
      }
    };

    // 智能匹配用户输入
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('创建') || lowerMessage.includes('账户')) {
      return responses['创建智能账户'];
    } else if (lowerMessage.includes('余额') || lowerMessage.includes('查询')) {
      return responses['查询账户余额'];
    } else if (lowerMessage.includes('跨链') || lowerMessage.includes('转账')) {
      return responses['跨链转账'];
    } else {
      return {
        message: '👋 欢迎使用 OmniFlow AI Assistant！\n\n我是您的 Web3 智能助手，可以帮助您：\n\n🔧 **智能账户管理**\n• 创建和管理智能账户\n• 设置社交恢复\n• 批量交易操作\n\n💰 **资产管理**\n• 查询多链余额\n• 跨链资产转移\n• DeFi 收益优化\n\n🤖 **AI 功能**\n• 智能路由推荐\n• 风险评估\n• 操作指导\n\n请告诉我您需要什么帮助？',
        suggestions: ['创建智能账户', '查询账户余额', '跨链转账', '了解更多功能']
      };
    }
  }

  async chat(message, conversationHistory = []) {
    try {
      // 如果启用本地模式，直接返回本地响应
      if (this.useLocalMode) {
        const localResponse = this.generateLocalResponse(message);
        return {
          success: true,
          message: localResponse.message,
          suggestions: localResponse.suggestions,
          usage: { total_tokens: 0 }
        };
      }

      const messages = [
        {
          role: 'system',
          content: `你是 OmniFlow Protocol 的 AI Flow Assistant，一个专业的 Web3 智能助手。你的主要职责是：

1. 帮助用户理解和操作智能账户功能
2. 协助用户进行跨链资产管理
3. 提供 DeFi 收益优化建议
4. 解释区块链和智能合约相关概念
5. 指导用户使用 ERC-4337 账户抽象功能

你应该：
- 用简洁、专业的语言回答
- 优先推荐安全的操作方式
- 在涉及资金操作时提醒用户注意风险
- 提供具体的操作步骤和建议

当前支持的功能：
- 智能账户创建和管理
- 社交恢复设置
- 批量交易执行
- Gas费抽象
- 跨链资产查询

请始终保持专业、友好的语调。`
        },
        ...conversationHistory,
        {
          role: 'user',
          content: message
        }
      ];

      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          input: {
            messages: messages
          },
          parameters: {
            temperature: 0.7,
            max_tokens: 1500,
            top_p: 0.8
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-DashScope-SSE': 'disable'
          },
          timeout: 30000, // 30秒超时
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          }
        }
      );

      if (response.data && response.data.output) {
        // 处理新的响应格式（通过后端代理）
        let aiResponse;
        if (response.data.output.text) {
          // 后端代理返回的格式
          aiResponse = response.data.output.text;
        } else if (response.data.output.choices) {
          // 原始API格式
          aiResponse = response.data.output.choices[0].message.content;
        } else {
          throw new Error('Invalid response format');
        }
        
        return {
          success: true,
          message: aiResponse,
          usage: response.data.usage
        };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('AI Service Error:', error);
      
      let errorMessage = '服务暂时不可用';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = '请求超时，请检查网络连接';
      } else if (error.response) {
        // 服务器响应了错误状态码
        errorMessage = error.response.data?.message || `服务器错误 (${error.response.status})`;
      } else if (error.request) {
        // 请求发出但没有收到响应
        errorMessage = '网络连接失败，请检查网络设置';
      } else {
        // 其他错误
        errorMessage = error.message || '未知错误';
      }
      
      return {
        success: false,
        error: errorMessage,
        fallbackMessage: '抱歉，AI助手暂时无法响应。请稍后再试，或者查看帮助文档获取相关信息。'
      };
    }
  }

  // 智能分析用户意图
  async analyzeIntent(message) {
    const intentPrompt = `分析以下用户消息的意图，返回JSON格式：
{
  "intent": "create_account|transfer|swap|bridge|query_balance|add_guardian|recovery|batch_transaction|other",
  "entities": {
    "amount": "数量",
    "token": "代币名称", 
    "target_chain": "目标链",
    "recipient": "接收地址"
  },
  "confidence": 0.95
}

用户消息：${message}`;

    try {
      const response = await this.chat(intentPrompt);
      if (response.success) {
        try {
          return JSON.parse(response.message);
        } catch {
          return { intent: 'other', confidence: 0.5 };
        }
      }
      return { intent: 'other', confidence: 0.5 };
    } catch (error) {
      console.error('Intent analysis error:', error);
      // 如果网络请求失败，使用本地备用分析
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('创建') || lowerMessage.includes('账户')) {
        return { intent: 'create_account', confidence: 0.7 };
      } else if (lowerMessage.includes('余额') || lowerMessage.includes('查询')) {
        return { intent: 'query_balance', confidence: 0.7 };
      } else if (lowerMessage.includes('转账') || lowerMessage.includes('发送')) {
        return { intent: 'transfer', confidence: 0.7 };
      } else if (lowerMessage.includes('跨链') || lowerMessage.includes('桥接')) {
        return { intent: 'bridge', confidence: 0.7 };
      } else if (lowerMessage.includes('交换') || lowerMessage.includes('兑换')) {
        return { intent: 'swap', confidence: 0.7 };
      } else {
        return { intent: 'other', confidence: 0.5 };
      }
    }
  }

  // 生成操作建议
  async generateActionSuggestions(intent, entities) {
    const suggestions = {
      create_account: [
        '创建智能账户',
        '设置社交恢复',
        '查看账户功能'
      ],
      transfer: [
        '执行转账',
        '批量转账',
        '预估Gas费'
      ],
      swap: [
        '代币兑换',
        '查看最优路径',
        '设置滑点保护'
      ],
      bridge: [
        '跨链转账',
        '查看桥接费用',
        '选择最优路径'
      ],
      query_balance: [
        '查看余额',
        '查看多链资产',
        '资产分布分析'
      ]
    };

    return suggestions[intent] || ['获取帮助', '查看文档', '联系支持'];
  }
}

export default new AIService();