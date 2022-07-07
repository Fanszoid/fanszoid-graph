import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeAll, beforeEach, clearStore, describe, mockIpfsFile, newMockEvent, test } from "matchstick-as"
import { Admin, CollaboratorAdded, CollaboratorRemoved, EventCreated, EventDeleted, EventEdited, EventOwnershipTransferred, EventPaused, EventUnpaused } from "../../build/generated/Admin/Admin";
import { Event, User } from "../../build/generated/schema";
import { handleCollaboratorAdded, handleCollaboratorRemoved, handleEventCreated, handleEventDeleted, handleEventOwnershipTransferred, handleEventPaused, handleEventUnpaused, handleEventUriModification } from "../../src/handlers/adminHandler";
import { log } from "matchstick-as/assembly/log";
import { param } from "../utils";
import { loadOrCreateUser } from "../../src/modules/User";



describe("Event Changes", () => {
  beforeEach(() => {
      clearStore() // <-- clear the store before each test in the file

      let event = new Event("e0x0");
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
      param('eventId', BigInt.fromString('1')),
      param('organizer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a'),
      param('uri', 'FAKE_URI')
    ];

    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_event_metadata.json');

    handleEventCreated(event);
    
    let loaded = Event.load('e0x1');
    if(!loaded) return;

    // Test agains storage [Entity, id, attr, expected_value]
    assert.fieldEquals('Event', 'e0x1', 'id', 'e0x1');
    assert.fieldEquals('Event', 'e0x1', 'organizer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a');
    assert.fieldEquals('Event', 'e0x1', 'metadata', 'FAKE_URI');
  })

  test("Handle event deleted", () => {
    let mockEvent = newMockEvent();
    let event = new EventDeleted(
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
      param('eventId', BigInt.fromString('0'))
    ];

    assert.fieldEquals('Event', 'e0x0', 'id', 'e0x0');
    handleEventDeleted(event)
    assert.notInStore('Event', 'e0x0');
  });

  test("Handle event ownership transferred", () => {
    let entity = Event.load('e0x0');
    if(!entity) throw Error('Event not found');
    entity.organizer = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';
    entity.save();

    let mockEvent = newMockEvent();
    let event = new EventOwnershipTransferred(
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
      param('eventId', BigInt.fromString('0')),
      param('newOwner', '0x0000000000000000000000000000000000000000')
    ];

    assert.fieldEquals('Event', 'e0x0', 'organizer', entity.organizer);
    handleEventOwnershipTransferred(event)
    assert.fieldEquals('Event', 'e0x0', 'organizer', '0x0000000000000000000000000000000000000000');
  
    // TO DO: Check that remaining ticket ownerhips is transferred too
  });

  test("Handle creator royalty modified on event", () => {
    log.warning("TO DO", []);
  });

  test("Handle event modified", () => {
    let entity = Event.load('e0x0');
    if(!entity) throw Error('Event not found');
    entity.metadata = 'FAKE_URI';
    entity.title = "Metaverse";
    entity.save();
    mockIpfsFile('FAKE_2_URI', 'tests/ipfs/fake_2_event_metadata.json');

    let mockEvent = newMockEvent();
    let event = new EventEdited(
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
      param('eventId', BigInt.fromString('0')),
      param('newUri', 'FAKE_2_URI')
    ];

    assert.fieldEquals('Event', 'e0x0', 'metadata', 'FAKE_URI');
    assert.fieldEquals('Event', 'e0x0', 'title', 'Metaverse');
    handleEventUriModification(event)
    assert.fieldEquals('Event', 'e0x0', 'title', 'FAKE');
    assert.fieldEquals('Event', 'e0x0', 'metadata', 'FAKE_2_URI');
  });

  test("Handle collaborator added", () => {
    let mockEvent = newMockEvent();
    let event = new CollaboratorAdded(
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
      param('eventId', BigInt.fromString('0')),
      param('collaborator', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a')
    ];

    assert.fieldEquals('Event', 'e0x0', 'collaborators', '[]');
    handleCollaboratorAdded(event)
    assert.fieldEquals('Event', 'e0x0', 'collaborators', '[0xa16081f360e3847006db660bae1c6d1b2e17ec2a]');
  });

  test("Handle collaborator removed", () => {
    let collab = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';
    let user = loadOrCreateUser(Address.fromString(collab));
    let entity = Event.load('e0x0');
    if(!entity) throw Error('Event not found');
    entity.collaborators = [user.id];
    entity.save();

    let mockEvent = newMockEvent();
    let event = new CollaboratorRemoved(
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
      param('eventId', BigInt.fromString('0')),
      param('collaborator', collab)
    ];
    
    assert.fieldEquals('Event', 'e0x0', 'collaborators', '['+collab+']');
    handleCollaboratorRemoved(event)
    assert.fieldEquals('Event', 'e0x0', 'collaborators', '[]');
  });

  test("Handle event paused", () => {
    let mockEvent = newMockEvent();
    let event = new EventPaused(
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
      param('eventId', BigInt.fromString('0')),
    ];

    assert.fieldEquals('Event', 'e0x0', 'paused', 'false');
    handleEventPaused(event)
    assert.fieldEquals('Event', 'e0x0', 'paused', 'true');
  });

  test("Handle event unpaused", () => {
    let entity = Event.load('e0x0');
    if(!entity) throw Error('Event not found');
    entity.paused = true;
    entity.save();

    let mockEvent = newMockEvent();
    let event = new EventUnpaused(
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
      param('eventId', BigInt.fromString('0')),
    ];

    assert.fieldEquals('Event', 'e0x0', 'paused', 'true');
    handleEventUnpaused(event)
    assert.fieldEquals('Event', 'e0x0', 'paused', 'false');
  });
})




// For coverage analysis
// Include all handlers beign tested
export { 
  handleEventCreated,
  handleEventDeleted,
  handleEventOwnershipTransferred,
  handleEventUriModification,
  handleCollaboratorAdded,
  handleCollaboratorRemoved,
  handleEventPaused,
  handleEventUnpaused
}