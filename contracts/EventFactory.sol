//SPDX-License-Identifier: UNLICENSED
// contracts/EventFactory.sol

pragma solidity ^0.8.19;

import "./Event.sol";

contract EventFactory {
    Event[] public events;
    mapping(uint => address) public indexToContract;
    mapping(uint => address) public indexToOwner;
    
    event EventCreated(address owner, address tokenContract);

    function deployEvent(string memory _eventName) public {
        Event e = new Event(_eventName, msg.sender);
        events.push(e);
        indexToContract[events.length - 1] = address(e);
        indexToOwner[events.length - 1] = msg.sender;
        emit EventCreated(msg.sender,address(e));
    }

    function getEvents() public view returns (Event[] memory) {
        return events;
    }

    function getEventDetails(uint _index) public view returns (address, address) {
        return (indexToOwner[_index], indexToContract[_index]);
    }

}
