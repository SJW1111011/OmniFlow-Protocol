import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import aiService from '../services/aiService';
import { useAccount } from 'wagmi';
import { useEtherspotAccount } from './useEtherspotAccount';
import { useCrossChain } from './useCrossChain';

export const useAIAssistant = () => {
  const { address, isConnected } = useAccount();
  const { smartAccountAddress, createSmartAccount, getBalance } = useEtherspotAccount();
  const { 
    getAIRecommendedRoute, 
    executeCrossChain, 
    supportedChains,
    estimateFees 
  } = useCrossChain();
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIntent, setCurrentIntent] = useState(null);
  const messagesEndRef = useRef(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 发送消息
  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // 分析用户意图
      const intent = await aiService.analyzeIntent(content);
      setCurrentIntent(intent);

      // 获取AI回复
      const aiResponse = await aiService.chat(content, []);

      // 检查AI响应是否成功
      if (!aiResponse.success) {
        throw new Error(aiResponse.error || 'AI服务调用失败');
      }

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse.message,
        timestamp: new Date(),
        intent: intent.type || intent.intent,
        suggestions: aiResponse.suggestions || [],
        actions: aiResponse.actions || []
      };

      setMessages(prev => [...prev, aiMessage]);

      // 如果有建议的操作，自动执行
      if (aiResponse.autoExecute && aiResponse.actions?.length > 0) {
        await executeAction(aiResponse.actions[0]);
      }

    } catch (error) {
      console.error('AI对话失败:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: error.message || '抱歉，我遇到了一些问题，请稍后再试。',
        timestamp: new Date(),
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [address, smartAccountAddress, isConnected, supportedChains]);

  // 执行智能操作
  const executeAction = useCallback(async (action) => {
    try {
      switch (action.type) {
        case 'create_account':
          await handleCreateAccount();
          break;
        case 'check_balance':
          await handleCheckBalance(action.params);
          break;
        case 'transfer':
          await handleTransfer(action.params);
          break;
        case 'cross_chain':
          await handleCrossChain(action.params);
          break;
        case 'route_analysis':
          await handleRouteAnalysis(action.params);
          break;
        case 'fee_estimation':
          await handleFeeEstimation(action.params);
          break;
        default:
          console.log('未知操作类型:', action.type);
      }
    } catch (error) {
      console.error('执行操作失败:', error);
      message.error(`操作失败: ${error.message}`);
    }
  }, [smartAccountAddress]);

  // 创建智能账户
  const handleCreateAccount = useCallback(async () => {
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (smartAccountAddress) {
      message.info('您已经有智能账户了');
      return;
    }

    try {
      const result = await createSmartAccount();
      if (result.success) {
        message.success('智能账户创建成功！');
        
        // 添加成功消息
        const successMessage = {
          id: Date.now(),
          type: 'ai',
          content: `✅ 智能账户创建成功！\n地址: ${result.address}\n\n🎉 现在您可以享受以下功能:\n• 跨链Gas抽象 - 用任意代币支付Gas费\n• 批量交易 - 一次签名执行多个操作\n• 社交恢复 - 安全找回账户\n• AI智能操作 - 自然语言控制资产`,
          timestamp: new Date(),
          intent: 'account_creation'
        };
        setMessages(prev => [...prev, successMessage]);
      }
    } catch (error) {
      message.error('创建智能账户失败');
    }
  }, [isConnected, smartAccountAddress, createSmartAccount]);

  // 查询余额
  const handleCheckBalance = useCallback(async (params = {}) => {
    if (!smartAccountAddress) {
      message.error('请先创建智能账户');
      return;
    }

    try {
      const balance = await getBalance(params.token);
      
      const balanceMessage = {
        id: Date.now(),
        type: 'ai',
        content: `💰 账户余额信息:\n地址: ${smartAccountAddress}\n余额: ${balance} ${params.token || 'ETH'}\n\n💡 提示: 您可以说"帮我把资产转到收益最高的链上"来优化收益`,
        timestamp: new Date(),
        intent: 'balance_query'
      };
      setMessages(prev => [...prev, balanceMessage]);
    } catch (error) {
      message.error('查询余额失败');
    }
  }, [smartAccountAddress, getBalance]);

  // 转账操作
  const handleTransfer = useCallback(async (params) => {
    if (!smartAccountAddress) {
      message.error('请先创建智能账户');
      return;
    }

    // 这里应该实现实际的转账逻辑
    message.info('转账功能正在开发中...');
    
    const transferMessage = {
      id: Date.now(),
      type: 'ai',
      content: `🔄 准备转账:\n从: ${smartAccountAddress}\n到: ${params.to}\n金额: ${params.amount} ${params.token}\n\n⚡ 使用智能账户转账的优势:\n• Gas费抽象 - 可用${params.token}支付Gas\n• 批量操作 - 可同时执行多笔转账\n• 安全保障 - 多重签名保护`,
      timestamp: new Date(),
      intent: 'transfer'
    };
    setMessages(prev => [...prev, transferMessage]);
  }, [smartAccountAddress]);

  // 跨链操作
  const handleCrossChain = useCallback(async (params) => {
    if (!smartAccountAddress) {
      message.error('请先创建智能账户');
      return;
    }

    try {
      // 获取AI推荐的最优路由
      const aiRoute = await getAIRecommendedRoute(
        params.fromChain,
        params.toChain,
        params.token,
        params.amount,
        {
          riskTolerance: 'medium',
          speedPreference: 'medium',
          costSensitivity: 'medium'
        }
      );

      if (aiRoute) {
        const crossChainMessage = {
          id: Date.now(),
          type: 'ai',
          content: `🌉 AI智能跨链分析完成！\n\n📊 推荐路由:\n• 协议: ${aiRoute.protocol}\n• 预计费用: ${aiRoute.fees.total.toFixed(6)} ETH\n• 预计时间: ${aiRoute.estimatedTime}分钟\n• 安全等级: ${aiRoute.security}\n\n🤖 AI推荐理由: ${aiRoute.reasoning}\n\n是否执行此跨链操作？`,
          timestamp: new Date(),
          intent: 'cross_chain',
          suggestions: ['执行跨链', '查看其他路由', '取消操作'],
          routeData: aiRoute
        };
        setMessages(prev => [...prev, crossChainMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now(),
        type: 'ai',
        content: `❌ 跨链路由分析失败: ${error.message}\n\n请检查:\n• 源链和目标链是否支持\n• 代币和金额是否正确\n• 网络连接是否正常`,
        timestamp: new Date(),
        intent: 'cross_chain',
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [smartAccountAddress, getAIRecommendedRoute]);

  // 路由分析
  const handleRouteAnalysis = useCallback(async (params) => {
    try {
      const routes = await getAIRecommendedRoute(
        params.fromChain,
        params.toChain,
        params.token,
        params.amount
      );

      if (routes) {
        const analysisMessage = {
          id: Date.now(),
          type: 'ai',
          content: `📈 跨链路由深度分析:\n\n🏆 最优路由: ${routes.protocol}\n💰 总费用: ${routes.fees.total.toFixed(6)} ETH\n⏱️ 预计时间: ${routes.estimatedTime}分钟\n🛡️ 安全评级: ${routes.security}\n📊 综合评分: ${routes.score.toFixed(1)}/100\n\n${routes.reasoning}`,
          timestamp: new Date(),
          intent: 'route_analysis'
        };
        setMessages(prev => [...prev, analysisMessage]);
      }
    } catch (error) {
      message.error('路由分析失败');
    }
  }, [getAIRecommendedRoute]);

  // 费用估算
  const handleFeeEstimation = useCallback(async (params) => {
    try {
      const fees = await estimateFees(
        params.fromChain,
        params.toChain,
        params.token,
        params.amount
      );

      if (fees && fees.length > 0) {
        const feeComparison = fees.map(fee => 
          `• ${fee.protocol}: ${fee.fees.total.toFixed(6)} ETH (${fee.estimatedTime}分钟)`
        ).join('\n');

        const feeMessage = {
          id: Date.now(),
          type: 'ai',
          content: `💸 跨链费用对比分析:\n\n${feeComparison}\n\n💡 AI建议: 选择费用和时间平衡最优的协议`,
          timestamp: new Date(),
          intent: 'fee_estimation'
        };
        setMessages(prev => [...prev, feeMessage]);
      }
    } catch (error) {
      message.error('费用估算失败');
    }
  }, [estimateFees]);

  // 清空对话
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentIntent(null);
  }, []);

  // 执行建议操作
  const executeSuggestion = useCallback(async (suggestion) => {
    if (typeof suggestion === 'string') {
      // 如果是字符串建议，直接发送消息
      await sendMessage(suggestion);
    } else if (suggestion && suggestion.type) {
      // 如果是操作对象，执行对应操作
      await executeAction(suggestion);
    }
  }, [sendMessage, executeAction]);

  // 生成操作建议
  const generateSuggestions = useCallback(() => {
    const baseSuggestions = [
      '创建智能账户',
      '查询账户余额',
      '帮我转账到其他地址',
      '跨链转移资产到Polygon',
      '分析最优跨链路由',
      '估算跨链费用'
    ];

    if (!isConnected) {
      return ['请先连接钱包', '什么是OmniFlow？'];
    }

    if (!smartAccountAddress) {
      return ['创建智能账户', '什么是智能账户？', 'OmniFlow有什么优势？'];
    }

    return baseSuggestions;
  }, [isConnected, smartAccountAddress]);

  return {
    messages,
    loading,
    currentIntent,
    sendMessage,
    executeAction,
    executeSuggestion,
    clearMessages,
    generateSuggestions,
    messagesEndRef,
    
    // 状态
    hasSmartAccount: !!smartAccountAddress,
    isWalletConnected: isConnected,
    supportedChains
  };
};