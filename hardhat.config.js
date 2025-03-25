require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,  // Enable optimizer
        runs: 2**32 - 1  // Optimize for maximum performance
      },
      metadata: {
        // Default metadata settings for all contracts
        bytecodeHash: "none"  // Use IPFS metadata hash by default for all contracts
      }
    }
  }
};