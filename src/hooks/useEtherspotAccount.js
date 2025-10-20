import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { message } from 'antd';
import etherspotService from '../services/etherspotService';

export const useEtherspotAccount = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [smartAccount, setSmartAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [previousAddress, setPreviousAddress] = useState(null);

  // 初始化Etherspot SDK
  const initializeEtherspot = useCallback(async () => {
    if (!walletClient || !address || isInitialized) return;

    try {
      setLoading(true);
      
      // 获取用户的钱包地址
      const accounts = await walletClient.getAddresses();
      console.log('用户钱包地址:', accounts);
      if (!accounts || accounts.length === 0) {
        throw new Error('无法获取钱包账户');
      }

      // 使用 MetaMask 钱包初始化 SDK
      console.log('使用 MetaMask 钱包初始化 Etherspot SDK...');
      await etherspotService.initializeWithWallet(walletClient, 11155111);

      setIsInitialized(true);
      console.log('Etherspot SDK 初始化成功，用户地址:', address);
      
    } catch (error) {
      console.error('初始化 Etherspot SDK 失败:', error);
      message.error('初始化智能账户服务失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [walletClient, address, isInitialized]);

  // 获取智能账户信息
  const fetchSmartAccount = useCallback(async (customConfig = {}) => {
    // 添加更严格的初始化检查
    if (!isInitialized || !address || !isConnected) {
      console.log('跳过获取智能账户信息：', { isInitialized, address, isConnected });
      return;
    }
    
    try {
      setLoading(true);
      
      // 获取智能账户地址
      const accountAddress = await etherspotService.getSmartAccountAddress();
      const isDeployed = await etherspotService.isSmartAccountDeployed(customConfig);
      const balance = await etherspotService.getBalance();
      
      const accountInfo = {
        address: accountAddress,
        owner: address,
        isDeployed: isDeployed,
        balance: balance,
        // 支持自定义守护人配置
        guardians: customConfig.guardians || [],
        requiredGuardians: customConfig.requiredGuardians || 1
      };
      
      setSmartAccount(accountInfo);
      console.log('智能账户信息:', accountInfo);
      
    } catch (error) {
      console.error('获取智能账户失败:', error);
      // 如果是初始化错误，不显示错误消息，因为可能是正在重新初始化
      if (!error.message.includes('未初始化')) {
        message.error('获取智能账户信息失败: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [isInitialized, address, isConnected]);

  // 创建智能账户
  const createSmartAccount = useCallback(async (customConfig = {}) => {
    if (!address) {
      message.error('请先连接钱包');
      return false;
    }

    if (!isInitialized) {
      message.error('SDK未初始化，请稍后重试');
      return false;
    }

    // 检查是否已经有智能账户
    if (smartAccount?.address) {
      message.info('智能账户已存在');
      console.log('智能账户已存在:', smartAccount.address);
      return true;
    }

    try {
      setLoading(true);
      console.log('开始检查智能账户...');
      
      // 使用固定的智能账户地址
      const accountAddress = await etherspotService.getSmartAccountAddress();
      const isDeployed = await etherspotService.isSmartAccountDeployed(customConfig);
      
      if (accountAddress) {
        if (isDeployed) {
          message.success('智能账户已存在！');
          console.log('智能账户已存在:', accountAddress);
        } else {
          // 尝试创建智能账户
          console.log('智能账户地址已配置，开始部署...');
          await etherspotService.createSmartAccount(customConfig);
          message.success('智能账户创建成功！');
        }
        
        // 更新账户信息
        await fetchSmartAccount(customConfig);
        return true;
      } else {
        message.error('获取智能账户地址失败');
        return false;
      }
    } catch (error) {
      console.error('创建智能账户失败:', error);
      message.error('创建智能账户失败: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [address, isInitialized, smartAccount, fetchSmartAccount]);

  // 发送交易
  const sendTransaction = useCallback(async (txData, value = '0', data = '0x') => {
    if (!smartAccount) {
      message.error('请先创建智能账户');
      return false;
    }

    if (!isInitialized) {
      message.error('SDK未初始化');
      return false;
    }

    try {
      setLoading(true);
      
      // 处理不同的参数格式
      let to, finalValue, finalData;
      
      if (typeof txData === 'object' && txData.to) {
        // 新格式：对象参数
        to = txData.to;
        finalValue = txData.value || '0';
        finalData = txData.data || '0x';
        
        // 如果启用了paymaster，这里可以添加相关逻辑
        if (txData.usePaymaster && txData.paymasterConfig) {
          console.log('使用Paymaster配置:', txData.paymasterConfig);
          // TODO: 实现paymaster逻辑
        }
      } else {
        // 旧格式：直接参数（向后兼容）
        to = txData;
        finalValue = value;
        finalData = data;
      }
      
      const result = await etherspotService.sendTransaction(to, finalValue, finalData);
      
      if (result) {
        message.success('交易发送成功');
        // 刷新账户信息
        await fetchSmartAccount();
        return result;
      } else {
        message.error('交易发送失败');
        return false;
      }
    } catch (error) {
      console.error('发送交易失败:', error);
      message.error('发送交易失败: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [smartAccount, isInitialized, fetchSmartAccount]);

  // 执行批量交易（使用本地智能账户的批处理功能）
  const executeBatchTransaction = useCallback(async (transactions, gasOptions = {}, customConfig = {}) => {
    if (!smartAccount) {
      message.error('请先创建智能账户');
      return false;
    }

    if (!isInitialized) {
      message.error('SDK未初始化');
      return false;
    }

    try {
      setLoading(true);
      
      // 使用 etherspotService 的批量交易功能
      console.log('执行批量交易:', transactions);
      
      const result = await etherspotService.executeBatchTransactions(transactions, gasOptions);
      
      // etherspotService.executeBatchTransactions 返回的是 { userOpHash, wait, transactions }
      if (result && result.userOpHash) {
        message.success('批量交易执行成功');
        await fetchSmartAccount(customConfig);
        return {
          success: true,
          transactionHash: result.userOpHash,
          userOpHash: result.userOpHash,
          wait: result.wait,
          transactionCount: result.transactions
        };
      } else {
        message.error('批量交易执行失败');
        return false;
      }
    } catch (error) {
      console.error('批量交易失败:', error);
      message.error('批量交易失败: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [smartAccount, isInitialized, fetchSmartAccount]);

  // 获取余额
  const getBalance = useCallback(async (tokenAddress = null, customConfig = {}) => {
    // 如果SDK未初始化，等待初始化完成
    if (!isInitialized) {
      console.log('SDK未初始化，等待初始化完成...');
      return {
        nativeBalance: '0.0',
        tokenBalance: '0.0',
        token: {
          balance: '0.0',
          symbol: 'TestToken',
          decimals: 18
        }
      };
    }

    try {
      const smartAccountAddress = await etherspotService.calculateSmartAccountAddress(address, customConfig);
      console.log('正在查询智能账户余额，地址:', smartAccountAddress);
      
      // 获取余额信息 - etherspotService.getBalance() 返回字符串格式的ETH余额
      const nativeBalance = await etherspotService.getBalance();
      console.log('获取到的原生代币余额:', nativeBalance);
      
      const result = {
        nativeBalance: nativeBalance || '0.0',
        tokenBalance: '0.0', // 默认代币余额
        token: {
          balance: '0.0',
          symbol: 'TestToken',
          decimals: 18
        }
      };

      // 如果提供了代币地址，获取代币余额
      if (tokenAddress) {
        try {
          console.log('正在获取代币余额，代币地址:', tokenAddress);
          const tokenBalance = await etherspotService.getTokenBalance(tokenAddress);
          console.log('获取到的代币余额:', tokenBalance);
          result.tokenBalance = tokenBalance;
          result.token = {
            balance: tokenBalance,
            symbol: 'MockERC20',
            decimals: 18
          };
        } catch (tokenError) {
          console.warn('获取代币余额失败:', tokenError);
          // 保持默认值
        }
      }

      console.log('最终返回的余额数据:', result);
      return result;
    } catch (error) {
      console.error('获取余额失败:', error);
      // 返回默认值而不是抛出错误
      return {
        nativeBalance: '0.0',
        tokenBalance: '0.0',
        token: {
          balance: '0.0',
          symbol: 'TestToken',
          decimals: 18
        }
      };
    }
  }, [isInitialized, address]);

  // 添加守护者（Etherspot使用不同的安全模型，这里保持接口兼容性）
  const addGuardian = useCallback(async (guardianAddress) => {
    message.info('Etherspot 使用不同的安全模型，不需要传统的守护者概念');
    return true;
  }, []);

  // 移除守护者（保持接口兼容性）
  const removeGuardian = useCallback(async (guardianAddress) => {
    message.info('Etherspot 使用不同的安全模型，不需要传统的守护者概念');
    return true;
  }, []);

  // 账户切换时重置状态
  useEffect(() => {
    // 只有当地址真正发生变化时才重置状态
    if (isConnected && address && previousAddress && address !== previousAddress) {
      console.log('检测到账户切换，从', previousAddress, '到', address);
      // 当账户地址变化时，清除之前的智能账户状态
      setSmartAccount(null);
      setIsInitialized(false);
      etherspotService.cleanup();
    }
    
    // 更新之前的地址
    if (address !== previousAddress) {
      setPreviousAddress(address);
    }
  }, [address, isConnected, previousAddress]);

  // 初始化效果 - 放在账户切换逻辑之后，确保正确的执行顺序
  useEffect(() => {
    if (isConnected && address && walletClient && !isInitialized) {
      initializeEtherspot();
    } else if (!isConnected) {
      setSmartAccount(null);
      setIsInitialized(false);
      setPreviousAddress(null);
      etherspotService.cleanup();
    }
  }, [isConnected, address, walletClient, isInitialized, initializeEtherspot]);

  // 获取账户信息效果 - 只有在初始化完成且地址存在时才执行
  useEffect(() => {
    if (isInitialized && address && isConnected) {
      fetchSmartAccount();
    }
  }, [isInitialized, address, isConnected, fetchSmartAccount]);

  return {
    smartAccount,
    smartAccountAddress: smartAccount?.address,
    loading,
    guardians: smartAccount?.guardians || [],
    createSmartAccount,
    addGuardian,
    removeGuardian,
    executeBatchTransaction,
    sendTransaction,
    fetchSmartAccount,
    getBalance,
    isInitialized
  };
};