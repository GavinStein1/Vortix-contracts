import assert from "assert";
import * as EventContractInfo from "../artifacts-zk/contracts/Event.sol/Event.json";
import * as FactoryContractInfo from "../artifacts-zk/contracts/EventFactory.sol/EventFactory.json";
import * as MarketplaceContractInfo from "../artifacts-zk/contracts/TicketMarketplace.sol/TicketMarketplace.json";
import { Wallet, Provider, Contract, utils } from 'zksync-web3';
import * as hre from 'hardhat';
import * as ethers from "ethers";
import { BigNumber } from "ethers";
import dotenv from "dotenv";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

dotenv.config();

const PRIVATE_KEY: string = process.env.WALLET_PRIVATE_KEY!;
const FACTORY_ADDRESS: string = process.env.FACTORY_ADDRESS!;
const MARKETPLACE_ADDRESS: string = process.env.MARKETPLACE_ADDRESS!;
const FACTORY_ABI = FactoryContractInfo.abi;
const EVENT_ABI = EventContractInfo.abi;
const MARKETPLACE_ABI = MarketplaceContractInfo.abi;

async function deployMarketplace(deployer: Deployer): Promise<Contract> {
    const artifact = await deployer.loadArtifact("TicketMarketplace");
    return await deployer.deploy(artifact, []);
}

let provider: Provider;
let account1: Wallet;
// let account2: Wallet;
let eventFactoryContract: Contract;
let marketplaceContract: Contract;

beforeEach(async function () {
    if (process.env.TESTNET) {
        provider = new Provider("https://zksync2-testnet.zksync.dev");
        account1 = new Wallet(PRIVATE_KEY, provider);
        // const deployer = new Deployer(hre, account1);
        // const marketplace = await deployMarketplace(deployer);
        // console.log("New marketplace address: ", marketplace.address);
        // account2 = new Wallet();
        eventFactoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, account1);
        marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, account1);

        console.log("Event factory: ", eventFactoryContract.address);
        console.log("Marketplace: ", marketplaceContract.address);
    }
});

describe("Testnet", function () {
    describe("deployment", function () {
        it("Contracts should be deployed", async function () {
            assert(eventFactoryContract.address);
            assert(marketplaceContract.address);
        });
    });
    describe("EventFactory & Marketplace", function () {
        it("Should create an event and list it on marketplace", async function () {
            const balanceBefore = await provider.getBalance(account1.address);
            const name = "Testnet event (testing)";
            const eventsBefore = await eventFactoryContract.getEvents();
            var eventTx = await eventFactoryContract.deployEvent(name);
            await eventTx.wait();
            const eventsAfter = await eventFactoryContract.getEvents();
            console.log("event deployed to: " + eventsAfter[eventsAfter.length - 1]);
            assert(eventsAfter.length - eventsBefore.length == 1);
            const eventContract = new ethers.Contract(eventsAfter[eventsAfter.length - 1], EVENT_ABI, account1);
            const nameFromContract = await eventContract.getEventName();
            assert(name == nameFromContract);
            
            // create a ticket type - auto transferred to event owner
            console.log("Creating ticket type.");
            var txResponse = await eventContract.createTicketType("Ticket Type A", 100, 20);
            await txResponse.wait();
            console.log("Set approval");
            txResponse = await eventContract.setApprovalForAll(marketplaceContract.address, true);
            await txResponse.wait();
            console.log("Listing a ticket");
            // list ticket type
            var txResponse = await marketplaceContract.listTicket(eventContract.address, 1, 20, 100);
            await txResponse.wait();

            

            // check
            const listedIds = await marketplaceContract.getListingIDs(eventContract.address, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0].toString() == "1");

            const balanceAfter = await provider.getBalance(account1.address);
            const cost = balanceBefore.sub(balanceAfter);

            console.log("Cost of test: " + ethers.utils.formatEther(cost.toString()));
        });
    });
});