// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev 模拟ERC20代币合约，用于测试Gas费抽象功能
 */
contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
    
    /**
     * @dev 铸造代币（用于测试）
     * @param to 接收者地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}