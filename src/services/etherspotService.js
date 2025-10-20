import { PrimeSdk, EtherspotBundler, MetaMaskWalletProvider } from '@etherspot/prime-sdk';
import { ethers } from 'ethers';

class EtherspotService {
  constructor() {
    this.primeSdk = null;
    this.bundler = null;
    this.provider = null;
    this.signer = null;
    this.isInitialized = false;
    this.actualChainId = null; // 保存实际使用的链ID
    this.supportedChains = {
      ethereum: { chainId: 1, name: 'Ethereum Mainnet' },
      sepolia: { chainId: 11155111, name: 'Sepolia Testnet' },
      polygon: { chainId: 137, name: 'Polygon Mainnet' },
      mumbai: { chainId: 80001, name: 'Polygon Mumbai' },
      arbitrum: { chainId: 42161, name: 'Arbitrum One' },
      optimism: { chainId: 10, name: 'Optimism' }
    };
  }

  /**
   * 初始化Etherspot SDK - 使用MetaMask钱包
   * @param {Object} walletClient - Wagmi钱包客户端
   * @param {number} chainId - 链ID (默认11155111为Sepolia测试网)
   */
  async initializeWithWallet(walletClient, chainId = 11155111) {
    try {
      console.log('使用MetaMask钱包初始化 EtherspotService，参数:', { chainId });
      
      // 统一使用 Sepolia 测试网
      const actualChainId = 11155111; // Sepolia chainId
      const actualRpcUrl = 'https://eth-sepolia.g.alchemy.com/v2/i5LOb9tsBpvhiLY25PMsuuLhUsAX62wK';

      // 创建 provider 实例用于合约调用
      this.provider = new ethers.providers.JsonRpcProvider(actualRpcUrl);

      // 使用 MetaMask 钱包提供者
      console.log('连接 MetaMask 钱包...');
      const metamaskProvider = await MetaMaskWalletProvider.connect();
      
      // 根据官方文档，使用 MetaMask 提供者初始化 PrimeSdk
      console.log('初始化 PrimeSdk with MetaMask...');
      this.primeSdk = new PrimeSdk(
        metamaskProvider,
        {
          chainId: actualChainId,
          bundlerProvider: new EtherspotBundler(actualChainId, 'eyJvcmciOiI2NTIzZjY5MzUwOTBmNzAwMDFiYjJkZWIiLCJpZCI6IjY1MjNmNmIzNTA5MGY3MDAwMWJiMmRmMSIsImgiOiJtdWVybXVyaGFzaDEyOCJ9')
        }
      );

      // 验证 SDK 初始化
      const smartAccountAddress = await this.primeSdk.getCounterFactualAddress();
      console.log('智能账户地址:', smartAccountAddress);

      if (!smartAccountAddress) {
        throw new Error('无法获取智能账户地址');
      }

      console.log('Etherspot SDK with MetaMask initialized successfully');
      this.isInitialized = true;
      this.actualChainId = actualChainId;
      return true;
    } catch (error) {
      console.error('Failed to initialize Etherspot SDK with MetaMask:', error);
      this.primeSdk = null;
      this.provider = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 初始化Etherspot SDK - 使用私钥（保留用于测试）
   * @param {string} privateKey - 用户私钥
   * @param {string} rpcUrl - RPC URL (默认使用本地网络)
   * @param {number} chainId - 链ID (默认31337为本地网络)
   */
  async initialize(privateKey, rpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com', chainId = 11155111) {
    try {
      console.log('初始化 EtherspotService，参数:', { rpcUrl, chainId });
      
      // 统一使用 Sepolia 测试网
      const actualChainId = 11155111; // Sepolia chainId
      const actualRpcUrl = 'https://eth-sepolia.g.alchemy.com/v2/i5LOb9tsBpvhiLY25PMsuuLhUsAX62wK';

      // 创建 provider 实例用于合约调用
      this.provider = new ethers.providers.JsonRpcProvider(actualRpcUrl);

      // 根据官方文档，使用最简配置初始化 PrimeSdk
      console.log('初始化 PrimeSdk...');
      this.primeSdk = new PrimeSdk(
        { privateKey },
        { chainId: actualChainId }
      );

      // 验证 SDK 初始化
      const smartAccountAddress = await this.primeSdk.getCounterFactualAddress();
      console.log('智能账户地址:', smartAccountAddress);

      if (!smartAccountAddress) {
        throw new Error('无法获取智能账户地址');
      }

      console.log('Etherspot SDK initialized successfully');
      this.isInitialized = true;
      this.actualChainId = actualChainId;
      return true;
    } catch (error) {
      console.error('Failed to initialize Etherspot SDK:', error);
      this.primeSdk = null;
      this.provider = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 获取智能账户地址
   */
  async getSmartAccountAddress() {
    console.log('getSmartAccountAddress 调用，isInitialized:', this.isInitialized, 'primeSdk:', !!this.primeSdk);
    
    if (!this.primeSdk || !this.isInitialized) {
      console.error('Etherspot SDK not initialized - primeSdk:', !!this.primeSdk, 'isInitialized:', this.isInitialized);
      throw new Error('Etherspot SDK not initialized');
    }

    try {
      const address = await this.primeSdk.getCounterFactualAddress();
      console.log('Smart Account Address:', address);
      return address;
    } catch (error) {
      console.error('Failed to get smart account address:', error);
      throw error;
    }
  }

  /**
   * 检查智能账户是否已部署
   */
  async isSmartAccountDeployed() {
    if (!this.primeSdk) {
      throw new Error('Etherspot SDK not initialized');
    }

    try {
      const address = await this.getSmartAccountAddress();
      const code = await this.provider.getCode(address);
      return code !== '0x';
    } catch (error) {
      console.error('Failed to check smart account deployment:', error);
      throw error;
    }
  }

  /**
   * 创建并部署智能账户
   */
  async createSmartAccount() {
    if (!this.primeSdk) {
      throw new Error('Etherspot SDK not initialized');
    }

    try {
      console.log('开始创建智能账户...');

      // 检查是否已部署
      const isDeployed = await this.isSmartAccountDeployed();
      if (isDeployed) {
        const address = await this.getSmartAccountAddress();
        console.log('Smart account already deployed at:', address);
        return { address, isNewDeployment: false };
      }

      // 获取智能账户地址
      const smartAccountAddress = await this.getSmartAccountAddress();
      if (!smartAccountAddress) {
        throw new Error('无法获取智能账户地址');
      }

      console.log('智能账户地址:', smartAccountAddress);

      // 清空之前的批次
      try {
        await this.primeSdk.clearUserOpsFromBatch();
      } catch (clearError) {
        console.warn('清空批次失败，继续执行:', clearError);
      }

      // 创建一个简单的交易来触发智能账户部署
      const userOpsBatch = await this.primeSdk.addUserOpsToBatch({
        to: smartAccountAddress, // 发送给自己
        value: ethers.utils.parseEther('0'), // 0 ETH
        data: '0x' // 空数据
      });

      console.log('UserOps batch created:', userOpsBatch);

      // 估算gas费用
      let gasEstimate;
      try {
        gasEstimate = await this.primeSdk.estimate();
        console.log('Gas estimate:', gasEstimate);
        
        if (!gasEstimate) {
          throw new Error('Gas estimation failed - no estimate returned');
        }
      } catch (estimateError) {
        console.error('Gas 估算失败:', estimateError);
        throw new Error(`Gas estimation failed: ${estimateError.message}`);
      }

      // 检查部署账户余额
      try {
        const balance = await this.getBalance();
        console.log('部署账户余额:', balance, 'ETH');
        
        if (parseFloat(balance) === 0) {
          throw new Error('部署账户余额不足，请先充值');
        }
      } catch (balanceError) {
        console.error('获取余额失败:', balanceError);
        throw new Error('无法获取账户余额，请检查网络连接');
      }

      // 发送用户操作
      console.log('正在部署智能账户...');
      const userOpResponse = await this.primeSdk.send();
      console.log('UserOp sent:', userOpResponse);

      // 验证响应
      if (!userOpResponse || !userOpResponse.userOpHash) {
        throw new Error('部署交易响应无效');
      }

      // 等待交易确认
      console.log('等待交易确认...');
      const receipt = await userOpResponse.wait();
      console.log('Transaction receipt:', receipt);

      const address = await this.getSmartAccountAddress();
      return { 
        address, 
        isNewDeployment: true,
        transactionHash: receipt.transactionHash,
        userOpHash: userOpResponse.userOpHash
      };

    } catch (error) {
      console.error('Failed to create smart account:', error);
      
      // 提供更详细的错误信息
      if (error.message && error.message.includes('Cannot convert undefined or null to object')) {
        throw new Error('智能账户创建失败：参数验证错误，请检查网络连接');
      } else if (error.message && error.message.includes('insufficient funds')) {
        throw new Error('智能账户创建失败：余额不足，请充值后重试');
      } else if (error.message && error.message.includes('gas')) {
        throw new Error('智能账户创建失败：Gas 估算失败，请检查网络状态');
      }
      
      throw error;
    }
  }

  /**
   * 执行批量交易
   * @param {Array} transactions - 交易数组，每个交易包含 {to, value, data}
   * @returns {Promise} 交易结果
   */
  async executeBatchTransactions(transactions) {
    if (!this.primeSdk) {
      throw new Error('Etherspot SDK not initialized');
    }

    try {
      console.log('🚀 开始执行批量交易...');
      console.log('📋 交易数据:', JSON.stringify(transactions, null, 2));

      // 检查智能账户是否已部署
      const smartAccountAddress = await this.getSmartAccountAddress();
      console.log('📍 智能账户地址:', smartAccountAddress);
      
      const isDeployed = await this.isSmartAccountDeployed();
      console.log('🏗️ 智能账户是否已部署:', isDeployed);

      // 获取当前余额
      const balance = await this.getBalance();
      console.log('💰 当前智能账户余额:', balance);

      // 记录接收方地址的初始余额
      const recipientBalances = {};
      for (const tx of transactions) {
        if (tx.to && ethers.utils.isAddress(tx.to)) {
          try {
            const recipientBalance = await this.provider.getBalance(tx.to);
            recipientBalances[tx.to] = ethers.utils.formatEther(recipientBalance);
            console.log(`💰 接收方 ${tx.to} 初始余额:`, recipientBalances[tx.to]);
          } catch (error) {
            console.warn(`获取接收方 ${tx.to} 余额失败:`, error);
          }
        }
      }

      // 根据官方文档，使用 addUserOpsToBatch 方法添加交易
      let transactionBatch = null;
      
      for (const [index, tx] of transactions.entries()) {
        console.log(`📝 处理第 ${index + 1} 笔交易:`, tx);
        
        // 验证交易数据
        if (!tx.to || !ethers.utils.isAddress(tx.to)) {
          throw new Error(`无效的接收地址: ${tx.to}`);
        }

        // 确保 value 是 BigNumber 格式
        let value;
        try {
          value = tx.value && tx.value !== '0' ? 
            ethers.utils.parseEther(tx.value.toString()) : 
            ethers.BigNumber.from('0');
          console.log(`💵 转账金额 (Wei):`, value.toString());
        } catch (error) {
          throw new Error(`无效的转账金额: ${tx.value}`);
        }

        const transactionData = {
          to: tx.to,
          value: value
        };

        // 如果有 data 字段，添加到交易中
        if (tx.data && tx.data !== '0x') {
          transactionData.data = tx.data;
        }

        console.log('➕ 添加交易到批次:', transactionData);
        transactionBatch = await this.primeSdk.addUserOpsToBatch(transactionData);
        console.log('✅ 交易已添加到批次');
      }

      // 估算交易费用
      console.log('⚡ 估算交易费用...');
      const op = await this.primeSdk.estimate();
      console.log('📊 估算结果:', JSON.stringify(op, null, 2));

      // 检查Gas费用
      if (op.callGasLimit) {
        console.log('⛽ Gas限制:', op.callGasLimit.toString());
      }
      if (op.maxFeePerGas) {
        console.log('💸 最大Gas费用:', op.maxFeePerGas.toString());
      }

      // 发送交易
      console.log('📤 发送批量交易...');
      const userOpHash = await this.primeSdk.send(op);
      console.log('🔗 UserOp Hash:', userOpHash);

      // 等待交易确认
      console.log('⏳ 等待交易确认...');
      const receipt = await this.waitForTransactionReceipt(userOpHash);
      console.log('✅ 交易已确认:', JSON.stringify(receipt, null, 2));
      
      // 分析交易收据
      const analysis = await this.analyzeTransactionReceipt(receipt);
      console.log('🔍 交易分析结果:', analysis);
      
      // 检查接收方余额变化
      console.log('🔍 检查接收方余额变化...');
      for (const tx of transactions) {
        if (tx.to && recipientBalances[tx.to]) {
          const balanceChange = await this.checkBalanceChange(tx.to, recipientBalances[tx.to]);
          if (balanceChange) {
            console.log(`💰 接收方 ${tx.to} 余额变化:`, balanceChange);
            
            if (balanceChange.change <= 0) {
              console.log('⚠️ 警告: 接收方余额没有增加，可能存在问题!');
            }
          }
        }
      }
      
      // 检查交易是否成功
      if (receipt && receipt.success !== false) {
        console.log('🎉 批量交易执行成功!');
        
        // 获取更新后的余额
        setTimeout(async () => {
          try {
            const newBalance = await this.getBalance();
            console.log('💰 交易后余额:', newBalance);
          } catch (error) {
            console.log('获取交易后余额失败:', error);
          }
        }, 3000);
        
        return {
          success: true,
          userOpHash,
          transactionHash: receipt?.receipt?.transactionHash || receipt?.transactionHash,
          blockNumber: receipt?.receipt?.blockNumber || receipt?.blockNumber,
          receipt,
          analysis,
          message: '批量交易已确认'
        };
      } else {
        throw new Error('交易执行失败，请检查交易详情');
      }
    } catch (error) {
      console.error('❌ 批量交易执行失败:', error);
      console.error('错误堆栈:', error.stack);
      throw error;
    }
  }

  /**
   * 等待交易确认
   */
  async waitForTransactionReceipt(userOpHash, timeoutMs = 60000) {
    console.log('等待 UserOp 被打包:', userOpHash);
    
    const startTime = Date.now();
    const pollInterval = 2000; // 2秒轮询一次
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await this.primeSdk.getUserOpReceipt(userOpHash);
        if (receipt) {
          console.log('交易已确认:', receipt);
          return receipt;
        }
      } catch (error) {
        console.log('轮询交易状态时出错:', error.message);
      }
      
      // 等待下次轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`交易确认超时: ${userOpHash}`);
  }

  /**
   * 设置代币支付Gas费 (Paymaster)
   * @param {string} tokenAddress - 代币合约地址
   * @param {string} tokenAmount - 代币数量
   */
  async setupTokenPaymaster(tokenAddress, tokenAmount) {
    try {
      // 这里应该集成实际的Paymaster服务
      // 目前使用模拟实现
      console.log(`Setting up paymaster for token: ${tokenAddress}, amount: ${tokenAmount}`);
      
      // 实际实现中，这里会调用Etherspot的Paymaster API
      // await this.primeSdk.setPaymasterApi(paymasterUrl);
      
      return true;
    } catch (error) {
      console.error('Failed to setup token paymaster:', error);
      throw error;
    }
  }

  /**
   * 跨链Gas抽象转账
   * @param {string} to - 接收地址
   * @param {string} amount - 转账金额
   * @param {string} tokenAddress - 代币地址
   * @param {number} targetChainId - 目标链ID
   */
  async crossChainTransfer(to, amount, tokenAddress, targetChainId) {
    try {
      // 构建跨链转账交易
      const transactions = [
        {
          to: tokenAddress,
          data: this.encodeTransferData(to, amount)
        }
      ];

      // 如果是跨链转账，添加桥接交易
      if (targetChainId && targetChainId !== await this.getCurrentChainId()) {
        const bridgeTransaction = await this.buildBridgeTransaction(
          tokenAddress, 
          amount, 
          targetChainId, 
          to
        );
        transactions.push(bridgeTransaction);
      }

      // 执行批量交易，使用代币支付Gas
      return await this.executeBatchTransactions(transactions, {
        payWithToken: tokenAddress,
        tokenAmount: ethers.utils.parseUnits('10', 18) // 预留10个代币作为Gas费
      });

    } catch (error) {
      console.error('Failed to execute cross-chain transfer:', error);
      throw error;
    }
  }

  /**
   * 构建桥接交易
   */
  async buildBridgeTransaction(tokenAddress, amount, targetChainId, recipient) {
    // 这里应该集成实际的跨链桥协议
    // 目前返回模拟交易
    return {
      to: '0x1234567890123456789012345678901234567890', // 桥接合约地址
      data: '0x', // 桥接调用数据
      value: '0'
    };
  }

  /**
   * 编码ERC20转账数据
   */
  encodeTransferData(to, amount) {
    const iface = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount) returns (bool)'
    ]);
    return iface.encodeFunctionData('transfer', [to, amount]);
  }

  /**
   * 获取当前链ID
   */
  async getCurrentChainId() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    const network = await this.provider.getNetwork();
    return network.chainId;
  }

  /**
   * 获取多链余额
   * @param {string} tokenAddress - 代币地址 (可选)
   */
  async getMultiChainBalance(tokenAddress = null) {
    try {
      const address = await this.getSmartAccountAddress();
      const balances = {};

      // 获取当前链余额
      const currentChainId = await this.getCurrentChainId();
      
      if (tokenAddress) {
        // 获取代币余额
        const tokenBalance = await this.getTokenBalance(tokenAddress);
        balances[currentChainId] = {
          native: await this.getBalance(),
          token: tokenBalance
        };
      } else {
        // 只获取原生代币余额
        balances[currentChainId] = {
          native: await this.getBalance()
        };
      }

      return balances;
    } catch (error) {
      console.error('Failed to get multi-chain balance:', error);
      throw error;
    }
  }

  /**
   * 获取代币余额
   * @param {string} tokenAddress - 代币合约地址
   */
  async getTokenBalance(tokenAddress) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const address = await this.getSmartAccountAddress();
      
      // ERC20 balanceOf ABI
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await tokenContract.balanceOf(address);
      const decimals = await tokenContract.decimals();
      const symbol = await tokenContract.symbol();
      
      return {
        balance: ethers.utils.formatUnits(balance, decimals),
        symbol,
        decimals,
        raw: balance.toString()
      };
    } catch (error) {
      console.error('Failed to get token balance:', error);
      throw error;
    }
  }

  /**
   * 社交恢复功能 - 添加守护者
   * @param {Array} guardians - 守护者地址数组
   */
  async addGuardians(guardians) {
    try {
      // 目前使用模拟实现
      console.log('Adding guardians:', guardians);
      
      const smartAccountAddress = await this.getSmartAccountAddress();
      const transactions = guardians.map(guardian => ({
        to: smartAccountAddress,
        data: this.encodeAddGuardianData(guardian)
      }));

      return await this.executeBatchTransactions(transactions);
    } catch (error) {
      console.error('Failed to add guardians:', error);
      throw error;
    }
  }

  /**
   * 编码添加守护者的数据
   */
  encodeAddGuardianData(guardian) {
    // 这里应该根据实际的智能账户合约ABI来编码
    // 目前返回模拟数据
    return '0x';
  }

  /**
   * 发送交易
   * @param {string} to - 接收地址
   * @param {string} value - 发送金额 (wei)
   * @param {string} data - 交易数据
   */
  async sendTransaction(to, value = '0', data = '0x') {
    if (!this.primeSdk) {
      throw new Error('Etherspot SDK not initialized');
    }

    // 参数验证
    if (!to || typeof to !== 'string' || !ethers.utils.isAddress(to)) {
      throw new Error('Invalid recipient address');
    }

    if (!value) {
      value = '0';
    }

    if (!data) {
      data = '0x';
    }

    try {
      console.log('发送交易参数:', { to, value, data });

      // 确保智能账户已初始化
      const smartAccountAddress = await this.getSmartAccountAddress();
      if (!smartAccountAddress) {
        throw new Error('Smart account address not available');
      }

      // 将value转换为wei（如果是字符串形式的ETH值）
      let valueInWei;
      try {
        if (typeof value === 'string' && value.includes('.')) {
          // 如果是小数形式的ETH值，转换为wei
          valueInWei = ethers.utils.parseEther(value);
        } else {
          // 否则直接使用BigNumber
          valueInWei = ethers.BigNumber.from(value);
        }
      } catch (parseError) {
        console.error('Value parsing error:', parseError);
        throw new Error(`Invalid value format: ${value}`);
      }

      console.log('转换后的值 (wei):', valueInWei.toString());

      // 清空之前的批次
      try {
        await this.primeSdk.clearUserOpsFromBatch();
      } catch (clearError) {
        console.warn('清空批次失败，继续执行:', clearError);
      }

      // 添加交易到批次
      const userOpsBatch = await this.primeSdk.addUserOpsToBatch({
        to: to,
        value: valueInWei,
        data: data
      });

      console.log('UserOps batch created:', userOpsBatch);

      // 估算gas
      let gasEstimate;
      try {
        gasEstimate = await this.primeSdk.estimate();
        console.log('Gas estimate for transaction:', gasEstimate);
        
        // 验证gas估算结果
        if (!gasEstimate) {
          throw new Error('Gas estimation failed - no estimate returned');
        }
      } catch (estimateError) {
        console.error('Gas estimation failed:', estimateError);
        throw new Error(`Gas estimation failed: ${estimateError.message}`);
      }

      // 发送交易前的最后验证
      try {
        // 检查账户余额
        const balance = await this.getBalance();
        console.log('账户余额:', balance, 'ETH');
        
        if (parseFloat(balance) === 0) {
          console.warn('账户余额为0，交易可能失败');
        }
      } catch (balanceError) {
        console.warn('获取余额失败:', balanceError);
      }

      // 发送交易
      console.log('正在发送交易...');
      const userOpResponse = await this.primeSdk.send();
      console.log('Transaction sent successfully:', userOpResponse);

      // 验证响应
      if (!userOpResponse || !userOpResponse.userOpHash) {
        throw new Error('Invalid transaction response');
      }

      return userOpResponse;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      
      // 提供更详细的错误信息
      if (error.message && error.message.includes('Cannot convert undefined or null to object')) {
        throw new Error('交易参数验证失败，请检查网络连接和账户状态');
      } else if (error.message && error.message.includes('insufficient funds')) {
        throw new Error('账户余额不足，请充值后重试');
      } else if (error.message && error.message.includes('gas')) {
        throw new Error('Gas 估算失败，请检查网络状态');
      }
      
      throw error;
    }
  }

  /**
   * 获取智能账户余额
   */
  async getBalance() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const address = await this.getSmartAccountAddress();
      console.log('etherspotService.getBalance - 智能账户地址:', address);
      
      const balance = await this.provider.getBalance(address);
      console.log('etherspotService.getBalance - 原始余额 (wei):', balance.toString());
      
      // 使用更兼容的方式格式化余额
      let formattedBalance;
      try {
        // 尝试使用 ethers v5 的方式
        formattedBalance = ethers.utils.formatEther(balance);
      } catch (error) {
        console.warn('ethers.utils.formatEther 失败，尝试其他方式:', error);
        // 手动转换
        const balanceInEth = balance.toString() / Math.pow(10, 18);
        formattedBalance = balanceInEth.toString();
      }
      
      console.log('etherspotService.getBalance - 格式化余额 (ETH):', formattedBalance);
      
      return formattedBalance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * 计算智能账户地址（兼容性方法）
   * @param {string} ownerAddress - 所有者地址
   * @param {object} customConfig - 自定义配置（为了兼容性保留，但在Etherspot SDK中不使用）
   */
  async calculateSmartAccountAddress(ownerAddress, customConfig = {}) {
    if (!this.primeSdk) {
      throw new Error('Etherspot SDK not initialized');
    }

    try {
      // 在Etherspot SDK中，智能账户地址是通过getCounterFactualAddress获取的
      // 这个地址是基于当前初始化的钱包计算的
      const address = await this.primeSdk.getCounterFactualAddress();
      console.log('计算的智能账户地址:', address, '(基于当前钱包)');
      return address;
    } catch (error) {
      console.error('Failed to calculate smart account address:', error);
      throw error;
    }
  }

  /**
   * 获取支持的链列表
   */
  getSupportedChains() {
    return Object.values(this.supportedChains);
  }

  /**
   * 分析交易收据，检查资金转移情况
   */
  async analyzeTransactionReceipt(receipt) {
    console.log('🔍 分析交易收据...');
    
    if (!receipt || !receipt.receipt) {
      console.log('❌ 无效的交易收据');
      return { success: false, message: '无效的交易收据' };
    }
    
    const txReceipt = receipt.receipt;
    console.log('📋 交易基本信息:');
    console.log('  - 交易哈希:', txReceipt.transactionHash);
    console.log('  - 区块号:', txReceipt.blockNumber);
    console.log('  - Gas使用量:', txReceipt.gasUsed?.toString());
    console.log('  - 交易状态:', txReceipt.status);
    
    // 分析事件日志
    if (txReceipt.logs && txReceipt.logs.length > 0) {
      console.log('📝 事件日志分析:');
      
      for (const [index, log] of txReceipt.logs.entries()) {
        console.log(`  事件 ${index + 1}:`);
        console.log('    - 合约地址:', log.address);
        console.log('    - 主题:', log.topics);
        console.log('    - 数据:', log.data);
        
        // 检查是否是ETH转账事件
        if (log.topics && log.topics.length > 0) {
          const eventSignature = log.topics[0];
          
          // ETH转账通常会触发这些事件
          if (eventSignature === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            console.log('    ✅ 检测到ERC20转账事件');
          } else if (eventSignature === '0x2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c4') {
            console.log('    ✅ 检测到ETH转账事件');
          } else {
            console.log('    ❓ 未知事件类型:', eventSignature);
          }
        }
      }
    } else {
      console.log('⚠️ 没有找到事件日志 - 这可能表明交易没有执行预期的操作');
    }
    
    // 检查交易是否真正成功
    const isSuccess = txReceipt.status === 1 || txReceipt.status === '0x1';
    console.log('✅ 交易执行状态:', isSuccess ? '成功' : '失败');
    
    return {
      success: isSuccess,
      hasLogs: txReceipt.logs && txReceipt.logs.length > 0,
      gasUsed: txReceipt.gasUsed?.toString(),
      blockNumber: txReceipt.blockNumber,
      transactionHash: txReceipt.transactionHash
    };
  }

  /**
   * 检查特定地址的余额变化
   */
  async checkBalanceChange(address, beforeBalance) {
    try {
      console.log('💰 检查地址余额变化:', address);
      console.log('  - 交易前余额:', beforeBalance);
      
      const afterBalance = await this.provider.getBalance(address);
      const afterBalanceEth = ethers.utils.formatEther(afterBalance);
      
      console.log('  - 交易后余额:', afterBalanceEth);
      
      const balanceChange = parseFloat(afterBalanceEth) - parseFloat(beforeBalance);
      console.log('  - 余额变化:', balanceChange.toFixed(8), 'ETH');
      
      return {
        before: beforeBalance,
        after: afterBalanceEth,
        change: balanceChange
      };
    } catch (error) {
      console.error('检查余额变化失败:', error);
      return null;
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    console.log('清理 EtherspotService');
    this.primeSdk = null;
    this.provider = null;
    this.signer = null;
    this.isInitialized = false;
    this.actualChainId = null;
  }
}

export default new EtherspotService();