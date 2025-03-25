const fs = require("fs");
const { execSync } = require("child_process");

// Constants
const CONFIG_FILE = "./hardhat.config.js";
const ARTIFACT_SCRIPT = "./secure_artifacts.sh";
const RUN_VALUES = Array.from({ length: 32 }, (_, i) => 2 ** (31 - i) - 1); // 2^31-1 to 2^0-1
const BYTECODE_HASH_VALUES = ["ipfs", "none"];

// Backup original config
const originalConfig = fs.readFileSync(CONFIG_FILE, "utf8");

// Helper to update the Hardhat config
function updateConfig(runs, bytecodeHash, optimized) {
  const newConfig = `
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,  // Enable optimizer
        runs: ${runs}  // Dynamic runs value
      },
      metadata: {
        bytecodeHash: "${bytecodeHash}"  // Dynamic bytecodeHash
      }
    }
  }
};`;

    const noneConfig = `
  require("@nomicfoundation/hardhat-toolbox");
  module.exports = {
    solidity: {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: false,  // Enable optimizer
          runs: 0  // Dynamic runs value
        },
        metadata: {
          bytecodeHash: "${bytecodeHash}"  // Dynamic bytecodeHash
        }
      }
    }
  };`;

  optimized ? fs.writeFileSync(CONFIG_FILE, newConfig, "utf8") : fs.writeFileSync(CONFIG_FILE, noneConfig, "utf8");
  //fs.writeFileSync(CONFIG_FILE, newConfig, "utf8");
  console.log(`Updated hardhat.config.js with runs: ${runs}, bytecodeHash: "${bytecodeHash}", optimized: ${optimized}`);
}

// Helper to compile and secure artifacts
function compileAndSecure(prefix) {
  console.log(`Compiling with prefix: ${prefix}`);
  try {
    execSync("npx hardhat compile", { stdio: "inherit" });
    execSync(`${ARTIFACT_SCRIPT} ${prefix}`, { stdio: "inherit" });
    console.log(`Artifacts secured for prefix: ${prefix}`);
  } catch (error) {
    console.error(`Error during compilation or artifact securing for prefix: ${prefix}`, error);
  }
}

// Main execution loop
try {
  for (const bytecodeHash of BYTECODE_HASH_VALUES) {
    for (const runs of RUN_VALUES) {
      const prefix = `${bytecodeHash}${runs}`;
      updateConfig(runs, bytecodeHash, true);
      compileAndSecure(prefix);
    }
    updateConfig(0, bytecodeHash, false);
    compileAndSecure(`${bytecodeHash}none`);
  }
} catch (error) {
  console.error("Unexpected error:", error);
} finally {
  // Restore original config
  fs.writeFileSync(CONFIG_FILE, originalConfig, "utf8");
  console.log("Restored original hardhat.config.js");
}
