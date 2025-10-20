import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import crossChainService from '../services/crossChainService';
import { useAccount, useWalletClient } from 'wagmi';

export const useCrossChain = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [supportedChains, setSupportedChains] = useState([]);

  // 初始化支持的链
  useEffect(() => {
    const chains = crossChainService.getSupportedChains();
    setSupportedChains(chains);
  }, []);

  // 获取可用路由
  const getRoutes = useCallback(async (fromChain, toChain, token, amount) => {
    if (!fromChain || !toChain || !token || !amount) {
      return;
    }

    setLoading(true);
    try {
      const availableRoutes = await crossChainService.getAvailableRoutes(
        fromChain, 
        toChain, 
        token, 
        amount
      );
      setRoutes(availableRoutes);
      
      if (availableRoutes.length > 0) {
        setSelectedRoute(availableRoutes[0]); // 默认选择最优路由
      }
      
      return availableRoutes;
    } catch (error) {
      console.error('获取路由失败:', error);
      message.error('获取跨链路由失败，请稍后重试');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取AI推荐路由
  const getAIRecommendedRoute = useCallback(async (fromChain, toChain, token, amount, userContext) => {
    setLoading(true);
    try {
      const aiRoute = await crossChainService.getAIRecommendedRoute(
        fromChain, 
        toChain, 
        token, 
        amount, 
        userContext
      );
      
      setSelectedRoute(aiRoute);
      message.success(`AI推荐: ${aiRoute.reasoning}`);
      
      return aiRoute;
    } catch (error) {
      console.error('获取AI推荐路由失败:', error);
      message.error('AI路由推荐失败，请稍后重试');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 执行跨链交易
  const executeCrossChain = useCallback(async (route) => {
    if (!address || !walletClient) {
      message.error('请先连接钱包');
      return false;
    }

    if (!route) {
      message.error('请选择跨链路由');
      return false;
    }

    setLoading(true);
    try {
      // 更新交易状态
      setTransaction({
        ...route,
        status: 'executing',
        startTime: new Date(),
        steps: route.steps.map(step => ({ ...step, status: 'pending' }))
      });

      // 执行跨链交易
      const result = await crossChainService.executeCrossChain(route, address, walletClient);
      
      if (result.success) {
        setTransaction(prev => ({
          ...prev,
          status: 'submitted',
          txHash: result.txHash,
          steps: prev.steps.map((step, index) => 
            index === 0 ? { ...step, status: 'completed' } : step
          )
        }));
        
        message.success(result.message);
        
        // 开始监控交易状态
        monitorTransaction(result.txHash, route.protocolId);
        
        return true;
      } else {
        throw new Error(result.message || '交易执行失败');
      }
    } catch (error) {
      console.error('执行跨链交易失败:', error);
      message.error(error.message || '跨链交易失败，请稍后重试');
      
      setTransaction(prev => prev ? {
        ...prev,
        status: 'failed',
        error: error.message
      } : null);
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [address, walletClient]);

  // 监控交易状态
  const monitorTransaction = useCallback(async (txHash, protocolId) => {
    const checkStatus = async () => {
      try {
        const status = await crossChainService.getTransactionStatus(txHash, protocolId);
        
        setTransaction(prev => {
          if (!prev) return null;
          
          const updatedSteps = [...prev.steps];
          
          // 根据状态更新步骤
          switch (status.status) {
            case 'confirmed':
              updatedSteps[1] = { ...updatedSteps[1], status: 'completed' };
              break;
            case 'completed':
              updatedSteps.forEach((step, index) => {
                updatedSteps[index] = { ...step, status: 'completed' };
              });
              message.success('跨链交易已完成！');
              return { ...prev, status: 'completed', steps: updatedSteps };
            case 'failed':
              message.error('跨链交易失败');
              return { ...prev, status: 'failed', steps: updatedSteps };
            default:
              break;
          }
          
          return { ...prev, steps: updatedSteps, confirmations: status.confirmations };
        });
        
        // 如果交易未完成，继续监控
        if (status.status !== 'completed' && status.status !== 'failed') {
          setTimeout(checkStatus, 30000); // 30秒后再次检查
        }
      } catch (error) {
        console.error('监控交易状态失败:', error);
      }
    };
    
    checkStatus();
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setRoutes([]);
    setSelectedRoute(null);
    setTransaction(null);
    setLoading(false);
  }, []);

  // 获取链信息
  const getChainInfo = useCallback((chainId) => {
    return crossChainService.getChainInfo(chainId);
  }, []);

  // 计算最优路由
  const getOptimalRoute = useCallback(async (fromChain, toChain, token, amount, preferences) => {
    setLoading(true);
    try {
      const optimalRoute = await crossChainService.getOptimalRoute(
        fromChain, 
        toChain, 
        token, 
        amount, 
        preferences
      );
      
      setSelectedRoute(optimalRoute);
      return optimalRoute;
    } catch (error) {
      console.error('获取最优路由失败:', error);
      message.error('获取最优路由失败，请稍后重试');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 估算跨链费用
  const estimateFees = useCallback(async (fromChain, toChain, token, amount) => {
    try {
      const routes = await crossChainService.getAvailableRoutes(fromChain, toChain, token, amount);
      
      if (routes.length === 0) {
        return null;
      }
      
      const fees = routes.map(route => ({
        protocol: route.protocol,
        fees: route.fees,
        estimatedTime: route.estimatedTime
      }));
      
      return fees;
    } catch (error) {
      console.error('估算费用失败:', error);
      return null;
    }
  }, []);

  return {
    // 状态
    loading,
    routes,
    selectedRoute,
    transaction,
    supportedChains,
    
    // 方法
    getRoutes,
    getAIRecommendedRoute,
    executeCrossChain,
    reset,
    getChainInfo,
    getOptimalRoute,
    estimateFees,
    setSelectedRoute,
    
    // 工具方法
    isTransactionPending: transaction?.status === 'executing' || transaction?.status === 'submitted',
    isTransactionCompleted: transaction?.status === 'completed',
    isTransactionFailed: transaction?.status === 'failed'
  };
};