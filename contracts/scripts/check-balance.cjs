const { ethers } = require("hardhat");

async function main() {
  // 智能账户地址
  const smartAccountAddress = "0x49cca6d32e303975ab9748882248f9c3De448669";
  
  // 获取provider
  const provider = ethers.provider;
  
  // 检查智能账户余额
  const balance = await provider.getBalance(smartAccountAddress);
  console.log(`智能账户地址: ${smartAccountAddress}`);
  console.log(`余额 (wei): ${balance.toString()}`);
  console.log(`余额 (ETH): ${ethers.formatEther(balance)}`);
  
  // 检查一些默认账户的余额
  const signers = await ethers.getSigners();
  console.log("\n默认账户余额:");
  for (let i = 0; i < Math.min(3, signers.length); i++) {
    const signer = signers[i];
    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);
    console.log(`账户 ${i}: ${address}`);
    console.log(`余额 (ETH): ${ethers.formatEther(balance)}`);
  }
  
  // 检查网络信息
  const network = await provider.getNetwork();
  console.log(`\n网络信息:`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Network Name: ${network.name}`);
  
  // 获取最新区块
  const blockNumber = await provider.getBlockNumber();
  console.log(`最新区块号: ${blockNumber}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });