//SPDX-License-Identifier: UNLICENSED
// contracts/Event.sol

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/* 
@author Gavin Stein
*/

error NotOwner();
error AlreadyListed(address eventAddress, uint256 ticketId);
error PriceMustBeAboveZero();
error NotListed(address eventAddress, uint256 ticketId);
error PriceNotMet(address eventAddress, uint256 ticketId, uint256 total);
error NotEnoughStock(address eventAddress, uint256 ticketId, uint256 amount);
error NoEventGroup(address eventAddress);
error NotApproved(address seller, address eventAddress);
error NoProceeds(address seller);

contract TicketMarketplace is ERC1155Holder, ReentrancyGuard {

    struct Listing {
        uint256[] ticketIDs;
        mapping(uint256 => uint256) prices;
        mapping(uint256 => uint256) amounts;
        uint256 totalAmount;
    }

    struct ListingGroup {
        mapping(address => Listing) listings;
        address[] sellers;
        mapping(address => uint) isSeller;
    }

    event ItemListed(
        address indexed seller,
        address indexed eventAddress
        // uint256 indexed ticketId,
        // uint256 indexed amount,
        // uint256 price
    );
    event ItemCanceled(
        address indexed seller,
        address indexed eventAddress
        // uint256 indexed tokenId
    );
    // event ItemBought(
    //     address indexed buyer,
    //     address indexed eventAddress,
    //     uint256 indexed ticketId,
    //     uint256 indexed amount,
    //     uint256 price
    // );

    // State variables
    mapping(address => ListingGroup) private s_listings;
    mapping(address => uint256) private s_proceeds;

    // Function modifiers
   modifier notListed(
        address eventAddress,
        uint256 ticketId,
        address seller
   ) {
        if (s_listings[eventAddress].listings[seller].prices[ticketId] != 0) {
            revert AlreadyListed(eventAddress, ticketId);
        }

        _;
    }

    modifier isListed(
        address eventAddress,
        uint256 ticketId,
        address seller
    ) {
         if (s_listings[eventAddress].listings[seller].ticketIDs.length == 0 || s_listings[eventAddress].listings[seller].prices[ticketId] == 0) {
            revert NotListed(eventAddress, ticketId);
        }
        
        _;
    }

    modifier isOwner(
        address eventAddress,
        uint256 ticketId,
        address addr,
        uint256 amount
    ) {
        IERC1155 ticket = IERC1155(eventAddress);
        uint256 balance = ticket.balanceOf(addr, ticketId);
        if (balance < amount) {
            revert NotOwner();
        }

        _;
    }

    modifier isApproved(address eventAddress, address seller) {
        IERC1155 ticket = IERC1155(eventAddress);
        if (!ticket.isApprovedForAll(seller, address(this))) {
            revert NotApproved(seller, eventAddress);
        }

        _;
    }

    modifier isOwnerAndApprovedAndNotListed(
        address eventAddress,
        uint256 ticketId,
        address seller,
        uint256 amount
    ) {
        IERC1155 ticket = IERC1155(eventAddress);
        uint256 balance = ticket.balanceOf(seller, ticketId);
        if (balance < amount) {
            revert NotOwner();
        }
        if (!ticket.isApprovedForAll(seller, address(this))) {
            revert NotApproved(seller, eventAddress);
        }
        if (s_listings[eventAddress].listings[seller].prices[ticketId] != 0) {
            revert AlreadyListed(eventAddress, ticketId);
        }

        _;
    }

    function listTicket(
        address eventAddress,
        uint256 ticketId,
        uint256 price,
        uint256 amount
    ) external isOwnerAndApprovedAndNotListed(eventAddress, ticketId, msg.sender, amount) {
        if (price <= 0) {
            revert PriceMustBeAboveZero();
        }

        createListing(eventAddress, ticketId, price, amount);
        emit ItemListed(msg.sender, eventAddress);

    }

    function createListing(address eventAddress, uint256 ticketId, uint256 price, uint256 amount) private {
        if (s_listings[eventAddress].isSeller[msg.sender] == 0) {
            s_listings[eventAddress].isSeller[msg.sender] = 1;
            s_listings[eventAddress].sellers.push(msg.sender);
        }
        s_listings[eventAddress].listings[msg.sender].ticketIDs.push(ticketId);
        s_listings[eventAddress].listings[msg.sender].prices[ticketId] = price;
        s_listings[eventAddress].listings[msg.sender].amounts[ticketId] = amount;
        s_listings[eventAddress].listings[msg.sender].totalAmount += amount;
    }

    function cancelListing(
        address eventAddress,
        uint256 ticketId,
        uint256 amount
    ) external isOwner(eventAddress, ticketId, msg.sender, amount) isListed(eventAddress, ticketId, msg.sender) {
        s_listings[eventAddress].listings[msg.sender].totalAmount -= amount;
        if (s_listings[eventAddress].listings[msg.sender].totalAmount == 0) {
            s_listings[eventAddress].isSeller[msg.sender] = 0;
        }
        s_listings[eventAddress].listings[msg.sender].amounts[ticketId] -= amount;
        uint256 i = 0;
        if (s_listings[eventAddress].listings[msg.sender].amounts[ticketId] == 0) {
            delete s_listings[eventAddress].listings[msg.sender].prices[ticketId];
            while (i < s_listings[eventAddress].listings[msg.sender].ticketIDs.length) {
                if (s_listings[eventAddress].listings[msg.sender].ticketIDs[i] == ticketId) {
                    delete s_listings[eventAddress].listings[msg.sender].ticketIDs[i];
                    break;
                } else {
                    i += 1;
                }
            }
        }
        emit ItemCanceled(msg.sender, eventAddress);
    } 

    function buyItem(
        address eventAddress,
        uint ticketId,
        address seller,
        uint256 amount
    ) external payable isListed(eventAddress, ticketId, seller) nonReentrant {
        Listing storage listedItem = s_listings[eventAddress].listings[seller];
        uint256 total = listedItem.prices[ticketId] * amount;
        if (msg.value != total) {
            revert PriceNotMet(eventAddress, ticketId, total);
        }
        if (listedItem.amounts[ticketId] < amount) {
            revert NotEnoughStock(eventAddress, ticketId, amount);
        }
        
        s_proceeds[seller] += msg.value;
        listedItem.amounts[ticketId] -= amount;
        listedItem.totalAmount -= amount;
        if (listedItem.totalAmount == 0) {
            delete s_listings[eventAddress].listings[msg.sender];
        }
        IERC1155(eventAddress).safeTransferFrom(seller, msg.sender, ticketId, amount, "");
        // emit ItemBought(msg.sender, eventAddress, ticketId, total);
    }

    function updateListing(
        address eventAddress,
        uint256 ticketId,
        uint256 newPrice
    ) external isListed(eventAddress, ticketId, msg.sender) nonReentrant {
        s_listings[eventAddress].listings[msg.sender].prices[ticketId] = newPrice;
    }

    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NoProceeds(msg.sender);
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        require(success, "Transfer failed");
    }

    function getListingGroupSellers(
        address eventAddress
    ) public view returns (address[] memory) {
        return s_listings[eventAddress].sellers;
    }

    function getListingIDs(address eventAddress, address seller) public view returns (uint256[] memory) {
        return s_listings[eventAddress].listings[seller].ticketIDs;
    }

    function getTicketPrice(address eventAddress, address seller, uint256 ticketId) public view returns (uint256) {
        return s_listings[eventAddress].listings[seller].prices[ticketId];
    }

    function getTicketAmounts(address eventAddress, address seller, uint256 ticketId) public view returns (uint256) {
        return s_listings[eventAddress].listings[seller].amounts[ticketId];
    }

    function getListingTotalAmount(address eventAddress, address seller) public view returns (uint256) {
        return s_listings[eventAddress].listings[seller].totalAmount;
    }

    function getProceeds() public view returns (uint256) {
        return s_proceeds[msg.sender];
    }
}