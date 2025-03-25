// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract TokenValidator {
    address public owner;
    uint256 public validationThreshold;  // The value to be used in validation
    //uint[] internal internalstack;  // Internal stack to be used in validation

    // Constructor to set the initial owner and validation threshold
    constructor(uint256 _initialThreshold) {
        owner = msg.sender;
        validationThreshold = _initialThreshold;
    }

    // Function to set a new validation threshold (only by the owner)
    function setValidationThreshold(uint256 _newThreshold) external onlyOwner {
        validationThreshold = _newThreshold;
    }

    // Function to validate the token against the validation threshold
    function validateToken(address token) external view returns (bool) {
        uint256 transferStart;
        uint256 size;
        uint256 compCount = 0;

        assembly {
            size := extcodesize(token)
        }
    
        //load the bytecode from the token 
        bytes memory code = new bytes(size);
        assembly {
            extcodecopy(token, add(code, 0x20), 0, size)
        }
        
        // iterate over the first bytes of initialization code to find transfer function
        for (uint i = 0; i < code.length; i++) {
            bytes1 byteVal = code[i];  // Access each byte
            if (uint8(byteVal) == 0x60) {  // PUSH1 opcode
            // skip next byte
                i++;
            } else if (uint8(byteVal) == 0x61) {  // PUSH2 opcode
                //skip next 2 bytes
                i = i + 2;
            } else if (uint8(byteVal) == 0x62) {  // PUSH3 opcode
                //skip next 3 bytes
                i = i + 3;
            } else if (uint8(byteVal) == 0x63) {  // PUSH4 opcode
                //check next 4 bytes for transfer function byte 5 for EQ opcode and byte 6 for push2 opcode
                if (code[i + 1] == 0xa9 && code[i + 2] == 0x05 && code[i + 3] == 0x9c && code[i + 4] == 0xbb && code[i + 5] == 0x14 && code[i + 6] == 0x61) {
                    // next two bytes are the transfer start position
                    transferStart = uint8(code[i + 7]) * 256 + uint8(code[i + 8]);
                    break;
                }

            }
        }
        if ( transferStart > 0 ) {
            compCount = validateTransferFunction(code, transferStart);
        }
        return validationThreshold >= compCount;
    }

    // internal function to validate transfer function
    function validateTransferFunction(bytes memory code, uint256 start) internal pure returns (uint256) {
        uint256 i = start;
        uint256 jumpReturn = 0;
        uint32 comparisonCount = 0;
        // initialize stack in memory with 100 elements:
        uint[] memory internalstack = new uint[](100);
        uint32 stackPointer = 0;
        while (true) {
            uint8 opcode = uint8(code[i]);
            if (opcode == 0x56 || opcode == 0x57) { //JUMP or JUMPI opcode
                // calculate the jump address
                //uint newJumpAddress = uint256(internalstack[internalstack.length - 1]);
                uint newJumpAddress = uint256(internalstack[stackPointer - 1]);
                //internalstack.pop();
                stackPointer--;
                // on a conditional jump we might follow the REVERT path, so we need to save the return address
                if (opcode - 0x56 > 0) {
                    jumpReturn = i + 1;
                    //internalstack.pop(); // remove the condition from stack
                    stackPointer--;
                }
                i = newJumpAddress - 1; // i++ incoming but newJumpAddress is exact!
            } else if (opcode >= 0x10 && opcode <= 0x15) { // SLT SGT EQ etc.
                comparisonCount++;
                //internalstack.pop();
                stackPointer--;
                if (opcode < 0x15) // ISZERO has only one operand the rest has two
                    //internalstack.pop();
                    stackPointer--;
                //internalstack.push(0xBEEF); // 48879 in decimal for debugging
                internalstack[stackPointer++] = 0xBEEF;
            } else if (opcode >= 0x60 && opcode <= 0x7F) { // PUSH opcodes from push1 to push32
                uint8 pushlength = opcode - 0x5f;
                uint256 stackItem = 0;
                for (uint j = 1; j <= pushlength; j++) {
                    stackItem = ( stackItem * 256 ) + uint8(code[i + j]);
                }
                //internalstack.push(stackItem);
                internalstack[stackPointer++] = stackItem;
                i = i + pushlength;
            } else if (opcode >= 0x80 && opcode <= 0x89) { // DUP opcodes
                uint8 position = opcode - 0x7f;
                //internalstack.push(internalstack[internalstack.length - position]);
                internalstack[stackPointer] = internalstack[stackPointer - position];
                stackPointer++;
            } else if (opcode >= 0x90 && opcode <= 0x97) { // SWAP opcodes (1 - 8)
                uint8 position = opcode - 0x8e; // 0x90 - 0x8e = 2 (SWAP1 swaps the secondtopmost with the topmost item)
                //uint temp = internalstack[internalstack.length - position];
                //internalstack[internalstack.length - position] = internalstack[internalstack.length - 1];
                //internalstack[internalstack.length - 1] = temp;
                uint temp = internalstack[stackPointer - position];
                internalstack[stackPointer - position] = internalstack[stackPointer - 1];
                internalstack[stackPointer - 1] = temp;
            } else if (opcode >= 0x01 && opcode <= 0xB ) { // arithmetic functions
                //nternalstack.pop();
                //internalstack.pop();
                stackPointer -= 2;
                if (opcode == 0x8 || opcode == 0x9) {
                    //internalstack.pop(); // third operand ADDMOD and MULMOD
                    stackPointer--;
                }
                // we probably don't need to do anything but returning a dummy value
                //internalstack.push(0xDEADBEEF); // 3735928559 in decimal for debugging
                internalstack[stackPointer++] = 0xDEADBEEF;
            } else if (opcode >= 0x16 && opcode <= 0x1D && opcode != 0x19) { // LOGICAL OPERATIONS opcode
            // 0x19 is negating the top entry this will not be a jump address, so we can ignore it
                //internalstack.pop();
                stackPointer--;
                //internalstack.pop();
                //internalstack.push(0xDEAF); // 57007 in decimal for debugging
                internalstack[stackPointer - 1] = 0xDEAF;
            } else if (opcode == 0x36) { // CALLDATASIZE
                //internalstack.push(56); // expected size of calldata
                internalstack[stackPointer++] = 64;
            } else if (opcode == 0x35) { // CALLDATALOAD
                //internalstack.pop();
                //internalstack.push(0xDEAD); // 57005 for debugging
                internalstack[stackPointer - 1] = 0xDEAD;
            } else if (opcode == 0x50) { // POP opcode
                //internalstack.pop();
                stackPointer--;
            } else if (opcode >= 0x32 && opcode <= 0x34) { // ORIGIN and CALLER add an address to the stack
                //internalstack.push(0x1234); // 4660 in decimal for debugging
                internalstack[stackPointer++] = 0x1234;
            } else if (opcode > 0x51 && opcode <= 0x55 && opcode != 0x54) { // MEMORY opcodes
                // MEMLOAD 0x51 doesn't need to be handled it takes one parameter and has one output
                //internalstack.pop();
                //internalstack.pop();
                stackPointer -= 2;
            } else if (opcode == 0x20) { // KECCAK opcode
                //internalstack.pop(); // computing the keccak takes two arguments
                stackPointer--;
            } else if (opcode >= 0xA0 && opcode <= 0xA4) { // LOG opcodes
                uint8 logCount = opcode - 0xA0;
                //internalstack.pop();
                //internalstack.pop();
                stackPointer -= 2;
                for (logCount; logCount > 0; logCount--) {
                    //internalstack.pop();
                    stackPointer--;
                }
            } else if (opcode == 0xF3) { // RETURN opcode
                break;
            } else if (opcode == 0xFD) { // REVERT opcode
                // we followed the wrong path, return to the last jump location
                i = jumpReturn;
                break;
            } else {
                // do nothing these opcodes don't manipulate the stack or are not relevant
            }
            i++;
        }
        return comparisonCount;
    }

   // validate the hash of the token bytecode
   function getCodeHash(address target) external view returns (bytes32) {
        bytes32 codeHash;
        assembly {
            codeHash := extcodehash(target)
        }
        return codeHash;
    }

    function getCodeHashNoMeta(address target) external view returns (bytes32) {
        uint256 size;
        assembly {
            size := extcodesize(target)
        }

        // Load the contract's bytecode
        bytes memory bytecode = new bytes(size);
        assembly {
            extcodecopy(target, add(bytecode, 0x20), 0, size)
        }

        // Get the metadata length from the last 2 bytes of the bytecode
        uint16 metaLength = uint8(bytecode[bytecode.length - 2] << 8) + uint8(bytecode[bytecode.length - 1]);

        // Verify that metadata length makes sense (should be smaller than code size)
        if (metaLength < size && metaLength > 0) {
            // Read the possible metadata section start (located size - metaLength - 2 bytes)
            uint8 cborStart = uint8(bytecode[bytecode.length - metaLength - 2]);

            // Check for CBOR's `0xa1` or `0xa2` prefix indicating IPFS or Swarm metadata
            if (cborStart == 0xa1 || cborStart == 0xa2) {
                // Resize the bytecode to exclude the metadata and the last 2 bytes
                assembly {
                    mstore(bytecode, sub(mload(bytecode), add(metaLength, 2)))
                }
            }
        }

        // Return the Keccak256 hash of the modified bytecode
        return keccak256(bytecode);
    }

    

    // Modifier to restrict access to owner-only functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }
}
