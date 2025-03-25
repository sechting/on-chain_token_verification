const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const EVALUATION_DIR = "./evaluation"; // Directory for contract artifacts
const OUTPUT_FILE = "./contract_groups.json"; // Output file for grouping results

const TOKEN_PREFIXES = ["nonenone", ...Array.from({ length: 32 }, (_, i) => `none${2 ** (31 - i) - 1}`)]; // Token prefixes
const AUDITCHECK_PREFIXES = ["nonenone", ...Array.from({ length: 32 }, (_, i) => `none${2 ** (31 - i) - 1}`)]; // AuditCheck prefixes
const TOKENVALIDATOR_PREFIXES = ["nonenone", ...Array.from({ length: 32 }, (_, i) => `none${2 ** (31 - i) - 1}`)]; // TokenValidator prefixes

// Helper to load contract factory from evaluation artifacts
async function getContractFactoryFromEvaluation(prefix, contractName) {
  const artifactPath = path.join(EVALUATION_DIR, prefix, `${contractName}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const signer = await ethers.provider.getSigner();
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
}

// Retrieve contract size and hash
async function getContractDetails(prefix, contractName, constructorArgs = []) {
  const factory = await getContractFactoryFromEvaluation(prefix, contractName);
  const contract = await factory.deploy(...constructorArgs); // Deploy the contract
  await contract.deploymentTransaction().wait(); // Wait for deployment to complete

  const deployedBytecode = await ethers.provider.getCode(contract.target); // Fetch bytecode
  const size = deployedBytecode.length / 2 - 1; // Calculate bytecode size (excluding "0x" prefix)
  const hash = ethers.keccak256(deployedBytecode); // Calculate hash

  console.log(`Contract: ${contractName}, Prefix: ${prefix}, Size: ${size}, Hash: ${hash}`);
  return { prefix, size, hash, contractName };
}

// Group contracts based on size and hash
async function groupContracts() {
  const tokenDetails = [];
  const auditCheckDetails = [];
  const tokenValidatorDetails = [];
  const ozTokenADetails = [];

  try {
    // Process Tokens
    for (const tokenPrefix of TOKEN_PREFIXES) {
      console.log(`Processing Token prefix: ${tokenPrefix}`);
      const details = await getContractDetails(tokenPrefix, "SignedToken", [
        "testtoken", // Name
        "tt",        // Symbol
        ethers.parseUnits("1000", 18) // Initial supply
      ]);
      tokenDetails.push(details);
    }

    // Process AuditChecks
    for (const auditCheckPrefix of AUDITCHECK_PREFIXES) {
      console.log(`Processing AuditCheck prefix: ${auditCheckPrefix}`);
      const details = await getContractDetails(auditCheckPrefix, "AuditCheck");
      auditCheckDetails.push(details);
    }

    // Process TokenValidators
    for (const tokenValidatorPrefix of TOKENVALIDATOR_PREFIXES) {
        console.log(`Processing TokenValidator prefix: ${tokenValidatorPrefix}`);
        const details = await getContractDetails(tokenValidatorPrefix, "TokenValidator", [0]);
        tokenValidatorDetails.push(details);
    }

    // Process ozTokenA
    for (const ozTokenAPrefix of TOKEN_PREFIXES) {
      console.log(`Processing ozTokenA prefix: ${ozTokenAPrefix}`);
      const details = await getContractDetails(ozTokenAPrefix, "ozTokenA", [
        "ozTokenA", // Name
        "ozt",      // Symbol
        ethers.parseUnits("1000000", 18) // Initial supply
      ]);
      ozTokenADetails.push(details);
    }

    // Group by size and hash
    const tokenGroups = groupBy(tokenDetails, (item) => `${item.size}_${item.hash}`);
    const auditCheckGroups = groupBy(auditCheckDetails, (item) => `${item.size}_${item.hash}`);
    const tokenValidatorGroups = groupBy(tokenValidatorDetails, (item) => `${item.size}_${item.hash}`);
    const ozTokenAGroups = groupBy(ozTokenADetails, (item) => `${item.size}_${item.hash}`);

    // Save results
    const results = { tokenGroups, auditCheckGroups, tokenValidatorGroups, ozTokenAGroups};
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("Error during contract grouping:", error);
  }
}

// Grouping helper
function groupBy(array, keyGetter) {
  const map = new Map();
  array.forEach((item) => {
    const key = keyGetter(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  });
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    size: items[0].size,
    hash: items[0].hash,
    contracts: items.map((item) => item.prefix),
  }));
}

// Run the script
groupContracts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
