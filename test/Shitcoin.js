const { expect } = require('chai');
const hre = require("hardhat");

describe("Shitcoin", function () {
    let Shitcoin;
    let shitcoin;
    
    before(async function () {
        Shitcoin = await hre.ethers.getContractFactory("Shitcoin");
        shitcoin = await Shitcoin.deploy(1000n);
    });
    it("Shitcoin should be deployed and owner has all shitcoins", async function () {
        const [owner] = await hre.ethers.getSigners();  // Get the first signer as the owner

        // Check the balance of the owner
        const ownerBalance = await shitcoin.balanceOf(owner.address);
        expect(ownerBalance).to.equal(1000n);
    });
    it("Should transfer tokens between owner and user1", async function () {
        const [owner, user1] = await hre.ethers.getSigners();  // Get the first signer as the owner

        // Transfer 100 tokens from owner to user1
        await shitcoin.transfer(user1, 100n);

        // test if user1 received the tokens
        const user1Balance = await shitcoin.balanceOf(user1);
        expect(user1Balance).to.equal(100n);
    });
    it("User1 should not be able to transfer tokens to user2", async function () {
        const [owner, user1, user2] = await hre.ethers.getSigners();  // Get the first signer as the owner

        // Transfer 50 tokens from user1 to user2
        await shitcoin.connect(user1).transfer(user2, 50n);
        
        const user1Balance = await shitcoin.balanceOf(user1);
        const user2Balance = await shitcoin.balanceOf(user2);
        expect(user1Balance).to.equal(100n);
        expect(user2Balance).to.equal(0n);
    });
});
