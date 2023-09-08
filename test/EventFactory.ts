import { Wallet, Provider, Contract, utils } from 'zksync-web3';
import * as hre from 'hardhat';
import * as ethers from "ethers";
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import assert from "assert";
import * as EventContractInfo from "../artifacts-zk/contracts/Event.sol/Event.json";

const RICH_WALLET_PK =
  '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';
const EVENT_ABI = EventContractInfo.abi;
const EVENT_BYTECODE = EventContractInfo.bytecode;

// Deploy a contract with constructorArguments
async function deployContract(deployer: Deployer, contractName: string, constructorArguments: any[]): Promise<Contract> {
    const artifact = await deployer.loadArtifact(contractName);
    const overrides = {
        gasLimit: "4294967295"
    }
    return await deployer.deploy(artifact, constructorArguments, overrides);
}


let eventFactoryContract: Contract;
beforeEach(async () => {
    if (!process.env.TESTNET) {
        try {
            const provider =  new Provider('http://localhost:8011');
            const account1 = new Wallet(RICH_WALLET_PK, provider);
            const deployer = new Deployer(hre, account1);

            eventFactoryContract = await deployContract(deployer, "EventFactory", []);
        } catch (err) {
            if (err.code == "NETWORK_ERROR") {
                console.log("No test node found.");
            }
        }
    }
    
});

describe("EventFactory", function () {
    describe("Deployment", function () {
        it("Should be deployed", async function () {
            assert(eventFactoryContract.address);
        });
        it("Should have an empty events array", async function () {
            const events = await eventFactoryContract.getEvents();
            assert(events.length == 0);
            });
    });
    describe("New Events", function () {
        it("Should deploy an event", async function () {
            const eventTx = await eventFactoryContract.deployEvent("Event 1");
            const eventRcpt = await eventTx.wait();
            const events = await eventFactoryContract.getEvents();
            const eventAddress = utils.getDeployedContracts(eventRcpt)[0].deployedAddress;
            assert(eventAddress == events[0]);
        });
        it("Should have an event name", async function () {
            const provider = new Provider('http://localhost:8011');
            const account1 = new Wallet(RICH_WALLET_PK, provider);
            const eventTx = await eventFactoryContract.deployEvent("Event 1");
            const eventRcpt = await eventTx.wait();
            const eventAddress = utils.getDeployedContracts(eventRcpt)[0].deployedAddress;
            const factoryEventAddresses = await eventFactoryContract.getEvents();
            assert(eventAddress == await factoryEventAddresses);

            const eventContract = new ethers.Contract(eventAddress, EVENT_ABI, account1);
            const name = await eventContract.getEventName();
            assert(name == 'Event 1');
                        
        });
        it("Should not have tickets", async function () {
            const provider = new Provider("http://localhost:8011");
            const account1 = new Wallet(RICH_WALLET_PK, provider);
            const eventTx = await eventFactoryContract.deployEvent("Event 1");
            const eventRcpt = await eventTx.wait();
            const eventAddress = utils.getDeployedContracts(eventRcpt)[0].deployedAddress;
            const eventContract = new ethers.Contract(eventAddress, EVENT_ABI, account1);

            const ticketIDs = await eventContract.getTicketIDs();
            assert(ticketIDs.length == 0);
        });
    });
});