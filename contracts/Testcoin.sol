// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "./interfaces/IERC20.sol";

contract Testcoin is IERC20 {
    address public owner;
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;
    uint public totalSupply;
    string public name = "Testcoin";
    string public symbol = "TEST";
    uint8 public decimals = 18;

    constructor(uint initialSupply) {
        totalSupply = initialSupply;
        balanceOf[msg.sender] = totalSupply;
        owner = msg.sender;
    }

    function approve(address spender, uint value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address sender, address recipient, uint amount) public returns (bool) {
        require(balanceOf[sender] >= amount, "Insufficient balance");
        require(allowance[sender][msg.sender] >= amount, "Allowance exceeded");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        allowance[sender][msg.sender] -= amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }
}