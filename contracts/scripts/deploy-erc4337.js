import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
    console.log("开始部署ERC-4337智能账户系统...");

    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("部署者地址:", deployer.address);
    console.log("部署者余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // 1. 部署EntryPoint合约
    console.log("\n1. 部署EntryPoint合约...");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    const entryPointAddress = await entryPoint.getAddress();
    console.log("EntryPoint合约地址:", entryPointAddress);

    // 2. 部署SmartAccountFactory合约
    console.log("\n2. 部署SmartAccountFactory合约...");
    const creationFee = ethers.parseEther("0.001"); // 0.001 ETH
    const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactory");
    const factory = await SmartAccountFactory.deploy(creationFee, entryPointAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("SmartAccountFactory合约地址:", factoryAddress);
    console.log("创建费用:", ethers.formatEther(creationFee), "ETH");

    // 3. 创建一个测试智能账户
    console.log("\n3. 创建测试智能账户...");
    const [owner, guardian1, guardian2] = await ethers.getSigners();
    const guardians = [guardian1.address, guardian2.address];
    const requiredGuardians = 2;
    const salt = ethers.keccak256(ethers.toUtf8Bytes("test-account-1"));

    const tx = await factory.createSmartAccount(
        owner.address,
        guardians,
        requiredGuardians,
        salt,
        { value: creationFee }
    );
    
    const receipt = await tx.wait();
    console.log("智能账户创建交易哈希:", receipt.hash);

    // 获取创建的账户地址
    const accountCount = await factory.accountCount();
    const allAccounts = await factory.getAllAccounts();
    const smartAccountAddress = allAccounts[allAccounts.length - 1];
    
    console.log("创建的智能账户地址:", smartAccountAddress);
    console.log("账户所有者:", owner.address);
    console.log("守护者:", guardians);
    console.log("需要确认的守护者数量:", requiredGuardians);

    // 4. 验证智能账户功能
    console.log("\n4. 验证智能账户功能...");
    const SmartAccount = await ethers.getContractFactory("SmartAccount");
    const smartAccount = SmartAccount.attach(smartAccountAddress);

    const accountOwner = await smartAccount.owner();
    const accountGuardians = await smartAccount.getGuardians();
    const nonce = await smartAccount.getNonce();
    const deposit = await smartAccount.getDeposit();

    console.log("验证结果:");
    console.log("- 账户所有者:", accountOwner);
    console.log("- 守护者列表:", accountGuardians);
    console.log("- 当前nonce:", nonce.toString());
    console.log("- EntryPoint存款:", ethers.formatEther(deposit), "ETH");

    // 5. 向智能账户存入一些ETH用于测试
    console.log("\n5. 向智能账户存入测试资金...");
    const depositAmount = ethers.parseEther("0.1");
    await owner.sendTransaction({
        to: smartAccountAddress,
        value: depositAmount
    });
    
    const accountBalance = await owner.provider.getBalance(smartAccountAddress);
    console.log("智能账户余额:", ethers.formatEther(accountBalance), "ETH");

    console.log("\n✅ ERC-4337智能账户系统部署完成!");
    console.log("\n📋 部署摘要:");
    console.log("- EntryPoint:", entryPointAddress);
    console.log("- SmartAccountFactory:", factoryAddress);
    console.log("- 测试智能账户:", smartAccountAddress);
    console.log("- 创建费用:", ethers.formatEther(creationFee), "ETH");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("部署失败:", error);
        process.exit(1);
    });