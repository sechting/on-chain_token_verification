// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SignedToken is ERC20, Ownable {
    struct AuditorSignature {
        address auditorContract; // Address of the auditor's smart contract
        bytes signature;         // ECDSA signature of the hash
    }

    // Variable to store the signature
    AuditorSignature private auditorSignature;

    // Event to emit when the token is signed
    event TokenSigned(address indexed auditorContract, bytes signature);

    constructor(string memory name, string memory symbol, uint256 initialSupply)
        ERC20(name, symbol)
        Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    /**
     * @dev Allows the owner of the token to add an auditor's signature.
     * @param auditorContract The address of the auditor's smart contract on-chain.
     * @param signature The ECDSA signature of the hash signed by the auditor.
     */
    function signToken(address auditorContract, bytes memory signature) external onlyOwner {
        // Store the signature
        auditorSignature = AuditorSignature(auditorContract, signature);

        // Emit the signing event
        emit TokenSigned(auditorContract, signature);
    }

    /**
     * @dev Returns the current signature of the token.
     * @return The address of the auditor's contract and the signature.
     */
    function getSignature() external view returns (address, bytes memory) {
        require(auditorSignature.auditorContract != address(0), "No signature available");
        return (auditorSignature.auditorContract, auditorSignature.signature);
    }
}
