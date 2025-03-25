const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Constants
const EVALUATION_DIR = "./evaluation"; // Directory where the artifacts are stored
const OUTPUT_FILE = "./evaluation_results.json"; // Output file for results
const TOKEN_VALIDATOR_OPTIMIZED_PREFIX = "ipfs2147483647"; // Highest optimization for TokenValidator
const TOKEN_VALIDATOR_UNOPTIMIZED_PREFIX = "ipfsnone"; // Unoptimized version for TokenValidator
const OZ_TOKENA_PREFIXES = ["ipfsnone", ...Array.from({ length: 32 }, (_, i) => `ipfs${2 ** (31 - i) - 1}`)]; // ipfs Prefixes for ozTokenA
const TOKEN_VALIDATOR_THRESHOLD = 12; // Threshold for TokenValidator
const OZ_TOKEN_INITIAL_SUPPLY = 1000000; // Initial supply for ozTokenA

// Helper to reset the network
async function resetNetwork() {
  console.log("Resetting Hardhat network...");
  await network.provider.send("hardhat_reset");
}

// Helper to load a contract factory from the evaluation folder
async function getContractFactoryFromEvaluation(prefix, contractName) {
  const artifactPath = path.join(EVALUATION_DIR, prefix, `${contractName}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Retrieve the first signer
  const signer = await ethers.provider.getSigner();

  // Create and return the ContractFactory with the signer
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
}

// Deploy a contract and capture deployment cost
async function deployContractWithCost(prefix, contractName, constructorArgs = []) {
  const ContractFactory = await getContractFactoryFromEvaluation(prefix, contractName);
  const tx = await ContractFactory.getDeployTransaction(...constructorArgs);
  const signer = await ethers.provider.getSigner();
  const response = await signer.sendTransaction(tx);

  // Wait for deployment and capture the receipt
  const receipt = await response.wait();
  console.log(`${contractName} deployed at ${receipt.contractAddress} with prefix: ${prefix}`);
  return { address: receipt.contractAddress, deploymentCost: receipt.gasUsed.toString() };
}

// Run tests
async function main() {
  const results = [];

  try {
    for (const ozTokenAPrefix of OZ_TOKENA_PREFIXES) {
      console.log(`\nTesting ozTokenA with prefix: ${ozTokenAPrefix}`);

      // Reset the network
      await resetNetwork();

      // Deploy optimized TokenValidator
      const { address: optimizedAddress } = await deployContractWithCost(
        TOKEN_VALIDATOR_OPTIMIZED_PREFIX,
        "TokenValidator",
        [TOKEN_VALIDATOR_THRESHOLD]
      );

      // Deploy unoptimized TokenValidator
      const { address: unoptimizedAddress } = await deployContractWithCost(
        TOKEN_VALIDATOR_UNOPTIMIZED_PREFIX,
        "TokenValidator",
        [TOKEN_VALIDATOR_THRESHOLD]
      );

      // Deploy ozTokenA with name, symbol, and initial supply
      const { address: ozTokenAddress, deploymentCost } = await deployContractWithCost(
        ozTokenAPrefix,
        "ozTokenA",
        ["ozToken", "ozt", OZ_TOKEN_INITIAL_SUPPLY]
      );

      // Estimate gas cost with optimized TokenValidator
      const tokenValidatorOptimized = await ethers.getContractAt(
        "TokenValidator",
        optimizedAddress
      );
      const gasOptimized = await tokenValidatorOptimized.validateToken.estimateGas(ozTokenAddress);
      console.log(`Estimated gas (optimized) for ozTokenA with prefix=${ozTokenAPrefix}: ${gasOptimized.toString()}`);

      // Estimate gas cost with unoptimized TokenValidator
      const tokenValidatorUnoptimized = await ethers.getContractAt(
        "TokenValidator",
        unoptimizedAddress
      );
      const gasUnoptimized = await tokenValidatorUnoptimized.validateToken.estimateGas(ozTokenAddress);
      console.log(`Estimated gas (unoptimized) for ozTokenA with prefix=${ozTokenAPrefix}: ${gasUnoptimized.toString()}`);

      // Save results
      results.push({
        ozTokenAPrefix,
        gasUsedOptimized: gasOptimized.toString(),
        gasUsedUnoptimized: gasUnoptimized.toString(),
        deploymentCostToken: deploymentCost,
      });
    }
  } catch (error) {
    console.error("Error during testing:", error);
  } finally {
    // Sort results in ascending order of optimization level
    results.sort((a, b) => {
      const prefixA = a.ozTokenAPrefix;
      const prefixB = b.ozTokenAPrefix;

      if (prefixA === "ipfsnone") return -1; // Always put "ipfsnone" first
      if (prefixB === "ipfsnone") return 1;

      // Compare numeric values of optimization levels
      const levelA = prefixA.startsWith("ipfs") ? parseInt(prefixA.replace("ipfs", ""), 10) : Number.MAX_SAFE_INTEGER;
      const levelB = prefixB.startsWith("ipfs") ? parseInt(prefixB.replace("ipfs", ""), 10) : Number.MAX_SAFE_INTEGER;

      return levelA - levelB;
    });

    console.log("Test results:");
    console.table(results);

    // Save results to JSON
    try {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      console.log(`Results saved to ${OUTPUT_FILE}`);
    } catch (writeError) {
      console.error(`Error writing results to file: ${writeError.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
