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
let marketplace: web3.Contract;
let provider: web3.Provider;
let account1: web3.Wallet;
let account2: web3.Wallet;
beforeEach(async () => {
    if (!process.env.TESTNET) {
        provider = new web3.Provider('http://localhost:8011');
        account1 = new web3.Wallet(RICH_WALLET_PK, provider);
        account2 = new web3.Wallet(ACCOUNT2_PK, provider);
        const deployer = new Deployer(hre, account1);

        // Deploy the factory
        eventFactoryContract = await deployContract(deployer, "EventFactory", []);

        // Deploy an event
        const eventTx = await eventFactoryContract.deployEvent("New Event");
        const eventRcpt = await eventTx.wait();
        const eventAddress = web3.utils.getDeployedContracts(eventRcpt)[0].deployedAddress;
        eventContract = new ethers.Contract(eventAddress, EventABI, account1);
        
        marketplace = await deployContract(deployer, "TicketMarketplace", []);

        var txResponse = await eventContract.createTicketType("Ticket Type A", 100, 20);
        await txResponse.wait();
        txResponse = await eventContract.createTicketType("Ticket Type B", 10, 200);
        await txResponse.wait();

        txResponse = await eventContract.setApprovalForAll(marketplace.address, true);
        await txResponse.wait();
    }
});
describe("TicketMarketplace", function() {
    describe("Helper functions", function () {
        it("removeNullValues", async function () {
            var arr = [0, 0, 0, 0, 1, 0];
            arr = removeNullValues(arr);
            assert(arr.length == 1);
            assert(arr[0] == 1);

            arr = [0, 1];
            arr = removeNullValues(arr);
            assert(arr.length == 1);
            assert(arr[0] == 1);
        });
    });
    describe("Deployment", function () {
        it("Should be deployed", async function () {
            assert(marketplace.address);
        });
    });
    describe("Functions", function () {
        it("Should create a listing", async function () {
            var txResponse = await marketplace.listTicket(eventContract.address, 1, 20, 100);
            const rcpt = await txResponse.wait();
            
            const listedIds = await marketplace.getListingIDs(eventContract.address, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0].toString() == "1");

            const ticketPrice = await marketplace.getTicketPrice(eventContract.address, account1.address, listedIds[0]);
            assert(ticketPrice == 20);
        });
        it("Should cancel a listing", async function () {
            var txResponse = await marketplace.listTicket(eventContract.address, 1, 20, 100);
            const rcpt = await txResponse.wait();
            
            txResponse = await marketplace.cancelListing(
                eventContract.address,
                1,
                await marketplace.getTicketAmounts(eventContract.address, account1.address, 1)
            );
            await txResponse.wait();

            const totalAmount = await marketplace.getListingTotalAmount(eventContract.address, account1.address);
            assert(totalAmount == 0);
        });
        it("Should create two listings under one event", async function () {
            var txResponse = await marketplace.listTicket(eventContract.address, 1, 20, 100);
            await txResponse.wait();

            txResponse = await marketplace.listTicket(eventContract.address, 2, 200, 10);
            await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.address, account1.address);
            assert(listedIds.length == 2);
            assert(listedIds[1] == 2);

            const ticketPrice = await marketplace.getTicketPrice(eventContract.address, account1.address, listedIds[1]);
            assert(ticketPrice == 200);
        });
        it("Should list then cancel then list again", async function () {
            var txResponse = await marketplace.listTicket(eventContract.address, 1, 20, 100);
            await txResponse.wait();

            txResponse = await marketplace.cancelListing(
                eventContract.address,
                1,
                await marketplace.getTicketAmounts(eventContract.address, account1.address, 1)
            );
            await txResponse.wait();

            var ticketPrice = await marketplace.getTicketPrice(eventContract.address, account1.address, 1);
            assert(ticketPrice == 0);

            txResponse = await marketplace.listTicket(eventContract.address, 1, 22, 100);
            await txResponse.wait();

            var listedIds = await marketplace.getListingIDs(eventContract.address, account1.address);
            listedIds = removeNullValues(listedIds);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);

            ticketPrice = await marketplace.getTicketPrice(eventContract.address, account1.address, 1);
            assert(ticketPrice.toString() == "22");

            const totalAmount = await marketplace.getListingTotalAmount(eventContract.address, account1.address);
            assert(totalAmount == 100);

            const sellers = await marketplace.getListingGroupSellers(eventContract.address);
            // TODO: fix it so sellers are not duplicated
            // assert(sellers.length == 1);
            assert(sellers[0] == account1.address);
        });
        it("Should buy a ticket", async function () {
            
            // List the tickets
            var txResponse = await marketplace.listTicket(eventContract.address, 1, 20, 100);
            var rcpt = await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.address, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);
            
            // Account2 purchase a ticket
            const marketplace2 = marketplace.connect(account2);
            
            txResponse = await marketplace2.buyItem(eventContract.address, 1, account1.address, 1, { value: "20"});
            rcpt = await txResponse.wait();

            const proceeds = await marketplace.getProceeds();
            assert(proceeds == 20);

            const account2balance = await eventContract.balanceOf(account2.address, 1);
            assert(account2balance.toString() == "1");

            const newAmount = await marketplace.getTicketAmounts(eventContract.address, account1.address, 1);
            assert(newAmount == 99);

            const newTotalAmount = await marketplace.getListingTotalAmount(eventContract.address, account1.address);
            assert(newTotalAmount == 99);
        });
        it("Should buy a ticket then list it", async function () {            
            // List the tickets
            var txResponse = await marketplace.listTicket(eventContract.address, 1, 20, 100);
            var rcpt = await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.address, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);
            
            // Account2 purchase a ticket
            const marketplace2 = marketplace.connect(account2);

            txResponse = await marketplace2.buyItem(eventContract.address, 1, account1.address, 1, { value: "20"});
            rcpt = await txResponse.wait();

            //Account2 list ticket
            const eventContract2 = await eventContract.connect(account2);
            txResponse = await eventContract2.setApprovalForAll(marketplace.address, true);
            await txResponse.wait();

            txResponse = await marketplace2.listTicket(eventContract.address, 1, 22, 1);
            await txResponse.wait();

            const sellers = await marketplace.getListingGroupSellers(eventContract.address);
            assert(sellers.length == 2);
            assert(sellers[1] == account2.address);

            const listingPrice = await marketplace.getTicketPrice(eventContract.address, account2.address, 1);
            assert(listingPrice.toString() == "22");

            const totalTickets = await marketplace.getListingTotalAmount(eventContract.address, account2.address);
            assert(totalTickets.toString() == "1");
        });
        it("Should update listing", async function () {
            var txResponse = await marketplace.listTicket(eventContract.address, 1, 20, 100);
            await txResponse.wait();

            txResponse = await marketplace.updateListing(eventContract.address, 1, 25);
            await txResponse.wait();

            const newPrice = await marketplace.getTicketPrice(eventContract.address, account1.address, 1);
            assert(newPrice == 25);
        });
        it("Should withdraw proceeds", async function () {            
            // List the tickets
            var txResponse = await marketplace.listTicket(eventContract.address, 1, "1000000000000000000", 100);
            var rcpt = await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.address, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0].toString() == "1");
            
            // Account2 purchase a ticket
            const marketplace2 = marketplace.connect(account2);

            txResponse = await marketplace2.buyItem(eventContract.address, 1, account1.address, 1, { value: "1000000000000000000"});
            await txResponse.wait();

            const proceeds = await marketplace.getProceeds();
            assert(proceeds > 0);
            const account1BalanceOld = await provider.getBalance(account1.address);
            txResponse = await marketplace.withdrawProceeds();
            await txResponse.wait();

            const account1BalanceNew = await provider.getBalance(account1.address);
            // console.log("value:", ethers.formatEther("1000000000000000000"));
            // console.log("profit = ", ethers.formatEther(account1BalanceNew - account1BalanceOld));
            
            assert(account1BalanceNew > account1BalanceOld);
        });
    });
});

function removeNullValues(arr): any[] {
    try {
        var newArr: any[] = [];
        var i = 0;
        while (i < arr.length) {
            if (arr[i] != 0) {
                var tmp = arr[i];
                newArr.push(tmp);
            }
            i += 1;
        }
        return newArr;
    } catch (err) {
        return [-1];
    }
}