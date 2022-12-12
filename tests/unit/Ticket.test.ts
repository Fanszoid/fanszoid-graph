import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeAll, beforeEach, clearStore, describe, log, newMockEvent, test } from "matchstick-as"
import { Balance, Event, Ticket, User } from "../../build/generated/schema";
import { param } from "../utils";
import { TransferBatch, TransferSingle } from "../../build/generated/Ticket/Ticket";
import { handleTransferBatch, handleTransferSingle } from "../../src/handlers/ticketsHandler";
import { getBalanceId } from "../../src/modules/Balance";
import { getTicketId } from "../../src/modules/Ticket";


let address1:string = '';
let address2:string = '';
let org:string = '';

describe("Tickets", () => {  

  beforeAll(() => {
    address1 = Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f').toHex();
    address2 = Address.fromString('0xB8dF7E9Beb10F5154eE98bd1c75f1F6BDDE94154').toHex();
    org = Address.fromString('0xa16081f360e3847006db660bae1c6d1b2e17ec2a').toHex();
  })
  beforeEach(() => {
      clearStore() // <-- clear the store before each test in the file
      let event = new Event("e0x0");
      event.organizer = org;
      event.attendees = BigInt.fromString('0');
      event.collaborators = [];
      event.title = 'Title';
      event.description = 'Description';
      event.type = 'metaverse';
      event.category = 'art'
      event.startDateUTC = BigInt.fromString('0');
      event.endDateUTC = BigInt.fromString('0');
      event.save();

      let user1 = new User(address1);
      user1.address = address1;
      user1.save();
      let ticket = new Ticket(getTicketId(BigInt.fromString('0')));
      ticket.creatorRoyalty = 10;
      ticket.isResellable = false;
      ticket.isPrivate = false;
      ticket.totalAmount = 10;
      ticket.minAmountRestrictions = 0;
      ticket.restrictions = [];
      ticket.save();
      let balance1 = new Balance(getBalanceId(new BigInt(0), Address.fromString(address1), false));;
      balance1.type = 'Ticket';
      balance1.amountOwned = 5;
      balance1.event = 'e0x0';
      balance1.ticket = ticket.id;
      balance1.owner = org;
      balance1.amountOnSell = 5;
      balance1.isEventOwner = false;
      balance1.save();

      let user2 = new User(address2);
      user2.address = address2;
      user2.save();
  });
  
  test("Single Transfer", () => {
    let mockEvent = newMockEvent();
    
    let event = new TransferSingle(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    
    event.parameters = [
      param('operator', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('from', address1),
      param('to', address2),
      param('id', BigInt.fromString('0')),
      param('value', BigInt.fromString('1'))
    ];

    const balanceId1 = "t".concat(address1).concat("-0x0");
    const balanceId2 = "t".concat(address2).concat("-0x0");         
    
    // Test agains storage [Entity, id, attr, expected_value]
    assert.fieldEquals('Balance', balanceId1, 'amountOwned', '5');
    assert.notInStore('Balance', balanceId2);
    handleTransferSingle(event);
    assert.fieldEquals('Balance', balanceId1, 'amountOwned', '4');
    assert.fieldEquals('Balance', balanceId2, 'amountOwned', '1');
  })

  test("Bulk Transfer", () => {
    let mockEvent = newMockEvent();
    
    let event = new TransferBatch(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    
    event.parameters = [
      param('operator', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('from', address1),
      param('to', address2),
      param('ids', [BigInt.fromString('0')]),
      param('values', [BigInt.fromString('1')])
    ];

    const balanceId1 = "t".concat(address1).concat("-0x0");
    const balanceId2 = "t".concat(address2).concat("-0x0");      
    
    // Test agains storage [Entity, id, attr, expected_value]
    assert.fieldEquals('Balance', balanceId1, 'amountOwned', '5');
    assert.notInStore('Balance', balanceId2);
    handleTransferBatch(event);
    assert.fieldEquals('Balance', balanceId1, 'amountOwned', '4');
    assert.fieldEquals('Balance', balanceId2, 'amountOwned', '1');
  })
})

// For coverage analysis
// Include all handlers beign tested
export { 
  handleTransferSingle,
  handleTransferBatch
}