const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ec } = require("elliptic");

// Constants
const EVALUATION_DIR = "./evaluation"; // Directory for contract artifacts
const OUTPUT_FILE = "./validation_gas_results.json"; // Output file for results
const AUDITCHECK_PREFIXES = ["ipfsnone", ...Array.from({ length: 32 }, (_, i) => `ipfs${2 ** (31 - i) - 1}`)]; // AuditCheck optimization prefixes
const TOKEN_PREFIXES = ["ipfsnone", ...Array.from({ length: 32 }, (_, i) => `ipfs${2 ** (31 - i) - 1}`)]; // Token optimization prefixes
const AUDITOR_OPTIMIZED_PREFIX = "ipfs2147483647"; // Fixed optimized prefix for Auditor
const TOKEN_INITIAL_SUPPLY = ethers.parseUnits("1000", 18); // Initial supply for Token contract

// Test key pair
const curve = new ec("secp256k1");
const testKeyPair = curve.genKeyPair();
const testPrivateKey = testKeyPair.getPrivate("hex"); // Hexadecimal private key
const testPublicKey = Uint8Array.from(testKeyPair.getPublic(false, "array").slice(1)); // Uncompressed public key as Uint8Array

// Helper to reset the Hardhat network
async function resetNetwork() {
  console.log("Resetting Hardhat network...");
  await network.provider.send("hardhat_reset");
}

// Helper to load contract factory from evaluation artifacts
async function getContractFactoryFromEvaluation(prefix, contractName) {
  const artifactPath = path.join(EVALUATION_DIR, prefix, `${contractName}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const signer = await ethers.provider.getSigner();
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
}

// Deploy contract and return deployment details
async function deployContract(prefix, contractName, args = []) {
  const ContractFactory = await getContractFactoryFromEvaluation(prefix, contractName);
  const contract = await ContractFactory.deploy(...args);
  const receipt = await contract.deploymentTransaction().wait();
  console.log(`${contractName} deployed at ${contract.target} with prefix: ${prefix}`);
  return contract;
}

// Main data collection function
async function collectData() {
  const results = [];

  try {
    for (const auditCheckPrefix of AUDITCHECK_PREFIXES) {
      for (const tokenPrefix of TOKEN_PREFIXES) {
        console.log(`\nTesting Token (${tokenPrefix}) with AuditCheck (${auditCheckPrefix})`);

        // Reset the network
        await resetNetwork();

        // Deploy Auditor (optimized) with the consistent test public key
        const auditor = await deployContract(AUDITOR_OPTIMIZED_PREFIX, "Auditor", [testPublicKey]);

        // Deploy Token
        const token = await deployContract(tokenPrefix, "SignedToken", [
          "Test Token",
          "TT",
          TOKEN_INITIAL_SUPPLY,
        ]);

        // Deploy AuditCheck
        const auditCheck = await deployContract(auditCheckPrefix, "AuditCheck");

        // Sign the token hash
        const deployedBytecode = await ethers.provider.getCode(token.target);
        const tokenHash = ethers.keccak256(deployedBytecode);
        const testWallet = new ethers.Wallet(testPrivateKey);
        const signatureObj = await testWallet.signingKey.sign(ethers.getBytes(tokenHash));
        const signature = ethers.concat([signatureObj.r, signatureObj.s, ethers.toBeHex(signatureObj.v)]);

        // Sign the token using SignedToken contract
        await token.signToken(auditor.target, signature);

        // Validate the token
        const gasUsed = await auditCheck.validateToken.estimateGas(token.target);
        console.log(
          `Gas used for Token (${tokenPrefix}) with AuditCheck (${auditCheckPrefix}): ${gasUsed.toString()}`
        );

        // Record results
        results.push({
          tokenPrefix,
          auditCheckPrefix,
          gasUsed: gasUsed.toString(),
        });
      }
    }
  } catch (error) {
    console.error("Error during data collection:", error);
  } finally {
    // Save results to a JSON file
    try {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      console.log(`Results saved to ${OUTPUT_FILE}`);
    } catch (writeError) {
      console.error(`Error writing results to file: ${writeError.message}`);
    }
  }
}

// Run the script
collectData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
