import axios from 'axios';

// 支持的链配置
const SUPPORTED_CHAINS = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://etherscan.io',
    nativeToken: 'ETH'
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeToken: 'MATIC'
  },
  bsc: {
    id: 56,
    name: 'BSC',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeToken: 'BNB'
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeToken: 'ETH'
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeToken: 'ETH'
  }
};

// 跨链桥协议配置
const BRIDGE_PROTOCOLS = {
  layerzero: {
    name: 'LayerZero',
    type: 'omnichain',
    fee: 0.001, // 0.1%
    security: 'high',
    speed: 'fast',
    supported_chains: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism']
  },
  axelar: {
    name: 'Axelar',
    type: 'cross_chain',
    fee: 0.002, // 0.2%
    security: 'high',
    speed: 'medium',
    supported_chains: ['ethereum', 'polygon', 'bsc', 'arbitrum']
  },
  cbridge: {
    name: 'cBridge',
    type: 'liquidity_bridge',
    fee: 0.0015, // 0.15%
    security: 'medium',
    speed: 'fast',
    supported_chains: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism']
  },
  multichain: {
    name: 'Multichain',
    type: 'cross_chain',
    fee: 0.001, // 0.1%
    security: 'medium',
    speed: 'medium',
    supported_chains: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism']
  }
};

class CrossChainService {
  constructor() {
    this.supportedChains = SUPPORTED_CHAINS;
    this.bridgeProtocols = BRIDGE_PROTOCOLS;
  }

  // 获取支持的链列表
  getSupportedChains() {
    return Object.values(this.supportedChains);
  }

  // 获取链信息
  getChainInfo(chainId) {
    const chain = Object.values(this.supportedChains).find(c => c.id === chainId);
    return chain || null;
  }

  // 获取可用的跨链路由
  async getAvailableRoutes(fromChain, toChain, token, amount) {
    try {
      const routes = [];
      
      // 遍历所有桥协议，找到支持的路由
      for (const [protocolId, protocol] of Object.entries(this.bridgeProtocols)) {
        if (protocol.supported_chains.includes(fromChain) && 
            protocol.supported_chains.includes(toChain)) {
          
          const route = await this.calculateRoute(protocolId, fromChain, toChain, token, amount);
          if (route) {
            routes.push(route);
          }
        }
      }

      // 按综合评分排序
      return routes.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('获取跨链路由失败:', error);
      throw error;
    }
  }

  // 计算单个路由的详细信息
  async calculateRoute(protocolId, fromChain, toChain, token, amount) {
    try {
      const protocol = this.bridgeProtocols[protocolId];
      const fromChainInfo = this.supportedChains[fromChain];
      const toChainInfo = this.supportedChains[toChain];

      // 模拟计算费用和时间（实际应该调用各协议的API）
      const baseFee = parseFloat(amount) * protocol.fee;
      const gasFee = this.estimateGasFee(fromChain, toChain);
      const totalFee = baseFee + gasFee;
      const estimatedTime = this.estimateTime(protocol.speed, fromChain, toChain);

      // 计算综合评分（考虑费用、速度、安全性）
      const score = this.calculateScore(protocol, totalFee, estimatedTime);

      return {
        id: `${protocolId}_${fromChain}_${toChain}`,
        protocol: protocol.name,
        protocolId,
        fromChain: fromChainInfo.name,
        toChain: toChainInfo.name,
        token,
        amount,
        fees: {
          protocol: baseFee,
          gas: gasFee,
          total: totalFee
        },
        estimatedTime,
        security: protocol.security,
        score,
        steps: this.generateSteps(protocol, fromChainInfo, toChainInfo, token, amount)
      };
    } catch (error) {
      console.error(`计算${protocolId}路由失败:`, error);
      return null;
    }
  }

  // 估算Gas费用
  estimateGasFee(fromChain, toChain) {
    // 简化的Gas费用估算
    const baseGas = {
      ethereum: 0.01,
      polygon: 0.001,
      bsc: 0.001,
      arbitrum: 0.002,
      optimism: 0.002
    };
    
    return (baseGas[fromChain] || 0.005) + (baseGas[toChain] || 0.005);
  }

  // 估算交易时间
  estimateTime(speed, fromChain, toChain) {
    const baseTime = {
      fast: 5,    // 5分钟
      medium: 15, // 15分钟
      slow: 30    // 30分钟
    };

    // L2网络通常更快
    const isL2 = ['arbitrum', 'optimism', 'polygon'].includes(fromChain) || 
                 ['arbitrum', 'optimism', 'polygon'].includes(toChain);
    
    const time = baseTime[speed] || 15;
    return isL2 ? Math.max(time * 0.7, 2) : time;
  }

  // 计算路由综合评分
  calculateScore(protocol, totalFee, estimatedTime) {
    // 评分权重
    const weights = {
      security: 0.4,
      fee: 0.35,
      speed: 0.25
    };

    // 安全性评分
    const securityScore = {
      high: 100,
      medium: 70,
      low: 40
    }[protocol.security] || 50;

    // 费用评分（费用越低分数越高）
    const feeScore = Math.max(0, 100 - totalFee * 1000);

    // 速度评分（时间越短分数越高）
    const speedScore = Math.max(0, 100 - estimatedTime * 2);

    return (
      securityScore * weights.security +
      feeScore * weights.fee +
      speedScore * weights.speed
    );
  }

  // 生成交易步骤
  generateSteps(protocol, fromChain, toChain, token, amount) {
    return [
      {
        step: 1,
        action: 'approve',
        description: `授权 ${amount} ${token} 给 ${protocol.name} 合约`,
        chain: fromChain.name,
        status: 'pending'
      },
      {
        step: 2,
        action: 'bridge',
        description: `通过 ${protocol.name} 桥接到 ${toChain.name}`,
        chain: fromChain.name,
        status: 'pending'
      },
      {
        step: 3,
        action: 'confirm',
        description: `在 ${toChain.name} 上确认接收`,
        chain: toChain.name,
        status: 'pending'
      }
    ];
  }

  // 执行跨链交易
  async executeCrossChain(route, userAddress, signer) {
    try {
      console.log('开始执行跨链交易:', route);
      
      // 这里应该调用具体的桥协议API
      // 目前返回模拟的交易哈希
      const txHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      
      return {
        success: true,
        txHash,
        message: `跨链交易已提交，交易哈希: ${txHash}`
      };
    } catch (error) {
      console.error('执行跨链交易失败:', error);
      throw error;
    }
  }

  // 查询交易状态
  async getTransactionStatus(txHash, protocolId) {
    try {
      // 模拟查询交易状态
      const statuses = ['pending', 'confirmed', 'completed', 'failed'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      return {
        txHash,
        status: randomStatus,
        confirmations: Math.floor(Math.random() * 20),
        estimatedCompletion: new Date(Date.now() + 10 * 60 * 1000) // 10分钟后
      };
    } catch (error) {
      console.error('查询交易状态失败:', error);
      throw error;
    }
  }

  // 获取最优路由推荐
  async getOptimalRoute(fromChain, toChain, token, amount, preferences = {}) {
    try {
      const routes = await this.getAvailableRoutes(fromChain, toChain, token, amount);
      
      if (routes.length === 0) {
        throw new Error('未找到可用的跨链路由');
      }

      // 根据用户偏好调整评分
      if (preferences.prioritizeSecurity) {
        routes.forEach(route => {
          if (route.security === 'high') route.score += 20;
        });
      }

      if (preferences.prioritizeSpeed) {
        routes.forEach(route => {
          if (route.estimatedTime < 10) route.score += 15;
        });
      }

      if (preferences.prioritizeCost) {
        routes.forEach(route => {
          if (route.fees.total < 0.01) route.score += 15;
        });
      }

      // 重新排序
      routes.sort((a, b) => b.score - a.score);
      
      return routes[0]; // 返回最优路由
    } catch (error) {
      console.error('获取最优路由失败:', error);
      throw error;
    }
  }

  // AI智能路由选择
  async getAIRecommendedRoute(fromChain, toChain, token, amount, userContext = {}) {
    try {
      const routes = await this.getAvailableRoutes(fromChain, toChain, token, amount);
      
      // 基于用户历史行为和偏好的AI推荐逻辑
      const { riskTolerance = 'medium', speedPreference = 'medium', costSensitivity = 'medium' } = userContext;
      
      let bestRoute = routes[0];
      
      // AI决策逻辑
      for (const route of routes) {
        let aiScore = route.score;
        
        // 根据风险承受能力调整
        if (riskTolerance === 'low' && route.security === 'high') {
          aiScore += 25;
        } else if (riskTolerance === 'high' && route.fees.total < bestRoute.fees.total) {
          aiScore += 20;
        }
        
        // 根据速度偏好调整
        if (speedPreference === 'high' && route.estimatedTime < 10) {
          aiScore += 20;
        }
        
        // 根据成本敏感度调整
        if (costSensitivity === 'high' && route.fees.total < 0.005) {
          aiScore += 15;
        }
        
        if (aiScore > bestRoute.score) {
          bestRoute = { ...route, score: aiScore };
        }
      }
      
      return {
        ...bestRoute,
        aiRecommendation: true,
        reasoning: this.generateAIReasoning(bestRoute, userContext)
      };
    } catch (error) {
      console.error('AI路由推荐失败:', error);
      throw error;
    }
  }

  // 生成AI推荐理由
  generateAIReasoning(route, userContext) {
    const reasons = [];
    
    if (route.security === 'high') {
      reasons.push('该路由使用高安全性协议');
    }
    
    if (route.fees.total < 0.01) {
      reasons.push('交易费用较低');
    }
    
    if (route.estimatedTime < 10) {
      reasons.push('预计完成时间较短');
    }
    
    if (userContext.riskTolerance === 'low') {
      reasons.push('符合您的低风险偏好');
    }
    
    return reasons.join('，') + '，因此推荐使用此路由。';
  }
}

export default new CrossChainService();