import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("部署MockERC20代币合约...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 部署MockERC20代币
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy(
    "Test Token", 
    "TEST", 
    ethers.parseEther("1000000") // 1,000,000 tokens
  );
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  
  console.log("MockERC20 deployed to:", tokenAddress);
  console.log("Total Supply:", ethers.formatEther(await token.totalSupply()), "TEST");
  
  // 向一些测试账户转移代币
  const [, account1, account2] = await ethers.getSigners();
  
  await token.transfer(account1.address, ethers.parseEther("10000"));
  await token.transfer(account2.address, ethers.parseEther("10000"));
  
  console.log("Transferred 10,000 TEST to:", account1.address);
  console.log("Transferred 10,000 TEST to:", account2.address);
  
  console.log("✅ MockERC20代币部署完成!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });