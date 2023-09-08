import * as web3 from 'zksync-web3';
import * as hre from 'hardhat';
import * as ethers from "ethers";
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import assert from "assert";
import * as EventContractInfo from "../artifacts-zk/contracts/Event.sol/Event.json";

const RICH_WALLET_PK =
  '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';

const ACCOUNT2_PK = '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3';

const EventABI = EventContractInfo.abi;

// Deploy a contract with constructorArguments
async function deployContract(deployer: Deployer, contractName: string, constructorArguments: any[]): Promise<web3.Contract> {
    const artifact = await deployer.loadArtifact(contractName);
    const overrides = {
        gasLimit: "4294967295"
    }
    return await deployer.deploy(artifact, constructorArguments, overrides);
}
let eventFactoryContract: web3.Contract;
let eventContract: web3.Contract;
beforeEach(async () => {
    if (!process.env.TESTNET) {
        const provider = new web3.Provider('http://localhost:8011');
        const account1 = new web3.Wallet(RICH_WALLET_PK, provider);
        const deployer = new Deployer(hre, account1);
        
        eventFactoryContract = await deployContract(deployer, "EventFactory", []);
        const eventTx = await eventFactoryContract.deployEvent("New Event");
        const eventRcpt = await eventTx.wait();
        
        const eventAddress = web3.utils.getDeployedContracts(eventRcpt)[0].deployedAddress;
        eventContract = new web3.Contract(eventAddress, EventABI, account1);
    }
});

describe("Event", function () {
    describe("Deployment", function () {
        it("Should be deployed", async function () {
            const eventAddressInFactoryList = await eventFactoryContract.getEvents();
            const eventAddress = eventAddressInFactoryList[0];
            assert(eventContract.address);
            assert(eventAddress == eventContract.address);
        });
    });
    describe("Functions", function () {
        it("Should create a ticket type", async function () {
            const provider = new web3.Provider('http://localhost:8011');
            const account1 = new web3.Wallet(RICH_WALLET_PK, provider);

            const name = "Ticket type A";
            const amount = 2000;
            const value = 100;
            const txResponse = await eventContract.createTicketType(name, amount, value);
            await txResponse.wait();
            const ticketIDs = await eventContract.getTicketIDs();
            assert(ticketIDs.length == 1);
            assert(ticketIDs[0].toString() == "1");
            
            const ticketDetails = await eventContract.getTicketDetails(1);
            assert(ticketDetails[0] == name);
            assert(ticketDetails[1].toString() == value.toString());

            const balance = await eventContract.balanceOf(account1.address, 1);
            assert(balance.toString() == amount.toString());
        });
        it("Should not create a ticket type", async function () {
            try {
                const name = "";
                const amount = 2000;
                const value = 100;
                const txResponse = await eventContract.createTicketType(name, amount, value);
                await txResponse.wait();
                assert(false);
            } catch {
                assert(true);
            }
        });
        it("Should return a list of Ticket IDs", async function () {
            const txResponse = await eventContract.createTicketType("Type A", 100, 50);
            await txResponse.wait();
            await eventContract.createTicketType("Type B", 100, 60);
            await txResponse.wait();

            const checks = await eventContract.getTicketIDs();
            assert(checks[0] == 1);
            assert(checks[1] == 2);
            assert(checks.length == 2);
        });
        it("Should mint more tickets", async function () {
            const provider = new web3.Provider('http://localhost:8011');
            const account1 = new web3.Wallet(RICH_WALLET_PK, provider);
            const account2 = new web3.Wallet(ACCOUNT2_PK, provider);
            
            const txResponse = await eventContract.createTicketType("Type A", 100, 50);
            await txResponse.wait();
            const oldBalance = await eventContract.balanceOf(account1.address, 1);
            assert(oldBalance == 100);

            const txResponse2 = await eventContract.mintMore(1, 20);
            await txResponse2.wait();
            
            const newBalance = await eventContract.balanceOf(account1.address, 1);
            assert(newBalance == 120);
        });
        it("Should not mint more tickets", async function () {
            try {
                const txResponse = await eventContract.mintMore(1, 20);
                await txResponse.wait();
                assert(false);
            } catch {
                assert(true);
            }
        });
        it("Should assign a new value", async function () {
            var txResponse = await eventContract.createTicketType("Type A", 100, 50);
            await txResponse.wait();

            var checks = await eventContract.getTicketDetails(1);
            assert(checks[1] == 50);

            txResponse = await eventContract.assignValue(60, 1);
            await txResponse.wait();

            checks = await eventContract.getTicketDetails(1);
            assert(checks[1] == 60);
        });
    });
});

function wait() {
    console.log("waited");
}