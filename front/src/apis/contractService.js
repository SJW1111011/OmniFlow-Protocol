import { ethers } from 'ethers';

// 合约地址配置 - 支持多网络
export const CONTRACT_ADDRESSES = {
  localhost: {
    chainId: 31337,
    SMART_ACCOUNT_FACTORY: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    ENTRY_POINT: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    EXAMPLE_SMART_ACCOUNT: '0x70511574c08E25Be4a445bf300DAb69aFDcf3F82'
  },
  sepolia: {
    chainId: 11155111,
    SMART_ACCOUNT_FACTORY: '0x1d76001Bc2323Cccd4FdC8B1231e907F645AB765',
    ENTRY_POINT: '0x7A93344826CA3E410F8838E05C378d77f25aC0Ab',
    EXAMPLE_SMART_ACCOUNT: '0x2A13d17bD06FaA395a6b2A623c7b27AAfC9B6341'
  }
};

// 网络配置
export const NETWORK_CONFIG = {
  localhost: {
    chainId: 31337,
    name: 'Localhost',
    rpcUrl: 'http://127.0.0.1:8545'
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/i5LOb9tsBpvhiLY25PMsuuLhUsAX62wK'
  }
};

// 获取当前网络的合约地址
export const getCurrentNetworkAddresses = (chainId) => {
  if (chainId === 31337) return CONTRACT_ADDRESSES.localhost;
  if (chainId === 11155111) return CONTRACT_ADDRESSES.sepolia;
  return CONTRACT_ADDRESSES.localhost; // 默认使用本地网络
};

// EntryPoint ABI
export const ENTRY_POINT_ABI = [
  "function depositTo(address account) external payable",
  "function balanceOf(address account) external view returns (uint256)",
  "function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external",
  "function handleOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) external",
  "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) external pure returns (bytes32)",
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)"
];

// SmartAccountFactory ABI (更新以支持EntryPoint)
export const SMART_ACCOUNT_FACTORY_ABI = [
  "function createSmartAccount(address owner, address[] memory guardians, uint256 requiredGuardians, bytes32 salt) external payable returns (address)",
  "function getSmartAccountAddress(address owner, address[] memory guardians, uint256 requiredGuardians, bytes32 salt) external view returns (address)",
  "function getAccountsByOwner(address owner) external view returns (address[] memory)",
  "function getAllAccounts() external view returns (address[] memory)",
  "function accountCount() external view returns (uint256)",
  "function creationFee() external view returns (uint256)",
  "function isSmartAccount(address account) external view returns (bool)",
  "function entryPoint() external view returns (address)",
  "event SmartAccountCreated(address indexed account, address indexed owner, address[] guardians, uint256 requiredGuardians)"
];

// SmartAccount ABI (更新以支持ERC-4337)
export const SMART_ACCOUNT_ABI = [
  "function owner() external view returns (address)",
  "function getGuardians() external view returns (address[] memory)",
  "function guardianCount() external view returns (uint256)",
  "function requiredGuardians() external view returns (uint256)",
  "function addGuardian(address guardian) external",
  "function removeGuardian(address guardian) external",
  "function initiateRecovery(address newOwner) external",
  "function confirmRecovery() external",
  "function executeRecovery() external",
  "function execute(address to, uint256 value, bytes calldata data) external returns (bool success, bytes memory result)",
  "function batchExecute(tuple(address to, uint256 value, bytes data)[] calldata calls) external",
  "function payGasWithToken(address token, uint256 amount, address gasReceiver) external",
  "function getRecoveryInfo(uint256 recoveryId) external view returns (address newOwner, uint256 confirmations, uint256 timestamp, bool executed)",
  // ERC-4337 相关函数
  "function getNonce() external view returns (uint256)",
  "function validateUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256 validationData)",
  "function executeUserOp(address dest, uint256 value, bytes calldata func) external",
  "function addDeposit() external payable",
  "function getDeposit() external view returns (uint256)",
  "function entryPoint() external view returns (address)",
  "event GuardianAdded(address indexed guardian)",
  "event GuardianRemoved(address indexed guardian)",
  "event RecoveryInitiated(address indexed newOwner, uint256 recoveryId)",
  "event RecoveryConfirmed(address indexed guardian, uint256 confirmations)",
  "event RecoveryExecuted(address indexed oldOwner, address indexed newOwner)",
  "event TransactionExecuted(address indexed to, uint256 value, bytes data, bool success)"
];

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.factoryContract = null;
  }

  // 初始化提供者
  async initProvider(walletClient) {
    try {
      if (walletClient) {
        // 使用钱包客户端
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
      } else {
        // 使用只读提供者
        this.provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
        this.signer = null;
      }

      // 初始化工厂合约
      this.factoryContract = new ethers.Contract(
        CONTRACT_ADDRESSES.SMART_ACCOUNT_FACTORY,
        SMART_ACCOUNT_FACTORY_ABI,
        this.signer || this.provider
      );

      console.log('Provider initialized:', !!this.provider);
      console.log('Signer initialized:', !!this.signer);
      console.log('Factory contract initialized:', !!this.factoryContract);

      return true;
    } catch (error) {
      console.error('初始化提供者失败:', error);
      return false;
    }
  }

  // 获取智能账户工厂合约
  getFactoryContract() {
    return this.factoryContract;
  }

  // 获取智能账户合约实例
  getSmartAccountContract(address) {
    return new ethers.Contract(
      address,
      SMART_ACCOUNT_ABI,
      this.signer || this.provider
    );
  }

  // 创建智能账户
  async createSmartAccount(owner, guardians, requiredGuardians, salt) {
    try {
      if (!this.factoryContract || !this.signer) {
        throw new Error('合约未初始化或未连接钱包');
      }

      console.log('Calling creationFee...');
      const creationFee = await this.factoryContract.creationFee();
      console.log('Creation fee:', ethers.formatEther(creationFee), 'ETH');

      console.log('Creating smart account with params:', {
        owner,
        guardians,
        requiredGuardians,
        salt: ethers.hexlify(salt)
      });

      const tx = await this.factoryContract.createSmartAccount(
        owner,
        guardians,
        requiredGuardians,
        salt,
        { value: creationFee }
      );

      console.log('Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.hash);

      // 从事件中获取创建的账户地址
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.factoryContract.interface.parseLog(log);
          return parsed.name === 'SmartAccountCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.factoryContract.interface.parseLog(event);
        return {
          success: true,
          accountAddress: parsed.args.account,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber
        };
      }

      throw new Error('未找到SmartAccountCreated事件');
    } catch (error) {
      console.error('创建智能账户失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 预计算智能账户地址
  async getSmartAccountAddress(owner, guardians, requiredGuardians, salt) {
    try {
      if (!this.factoryContract) {
        throw new Error('工厂合约未初始化');
      }

      const address = await this.factoryContract.getSmartAccountAddress(
        owner,
        guardians,
        requiredGuardians,
        salt
      );

      return {
        success: true,
        address
      };
    } catch (error) {
      console.error('预计算地址失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取用户的智能账户列表
  async getAccountsByOwner(owner) {
    try {
      if (!this.factoryContract) {
        throw new Error('工厂合约未初始化');
      }

      const accounts = await this.factoryContract.getAccountsByOwner(owner);

      return {
        success: true,
        accounts: accounts
      };
    } catch (error) {
      console.error('获取账户列表失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取智能账户详细信息
  async getSmartAccountInfo(accountAddress) {
    try {
      // 确保provider已初始化
      if (!this.provider) {
        throw new Error('Provider未初始化，请先连接钱包');
      }

      console.log('Getting smart account info for:', accountAddress);
      const accountContract = this.getSmartAccountContract(accountAddress);
      console.log('Account contract created:', !!accountContract);

      console.log('Calling contract methods...');
      const [owner, guardians, guardianCount, requiredGuardians] = await Promise.all([
        accountContract.owner(),
        accountContract.getGuardians(),
        accountContract.guardianCount(),
        accountContract.requiredGuardians()
      ]);

      console.log('Contract methods results:', {
        owner,
        guardians,
        guardianCount: guardianCount.toString(),
        requiredGuardians: requiredGuardians.toString()
      });

      // 获取最新的恢复信息（如果有的话）
      let recoveryInfo = null;
      try {
        // 假设恢复ID从0开始，这里可能需要根据实际情况调整
        recoveryInfo = await accountContract.getRecoveryInfo(0);
      } catch (error) {
        // 如果没有恢复信息，忽略错误
        console.log('没有恢复信息或恢复信息获取失败:', error.message);
      }

      return {
        success: true,
        info: {
          address: accountAddress,
          owner,
          guardians,
          guardianCount: Number(guardianCount),
          requiredGuardians: Number(requiredGuardians),
          recovery: recoveryInfo ? {
            newOwner: recoveryInfo.newOwner,
            confirmations: Number(recoveryInfo.confirmations),
            timestamp: Number(recoveryInfo.timestamp),
            executed: recoveryInfo.executed
          } : null
        }
      };
    } catch (error) {
      console.error('获取智能账户信息失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 添加守护者
  async addGuardian(accountAddress, guardianAddress) {
    try {
      if (!this.signer) {
        throw new Error('未连接钱包');
      }

      const accountContract = this.getSmartAccountContract(accountAddress);
      const tx = await accountContract.addGuardian(guardianAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('添加守护者失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 移除守护者
  async removeGuardian(accountAddress, guardianAddress) {
    try {
      if (!this.signer) {
        throw new Error('未连接钱包');
      }

      const accountContract = this.getSmartAccountContract(accountAddress);
      const tx = await accountContract.removeGuardian(guardianAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('移除守护者失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 执行交易
  async executeTransaction(accountAddress, to, value, data) {
    try {
      if (!this.signer) {
        throw new Error('未连接钱包');
      }

      const accountContract = this.getSmartAccountContract(accountAddress);
      const tx = await accountContract.execute(to, value, data);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('执行交易失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 批量执行交易
  async executeBatchTransaction(accountAddress, transactions) {
    try {
      if (!this.signer) {
        throw new Error('未连接钱包');
      }

      const accountContract = this.getSmartAccountContract(accountAddress);
      
      // 将交易数据转换为Call结构体数组格式
      const calls = transactions.map(tx => ({
        to: tx.to,
        value: tx.value || '0',
        data: tx.data || '0x'
      }));

      const tx = await accountContract.batchExecute(calls);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('批量执行交易失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeBatchTransactions(accountAddress, targets, values, data) {
    try {
      if (!this.signer) {
        throw new Error('未连接钱包');
      }

      const accountContract = this.getSmartAccountContract(accountAddress);
      const tx = await accountContract.executeBatch(targets, values, data);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('批量执行交易失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 生成随机盐值
  generateSalt(prefix = 'smart-account') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return ethers.keccak256(ethers.toUtf8Bytes(`${prefix}-${timestamp}-${random}`));
  }
}

// 导出单例实例
export const contractService = new ContractService();
export default contractService;