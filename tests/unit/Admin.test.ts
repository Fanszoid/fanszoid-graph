import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeAll, beforeEach, clearStore, describe, mockIpfsFile, newMockEvent, test } from "matchstick-as"
import { Admin, EventCreated } from "../../build/generated/Admin/Admin";
import { Event } from "../../build/generated/schema";
import { handleEventCreated } from "../../src/handlers/adminHandler";
import { log } from "matchstick-as/assembly/log";


describe("Event Changes", () => {
  beforeEach(() => {
      clearStore() // <-- clear the store before each test in the file

      let event = new Event("e0x1");
      event.save();
  });
  
  test("Handle event creation", () => {
    let mockEvent = newMockEvent();
    
    let event = new EventCreated(
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
      new ethereum.EventParam('eventId', ethereum.Value.fromUnsignedBigInt(new BigInt(1))),
      new ethereum.EventParam('organizer', ethereum.Value.fromAddress(Address.fromString("0xa16081f360e3847006db660bae1c6d1b2e17ec2a"))),
      new ethereum.EventParam('uri', ethereum.Value.fromString('FAKE_URI'))
    ];
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_event_metadata.json');

    handleEventCreated(event);
    
    let loaded = Event.load('e0x0');
    if(!loaded) return;

    // Test agains storage [Entity, id, attr, expected_value]
    assert.fieldEquals('Event', 'e0x0', 'id', 'e0x0');
    assert.fieldEquals('Event', 'e0x0', 'organizer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a');
    assert.fieldEquals('Event', 'e0x0', 'metadata', 'FAKE_URI');
  })

  test("Handle event deleted", () => {

  });

  test("Handle event ownership transferred", () => {

  });

  test("Handle creator royalty modified on event", () => {

  });

  test("Handle event modified", () => {

  });

  test("Handle collaborator added", () => {

  });

  test("Handle collaborator removed", () => {

  });

  test("Handle event paused", () => {

  });

  test("Handle event unpaused", () => {

  });
})