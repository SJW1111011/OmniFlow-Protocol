const { ethers } = require('ethers');

class ContractService {
  constructor() {
    this.provider = null;
    this.factoryContract = null;
    this.smartAccountABI = [
      "function owner() view returns (address)",
      "function guardians(address) view returns (bool)",
      "function getGuardians() view returns (address[])",
      "function addGuardian(address guardian)",
      "function removeGuardian(address guardian)",
      "function initiateRecovery(address newOwner)",
      "function confirmRecovery()",
      "function executeRecovery()",
      "function executeBatch(address[] targets, uint256[] values, bytes[] data)",
      "function execute(address target, uint256 value, bytes data)",
      "function payGasWithToken(address token, uint256 amount, address payable recipient)",
      "event GuardianAdded(address indexed guardian)",
      "event GuardianRemoved(address indexed guardian)",
      "event RecoveryInitiated(address indexed newOwner, uint256 executeAfter)",
      "event RecoveryExecuted(address indexed newOwner)",
      "event TransactionExecuted(address indexed target, uint256 value, bytes data)"
    ];

    this.factoryABI = [
      "function createAccount(address owner, address[] guardians) returns (address)",
      "function getAccount(address owner) view returns (address)",
      "function accounts(address) view returns (address)",
      "function setCreationFee(uint256 fee)",
      "function creationFee() view returns (uint256)",
      "event AccountCreated(address indexed owner, address indexed account, address[] guardians)"
    ];

    this.initialize();
  }

  initialize() {
    try {
      const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      const factoryAddress = process.env.SMART_ACCOUNT_FACTORY_ADDRESS;
      if (factoryAddress) {
        this.factoryContract = new ethers.Contract(
          factoryAddress,
          this.factoryABI,
          this.provider
        );
      }
    } catch (error) {
      console.error('合约服务初始化失败:', error);
    }
  }

  // 获取提供者
  getProvider() {
    return this.provider;
  }

  // 获取工厂合约
  getFactoryContract(signerOrProvider = null) {
    const contractProvider = signerOrProvider || this.provider;
    return new ethers.Contract(
      process.env.SMART_ACCOUNT_FACTORY_ADDRESS,
      this.factoryABI,
      contractProvider
    );
  }

  // 获取智能账户合约
  getSmartAccountContract(address, signerOrProvider = null) {
    const contractProvider = signerOrProvider || this.provider;
    return new ethers.Contract(address, this.smartAccountABI, contractProvider);
  }

  // 创建钱包实例
  createWallet(privateKey) {
    return new ethers.Wallet(privateKey, this.provider);
  }

  // 验证地址格式
  isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  // 格式化以太币
  formatEther(value) {
    return ethers.utils.formatEther(value);
  }

  // 解析以太币
  parseEther(value) {
    return ethers.utils.parseEther(value);
  }

  // 获取账户余额
  async getBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return this.formatEther(balance);
    } catch (error) {
      console.error('获取余额失败:', error);
      throw error;
    }
  }

  // 获取交易收据
  async getTransactionReceipt(txHash) {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.error('获取交易收据失败:', error);
      throw error;
    }
  }

  // 等待交易确认
  async waitForTransaction(txHash, confirmations = 1) {
    try {
      return await this.provider.waitForTransaction(txHash, confirmations);
    } catch (error) {
      console.error('等待交易确认失败:', error);
      throw error;
    }
  }

  // 估算Gas费用
  async estimateGas(transaction) {
    try {
      return await this.provider.estimateGas(transaction);
    } catch (error) {
      console.error('估算Gas失败:', error);
      throw error;
    }
  }

  // 获取当前Gas价格
  async getGasPrice() {
    try {
      return await this.provider.getGasPrice();
    } catch (error) {
      console.error('获取Gas价格失败:', error);
      throw error;
    }
  }

  // 获取网络信息
  async getNetwork() {
    try {
      return await this.provider.getNetwork();
    } catch (error) {
      console.error('获取网络信息失败:', error);
      throw error;
    }
  }

  // 获取区块号
  async getBlockNumber() {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('获取区块号失败:', error);
      throw error;
    }
  }

  // 监听合约事件
  listenToEvents(contract, eventName, callback) {
    try {
      contract.on(eventName, callback);
      console.log(`开始监听事件: ${eventName}`);
    } catch (error) {
      console.error('监听事件失败:', error);
      throw error;
    }
  }

  // 停止监听事件
  stopListening(contract, eventName) {
    try {
      contract.removeAllListeners(eventName);
      console.log(`停止监听事件: ${eventName}`);
    } catch (error) {
      console.error('停止监听事件失败:', error);
      throw error;
    }
  }

  // 解码交易数据
  decodeTransactionData(abi, data) {
    try {
      const iface = new ethers.utils.Interface(abi);
      return iface.parseTransaction({ data });
    } catch (error) {
      console.error('解码交易数据失败:', error);
      throw error;
    }
  }

  // 编码函数调用
  encodeFunctionCall(abi, functionName, params) {
    try {
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData(functionName, params);
    } catch (error) {
      console.error('编码函数调用失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const contractService = new ContractService();

module.exports = contractService;