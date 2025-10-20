const express = require('express');
const { ethers } = require('ethers');
const authRoutes = require('./auth');
const router = express.Router();

// 使用认证中间件
const { authenticateToken } = authRoutes;

// 智能合约配置
const SMART_ACCOUNT_FACTORY_ADDRESS = process.env.SMART_ACCOUNT_FACTORY_ADDRESS || '';
const SMART_ACCOUNT_ABI = [
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

const FACTORY_ABI = [
  "function createAccount(address owner, address[] guardians) returns (address)",
  "function getAccount(address owner) view returns (address)",
  "function accounts(address) view returns (address)",
  "function setCreationFee(uint256 fee)",
  "function creationFee() view returns (uint256)",
  "event AccountCreated(address indexed owner, address indexed account, address[] guardians)"
];

// 获取以太坊提供者
const getProvider = () => {
  const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
  return new ethers.providers.JsonRpcProvider(rpcUrl);
};

// 获取智能账户工厂合约实例
const getFactoryContract = (signerOrProvider) => {
  return new ethers.Contract(SMART_ACCOUNT_FACTORY_ADDRESS, FACTORY_ABI, signerOrProvider);
};

// 获取智能账户合约实例
const getSmartAccountContract = (address, signerOrProvider) => {
  return new ethers.Contract(address, SMART_ACCOUNT_ABI, signerOrProvider);
};

// 创建智能账户
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { guardians = [], privateKey } = req.body;
    const ownerAddress = req.user.userId;

    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: '需要提供私钥来签署交易'
      });
    }

    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const factoryContract = getFactoryContract(wallet);

    // 检查是否已经创建过智能账户
    const existingAccount = await factoryContract.getAccount(ownerAddress);
    if (existingAccount !== ethers.constants.AddressZero) {
      return res.json({
        success: true,
        message: '智能账户已存在',
        data: {
          accountAddress: existingAccount,
          owner: ownerAddress,
          guardians: guardians
        }
      });
    }

    // 创建智能账户
    const tx = await factoryContract.createAccount(ownerAddress, guardians);
    const receipt = await tx.wait();

    // 从事件中获取创建的账户地址
    const accountCreatedEvent = receipt.events?.find(
      event => event.event === 'AccountCreated'
    );
    
    const accountAddress = accountCreatedEvent?.args?.account;

    res.json({
      success: true,
      message: '智能账户创建成功',
      data: {
        accountAddress,
        owner: ownerAddress,
        guardians,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    });

  } catch (error) {
    console.error('创建智能账户错误:', error);
    res.status(500).json({
      success: false,
      message: '创建智能账户失败',
      error: error.message
    });
  }
});

// 获取智能账户信息
router.get('/info/:address', authenticateToken, async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({
        success: false,
        message: '无效的地址格式'
      });
    }

    const provider = getProvider();
    const smartAccountContract = getSmartAccountContract(address, provider);

    // 获取账户信息
    const [owner, guardians] = await Promise.all([
      smartAccountContract.owner(),
      smartAccountContract.getGuardians()
    ]);

    // 获取账户余额
    const balance = await provider.getBalance(address);

    res.json({
      success: true,
      data: {
        address,
        owner,
        guardians,
        balance: ethers.utils.formatEther(balance),
        guardiansCount: guardians.length
      }
    });

  } catch (error) {
    console.error('获取智能账户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取智能账户信息失败',
      error: error.message
    });
  }
});

// 添加守护者
router.post('/add-guardian', authenticateToken, async (req, res) => {
  try {
    const { accountAddress, guardianAddress, privateKey } = req.body;

    if (!ethers.utils.isAddress(accountAddress) || !ethers.utils.isAddress(guardianAddress)) {
      return res.status(400).json({
        success: false,
        message: '无效的地址格式'
      });
    }

    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: '需要提供私钥来签署交易'
      });
    }

    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const smartAccountContract = getSmartAccountContract(accountAddress, wallet);

    // 添加守护者
    const tx = await smartAccountContract.addGuardian(guardianAddress);
    const receipt = await tx.wait();

    res.json({
      success: true,
      message: '守护者添加成功',
      data: {
        guardianAddress,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    });

  } catch (error) {
    console.error('添加守护者错误:', error);
    res.status(500).json({
      success: false,
      message: '添加守护者失败',
      error: error.message
    });
  }
});

// 移除守护者
router.post('/remove-guardian', authenticateToken, async (req, res) => {
  try {
    const { accountAddress, guardianAddress, privateKey } = req.body;

    if (!ethers.utils.isAddress(accountAddress) || !ethers.utils.isAddress(guardianAddress)) {
      return res.status(400).json({
        success: false,
        message: '无效的地址格式'
      });
    }

    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: '需要提供私钥来签署交易'
      });
    }

    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const smartAccountContract = getSmartAccountContract(accountAddress, wallet);

    // 移除守护者
    const tx = await smartAccountContract.removeGuardian(guardianAddress);
    const receipt = await tx.wait();

    res.json({
      success: true,
      message: '守护者移除成功',
      data: {
        guardianAddress,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    });

  } catch (error) {
    console.error('移除守护者错误:', error);
    res.status(500).json({
      success: false,
      message: '移除守护者失败',
      error: error.message
    });
  }
});

// 发起账户恢复
router.post('/initiate-recovery', authenticateToken, async (req, res) => {
  try {
    const { accountAddress, newOwner, privateKey } = req.body;

    if (!ethers.utils.isAddress(accountAddress) || !ethers.utils.isAddress(newOwner)) {
      return res.status(400).json({
        success: false,
        message: '无效的地址格式'
      });
    }

    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: '需要提供私钥来签署交易'
      });
    }

    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const smartAccountContract = getSmartAccountContract(accountAddress, wallet);

    // 发起恢复
    const tx = await smartAccountContract.initiateRecovery(newOwner);
    const receipt = await tx.wait();

    res.json({
      success: true,
      message: '账户恢复已发起',
      data: {
        newOwner,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    });

  } catch (error) {
    console.error('发起账户恢复错误:', error);
    res.status(500).json({
      success: false,
      message: '发起账户恢复失败',
      error: error.message
    });
  }
});

// 执行批量交易
router.post('/execute-batch', authenticateToken, async (req, res) => {
  try {
    const { accountAddress, transactions, privateKey } = req.body;

    if (!ethers.utils.isAddress(accountAddress)) {
      return res.status(400).json({
        success: false,
        message: '无效的账户地址'
      });
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '交易列表不能为空'
      });
    }

    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: '需要提供私钥来签署交易'
      });
    }

    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const smartAccountContract = getSmartAccountContract(accountAddress, wallet);

    // 准备批量交易数据
    const targets = transactions.map(tx => tx.target);
    const values = transactions.map(tx => tx.value || 0);
    const data = transactions.map(tx => tx.data || '0x');

    // 执行批量交易
    const tx = await smartAccountContract.executeBatch(targets, values, data);
    const receipt = await tx.wait();

    res.json({
      success: true,
      message: '批量交易执行成功',
      data: {
        transactionCount: transactions.length,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }
    });

  } catch (error) {
    console.error('执行批量交易错误:', error);
    res.status(500).json({
      success: false,
      message: '执行批量交易失败',
      error: error.message
    });
  }
});

// 获取用户的智能账户
router.get('/my-account', authenticateToken, async (req, res) => {
  try {
    const ownerAddress = req.user.userId;
    const provider = getProvider();
    const factoryContract = getFactoryContract(provider);

    // 获取用户的智能账户地址
    const accountAddress = await factoryContract.getAccount(ownerAddress);

    if (accountAddress === ethers.constants.AddressZero) {
      return res.json({
        success: true,
        message: '用户尚未创建智能账户',
        data: null
      });
    }

    // 获取账户详细信息
    const smartAccountContract = getSmartAccountContract(accountAddress, provider);
    const [owner, guardians, balance] = await Promise.all([
      smartAccountContract.owner(),
      smartAccountContract.getGuardians(),
      provider.getBalance(accountAddress)
    ]);

    res.json({
      success: true,
      data: {
        address: accountAddress,
        owner,
        guardians,
        balance: ethers.utils.formatEther(balance),
        guardiansCount: guardians.length
      }
    });

  } catch (error) {
    console.error('获取用户智能账户错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户智能账户失败',
      error: error.message
    });
  }
});

module.exports = router;