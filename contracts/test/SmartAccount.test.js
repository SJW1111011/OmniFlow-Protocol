const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SmartAccount", function () {
  let SmartAccount, smartAccount;
  let SmartAccountFactory, factory;
  let owner, guardian1, guardian2, guardian3, newOwner, attacker;
  let guardians, requiredGuardians;

  beforeEach(async function () {
    // 获取测试账户
    [owner, guardian1, guardian2, guardian3, newOwner, attacker] = await ethers.getSigners();
    
    // 设置守护人
    guardians = [guardian1.address, guardian2.address, guardian3.address];
    requiredGuardians = 2;

    // 部署工厂合约
    SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactory");
    factory = await SmartAccountFactory.deploy(ethers.parseEther("0.001"));
    await factory.waitForDeployment();

    // 创建智能账户
    const salt = ethers.keccak256(ethers.toUtf8Bytes("test-salt"));
    await factory.createSmartAccount(
      owner.address,
      guardians,
      requiredGuardians,
      salt,
      { value: ethers.parseEther("0.001") }
    );

    // 获取创建的智能账户
    const accounts = await factory.getAccountsByOwner(owner.address);
    SmartAccount = await ethers.getContractFactory("SmartAccount");
    smartAccount = SmartAccount.attach(accounts[0]);
  });

  describe("部署和初始化", function () {
    it("应该正确设置所有者", async function () {
      expect(await smartAccount.owner()).to.equal(owner.address);
    });

    it("应该正确设置守护人", async function () {
      const accountGuardians = await smartAccount.getGuardians();
      expect(accountGuardians).to.deep.equal(guardians);
      expect(await smartAccount.guardianCount()).to.equal(3);
      expect(await smartAccount.requiredGuardians()).to.equal(2);
    });

    it("应该正确识别守护人", async function () {
      expect(await smartAccount.isGuardian(guardian1.address)).to.be.true;
      expect(await smartAccount.isGuardian(guardian2.address)).to.be.true;
      expect(await smartAccount.isGuardian(guardian3.address)).to.be.true;
      expect(await smartAccount.isGuardian(attacker.address)).to.be.false;
    });
  });

  describe("守护人管理", function () {
    it("所有者应该能够添加守护人", async function () {
      await expect(smartAccount.connect(owner).addGuardian(newOwner.address))
        .to.emit(smartAccount, "GuardianAdded")
        .withArgs(newOwner.address);

      expect(await smartAccount.isGuardian(newOwner.address)).to.be.true;
      expect(await smartAccount.guardianCount()).to.equal(4);
    });

    it("所有者应该能够移除守护人", async function () {
      await expect(smartAccount.connect(owner).removeGuardian(guardian3.address))
        .to.emit(smartAccount, "GuardianRemoved")
        .withArgs(guardian3.address);

      expect(await smartAccount.isGuardian(guardian3.address)).to.be.false;
      expect(await smartAccount.guardianCount()).to.equal(2);
    });

    it("非所有者不应该能够添加守护人", async function () {
      await expect(
        smartAccount.connect(attacker).addGuardian(newOwner.address)
      ).to.be.revertedWith("SmartAccount: caller is not the owner");
    });

    it("不应该能够添加重复的守护人", async function () {
      await expect(
        smartAccount.connect(owner).addGuardian(guardian1.address)
      ).to.be.revertedWith("SmartAccount: guardian already exists");
    });
  });

  describe("账户恢复", function () {
    it("守护人应该能够发起恢复", async function () {
      await expect(smartAccount.connect(guardian1).initiateRecovery(newOwner.address))
        .to.emit(smartAccount, "RecoveryInitiated")
        .withArgs(newOwner.address, 0);

      const recovery = await smartAccount.getRecoveryInfo(0);
      expect(recovery.newOwner).to.equal(newOwner.address);
      expect(recovery.confirmations).to.equal(1);
      expect(recovery.executed).to.be.false;
    });

    it("应该能够完成账户恢复", async function () {
      // 发起恢复
      await smartAccount.connect(guardian1).initiateRecovery(newOwner.address);
      
      // 第二个守护人确认
      await smartAccount.connect(guardian2).confirmRecovery(0);

      // 等待恢复期
      await time.increase(2 * 24 * 60 * 60 + 1); // 2天 + 1秒

      // 执行恢复
      await expect(smartAccount.executeRecovery(0))
        .to.emit(smartAccount, "RecoveryExecuted")
        .withArgs(newOwner.address, 0)
        .and.to.emit(smartAccount, "OwnerChanged")
        .withArgs(owner.address, newOwner.address);

      expect(await smartAccount.owner()).to.equal(newOwner.address);
    });

    it("恢复期未过不应该能够执行恢复", async function () {
      await smartAccount.connect(guardian1).initiateRecovery(newOwner.address);
      await smartAccount.connect(guardian2).confirmRecovery(0);

      await expect(
        smartAccount.executeRecovery(0)
      ).to.be.revertedWith("SmartAccount: recovery period not passed");
    });

    it("确认数不足不应该能够执行恢复", async function () {
      await smartAccount.connect(guardian1).initiateRecovery(newOwner.address);
      await time.increase(2 * 24 * 60 * 60 + 1);

      await expect(
        smartAccount.executeRecovery(0)
      ).to.be.revertedWith("SmartAccount: insufficient confirmations");
    });
  });

  describe("批量操作", function () {
    it("应该能够执行批量交易", async function () {
      // 向智能账户发送一些ETH
      await owner.sendTransaction({
        to: await smartAccount.getAddress(),
        value: ethers.parseEther("1.0")
      });

      const calls = [
        {
          to: guardian1.address,
          value: ethers.parseEther("0.1"),
          data: "0x"
        },
        {
          to: guardian2.address,
          value: ethers.parseEther("0.1"),
          data: "0x"
        }
      ];

      await expect(smartAccount.connect(owner).batchExecute(calls))
        .to.emit(smartAccount, "BatchExecuted");
    });

    it("非所有者不应该能够执行批量交易", async function () {
      const calls = [{
        to: guardian1.address,
        value: ethers.parseEther("0.1"),
        data: "0x"
      }];

      await expect(
        smartAccount.connect(attacker).batchExecute(calls)
      ).to.be.revertedWith("SmartAccount: caller is not the owner");
    });
  });

  describe("单个交易执行", function () {
    it("应该能够执行单个交易", async function () {
      // 向智能账户发送一些ETH
      await owner.sendTransaction({
        to: await smartAccount.getAddress(),
        value: ethers.parseEther("1.0")
      });

      const initialBalance = await ethers.provider.getBalance(guardian1.address);
      
      await smartAccount.connect(owner).execute(
        guardian1.address,
        ethers.parseEther("0.1"),
        "0x"
      );

      const finalBalance = await ethers.provider.getBalance(guardian1.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("0.1"));
    });
  });

  describe("Gas费抽象", function () {
    let mockToken;

    beforeEach(async function () {
      // 部署一个模拟ERC20代币
      const MockToken = await ethers.getContractFactory("MockERC20");
      mockToken = await MockToken.deploy("Mock Token", "MTK", ethers.parseEther("1000"));
      await mockToken.waitForDeployment();

      // 向智能账户转移一些代币
      await mockToken.transfer(await smartAccount.getAddress(), ethers.parseEther("100"));
    });

    it("应该能够使用ERC20代币支付Gas费", async function () {
      const amount = ethers.parseEther("10");
      const recipient = guardian1.address;

      await expect(
        smartAccount.connect(owner).payGasWithToken(
          await mockToken.getAddress(),
          amount,
          recipient
        )
      ).to.emit(smartAccount, "GasPaymentExecuted")
       .withArgs(await mockToken.getAddress(), amount);

      expect(await mockToken.balanceOf(recipient)).to.equal(amount);
    });
  });

  describe("接收ETH", function () {
    it("应该能够接收ETH", async function () {
      const amount = ethers.parseEther("1.0");
      
      await expect(() =>
        owner.sendTransaction({
          to: smartAccount.getAddress(),
          value: amount
        })
      ).to.changeEtherBalance(smartAccount, amount);
    });
  });
});

// 模拟ERC20代币合约
const MockERC20Source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
}
`;