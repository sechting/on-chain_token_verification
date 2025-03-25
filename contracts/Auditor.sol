// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Auditor is Ownable {
    address public auditorAddress; // The derived Ethereum address of the auditor

    /**
     * @dev Initializes the contract with the auditor's public key.
     * @param publicKey The public key of the auditor (64 bytes: X and Y coordinates).
     */
    constructor(bytes memory publicKey) 
        Ownable(msg.sender) {
        require(publicKey.length == 64, "Invalid public key length"); // Ensure it's a valid uncompressed public key
        auditorAddress = deriveAddress(publicKey);
        console.log("Auditor address: %s", auditorAddress);
    }

    /**
     * @dev Updates the auditor's address. Can only be called by the owner.
     * @param newPublicKey The new public key of the auditor (64 bytes).
     */
    function updateAddress(bytes memory newPublicKey) external onlyOwner {
        require(newPublicKey.length == 64, "Invalid public key length");
        auditorAddress = deriveAddress(newPublicKey);
    }

    /**
     * @dev Returns the current stored address of the auditor.
     * @return The Ethereum address of the auditor.
     */
    function getAddress() external view returns (address) {
        return auditorAddress;
    }

    /**
     * @dev Derives the Ethereum address from a given public key.
     * @param publicKey The public key (64 bytes: X and Y coordinates).
     * @return The derived Ethereum address.
     */
    function deriveAddress(bytes memory publicKey) internal pure returns (address) {
        return address(uint160(uint256(keccak256(publicKey))));
    }
}
