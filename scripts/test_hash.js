const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// File name for saving results
const OUTPUT_FILE = "./hash_results.json";

// Constants
const EVALUATION_DIR = "./evaluation"; // Directory where the artifacts are stored
const TOKEN_VALIDATOR_OPTIMIZED_PREFIX = "ipfs2147483647"; // Optimized TokenValidator
const TOKEN_VALIDATOR_UNOPTIMIZED_PREFIX = "ipfsnone"; // Unoptimized TokenValidator
const OZ_TOKENA_PREFIXES = ["ipfsnone", ...Array.from({ length: 32 }, (_, i) => `ipfs${2 ** (31 - i) - 1}`)]; // ozTokenA prefixes

// Helper to reset the Hardhat network
async function resetNetwork() {
  console.log("Resetting Hardhat network...");
  await network.provider.send("hardhat_reset");
}

// Helper to load contract factory from evaluation artifacts
async function getContractFactoryFromEvaluation(prefix, contractName) {
  const artifactPath = path.join(EVALUATION_DIR, prefix, `${contractName}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create and return the ContractFactory
  const signer = await ethers.provider.getSigner();
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
}

// Deploy contract and return deployment details
async function deployContract(prefix, contractName, args = []) {
  const ContractFactory = await getContractFactoryFromEvaluation(prefix, contractName);

  // Deploy the contract
  const contract = await ContractFactory.deploy(...args);
  const receipt = await contract.deploymentTransaction().wait();

  console.log(`${contractName} deployed at ${contract.target} with prefix: ${prefix}`);
  return { contract, gasUsed: receipt.gasUsed.toString() };
}

// Run tests
async function main() {
  const results = [];

  try {
    for (const ozTokenAPrefix of OZ_TOKENA_PREFIXES) {
      console.log(`\nTesting ozTokenA with prefix: ${ozTokenAPrefix}`);

      // Reset the network
      await resetNetwork();

      // Deploy TokenValidator (optimized)
      const { contract: optimizedValidator } = await deployContract(
        TOKEN_VALIDATOR_OPTIMIZED_PREFIX,
        "TokenValidator",
        [0] // Constructor argument
      );

      // Deploy TokenValidator (unoptimized)
      const { contract: unoptimizedValidator } = await deployContract(
        TOKEN_VALIDATOR_UNOPTIMIZED_PREFIX,
        "TokenValidator",
        [0] // Constructor argument
      );

      // Deploy ozTokenA
      const { contract: ozToken } = await deployContract(ozTokenAPrefix, "ozTokenA", [
        "ozTokenA",
        "ozt",
        ethers.parseUnits("1000000", 18),
      ]);

      // Measure gas for getCodeHashNoMeta() on optimized
      const gasUsedOptimizedNoMeta = await optimizedValidator
        .getCodeHashNoMeta.estimateGas(ozToken.target);

      // Measure gas for getCodeHashNoMeta() on unoptimized
      const gasUsedUnoptimizedNoMeta = await unoptimizedValidator
        .getCodeHashNoMeta.estimateGas(ozToken.target);

      // Measure gas for getCodeHash() on optimized
      const gasUsedOptimizedMeta = await optimizedValidator.getCodeHash.estimateGas(
        ozToken.target
      );

      // Measure gas for getCodeHash() on unoptimized
      const gasUsedUnoptimizedMeta = await unoptimizedValidator.getCodeHash.estimateGas(
        ozToken.target
      );

      console.log(
        `Gas results for ozTokenA (${ozTokenAPrefix}): \n` +
        `Optimized - NoMeta: ${gasUsedOptimizedNoMeta.toString()}, Meta: ${gasUsedOptimizedMeta.toString()}\n` +
        `Unoptimized - NoMeta: ${gasUsedUnoptimizedNoMeta.toString()}, Meta: ${gasUsedUnoptimizedMeta.toString()}`
      );

      results.push({
        ozTokenAPrefix,
        gasUsedOptimizedNoMeta: gasUsedOptimizedNoMeta.toString(),
        gasUsedUnoptimizedNoMeta: gasUsedUnoptimizedNoMeta.toString(),
        gasUsedOptimizedMeta: gasUsedOptimizedMeta.toString(),
        gasUsedUnoptimizedMeta: gasUsedUnoptimizedMeta.toString(),
      });
    }
  } catch (error) {
    console.error("Error during testing:", error);
  } finally {
    // Save results to console and JSON
    console.log("Test results:");
    console.table(results);

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
