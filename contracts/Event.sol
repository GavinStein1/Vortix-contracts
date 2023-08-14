//SPDX-License-Identifier: UNLICENSED
// contracts/Event.sol

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/*
@author Gavin Stein
*/

contract Event is ERC1155, Ownable {
    uint[] public TicketIDs;  // List of unique ticket Identifiers as integers
    string public eventName;  // Name of the event

    //Events
    event NewTokenType(uint id, string name, uint amount);

    mapping(uint => string) public idToName;  // mapping of the ticket ID to the Name of the ticket
    mapping(uint => uint) public idToValues;  // mapping of the ticket ID to the value of that ticket type (unit TBC)
     
    /* Create an instance of the Event contract
     _eventName: String - name of the event
     _owner: address - will have admin functionality
     */
    constructor(string memory _eventName, address _owner) ERC1155("") {
        eventName = _eventName;
        transferOwnership(_owner);
    }

    /* Create a new ticket type. only callable by the owner
    _name: String - name of the ticket
    _amount: uint - number of tickets to mint
    _value: uint - price of each ticket (unit TBC)
    */
    function createTicketType(string memory _name, uint _amount, uint _value) public onlyOwner returns (uint) {
        require(bytes(_name).length != 0);  // require that the name is not "". If a ticket name is "" in idToName then it is considered to not exist.
        uint id = 1;
        if (TicketIDs.length != 0) {
            id = TicketIDs[TicketIDs.length - 1] + 1;
        }
        TicketIDs.push(id);
        idToName[id] = _name;
        idToValues[id] = _value;
        _mint(owner(), id, _amount, "");  // mint ticket type and send to owner address. TODO: confirm the best way to submit owner address (i.e. owner() or tx.sender)
        emit NewTokenType(id, _name, _amount);
        return id;
    }

    // Returns a list of ticketIDs
    function getTicketIDs() public view returns (uint[] memory) {
        return TicketIDs;
    }

    // Returns the name of the event
    function getEventName() public view returns (string memory) {
        return eventName;
    }

    // Returns the name and value of a ticket
    function getTicketDetails(uint _id) public view returns (string memory, uint) {
        return (idToName[_id], idToValues[_id]);
    }
    
    /* Mint additional tickets of a given type. Only callable by owner
    _id: uint - ticket ID to mint
    _amount: uint - number of tickets to mint
    */
    function mintMore(uint _id, uint amount) public onlyOwner {
        require(bytes(idToName[_id]).length != 0);  // require that ticket ID exists (i.e. has a value in idToName);

        _mint(owner(), _id, amount, "");
    }

    /* set the value of a ticket type
    _value: uint - new value
    _id: uint - ticket id to change
    */
    function assignValue(uint _value, uint _id) public onlyOwner {
        require(bytes(idToName[_id]).length != 0);
        idToValues[_id] = _value;
    }

}