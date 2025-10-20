import { ethers, providers, utils, BigNumber } from 'ethers';

// 多网络合约地址配置
const NETWORK_CONTRACTS = {
  localhost: {
    chainId: 31337,
    entryPoint: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    smartAccountFactory: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    testSmartAccount: "0x70511574c08E25Be4a445bf300DAb69aFDcf3F82",
    mockERC20: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
  },
  sepolia: {
    chainId: 11155111,
    entryPoint: "0x7A93344826CA3E410F8838E05C378d77f25aC0Ab",
    smartAccountFactory: "0x1d76001Bc2323Cccd4FdC8B1231e907F645AB765",
    testSmartAccount: "0x49cca6d32e303975ab9748882248f9c3De448669"
  }
};

// 获取当前网络的合约地址
const getNetworkContracts = (chainId) => {
  if (chainId === 31337) return NETWORK_CONTRACTS.localhost;
  if (chainId === 11155111) return NETWORK_CONTRACTS.sepolia;
  return NETWORK_CONTRACTS.localhost; // 默认使用本地网络
};

// 保持向后兼容性
const LOCAL_CONTRACTS = NETWORK_CONTRACTS.localhost;

// 智能账户合约ABI (简化版)
const SMART_ACCOUNT_ABI = [
  "function execute(address to, uint256 value, bytes calldata data) external",
  "function executeBatch(address[] calldata to, uint256[] calldata value, bytes[] calldata data) external",
  "function payGasWithToken(address token, uint256 amount) external",
  "function owner() external view returns (address)",
  "function nonce() external view returns (uint256)",
  "function getBalance() external view returns (uint256)"
];

// ERC20代币ABI
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

class LocalEtherspotService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.smartAccount = null;
    this.mockToken = null;
    this.isInitialized = false;
  }

  /**
   * 检查智能账户资金状况并提供充值建议
   * @param {Array} transactions - 待执行的交易数组
   * @param {Object} gasOptions - Gas选项
   * @returns {Object} 资金检查结果和建议
   */
  async checkFundingRequirements(transactions = [], gasOptions = {}) {
    // 检查是否已初始化
    this._checkInitialized();
    
    try {
      // 获取当前网络信息和合约地址
      const network = await this.provider.getNetwork();
      const contracts = getNetworkContracts(network.chainId);
      
      // 获取智能账户余额 - 使用动态获取的地址
      const smartAccountAddress = await this.getSmartAccountAddress();
      const smartAccountBalance = await this.provider.getBalance(smartAccountAddress);
      
      // 检查智能账户是否已部署
      const isDeployed = await this.isSmartAccountDeployed();
      if (!isDeployed) {
        return {
          currentBalance: utils.formatEther(smartAccountBalance),
          currentBalanceWei: smartAccountBalance.toString(),
          networkGasPrice: '0',
          isDeployed: false,
          error: '智能账户尚未部署，无法执行交易。请先部署智能账户。',
          recommendations: ['请联系管理员部署智能账户合约', '或检查智能账户地址配置是否正确']
        };
      }
      
      // 获取当前Gas价格
      let currentGasPrice;
      try {
        currentGasPrice = await this.provider.getGasPrice();
      } catch (error) {
        currentGasPrice = utils.parseUnits('2', 'gwei');
      }
      
      // 计算基本信息
      const result = {
        currentBalance: utils.formatEther(smartAccountBalance),
        currentBalanceWei: smartAccountBalance.toString(),
        networkGasPrice: utils.formatUnits(currentGasPrice, 'gwei'),
        isDeployed: true,
        recommendations: []
      };
      
      // 如果有交易，计算所需资金
      if (transactions && transactions.length > 0) {
        const addresses = transactions.map(tx => tx.to);
        const values = transactions.map(tx => utils.parseEther(tx.value || '0'));
        const dataArray = transactions.map(tx => tx.data || '0x');
        
        // 计算总交易金额
        const totalValue = values.reduce((sum, value) => sum.add(value), ethers.BigNumber.from(0));
        
        // 设置Gas选项
        const gasSettings = {
          gasLimit: gasOptions.gasLimit || 300000,
          gasPrice: gasOptions.gasPrice || currentGasPrice.mul(110).div(100)
        };
        
        // 限制最大Gas价格
        const maxGasPrice = utils.parseUnits('10', 'gwei');
        if (gasSettings.gasPrice.gt(maxGasPrice)) {
          gasSettings.gasPrice = maxGasPrice;
        }
        
        // 尝试估算实际Gas
        let estimatedGas = gasSettings.gasLimit;
        try {
          estimatedGas = await this.smartAccount.estimateGas.executeBatch(addresses, values, dataArray);
          estimatedGas = estimatedGas.mul(110).div(100); // 添加10%缓冲
        } catch (error) {
          console.warn('无法估算Gas，使用默认值');
        }
        
        const estimatedGasCost = estimatedGas.mul(gasSettings.gasPrice);
        const totalRequired = totalValue.add(estimatedGasCost);
        
        result.transactionAnalysis = {
          transactionValue: utils.formatEther(totalValue),
          estimatedGasCost: utils.formatEther(estimatedGasCost),
          totalRequired: utils.formatEther(totalRequired),
          gasLimit: estimatedGas.toString(),
          gasPrice: utils.formatUnits(gasSettings.gasPrice, 'gwei')
        };
        
        // 检查是否需要充值
        if (smartAccountBalance.lt(totalRequired)) {
          const shortfall = totalRequired.sub(smartAccountBalance);
          result.needsFunding = true;
          result.shortfall = utils.formatEther(shortfall);
          result.recommendations.push(`需要向智能账户充值至少 ${utils.formatEther(shortfall)} ETH`);
          result.recommendations.push(`建议充值 ${utils.formatEther(shortfall.mul(120).div(100))} ETH 以确保有足够余量`);
        } else {
          result.needsFunding = false;
          const surplus = smartAccountBalance.sub(totalRequired);
          result.surplus = utils.formatEther(surplus);
          result.recommendations.push(`当前余额充足，剩余 ${utils.formatEther(surplus)} ETH`);
        }
      } else {
        // 没有具体交易，提供一般性建议
        const minRecommendedBalance = utils.parseEther('0.01'); // 建议最小余额
        
        if (smartAccountBalance.lt(minRecommendedBalance)) {
          result.needsFunding = true;
          const shortfall = minRecommendedBalance.sub(smartAccountBalance);
          result.shortfall = utils.formatEther(shortfall);
          result.recommendations.push(`建议向智能账户充值至少 ${utils.formatEther(minRecommendedBalance)} ETH`);
        } else {
          result.needsFunding = false;
          result.recommendations.push('当前余额充足，可以执行基本交易');
        }
      }
      
      return result;
    } catch (error) {
      console.error('检查资金需求失败:', error);
      throw error;
    }
  }

  /**
   * 初始化本地Etherspot服务
   * @param {string} privateKey - 用户私钥
   * @param {string} rpcUrl - 本地RPC URL
   */
  async initialize(privateKey, rpcUrl = 'http://localhost:8545') {
    try {
      console.log('初始化本地Etherspot服务...');
      
      // 创建provider和signer
      this.provider = new providers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      
      // 获取网络信息
      const network = await this.provider.getNetwork();
      console.log('连接到网络:', network.name, 'ChainId:', network.chainId);
      
      // 根据网络获取合约地址
      const contracts = getNetworkContracts(network.chainId);
      console.log('使用合约地址:', contracts);
      
      // 连接智能账户合约
      this.smartAccount = new ethers.Contract(
        contracts.testSmartAccount,
        SMART_ACCOUNT_ABI,
        this.signer
      );
      
      // 连接MockERC20代币合约 (如果存在)
      if (contracts.mockERC20) {
        this.mockToken = new ethers.Contract(
          contracts.mockERC20,
          ERC20_ABI,
          this.signer
        );
      }
      
      const balance = await this.provider.getBalance(this.signer.address);
      console.log('账户余额:', utils.formatEther(balance), 'ETH');
      
      this.isInitialized = true;
      console.log('✅ 本地Etherspot服务初始化成功');
      return true;
    } catch (error) {
      console.error('❌ 初始化本地Etherspot服务失败:', error);
      throw error;
    }
  }

  /**
   * 使用用户地址初始化本地Etherspot服务（不需要私钥）
   * @param {string} userAddress - 用户钱包地址
   * @param {string} rpcUrl - RPC URL
   */
  async initializeWithAddress(userAddress, rpcUrl = 'http://localhost:8545') {
    try {
      console.log('使用用户地址初始化本地Etherspot服务...', userAddress);
      
      // 创建provider
      this.provider = new providers.JsonRpcProvider(rpcUrl);
      this.userAddress = userAddress; // 存储用户地址
      
      // 获取网络信息
      const network = await this.provider.getNetwork();
      console.log('连接到网络:', network.name, 'ChainId:', network.chainId);
      
      // 根据网络获取合约地址
      const contracts = getNetworkContracts(network.chainId);
      console.log('使用合约地址:', contracts);
      
      // 连接智能账户合约（只读模式）
      this.smartAccount = new ethers.Contract(
        contracts.testSmartAccount,
        SMART_ACCOUNT_ABI,
        this.provider
      );
      
      // 连接MockERC20代币合约 (如果存在，只读模式)
      if (contracts.mockERC20) {
        this.mockToken = new ethers.Contract(
          contracts.mockERC20,
          ERC20_ABI,
          this.provider
        );
      }
      
      const balance = await this.provider.getBalance(userAddress);
      console.log('用户账户余额:', utils.formatEther(balance), 'ETH');
      
      this.isInitialized = true;
      console.log('✅ 本地Etherspot服务初始化成功（地址模式）');
      return true;
    } catch (error) {
      console.error('❌ 初始化本地Etherspot服务失败:', error);
      throw error;
    }
  }

  /**
   * 获取智能账户地址 - 使用固定地址
   */
  async getSmartAccountAddress() {
    this._checkInitialized();
    const chainId = await this.getCurrentChainId();
    const contracts = getNetworkContracts(chainId);
    
    // 直接返回配置的固定智能账户地址
    console.log('使用固定智能账户地址:', contracts.testSmartAccount);
    return contracts.testSmartAccount;
  }

  /**
   * 获取智能账户配置
   * @param {string} ownerAddress - 所有者地址
   * @param {Object} customConfig - 自定义配置
   * @returns {Object} 智能账户配置
   */
  getSmartAccountConfig(ownerAddress, customConfig = {}) {
    // 验证所有者地址
    if (!ownerAddress || !ethers.utils.isAddress(ownerAddress)) {
      throw new Error('无效的所有者地址');
    }

    // 默认配置
    const defaultConfig = {
      guardians: [],
      requiredGuardians: 1,
      saltSuffix: 'default'
    };

    // 合并配置
    const config = { ...defaultConfig, ...customConfig };

    // 验证守护人地址
    if (config.guardians && config.guardians.length > 0) {
      for (const guardian of config.guardians) {
        if (!ethers.utils.isAddress(guardian)) {
          throw new Error(`无效的守护人地址: ${guardian}`);
        }
      }
    } else {
      // 如果没有提供守护人，为每个用户派生唯一的守护人地址
      const derivedGuardian1 = ethers.utils.getAddress(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'address', 'uint256'], ['guardian', ownerAddress, 1])
        ).slice(0, 42)
      );
      const derivedGuardian2 = ethers.utils.getAddress(
        ethers.utils.keccak256(
          ethers.utils.solidityPack(['string', 'address', 'uint256'], ['guardian', ownerAddress, 2])
        ).slice(0, 42)
      );
      config.guardians = [derivedGuardian1, derivedGuardian2];
    }

    // 验证所需守护人数量
    if (config.requiredGuardians < 1 || config.requiredGuardians > config.guardians.length) {
      throw new Error(`所需守护人数量必须在1到${config.guardians.length}之间`);
    }

    return config;
  }

  /**
   * 计算智能账户地址
   */
  async calculateSmartAccountAddress(ownerAddress, customConfig = {}) {
    try {
      const chainId = await this.getCurrentChainId();
      const contracts = getNetworkContracts(chainId);
      
      // SmartAccountFactory ABI
      const factoryABI = [
        'function getSmartAccountAddress(address _owner, address[] memory _guardians, uint256 _requiredGuardians, bytes32 _salt) external view returns (address)'
      ];
      
      const factory = new ethers.Contract(contracts.smartAccountFactory, factoryABI, this.provider);
      
      // 获取用户配置
      const config = this.getSmartAccountConfig(ownerAddress, customConfig);
      
      // 生成唯一的盐值
      const saltString = `smart-account-${ownerAddress}-${config.saltSuffix}-${JSON.stringify(config.guardians)}-${config.requiredGuardians}`;
      const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(saltString));
      
      const predictedAddress = await factory.getSmartAccountAddress(
        ownerAddress, 
        config.guardians, 
        config.requiredGuardians, 
        salt
      );
      
      console.log('智能账户配置:', {
        owner: ownerAddress,
        guardians: config.guardians,
        requiredGuardians: config.requiredGuardians,
        salt: salt,
        predictedAddress: predictedAddress
      });
      
      return predictedAddress;
      
    } catch (error) {
      console.error('计算智能账户地址失败:', error);
      return null;
    }
  }

  /**
   * 创建智能账户
   */
  async createSmartAccount(customConfig = {}) {
    this._checkInitialized();
    
    if (!this.signer || !this.signer.address) {
      throw new Error('需要连接钱包才能创建智能账户');
    }
    
    try {
      const chainId = await this.getCurrentChainId();
      const contracts = getNetworkContracts(chainId);
      
      // SmartAccountFactory ABI
      const factoryABI = [
        'function createSmartAccount(address _owner, address[] memory _guardians, uint256 _requiredGuardians, bytes32 _salt) external payable returns (address)',
        'function getSmartAccountAddress(address _owner, address[] memory _guardians, uint256 _requiredGuardians, bytes32 _salt) external view returns (address)',
        'function creationFee() external view returns (uint256)'
      ];
      
      const factory = new ethers.Contract(contracts.smartAccountFactory, factoryABI, this.signer);
      
      // 获取用户配置
      const owner = this.signer.address;
      const config = this.getSmartAccountConfig(owner, customConfig);
      
      // 生成唯一的盐值
      const saltString = `smart-account-${owner}-${config.saltSuffix}-${JSON.stringify(config.guardians)}-${config.requiredGuardians}`;
      const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(saltString));
      
      // 预计算地址
      const predictedAddress = await factory.getSmartAccountAddress(
        owner, 
        config.guardians, 
        config.requiredGuardians, 
        salt
      );
      
      // 检查是否已部署
      const code = await this.provider.getCode(predictedAddress);
      if (code !== '0x') {
        console.log('智能账户已存在:', predictedAddress);
        return predictedAddress;
      }
      
      // 获取创建费用
      const creationFee = await factory.creationFee();
      
      // 检查余额
      const balance = await this.signer.getBalance();
      if (balance.lt(creationFee)) {
        throw new Error(`余额不足，需要至少 ${utils.formatEther(creationFee)} ETH 来创建智能账户`);
      }
      
      console.log('开始创建智能账户...', {
        owner: owner,
        guardians: config.guardians,
        requiredGuardians: config.requiredGuardians,
        salt: salt,
        predictedAddress: predictedAddress,
        creationFee: utils.formatEther(creationFee) + ' ETH'
      });
      
      const tx = await factory.createSmartAccount(
        owner, 
        config.guardians, 
        config.requiredGuardians, 
        salt, 
        {
          value: creationFee,
          gasLimit: 2000000
        }
      );
      
      console.log('交易哈希:', tx.hash);
      const receipt = await tx.wait();
      console.log('智能账户创建成功，Gas使用:', receipt.gasUsed.toString());
      
      return predictedAddress;
      
    } catch (error) {
      console.error('创建智能账户失败:', error);
      throw error;
    }
  }

  /**
   * 检查智能账户是否已部署
   */
  async isSmartAccountDeployed(customConfig = {}) {
    this._checkInitialized();
    try {
      // 使用固定的智能账户地址
      const smartAccountAddress = await this.getSmartAccountAddress();
      const code = await this.provider.getCode(smartAccountAddress);
      return code !== '0x';
    } catch (error) {
      console.error('检查智能账户部署状态失败:', error);
      return false;
    }
  }

  /**
   * 执行批量交易
   * @param {Array} transactions - 交易数组 [{to, value, data}, ...]
   * @param {Object} gasOptions - Gas选项 {useTokenPayment: boolean, tokenAddress: string, tokenAmount: string}
   * @param {Object} customConfig - 自定义智能账户配置
   */
  async executeBatchTransactions(transactions, gasOptions = {}, customConfig = {}) {
    this._checkInitialized();
    
    try {
      console.log('开始执行批量交易...');
      console.log('交易数量:', transactions.length);
      
      // 获取当前网络信息和合约地址
      const network = await this.provider.getNetwork();
      const contracts = getNetworkContracts(network.chainId);
      
      // 使用固定的智能账户地址
      const smartAccountAddress = contracts.testSmartAccount;
      console.log('使用智能账户地址:', smartAccountAddress);
      
      // 检查智能账户是否已部署
      const isDeployed = await this.isSmartAccountDeployed(customConfig);
      console.log('智能账户部署状态:', isDeployed);
      
      if (!isDeployed) {
        console.log('智能账户未部署，跳过创建步骤，直接使用预部署的合约');
        // 不再尝试创建智能账户，直接使用预部署的合约
      }
      
      // 准备交易数据
      const addresses = transactions.map(tx => tx.to);
      const values = transactions.map(tx => utils.parseEther(tx.value || '0'));
      const dataArray = transactions.map(tx => tx.data || '0x');
      
      // 计算总交易金额
      const totalValue = values.reduce((sum, value) => sum.add(value), ethers.BigNumber.from(0));
      console.log('总交易金额:', utils.formatEther(totalValue), 'ETH');
      
      // 检查智能账户余额
      const smartAccountBalance = await this.provider.getBalance(smartAccountAddress);
      console.log('智能账户余额:', utils.formatEther(smartAccountBalance), 'ETH');
      
      // 获取当前网络的Gas价格
      let currentGasPrice;
      try {
        currentGasPrice = await this.provider.getGasPrice();
        console.log('网络Gas价格:', utils.formatUnits(currentGasPrice, 'gwei'), 'gwei');
      } catch (error) {
        console.warn('获取网络Gas价格失败，使用默认值');
        currentGasPrice = utils.parseUnits('2', 'gwei'); // 使用更低的默认值
      }
      
      // 根据网络类型设置不同的 Gas 选项
      const isTestnet = network.chainId === 11155111; // Sepolia
      
      // 针对测试网进一步优化Gas设置
      const gasSettings = {
        gasLimit: gasOptions.gasLimit ? BigNumber.from(gasOptions.gasLimit) : 
                  BigNumber.from(isTestnet ? 50000 : 100000), // 测试网使用更低的Gas限制
        gasPrice: gasOptions.gasPrice ? BigNumber.from(gasOptions.gasPrice) : 
                  currentGasPrice.mul(isTestnet ? 90 : 100).div(100), // 测试网使用网络价格的90%
      };
      
      // 如果gasOptions中有其他属性，确保它们也是BigNumber类型
      if (gasOptions.gasPrice && !BigNumber.isBigNumber(gasOptions.gasPrice)) {
        gasSettings.gasPrice = BigNumber.from(gasOptions.gasPrice);
      }
      
      // 根据网络设置不同的最大Gas价格限制
      const maxGasPrice = utils.parseUnits(isTestnet ? '0.5' : '2', 'gwei'); // 测试网限制为0.5 gwei
      if (gasSettings.gasPrice.gt(maxGasPrice)) {
        gasSettings.gasPrice = maxGasPrice;
        console.log('Gas价格过高，限制为:', utils.formatUnits(maxGasPrice, 'gwei'), 'gwei');
      }
      
      console.log('使用 Gas 设置:', {
        gasLimit: gasSettings.gasLimit.toString(),
        gasPrice: utils.formatUnits(gasSettings.gasPrice, 'gwei') + ' gwei'
      });
      
      // 估算总Gas费用
      const estimatedGasCost = gasSettings.gasLimit.mul(gasSettings.gasPrice);
      const totalCost = totalValue.add(estimatedGasCost);
      
      console.log('交易总价值:', utils.formatEther(totalValue), 'ETH');
      console.log('预估Gas费用:', utils.formatEther(estimatedGasCost), 'ETH');
      console.log('预估总费用:', utils.formatEther(totalCost), 'ETH');
      console.log('智能账户余额:', utils.formatEther(smartAccountBalance), 'ETH');
      
      // 余额验证 - 添加更详细的日志
      if (smartAccountBalance.lt(totalCost)) {
        const shortfall = totalCost.sub(smartAccountBalance);
        console.error('余额不足详情:', {
          需要总费用: utils.formatEther(totalCost) + ' ETH',
          当前余额: utils.formatEther(smartAccountBalance) + ' ETH',
          缺少金额: utils.formatEther(shortfall) + ' ETH',
          交易价值: utils.formatEther(totalValue) + ' ETH',
          Gas费用: utils.formatEther(estimatedGasCost) + ' ETH'
        });
        throw new Error(`智能账户余额不足！需要 ${utils.formatEther(totalCost)} ETH，但只有 ${utils.formatEther(smartAccountBalance)} ETH。缺少 ${utils.formatEther(shortfall)} ETH`);
      }
      
      let txResponse;
      
      if (gasOptions.useTokenPayment && gasOptions.tokenAddress) {
        // 使用代币支付Gas费
        console.log('使用代币支付Gas费:', gasOptions.tokenAddress);
        
        // 首先批准代币支出
        const tokenAmount = utils.parseEther(gasOptions.tokenAmount || '10');
        const approveTx = await this.mockToken.approve(
          contracts.testSmartAccount,
          tokenAmount,
          gasSettings
        );
        await approveTx.wait();
        console.log('代币批准成功');
        
        // 执行批量交易并支付Gas
        // 确保使用正确的智能账户合约实例执行交易
        console.log('执行批量交易，智能账户地址:', smartAccountAddress);
        console.log('Signer地址:', this.signer ? this.signer.address : 'No signer');
        
        // 重新创建智能账户合约实例，确保使用正确的signer
        const smartAccountContract = new ethers.Contract(
          smartAccountAddress,
          SMART_ACCOUNT_ABI,
          this.signer
        );
        
        txResponse = await smartAccountContract.executeBatch(addresses, values, dataArray, gasSettings);
        
        // 调用代币支付Gas费方法
        const payGasTx = await this.smartAccount.payGasWithToken(
          gasOptions.tokenAddress,
          tokenAmount,
          gasSettings
        );
        await payGasTx.wait();
        console.log('代币支付Gas费成功');
        
      } else {
        // 普通批量交易
        try {
          // 确保使用正确的智能账户合约实例
          console.log('执行批量交易，智能账户地址:', smartAccountAddress);
          console.log('Signer地址:', this.signer ? this.signer.address : 'No signer');
          
          // 重新创建智能账户合约实例，确保使用正确的signer
          const smartAccountContract = new ethers.Contract(
            smartAccountAddress,
            SMART_ACCOUNT_ABI,
            this.signer
          );
          
          // 先尝试估算 Gas
          const estimatedGas = await smartAccountContract.estimateGas.executeBatch(addresses, values, dataArray);
          console.log('估算的 Gas:', estimatedGas.toString());
          
          // 使用估算的 Gas + 10% 缓冲（减少缓冲比例）
          gasSettings.gasLimit = estimatedGas.mul(110).div(100);
          
          // 重新计算费用
          const newEstimatedGasCost = gasSettings.gasLimit.mul(gasSettings.gasPrice);
          const newTotalCost = totalValue.add(newEstimatedGasCost);
          
          console.log('调整后预估Gas费用:', utils.formatEther(newEstimatedGasCost), 'ETH');
          console.log('调整后预估总费用:', utils.formatEther(newTotalCost), 'ETH');
          
          // 再次验证余额
          if (smartAccountBalance.lt(newTotalCost)) {
            const shortfall = newTotalCost.sub(smartAccountBalance);
            throw new Error(`调整Gas后余额仍不足！需要 ${utils.formatEther(newTotalCost)} ETH，但只有 ${utils.formatEther(smartAccountBalance)} ETH。缺少 ${utils.formatEther(shortfall)} ETH`);
          }
          
          // 执行批量交易
          txResponse = await smartAccountContract.executeBatch(addresses, values, dataArray, gasSettings);
          
        } catch (estimateError) {
          console.warn('Gas 估算失败，使用默认值:', estimateError.message);
          // 使用更保守的默认 Gas 限制
          gasSettings.gasLimit = 400000;
          
          // 重新创建智能账户合约实例，确保使用正确的signer
          const smartAccountContract = new ethers.Contract(
            smartAccountAddress,
            SMART_ACCOUNT_ABI,
            this.signer
          );
          
          txResponse = await smartAccountContract.executeBatch(addresses, values, dataArray, gasSettings);
        }
      }
      
      const receipt = await txResponse.wait();
      console.log('✅ 批量交易执行成功, Gas使用:', receipt.gasUsed.toString());
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };
      
    } catch (error) {
      console.error('❌ 批量交易执行失败:', error);
      
      // 提供更详细的错误信息
      if (error.message.includes('insufficient funds')) {
        throw new Error('资金不足：请确保智能账户有足够的ETH来支付交易费用和Gas费');
      } else if (error.message.includes('UNPREDICTABLE_GAS_LIMIT')) {
        throw new Error('Gas估算失败：可能是合约执行会失败或余额不足');
      } else if (error.message.includes('execution reverted')) {
        throw new Error('交易执行被拒绝：请检查交易参数和合约状态');
      } else if (error.message.includes('network')) {
        throw new Error('网络连接问题：请检查网络连接和RPC节点状态');
      }
      
      throw error;
    }
  }

  /**
   * 设置代币支付Gas费
   * @param {string} tokenAddress - 代币地址
   * @param {string} tokenAmount - 代币数量
   */
  async setupTokenPaymaster(tokenAddress, tokenAmount) {
    this._checkInitialized();
    
    try {
      console.log('设置代币支付Gas费:', tokenAddress, tokenAmount);
      
      // 检查代币余额
      const balance = await this.mockToken.balanceOf(this.signer.address);
      console.log('当前代币余额:', utils.formatEther(balance), 'TEST');
      
      const amount = utils.parseEther(tokenAmount);
      if (balance < amount) {
        throw new Error('代币余额不足');
      }
      
      // 批准智能账户使用代币
      const approveTx = await this.mockToken.approve(
        LOCAL_CONTRACTS.testSmartAccount,
        amount
      );
      await approveTx.wait();
      
      console.log('✅ 代币支付Gas费设置成功');
      return {
        success: true,
        tokenAddress,
        approvedAmount: utils.formatEther(amount)
      };
      
    } catch (error) {
      console.error('❌ 设置代币支付Gas费失败:', error);
      throw error;
    }
  }

  /**
   * 发送单个交易
   * @param {string} to - 接收地址
   * @param {string} value - 发送金额 (ETH)
   * @param {string} data - 交易数据
   */
  async sendTransaction(to, value = '0', data = '0x') {
    this._checkInitialized();
    
    try {
      console.log('发送交易到:', to, '金额:', value, 'ETH');
      
      const txResponse = await this.smartAccount.execute(
        to,
        utils.parseEther(value),
        data
      );
      
      const receipt = await txResponse.wait();
      console.log('✅ 交易发送成功');
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString()
      };
      
    } catch (error) {
      console.error('❌ 交易发送失败:', error);
      throw error;
    }
  }

  /**
   * 向智能账户充值
   * @param {string} amount - 充值金额（ETH）
   * @returns {Promise<Object>} 充值结果
   */
  async fundSmartAccount(amount) {
    this._checkInitialized();
    
    try {
      console.log('开始向智能账户充值:', amount, 'ETH');
      
      // 获取当前网络信息和合约地址
      const network = await this.provider.getNetwork();
      const contracts = getNetworkContracts(network.chainId);
      
      // 获取用户地址
      const userAddress = this.userAddress || (this.signer ? this.signer.address : null);
      if (!userAddress) {
        throw new Error('用户地址未设置');
      }
      
      // 检查用户EOA余额
      const eoaBalance = await this.provider.getBalance(userAddress);
      const fundAmount = utils.parseEther(amount);
      
      console.log('用户EOA余额:', utils.formatEther(eoaBalance), 'ETH');
      console.log('充值金额:', amount, 'ETH');
      
      if (eoaBalance.lt(fundAmount)) {
        throw new Error(`EOA余额不足！需要 ${amount} ETH，但只有 ${utils.formatEther(eoaBalance)} ETH`);
      }
      
      // 创建signer（如果使用userAddress模式，需要通过钱包签名）
      let signer;
      if (this.signer) {
        signer = this.signer;
      } else {
        // 如果没有signer，说明是通过地址初始化的，需要用户通过钱包签名
        throw new Error('需要连接钱包进行签名');
      }
      
      // 向智能账户转账
      const tx = await signer.sendTransaction({
        to: contracts.testSmartAccount,
        value: fundAmount,
        gasLimit: 21000 // 标准转账Gas限制
      });
      
      console.log('充值交易已发送:', tx.hash);
      
      // 等待交易确认
      const receipt = await tx.wait();
      console.log('✅ 充值成功，交易已确认');
      
      // 获取充值后的余额
      const newBalance = await this.provider.getBalance(contracts.testSmartAccount);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        newBalance: utils.formatEther(newBalance),
        message: `成功向智能账户充值 ${amount} ETH`
      };
      
    } catch (error) {
      console.error('❌ 智能账户充值失败:', error);
      throw error;
    }
  }

  /**
   * 快速充值建议金额
   * @returns {Promise<Object>} 建议充值信息
   */
  async getFundingSuggestions() {
    this._checkInitialized();
    
    try {
      // 获取当前网络信息和合约地址
      const network = await this.provider.getNetwork();
      const contracts = getNetworkContracts(network.chainId);
      
      // 获取智能账户当前余额
      const smartAccountBalance = await this.provider.getBalance(contracts.testSmartAccount);
      
      // 获取用户EOA余额
      const userAddress = this.userAddress || (this.signer ? this.signer.address : null);
      const eoaBalance = userAddress ? await this.provider.getBalance(userAddress) : ethers.BigNumber.from(0);
      
      // 获取当前Gas价格
      let currentGasPrice;
      try {
        currentGasPrice = await this.provider.getGasPrice();
      } catch (error) {
        currentGasPrice = utils.parseUnits('2', 'gwei');
      }
      
      // 计算建议充值金额
      const suggestions = [];
      
      // 基础交易费用（约0.001 ETH）
      const basicTxCost = currentGasPrice.mul(21000);
      
      // 复杂交易费用（约0.005 ETH）
      const complexTxCost = currentGasPrice.mul(100000);
      
      // 批量交易费用（约0.01 ETH）
      const batchTxCost = currentGasPrice.mul(200000);
      
      if (smartAccountBalance.lt(basicTxCost)) {
        suggestions.push({
          amount: '0.002',
          purpose: '基础交易',
          description: '支持基本的转账和简单交易'
        });
      }
      
      if (smartAccountBalance.lt(complexTxCost)) {
        suggestions.push({
          amount: '0.01',
          purpose: '复杂交易',
          description: '支持智能合约交互和复杂操作'
        });
      }
      
      if (smartAccountBalance.lt(batchTxCost)) {
        suggestions.push({
          amount: '0.02',
          purpose: '批量交易',
          description: '支持批量操作和高频交易'
        });
      }
      
      // 如果余额充足，提供维护建议
      if (suggestions.length === 0) {
        suggestions.push({
          amount: '0.005',
          purpose: '余额维护',
          description: '保持充足余额以应对Gas价格波动'
        });
      }
      
      return {
        currentBalance: utils.formatEther(smartAccountBalance),
        eoaBalance: utils.formatEther(eoaBalance),
        networkGasPrice: utils.formatUnits(currentGasPrice, 'gwei'),
        suggestions: suggestions,
        canFund: eoaBalance.gt(utils.parseEther('0.001')) // 至少需要0.001 ETH来支付充值交易的Gas
      };
      
    } catch (error) {
      console.error('获取充值建议失败:', error);
      throw error;
    }
  }

  /**
   * 获取账户余额
   */
  async getBalance() {
    this._checkInitialized();
    
    try {
      const ethBalance = await this.provider.getBalance(this.signer.address);
      console.log('用户钱包地址:', this.signer.address);
      console.log('用户钱包余额:', utils.formatEther(ethBalance), 'ETH');
      
      // 获取当前网络的合约配置
      const network = await this.provider.getNetwork();
      const contracts = getNetworkContracts(network.chainId);
      console.log('当前网络:', network.chainId);
      
      // 使用固定的智能账户地址
      const smartAccountAddress = contracts.testSmartAccount;
      console.log('固定智能账户地址:', smartAccountAddress);
      
      const smartAccountBalance = await this.provider.getBalance(smartAccountAddress);
      console.log('智能账户余额:', utils.formatEther(smartAccountBalance), 'ETH');
      
      const result = {
        eth: utils.formatEther(ethBalance),
        smartAccountEth: utils.formatEther(smartAccountBalance)
      };
      
      // 只有在有 mockERC20 合约时才获取代币余额
      if (this.mockToken && contracts.mockERC20) {
        const tokenBalance = await this.mockToken.balanceOf(this.signer.address);
        result.testToken = utils.formatEther(tokenBalance);
      } else {
        result.testToken = '0.0';
      }
      
      console.log('余额查询结果:', result);
      return result;
    } catch (error) {
      console.error('获取余额失败:', error);
      throw error;
    }
  }

  /**
   * 获取代币余额
   * @param {string} tokenAddress - 代币地址
   */
  async getTokenBalance(tokenAddress) {
    this._checkInitialized();
    
    try {
      // 如果没有提供代币地址，尝试使用当前网络的默认代币
      if (!tokenAddress) {
        const chainId = await this.getCurrentChainId();
        const contracts = getNetworkContracts(chainId);
        tokenAddress = contracts.mockERC20;
        
        if (!tokenAddress) {
          throw new Error('当前网络没有配置默认代币地址');
        }
      }
      
      // 如果没有 mockToken 实例或地址不匹配，创建新的合约实例
      if (!this.mockToken || this.mockToken.address !== tokenAddress) {
        this.mockToken = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          this.signer
        );
      }
      
      const balance = await this.mockToken.balanceOf(this.signer.address);
      const symbol = await this.mockToken.symbol();
      
      return {
        balance: utils.formatEther(balance),
        symbol,
        address: tokenAddress
      };
    } catch (error) {
      console.error('获取代币余额失败:', error);
      throw error;
    }
  }

  /**
   * 获取支持的链信息
   */
  getSupportedChains() {
    return {
      localhost: { 
        chainId: 31337, 
        name: 'Localhost Network',
        contracts: LOCAL_CONTRACTS
      }
    };
  }

  /**
   * 获取当前链ID
   */
  async getCurrentChainId() {
    this._checkInitialized();
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.provider = null;
    this.signer = null;
    this.smartAccount = null;
    this.mockToken = null;
    this.isInitialized = false;
    console.log('本地Etherspot服务已清理');
  }

  /**
   * 检查是否已初始化
   * @private
   */
  _checkInitialized() {
    if (!this.isInitialized) {
      throw new Error('LocalEtherspotService未初始化，请先调用initialize()');
    }
  }
}

export default new LocalEtherspotService();