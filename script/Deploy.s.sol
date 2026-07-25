// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Covenant} from "../src/Covenant.sol";
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        vm.startBroadcast(pk);
        Covenant c = new Covenant(IERC20(usdc));
        vm.stopBroadcast();
        console2.log("Covenant deployed at:", address(c));
    }
}
