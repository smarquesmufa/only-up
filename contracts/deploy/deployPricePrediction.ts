import { ethers, network } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("============================================================");
  console.log("PricePrediction Deploy Script");
  console.log("============================================================");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.error("Insufficient balance for deployment");
    process.exit(1);
  }

  console.log("\nDeploying PricePrediction...");
  const PricePrediction = await ethers.getContractFactory("PricePrediction");
  const contract = await PricePrediction.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PricePrediction deployed:", address);

  // Verify owner
  const owner = await contract.owner();
  console.log("Contract owner:", owner);

  // Save deployment info
  const deployment = {
    contract: "PricePrediction",
    address,
    owner: deployer.address,
    network: network.name,
    chainId: network.config.chainId,
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = `./deployments/${network.name}`;
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }
  fs.writeFileSync(`${deploymentPath}/PricePrediction.json`, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${deploymentPath}/PricePrediction.json`);

  console.log("\n============================================================");
  console.log("Deployment Complete!");
  console.log("============================================================");
  console.log("Contract Address:", address);
  console.log("\nNext steps:");

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
