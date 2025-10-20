// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SmartAccount.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SmartAccountFactory
 * @dev 智能账户工厂合约 - 用于创建和管理ERC-4337智能账户
 */
contract SmartAccountFactory is Ownable {
    
    // 事件定义
    event SmartAccountCreated(
        address indexed account,
        address indexed owner,
        address[] guardians,
        uint256 requiredGuardians
    );
    
    // 状态变量
    mapping(address => address[]) public ownerToAccounts; // 所有者到账户的映射
    mapping(address => bool) public isSmartAccount; // 检查地址是否为智能账户
    address[] public allAccounts; // 所有创建的账户
    
    uint256 public accountCount;
    uint256 public creationFee; // 创建费用
    IEntryPoint public immutable entryPoint; // ERC-4337 EntryPoint
    
    /**
     * @dev 构造函数
     * @param _creationFee 创建智能账户的费用
     * @param _entryPoint ERC-4337 EntryPoint地址
     */
    constructor(uint256 _creationFee, IEntryPoint _entryPoint) Ownable(msg.sender) {
        creationFee = _creationFee;
        entryPoint = _entryPoint;
    }
    
    /**
     * @dev 创建智能账户
     * @param _owner 账户所有者
     * @param _guardians 守护人列表
     * @param _requiredGuardians 恢复所需的守护人数量
     * @param _salt 盐值，用于确定性部署
     */
    function createSmartAccount(
        address _owner,
        address[] memory _guardians,
        uint256 _requiredGuardians,
        bytes32 _salt
    ) external payable returns (address) {
        require(msg.value >= creationFee, "SmartAccountFactory: insufficient fee");
        require(_owner != address(0), "SmartAccountFactory: owner cannot be zero address");
        require(_guardians.length >= _requiredGuardians, "SmartAccountFactory: not enough guardians");
        require(_requiredGuardians > 0, "SmartAccountFactory: required guardians must be greater than zero");
        
        // 使用CREATE2进行确定性部署
        bytes memory bytecode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(_owner, _guardians, _requiredGuardians, entryPoint)
        );
        
        address account;
        assembly {
            account := create2(0, add(bytecode, 0x20), mload(bytecode), _salt)
        }
        
        require(account != address(0), "SmartAccountFactory: deployment failed");
        
        // 记录账户信息
        ownerToAccounts[_owner].push(account);
        isSmartAccount[account] = true;
        allAccounts.push(account);
        accountCount++;
        
        emit SmartAccountCreated(account, _owner, _guardians, _requiredGuardians);
        
        return account;
    }
    
    /**
     * @dev 预计算智能账户地址
     * @param _owner 账户所有者
     * @param _guardians 守护人列表
     * @param _requiredGuardians 恢复所需的守护人数量
     * @param _salt 盐值
     */
    function getSmartAccountAddress(
        address _owner,
        address[] memory _guardians,
        uint256 _requiredGuardians,
        bytes32 _salt
    ) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(_owner, _guardians, _requiredGuardians)
        );
        
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt,
                keccak256(bytecode)
            )
        );
        
        return address(uint160(uint256(hash)));
    }
    
    /**
     * @dev 获取用户的所有智能账户
     * @param _owner 账户所有者
     */
    function getAccountsByOwner(address _owner) external view returns (address[] memory) {
        return ownerToAccounts[_owner];
    }
    
    /**
     * @dev 获取所有智能账户
     */
    function getAllAccounts() external view returns (address[] memory) {
        return allAccounts;
    }
    
    /**
     * @dev 设置创建费用（仅所有者）
     * @param _newFee 新的创建费用
     */
    function setCreationFee(uint256 _newFee) external onlyOwner {
        creationFee = _newFee;
    }
    
    /**
     * @dev 提取合约中的ETH（仅所有者）
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "SmartAccountFactory: no balance to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "SmartAccountFactory: withdrawal failed");
    }
    
    /**
     * @dev 检查地址是否为通过此工厂创建的智能账户
     * @param _account 要检查的地址
     */
    function isAccountFromFactory(address _account) external view returns (bool) {
        return isSmartAccount[_account];
    }
}