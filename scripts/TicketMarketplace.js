const assert = require("assert");

let eventFactory;
let eventContract;
let marketplace;
beforeEach(async () => {
    eventFactory = await ethers.deployContract("EventFactory");
    await eventFactory.waitForDeployment();
    const eventTx = await eventFactory.deployEvent("New Event");
    const eventRcpt = await eventTx.wait();
    const eventAddress = eventRcpt.logs[0].address;
    const eventContractFactory = await ethers.getContractFactory("Event");
    eventContract = eventContractFactory.attach(
        eventAddress // The deployed contract address
    );
    
    marketplace = await ethers.deployContract("TicketMarketplace");
    await eventFactory.waitForDeployment();

    var txResponse = await eventContract.createTicketType("Ticket Type A", 100, 20);
    await txResponse.wait();
    txResponse = await eventContract.createTicketType("Ticket Type B", 10, 200);
    await txResponse.wait();

    txResponse = await eventContract.setApprovalForAll(marketplace.target, true);
    await txResponse.wait();
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
            // console.log(marketplace.target);
            assert(marketplace.target);
        });
    });
    describe("Functions", function () {
        it("Should create a listing", async function () {
            const [account] = await ethers.getSigners();
            var txResponse = await marketplace.listTicket(eventContract.target, 1, 20, 100);
            const rcpt = await txResponse.wait();

            const logEvent = rcpt.logs[rcpt.logs.length - 1];

            assert(account.address == logEvent.args[0]);
            assert(eventContract.target == logEvent.args[1]);
            
            const listedIds = await marketplace.getListingIDs(eventContract.target, account.address);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);

            const ticketPrice = await marketplace.getTicketPrice(eventContract.target, account.address, listedIds[0]);
            assert(ticketPrice == 20);
        });
        it("Should cancel a listing", async function () {
            const [account] = await ethers.getSigners();
            var txResponse = await marketplace.listTicket(eventContract.target, 1, 20, 100);
            const rcpt = await txResponse.wait();

            const logEvent = rcpt.logs[rcpt.logs.length - 1];

            assert(account.address == logEvent.args[0]);
            assert(eventContract.target == logEvent.args[1]);
            
            txResponse = await marketplace.cancelListing(
                eventContract.target,
                1,
                await marketplace.getTicketAmounts(eventContract.target, account.address, 1)
            );
            await txResponse.wait();

            const sellers = await marketplace.getListingGroupSellers(eventContract.target);
            assert(sellers.length == 1);
            assert(sellers[0] == 0);
        });
        it("Should create two listings under one event", async function () {
            const [account] = await ethers.getSigners();
            var txResponse = await marketplace.listTicket(eventContract.target, 1, 20, 100);
            var rcpt = await txResponse.wait();

            const logEvent = rcpt.logs[rcpt.logs.length - 1];

            assert(account.address == logEvent.args[0]);
            assert(eventContract.target == logEvent.args[1]);

            txResponse = await marketplace.listTicket(eventContract.target, 2, 200, 10);
            await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.target, account.address);
            assert(listedIds.length == 2);
            assert(listedIds[1] == 2);

            const ticketPrice = await marketplace.getTicketPrice(eventContract.target, account.address, listedIds[1]);
            assert(ticketPrice == 200);
        });
        it("Should list then cancel then list again", async function () {
            const [account] = await ethers.getSigners();
            var txResponse = await marketplace.listTicket(eventContract.target, 1, 20, 100);
            var rcpt = await txResponse.wait();

            const logEvent = rcpt.logs[rcpt.logs.length - 1];

            assert(account.address == logEvent.args[0]);
            assert(eventContract.target == logEvent.args[1]);

            txResponse = await marketplace.cancelListing(
                eventContract.target,
                1,
                await marketplace.getTicketAmounts(eventContract.target, account.address, 1)
            );
            await txResponse.wait();

            var sellers = await marketplace.getListingGroupSellers(eventContract.target);
            assert(sellers.length == 1);
            assert(sellers[0] == 0);

            var ticketPrice = await marketplace.getTicketPrice(eventContract.target, account.address, 1);
            assert(ticketPrice == 0);

            txResponse = await marketplace.listTicket(eventContract.target, 1, 22, 100);
            await txResponse.wait();

            var listedIds = await marketplace.getListingIDs(eventContract.target, account.address);
            listedIds = removeNullValues(listedIds);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);

            ticketPrice = await marketplace.getTicketPrice(eventContract.target, account.address, 1);
            assert(ticketPrice == 22);

            const totalAmount = await marketplace.getListingTotalAmount(eventContract.target, account.address);
            sellers = removeNullValues(await marketplace.getListingGroupSellers(eventContract.target));
            assert(totalAmount == 100);
            assert(sellers.length == 1);
            assert(sellers[0] == account.address);
        });
        it("Should buy a ticket", async function () {
            const [account1, account2] = await ethers.getSigners();
            
            // List the tickets
            var txResponse = await marketplace.listTicket(eventContract.target, 1, 20, 100);
            var rcpt = await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.target, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);
            
            // Account2 purchase a ticket
            const marketplace2 = await marketplace.connect(account2);
            
            txResponse = await marketplace2.buyItem(eventContract.target, 1, account1.address, 1, { value: "20"});
            rcpt = await txResponse.wait();

            const proceeds = await marketplace.getProceeds();
            assert(proceeds == 20);

            const account2balance = await eventContract.balanceOf(account2.address, 1);
            assert(account2balance == 1);

            const newAmount = await marketplace.getTicketAmounts(eventContract.target, account1.address, 1);
            assert(newAmount == 99);

            const newTotalAmount = await marketplace.getListingTotalAmount(eventContract.target, account1.address);
            assert(newTotalAmount == 99);
        });
        it("Should buy a ticket then list it", async function () {
            const [account1, account2] = await ethers.getSigners();
            
            // List the tickets
            var txResponse = await marketplace.listTicket(eventContract.target, 1, 20, 100);
            var rcpt = await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.target, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);
            
            // Account2 purchase a ticket
            const marketplace2 = await marketplace.connect(account2);

            txResponse = await marketplace2.buyItem(eventContract.target, 1, account1.address, 1, { value: "20"});
            rcpt = await txResponse.wait();

            //Account2 list ticket
            const eventContract2 = await eventContract.connect(account2);
            txResponse = await eventContract2.setApprovalForAll(marketplace.target, true);
            await txResponse.wait();

            txResponse = await marketplace2.listTicket(eventContract.target, 1, 22, 1);
            await txResponse.wait();
            const sellers = await marketplace.getListingGroupSellers(eventContract.target);
            assert(sellers.length == 2);
            assert(sellers[1] == account2.address);

            const listingPrice = await marketplace.getTicketPrice(eventContract.target, account2.address, 1);
            assert(listingPrice == 22);

            const totalTickets = await marketplace.getListingTotalAmount(eventContract.target, account2.address);
            assert(totalTickets == 1);
        });
        it("Should update listing", async function () {
            const [account] = await ethers.getSigners();
            var txResponse = await marketplace.listTicket(eventContract.target, 1, 20, 100);
            var rcpt = await txResponse.wait();

            txResponse = await marketplace.updateListing(eventContract.target, 1, 25);
            await txResponse.wait();

            const newPrice = await marketplace.getTicketPrice(eventContract.target, account.address, 1);
            assert(newPrice == 25);
        });
        it("Should withdraw proceeds", async function () {
            const [account1, account2] = await ethers.getSigners();
            
            // List the tickets
            var txResponse = await marketplace.listTicket(eventContract.target, 1, "1000000000000000000", 100);
            var rcpt = await txResponse.wait();

            const listedIds = await marketplace.getListingIDs(eventContract.target, account1.address);
            assert(listedIds.length == 1);
            assert(listedIds[0] == 1);
            
            // Account2 purchase a ticket
            const marketplace2 = await marketplace.connect(account2);

            txResponse = await marketplace2.buyItem(eventContract.target, 1, account1.address, 1, { value: "1000000000000000000"});
            rcpt = await txResponse.wait();

            const proceeds = await marketplace.getProceeds();
            assert(proceeds > 0);
            const account1BalanceOld = await ethers.provider.getBalance(account1.address);
            txResponse = await marketplace.withdrawProceeds();
            await txResponse.wait();

            const account1BalanceNew = await ethers.provider.getBalance(account1.address);
            // console.log("value:", ethers.formatEther("1000000000000000000"));
            // console.log("profit = ", ethers.formatEther(account1BalanceNew - account1BalanceOld));
            
            assert(account1BalanceNew > account1BalanceOld);
        });
    });
});

function removeNullValues(arr) {
    try {
        var newArr = [];
        var i = 0;
        while (i < arr.length) {
            if (arr[i] != 0) {
                newArr.push(arr[i]);
            }
            i += 1;
        }
        return newArr;
    } catch (err) {
        return -1;
    }
}