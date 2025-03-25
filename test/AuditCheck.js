const { ethers } = require("hardhat");
const { ec } = require("elliptic");
const { expect } = require("chai");

describe("AuditCheck", function () {
    let auditor, signedToken, auditCheck;
    let owner, otherAccount;
    let publicKeyBytes, privateKey;

    before(async () => {
        [owner, otherAccount] = await ethers.getSigners();

        // Generate a new random wallet
        const wallet = ethers.Wallet.createRandom();
        privateKey = wallet.privateKey; // Extract the private key

        // Decompress the public key using elliptic
        const curve = new ec("secp256k1");
        const compressedKey = ethers.getBytes(wallet.publicKey);
        const key = curve.keyFromPublic(compressedKey);
        const uncompressedKey = key.getPublic(false); // Uncompressed key (65 bytes)

        // Strip the prefix (0x04) and convert to Uint8Array
        const publicKey64 = uncompressedKey.encode("array").slice(1);
        publicKeyBytes = Uint8Array.from(publicKey64); // Ensure it's a Uint8Array

        // Deploy the Auditor contract with the Uint8Array public key
        const Auditor = await ethers.getContractFactory("Auditor");
        auditor = await Auditor.deploy(publicKeyBytes); // Deploy only once
        console.log("Auditor.target:", auditor.target);

        // Deploy the SignedToken contract
        const SignedToken = await ethers.getContractFactory("SignedToken");
        signedToken = await SignedToken.deploy("Test Token", "TT", 1000); // Deploy only once
        console.log("SignedToken.target:", signedToken.target);

        // Deploy the AuditCheck contract
        const AuditCheck = await ethers.getContractFactory("AuditCheck");
        auditCheck = await AuditCheck.deploy(); // Deploy only once
        console.log("AuditCheck.target:", auditCheck.target);
    });

    it("should set up contracts correctly", async () => {
        // Verify the auditor's address
        const storedAuditorAddress = await auditor.getAddress();
        expect(storedAuditorAddress).to.be.a("string");
        expect(storedAuditorAddress).to.not.equal(ethers.ZeroAddress);

        // Verify deployment of contracts
        expect(signedToken.target).to.match(/^0x[0-9a-fA-F]{40}$/); // Proper Ethereum address
        expect(auditCheck.target).to.match(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should not verify a token that has not been signed", async () => {
        // Validate the token using AuditCheck
        const isValid = await auditCheck.validateToken(signedToken.target);

        const gasUsed = await auditCheck.validateToken.estimateGas(signedToken.target);
        console.log("should not verify a token that has not been signed");
        console.log("Gas used for validateToken:", gasUsed.toString());

        // Expect validation to fail (return false)
        expect(isValid).to.be.false;
    });
  
    it("should verify the token after signing", async () => {
        // Step 1: Fetch the deployed bytecode from the blockchain
        const deployedBytecode = await ethers.provider.getCode(signedToken.target);

        // Step 2: Compute the hash of the deployed bytecode
        const tokenHash = ethers.keccak256(deployedBytecode);

        // Step 3: Sign the hash using the auditor's private key
        const auditorWallet = new ethers.Wallet(privateKey);
        //const signature = await auditorWallet.signMessage(ethers.getBytes(tokenHash)); // alternative with Ethereum prefix
        // signing the hash without the Ethereum prefix
        const signatureObj = await auditorWallet.signingKey.sign(ethers.getBytes(tokenHash));
        const signature = ethers.concat([signatureObj.r, signatureObj.s, ethers.toBeHex(signatureObj.v)]);

        // Step 4: Sign the token using the SignedToken contract
        await signedToken.connect(owner).signToken(auditor.target, signature);

        // Step 5: Validate the token using the AuditCheck contract
        const isValid = await auditCheck.validateToken(signedToken.target);

        // Step 6: estimate gas consumption
        const gasUsed = await auditCheck.validateToken.estimateGas(signedToken.target);
        console.log("should verify the token after signing");
        console.log("Gas used for validateToken:", gasUsed.toString());

        // Expect validation to succeed (return true)
        expect(isValid).to.be.true;
    });
  
    it("should not verify a token signed by an imposter", async () => {
        // Step 1: Fetch the deployed bytecode from the blockchain
        const deployedBytecode = await ethers.provider.getCode(signedToken.target);

        // Step 2: Compute the hash of the deployed bytecode
        const tokenHash = ethers.keccak256(deployedBytecode);

        // Step 3: Impersonator's private key
        const imposterPrivateKey = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // Example key
        const imposterWallet = new ethers.Wallet(imposterPrivateKey);

        // Step 4: Impersonator signs the tokenHash
        const signatureObj = await imposterWallet.signingKey.sign(ethers.getBytes(tokenHash));
        const imposterSignature = ethers.concat([signatureObj.r, signatureObj.s, ethers.toBeHex(signatureObj.v)]);

        // Step 5: Sign the token using the SignedToken contract (with the imposter's signature)
        await signedToken.connect(owner).signToken(auditor.target, imposterSignature);

        // Step 6: Validate the token using the AuditCheck contract
        const isValid = await auditCheck.validateToken(signedToken.target);

        // Step 7: Estimate gas consumption
        const gasUsed = await auditCheck.validateToken.estimateGas(signedToken.target);
        console.log("should not verify the token signed by an imposter");
        console.log("Gas used for validateToken:", gasUsed.toString());

        // Expect validation to fail (return false)
        expect(isValid).to.be.false;
    });

    it("should not verify a token with an invalid auditor contract", async () => {
        // Step 1: Fetch the deployed bytecode from the blockchain
        const deployedBytecode = await ethers.provider.getCode(signedToken.target);

        // Step 2: Compute the hash of the deployed bytecode
        const tokenHash = ethers.keccak256(deployedBytecode);

        // Step 3: Sign the hash using the auditor's private key
        const auditorWallet = new ethers.Wallet(privateKey);
        //const signature = await auditorWallet.signMessage(ethers.getBytes(tokenHash)); // alternative with Ethereum prefix
        // signing the hash without the Ethereum prefix
        const signatureObj = await auditorWallet.signingKey.sign(ethers.getBytes(tokenHash));
        const signature = ethers.concat([signatureObj.r, signatureObj.s, ethers.toBeHex(signatureObj.v)]);
    
        // Step 4: Sign the token with an invalid auditor contract (e.g., address(0))
        const invalidAuditorContract = ethers.ZeroAddress;
        await signedToken.connect(owner).signToken(invalidAuditorContract, signature);
    
        // Step 5: Validate the token using the AuditCheck contract
        const isValid = await auditCheck.validateToken(signedToken.target);
    
        // Step 6: Estimate gas consumption
        const gasUsed = await auditCheck.validateToken.estimateGas(signedToken.target);
        console.log("should not verify the token with an invalid auditor contract");
        console.log("Gas used for validateToken:", gasUsed.toString());

        // Expect validation to fail
        expect(isValid).to.be.false;
    });
    
});
