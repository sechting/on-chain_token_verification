const { expect } = require('chai');
const hre = require("hardhat");

describe("TokenValidator", function () {
    let Testcoin;
    let testcoin;
    let Shitcoin;
    let shitcoin;
    let OZTokenA;
    let ozTokenA;
    let OZTokenB;
    let ozTokenB;
    let TokenValidator;
    let tokenValidator;

    before(async function () {
        Testcoin = await hre.ethers.getContractFactory("Testcoin");
        testcoin = await Testcoin.deploy(1000n);

        Shitcoin = await hre.ethers.getContractFactory("Shitcoin");
        shitcoin = await Shitcoin.deploy(1000n);

        OZTokenA = await hre.ethers.getContractFactory("ozTokenA");
        ozTokenA = await OZTokenA.deploy("TokenA", "TOKA", 1000n);

        OZTokenB = await hre.ethers.getContractFactory("ozTokenB");
        ozTokenB = await OZTokenB.deploy("TokenB", "TOKB", 1000n);

        TokenValidator = await hre.ethers.getContractFactory("TokenValidator");
        tokenValidator = await TokenValidator.deploy(11);
        await tokenValidator.waitForDeployment();

        // check deployment cost
        const tx = await tokenValidator.deploymentTransaction();
        const receipt = await tx.wait();
        console.log('TokenValidator deployed gasUsed:', receipt.gasUsed.toString());
        
        // Retrieve and calculate the deployed bytecode size
        const bytecode = await hre.ethers.provider.getCode(tokenValidator.target);
        const bytecodeSize = (bytecode.length - 2) / 2; // Subtract 2 for the '0x' prefix and divide by 2 for byte length
        console.log("Bytecode size (in bytes):", bytecodeSize);
    });

    it('Should validate testCoin', async function () {
        const res = await tokenValidator.validateToken(testcoin);
        const gasUsed = await tokenValidator.validateToken.estimateGas(testcoin);

        console.log('gasUsed:', gasUsed.toString());
        expect(res).to.equal(true);
    });

    it('Should not validate shitCoin', async function () {
        const res = await tokenValidator.validateToken(shitcoin);
        const gasUsed = await tokenValidator.validateToken.estimateGas(shitcoin);

        console.log('gasUsed:', gasUsed.toString());
        console.log('res:', res);
        expect(res).to.equal(false);
    });

    it('Should validate OZTokenA', async function () {
        const res = await tokenValidator.validateToken(ozTokenA);
        const gasUsed = await tokenValidator.validateToken.estimateGas(ozTokenA);

        console.log('gasUsed:', gasUsed.toString());
        console.log('res:', res);
        expect(res).to.equal(true);
    });

    
    it('Should be able to validate a token to a known hash', async function () {
        const result1 = await tokenValidator.getCodeHash(ozTokenA);
        const result2 = await tokenValidator.getCodeHash(ozTokenB); 

        const gasUsed = await tokenValidator.getCodeHash.estimateGas(ozTokenA);
        console.log('extcodehash gasUsed:', gasUsed.toString());
        expect(result1).to.be.equal(result2);
    });

    it('Should also be able to validate a token to a known hash dismissing the metadata', async function () {
        const result1 = await tokenValidator.getCodeHashNoMeta(ozTokenA);
        const result2 = await tokenValidator.getCodeHashNoMeta(ozTokenB);

        const gasUsed = await tokenValidator.getCodeHashNoMeta.estimateGas(ozTokenA);
        console.log('metadata extcodehash gasUsed:', gasUsed.toString());
        expect(result1).to.be.equal(result2);
    });

});