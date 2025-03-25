// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "hardhat/console.sol";

interface ISignedToken {
    function getSignature() external view returns (address, bytes memory);
}

interface IAuditor {
    function getAddress() external view returns (address);
}

contract AuditCheck {
    /**
     * @dev Validates if a token has been audited by checking the ECDSA signature.
     * @param tokenAddress The address of the token to validate.
     * @return isValid True if the token is audited, otherwise false.
     */
    function validateToken(address tokenAddress) external view returns (bool) {
        try ISignedToken(tokenAddress).getSignature() returns (address auditorContract, bytes memory signature) {
            // Ensure the token has a valid auditor contract
            if (auditorContract == address(0) || signature.length == 0) {
                return false; // No valid signature or auditor contract
            }

            // Retrieve the auditor's address from the auditor contract
            IAuditor auditor = IAuditor(auditorContract);
            address auditorAddress = auditor.getAddress();

            // Retrieve and hash the deployed bytecode of the token
            bytes32 tokenHash = getDeployedBytecodeHash(tokenAddress);

            // Extract r, s, and v from the signature
            bytes32 r;
            bytes32 s;
            uint8 v;

            assembly {
                r := mload(add(signature, 32))
                s := mload(add(signature, 64))
                v := byte(0, mload(add(signature, 96)))
            }

            /* // alternative way with prefixed hash
            bytes32 prefixedHash = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", tokenHash)
            );*/
            // Perform ecrecover to retrieve the signer of the hash
            address recoveredAddress = ecrecover(tokenHash, v, r, s);

            // Check if the recovered address matches the auditor's address
            return recoveredAddress == auditorAddress;
        } catch {
            // If getSignature fails, consider the token invalid
            return false;
        }
    }

    /**
     * @dev Retrieves the hash of the deployed bytecode of a contract.
     * @param tokenAddress The address of the contract to hash.
     * @return The keccak256 hash of the deployed bytecode.
     */
    function getDeployedBytecodeHash(address tokenAddress) public view returns (bytes32) {
        bytes memory code;
        assembly {
            // Get the size of the code at tokenAddress
            let size := extcodesize(tokenAddress)
            // Allocate memory for the code
            code := mload(0x40)
            mstore(0x40, add(code, add(size, 0x20))) // Adjust free memory pointer
            mstore(code, size)                      // Store length of the code
            extcodecopy(tokenAddress, add(code, 0x20), 0, size) // Copy code to memory
        }
        // Hash the bytecode
        return keccak256(code);
    }
}
