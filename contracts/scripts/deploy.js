import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("开始部署智能账户系统...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);
  console.log("部署者余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // 首先部署EntryPoint
  console.log("\n部署EntryPoint...");
  const EntryPoint = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await EntryPoint.deploy();
  await entryPoint.waitForDeployment();
  
  const entryPointAddress = await entryPoint.getAddress();
  console.log("EntryPoint 部署地址:", entryPointAddress);

  // 部署智能账户工厂
  console.log("\n部署SmartAccountFactory...");
  const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactory");
  
  // 设置创建费用为 0.001 ETH
  const creationFee = ethers.parseEther("0.001");
  const factory = await SmartAccountFactory.deploy(creationFee, entryPointAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("SmartAccountFactory 部署地址:", factoryAddress);
  console.log("创建费用:", ethers.formatEther(creationFee), "ETH");

  // 验证部署
  console.log("\n验证部署...");
  const accountCount = await factory.accountCount();
  console.log("当前账户数量:", accountCount.toString());

  // 创建一个示例智能账户
  console.log("\n创建示例智能账户...");
  
  // 设置示例参数
  const owner = deployer.address;
  const guardians = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // 示例守护人1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"  // 示例守护人2
  ];
  const requiredGuardians = 2;
  const salt = ethers.keccak256(ethers.toUtf8Bytes("example-salt-1"));

  // 预计算账户地址
  const predictedAddress = await factory.getSmartAccountAddress(
    owner,
    guardians,
    requiredGuardians,
    salt
  );
  console.log("预计算的智能账户地址:", predictedAddress);

  // 创建智能账户
  const tx = await factory.createSmartAccount(
    owner,
    guardians,
    requiredGuardians,
    salt,
    { value: creationFee }
  );
  
  const receipt = await tx.wait();
  console.log("智能账户创建交易哈希:", receipt.hash);

  // 获取创建的账户地址
  const accounts = await factory.getAccountsByOwner(owner);
  console.log("创建的智能账户地址:", accounts[accounts.length - 1]);

  // 验证智能账户功能
  console.log("\n验证智能账户功能...");
  const SmartAccount = await ethers.getContractFactory("SmartAccount");
  const smartAccount = SmartAccount.attach(accounts[accounts.length - 1]);

  const accountOwner = await smartAccount.owner();
  const accountGuardians = await smartAccount.getGuardians();
  const guardianCount = await smartAccount.guardianCount();
  const requiredGuardiansCount = await smartAccount.requiredGuardians();

  console.log("智能账户所有者:", accountOwner);
  console.log("守护人列表:", accountGuardians);
  console.log("守护人数量:", guardianCount.toString());
  console.log("所需守护人数量:", requiredGuardiansCount.toString());

  console.log("\n部署完成！");
  console.log("=".repeat(50));
  console.log("EntryPoint 地址:", entryPointAddress);
  console.log("SmartAccountFactory 地址:", factoryAddress);
  console.log("示例智能账户地址:", accounts[accounts.length - 1]);
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });