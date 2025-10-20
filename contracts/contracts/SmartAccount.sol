// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ERC-4337 相关接口
interface IAccount {
    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external returns (uint256 validationData);
}

interface IEntryPoint {
    function depositTo(address account) external payable;
    function balanceOf(address account) external view returns (uint256);
}

// UserOperation 结构体定义
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

/**
 * @title SmartAccount
 * @dev 智能账户合约 - 实现ERC-4337账户抽象功能
 * 支持社交恢复、批量操作、Gas费抽象等功能
 */
contract SmartAccount is ReentrancyGuard, IAccount {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // 事件定义
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event RecoveryInitiated(address indexed newOwner, uint256 recoveryId);
    event RecoveryExecuted(address indexed newOwner, uint256 recoveryId);
    event BatchExecuted(bytes32 indexed batchHash);
    event GasPaymentExecuted(address indexed token, uint256 amount);

    // 状态变量
    address public owner;
    mapping(address => bool) public guardians;
    address[] public guardianList;
    uint256 public guardianCount;
    uint256 public requiredGuardians; // 恢复所需的守护人数量

    // ERC-4337 相关状态变量
    IEntryPoint public immutable entryPoint;
    uint256 private _nonce;

    // 恢复相关
    struct Recovery {
        address newOwner;
        uint256 confirmations;
        mapping(address => bool) confirmed;
        uint256 timestamp;
        bool executed;
    }
    
    mapping(uint256 => Recovery) public recoveries;
    uint256 public recoveryCounter;
    uint256 public constant RECOVERY_PERIOD = 2 days; // 恢复等待期

    // 批量操作相关
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    // 修饰符
    modifier onlyOwner() {
        require(msg.sender == owner, "SmartAccount: caller is not the owner");
        _;
    }

    modifier onlyGuardian() {
        require(guardians[msg.sender], "SmartAccount: caller is not a guardian");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "SmartAccount: caller is not EntryPoint");
        _;
    }

    /**
     * @dev 构造函数
     * @param _owner 账户所有者
     * @param _guardians 初始守护人列表
     * @param _requiredGuardians 恢复所需的守护人数量
     * @param _entryPoint ERC-4337 EntryPoint地址
     */
    constructor(
        address _owner,
        address[] memory _guardians,
        uint256 _requiredGuardians,
        IEntryPoint _entryPoint
    ) {
        require(_owner != address(0), "SmartAccount: owner cannot be zero address");
        require(address(_entryPoint) != address(0), "SmartAccount: entryPoint cannot be zero address");
        require(_requiredGuardians > 0 && _requiredGuardians <= _guardians.length, 
                "SmartAccount: invalid required guardians count");

        owner = _owner;
        requiredGuardians = _requiredGuardians;
        entryPoint = _entryPoint;

        // 添加守护人
        for (uint256 i = 0; i < _guardians.length; i++) {
            require(_guardians[i] != address(0), "SmartAccount: guardian cannot be zero address");
            require(!guardians[_guardians[i]], "SmartAccount: duplicate guardian");
            
            guardians[_guardians[i]] = true;
            guardianList.push(_guardians[i]);
        }
        guardianCount = _guardians.length;

        emit OwnerChanged(address(0), _owner);
    }

    /**
     * @dev 接收ETH
     */
    receive() external payable {}

    /**
     * @dev 添加守护人
     * @param guardian 守护人地址
     */
    function addGuardian(address guardian) external onlyOwner {
        require(guardian != address(0), "SmartAccount: guardian cannot be zero address");
        require(!guardians[guardian], "SmartAccount: guardian already exists");
        require(guardian != owner, "SmartAccount: owner cannot be guardian");

        guardians[guardian] = true;
        guardianList.push(guardian);
        guardianCount++;

        emit GuardianAdded(guardian);
    }

    /**
     * @dev 移除守护人
     * @param guardian 守护人地址
     */
    function removeGuardian(address guardian) external onlyOwner {
        require(guardians[guardian], "SmartAccount: guardian does not exist");
        require(guardianCount > requiredGuardians, "SmartAccount: cannot remove guardian, would fall below required count");

        guardians[guardian] = false;
        
        // 从数组中移除
        for (uint256 i = 0; i < guardianList.length; i++) {
            if (guardianList[i] == guardian) {
                guardianList[i] = guardianList[guardianList.length - 1];
                guardianList.pop();
                break;
            }
        }
        guardianCount--;

        emit GuardianRemoved(guardian);
    }

    /**
     * @dev 发起账户恢复
     * @param newOwner 新的账户所有者
     */
    function initiateRecovery(address newOwner) external onlyGuardian {
        require(newOwner != address(0), "SmartAccount: new owner cannot be zero address");
        require(newOwner != owner, "SmartAccount: new owner is current owner");

        uint256 recoveryId = recoveryCounter++;
        Recovery storage recovery = recoveries[recoveryId];
        recovery.newOwner = newOwner;
        recovery.timestamp = block.timestamp;
        recovery.confirmed[msg.sender] = true;
        recovery.confirmations = 1;

        emit RecoveryInitiated(newOwner, recoveryId);
    }

    /**
     * @dev 确认账户恢复
     * @param recoveryId 恢复ID
     */
    function confirmRecovery(uint256 recoveryId) external onlyGuardian {
        Recovery storage recovery = recoveries[recoveryId];
        require(recovery.newOwner != address(0), "SmartAccount: recovery does not exist");
        require(!recovery.executed, "SmartAccount: recovery already executed");
        require(!recovery.confirmed[msg.sender], "SmartAccount: already confirmed");

        recovery.confirmed[msg.sender] = true;
        recovery.confirmations++;

        // 如果达到所需确认数且过了等待期，执行恢复
        if (recovery.confirmations >= requiredGuardians && 
            block.timestamp >= recovery.timestamp + RECOVERY_PERIOD) {
            _executeRecovery(recoveryId);
        }
    }

    /**
     * @dev 执行账户恢复
     * @param recoveryId 恢复ID
     */
    function executeRecovery(uint256 recoveryId) external {
        Recovery storage recovery = recoveries[recoveryId];
        require(recovery.confirmations >= requiredGuardians, "SmartAccount: insufficient confirmations");
        require(block.timestamp >= recovery.timestamp + RECOVERY_PERIOD, "SmartAccount: recovery period not passed");
        require(!recovery.executed, "SmartAccount: recovery already executed");

        _executeRecovery(recoveryId);
    }

    /**
     * @dev 内部函数：执行恢复
     * @param recoveryId 恢复ID
     */
    function _executeRecovery(uint256 recoveryId) internal {
        Recovery storage recovery = recoveries[recoveryId];
        address previousOwner = owner;
        owner = recovery.newOwner;
        recovery.executed = true;

        emit RecoveryExecuted(recovery.newOwner, recoveryId);
        emit OwnerChanged(previousOwner, recovery.newOwner);
    }

    /**
     * @dev 批量执行交易
     * @param calls 调用数组
     */
    function batchExecute(Call[] calldata calls) external onlyOwner nonReentrant {
        require(calls.length > 0, "SmartAccount: empty calls array");

        bytes32 batchHash = keccak256(abi.encode(calls, block.timestamp));

        for (uint256 i = 0; i < calls.length; i++) {
            Call calldata call = calls[i];
            
            (bool success, bytes memory result) = call.to.call{value: call.value}(call.data);
            require(success, string(abi.encodePacked("SmartAccount: call ", i, " failed: ", result)));
        }

        emit BatchExecuted(batchHash);
    }

    /**
     * @dev 使用ERC20代币支付Gas费
     * @param token 代币地址
     * @param amount 支付金额
     * @param recipient Gas费接收者
     */
    function payGasWithToken(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        require(token != address(0), "SmartAccount: token cannot be zero address");
        require(recipient != address(0), "SmartAccount: recipient cannot be zero address");
        require(amount > 0, "SmartAccount: amount must be greater than zero");

        IERC20(token).transfer(recipient, amount);
        
        emit GasPaymentExecuted(token, amount);
    }

    /**
     * @dev 执行单个交易
     * @param to 目标地址
     * @param value ETH数量
     * @param data 调用数据
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner nonReentrant {
        require(to != address(0), "SmartAccount: target cannot be zero address");

        (bool success, bytes memory result) = to.call{value: value}(data);
        require(success, string(abi.encodePacked("SmartAccount: execution failed: ", result)));
    }

    /**
     * @dev 获取守护人列表
     */
    function getGuardians() external view returns (address[] memory) {
        return guardianList;
    }

    /**
     * @dev 检查是否为守护人
     * @param guardian 地址
     */
    function isGuardian(address guardian) external view returns (bool) {
        return guardians[guardian];
    }

    /**
     * @dev 获取恢复信息
     * @param recoveryId 恢复ID
     */
    function getRecoveryInfo(uint256 recoveryId) external view returns (
        address newOwner,
        uint256 confirmations,
        uint256 timestamp,
        bool executed
    ) {
        Recovery storage recovery = recoveries[recoveryId];
        return (
            recovery.newOwner,
            recovery.confirmations,
            recovery.timestamp,
            recovery.executed
        );
    }

    /**
     * @dev 检查守护人是否已确认恢复
     * @param recoveryId 恢复ID
     * @param guardian 守护人地址
     */
    function hasConfirmedRecovery(uint256 recoveryId, address guardian) external view returns (bool) {
        return recoveries[recoveryId].confirmed[guardian];
    }

    // ============ ERC-4337 相关函数 ============

    /**
     * @dev 获取当前nonce值
     */
    function getNonce() public view returns (uint256) {
        return _nonce;
    }

    /**
     * @dev 验证用户操作 - ERC-4337核心函数
     * @param userOp 用户操作结构体
     * @param userOpHash 用户操作哈希
     * @param missingAccountFunds 账户缺少的资金
     * @return validationData 验证结果数据
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        // 验证nonce
        require(userOp.nonce == _nonce, "SmartAccount: invalid nonce");
        
        // 验证签名
        validationData = _validateSignature(userOp, userOpHash);
        
        // 增加nonce
        _nonce++;
        
        // 如果需要，向EntryPoint存入资金
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "SmartAccount: failed to pay prefund");
        }
        
        return validationData;
    }

    /**
     * @dev 执行用户操作 - 由EntryPoint调用
     * @param dest 目标地址
     * @param value 转账金额
     * @param func 调用数据
     */
    function executeUserOp(
        address dest,
        uint256 value,
        bytes calldata func
    ) external onlyEntryPoint {
        _call(dest, value, func);
    }

    /**
     * @dev 验证签名的内部函数
     * @param userOp 用户操作
     * @param userOpHash 用户操作哈希
     * @return validationData 验证结果
     */
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address signer = hash.recover(userOp.signature);
        
        if (signer == owner) {
            return 0; // 签名有效
        }
        
        return 1; // 签名无效
    }

    /**
     * @dev 内部调用函数
     * @param target 目标地址
     * @param value 转账金额
     * @param data 调用数据
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @dev 向EntryPoint存入资金
     */
    function addDeposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /**
     * @dev 获取在EntryPoint中的存款余额
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }
}