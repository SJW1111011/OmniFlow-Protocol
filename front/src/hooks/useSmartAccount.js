import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { message } from 'antd';
import contractService from '../apis/contractService';

export const useSmartAccount = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [smartAccount, setSmartAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guardians, setGuardians] = useState([]);

  // 初始化合约服务
  useEffect(() => {
    if (walletClient) {
      contractService.initProvider(walletClient).then(() => {
        console.log('合约服务初始化成功');
      }).catch(error => {
        console.error('初始化合约服务失败:', error);
      });
    }
  }, [walletClient]);

  // 获取智能账户信息
  const fetchSmartAccount = useCallback(async () => {
    if (!address || !isConnected) return;
    
    try {
      setLoading(true);
      
      // 确保合约服务已初始化
      if (!contractService.provider) {
        await contractService.initProvider(walletClient);
      }
      
      // 使用示例智能账户地址进行测试
      const testAddress = '0x0679e8c3B42556B5F50B4250517a268852F4E8b5';
      const accountInfo = await contractService.getSmartAccountInfo(testAddress);
      if (accountInfo && accountInfo.success) {
        setSmartAccount(accountInfo.info);
        setGuardians(accountInfo.info.guardians || []);
      }
    } catch (error) {
      console.error('获取智能账户失败:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, walletClient]);

  // 创建智能账户
  const createSmartAccount = useCallback(async (initialGuardians = []) => {
    if (!address) {
      message.error('请先连接钱包');
      return false;
    }

    try {
      setLoading(true);
      
      // 设置默认守护者（如果没有提供）
      const guardians = initialGuardians.length > 0 ? initialGuardians : [
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // 默认守护者1
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'  // 默认守护者2
      ];
      
      const requiredGuardians = Math.min(guardians.length, 2); // 需要的守护者数量
      const salt = contractService.generateSalt(); // 生成随机salt
      
      console.log('创建智能账户参数:', {
        owner: address,
        guardians,
        requiredGuardians,
        salt
      });
      
      const result = await contractService.createSmartAccount(address, guardians, requiredGuardians, salt);
      
      if (result.success) {
        message.success('智能账户创建成功');
        // 获取创建的账户信息
        const accountInfo = {
          address: result.accountAddress,
          owner: address,
          guardians: guardians,
          requiredGuardians: requiredGuardians
        };
        setSmartAccount(accountInfo);
        setGuardians(guardians);
        return true;
      } else {
        message.error(result.error || '创建失败');
        return false;
      }
    } catch (error) {
      console.error('创建智能账户失败:', error);
      message.error('创建智能账户失败: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [address]);

  // 添加守护者
  const addGuardian = useCallback(async (guardianAddress) => {
    if (!smartAccount) {
      message.error('请先创建智能账户');
      return false;
    }

    try {
      setLoading(true);
      
      const result = await contractService.addGuardian(smartAccount.address, guardianAddress);

      if (result.success) {
        message.success('守护者添加成功');
        await fetchSmartAccount(); // 刷新账户信息
        return true;
      } else {
        message.error(result.error || '添加失败');
        return false;
      }
    } catch (error) {
      console.error('添加守护者失败:', error);
      message.error('添加守护者失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [smartAccount, fetchSmartAccount]);

  // 移除守护者
  const removeGuardian = useCallback(async (guardianAddress) => {
    if (!smartAccount) {
      message.error('请先创建智能账户');
      return false;
    }

    try {
      setLoading(true);
      
      const result = await contractService.removeGuardian(smartAccount.address, guardianAddress);

      if (result.success) {
        message.success('守护者移除成功');
        await fetchSmartAccount(); // 刷新账户信息
        return true;
      } else {
        message.error(result.error || '移除失败');
        return false;
      }
    } catch (error) {
      console.error('移除守护者失败:', error);
      message.error('移除守护者失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [smartAccount, fetchSmartAccount]);

  // 执行批量交易
  const executeBatchTransaction = useCallback(async (transactions) => {
    if (!smartAccount) {
      message.error('请先创建智能账户');
      return false;
    }

    try {
      setLoading(true);
      
      const result = await contractService.executeBatchTransaction(smartAccount.address, transactions);

      if (result.success) {
        message.success('批量交易执行成功');
        return result.transactionHash;
      } else {
        message.error(result.error || '交易执行失败');
        return false;
      }
    } catch (error) {
      console.error('批量交易失败:', error);
      message.error('批量交易失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [smartAccount]);

  // 初始化时获取智能账户信息
  useEffect(() => {
    if (isConnected && address) {
      fetchSmartAccount();
    } else {
      setSmartAccount(null);
      setGuardians([]);
    }
  }, [isConnected, address, fetchSmartAccount]);

  return {
    smartAccount,
    loading,
    guardians,
    createSmartAccount,
    addGuardian,
    removeGuardian,
    executeBatchTransaction,
    fetchSmartAccount,
  };
};