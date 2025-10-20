// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SmartAccount.sol";

// 简化的EntryPoint合约实现
contract EntryPoint is ReentrancyGuard, Ownable {
    
    mapping(address => uint256) public balanceOf;
    
    event Deposited(address indexed account, uint256 totalDeposit);
    event Withdrawn(address indexed account, address withdrawAddress, uint256 amount);
    event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev 为账户存入资金
     * @param account 账户地址
     */
    function depositTo(address account) public payable {
        balanceOf[account] += msg.value;
        emit Deposited(account, balanceOf[account]);
    }
    
    /**
     * @dev 提取资金
     * @param withdrawAddress 提取地址
     * @param withdrawAmount 提取金额
     */
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external {
        require(balanceOf[msg.sender] >= withdrawAmount, "EntryPoint: insufficient balance");
        balanceOf[msg.sender] -= withdrawAmount;
        withdrawAddress.transfer(withdrawAmount);
        emit Withdrawn(msg.sender, withdrawAddress, withdrawAmount);
    }
    
    /**
     * @dev 处理用户操作（简化版本）
     * @param userOp 用户操作
     */
    function handleOp(UserOperation calldata userOp) external nonReentrant {
        bytes32 userOpHash = getUserOpHash(userOp);
        
        // 验证用户操作
        uint256 validationData = IAccount(userOp.sender).validateUserOp(userOp, userOpHash, 0);
        require(validationData == 0, "EntryPoint: validation failed");
        
        // 执行用户操作
        (bool success,) = userOp.sender.call(userOp.callData);
        
        emit UserOperationEvent(userOpHash, userOp.sender, address(0), userOp.nonce, success, 0, 0);
    }
    
    /**
     * @dev 获取用户操作哈希
     * @param userOp 用户操作
     */
    function getUserOpHash(UserOperation calldata userOp) public pure returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            userOp.initCode,
            userOp.callData,
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            userOp.paymasterAndData
        ));
    }
}