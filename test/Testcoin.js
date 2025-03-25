const { expect } = require('chai');
const hre = require("hardhat");

describe("Testcoin", function () {
    let Testcoin;
    let testcoin;
    
    before(async function () {
        Testcoin = await hre.ethers.getContractFactory("Testcoin");
        testcoin = await Testcoin.deploy(1000n);
    });
    it("Testcoin should be deployed and owner has all testcoins", async function () {
        const [owner] = await hre.ethers.getSigners();  // Get the first signer as the owner

        // Check the balance of the owner
        const ownerBalance = await testcoin.balanceOf(owner.address);
        expect(ownerBalance).to.equal(1000n);
    });
    it("Should transfer tokens between owner and user1", async function () {
        const [owner, user1] = await hre.ethers.getSigners();  // Get the first signer as the owner

        // Transfer 100 tokens from owner to user1
        await testcoin.transfer(user1, 100n);

        // test if user1 received the tokens
        const user1Balance = await testcoin.balanceOf(user1);
        expect(user1Balance).to.equal(100n);
    });
    it("User1 should be able to transfer tokens to user2", async function () {
        const [owner, user1, user2] = await hre.ethers.getSigners();  // Get the first signer as the owner

        // Transfer 50 tokens from user1 to user2
        await testcoin.connect(user1).transfer(user2, 50n);
        
        const user1Balance = await testcoin.balanceOf(user1);
        const user2Balance = await testcoin.balanceOf(user2);
        expect(user1Balance).to.equal(50n);
        expect(user2Balance).to.equal(50n);
    });
});
