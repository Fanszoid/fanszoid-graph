import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeAll, beforeEach, clearStore, describe, mockIpfsFile, newMockEvent, test } from "matchstick-as"
import { Admin, CollaboratorAdded, CollaboratorRemoved, CreatorRoyaltyModifiedOnEvent, EventCreated, EventDeleted, EventEdited, EventOwnershipTransferred, EventPaused, EventUnpaused, MembershipAssignedToTicket, MembershipRemovedFromTicket, MembershipTokenIdRemovedFromTicket } from "../../build/generated/Admin/Admin";
import { AllowedMembership, Event, Ticket, User } from "../../build/generated/schema";
import { handleCollaboratorAdded, handleCollaboratorRemoved, handleCreatorRoyaltyModifiedOnEvent, handleDisallowMembership, handleDisallowMembershipTokenId, handleEventCreated, handleEventDeleted, handleEventOwnershipTransferred, handleEventPaused, handleEventUnpaused, handleEventUriModification, handleMembershipsAssigned } from "../../src/handlers/adminHandler";
import { log } from "matchstick-as/assembly/log";
import { param } from "../utils";
import { loadOrCreateUser } from "../../src/modules/User";
import { getTicketId } from "../../src/modules/Ticket";
import { getAllowedMembershipId } from "../../src/modules/Membership";

let org: string = '';

describe("Admin", () => {

  beforeAll(() => {
    org = Address.fromString('0xa16081f360e3847006db660bae1c6d1b2e17ec2a').toHex();
  });

  beforeEach(() => {
      clearStore() // <-- clear the store before each test in the file

      let event = new Event("e0x0");
      event.organizer = org;
      event.collaborators = [];
      event.attendees = BigInt.fromString('0');
      event.paused = false;
      event.title = 'Title';
      event.description = 'Description';
      event.type = 'metaverse';
      event.category = 'art'
      event.startDateUTC = BigInt.fromString('0');
      event.endDateUTC = BigInt.fromString('0');
      event.indexStatus = 'PARSED'
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

    // Test agains storage [Entity, id, attr, expected_value]
    assert.fieldEquals('Event', 'e0x1', 'id', 'e0x1');
    assert.fieldEquals('Event', 'e0x1', 'organizer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a');
    assert.fieldEquals('Event', 'e0x1', 'metadata', 'FAKE_URI');
    assert.fieldEquals('Event', 'e0x1', 'indexStatus', 'PARSED')
    assert.fieldEquals('Event', 'e0x1', 'eventFanzUri', 'metaverse-lollapalooza-2022-e0x1')
  })

  test("Handle event creation with special chars in title", () => {
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

    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_2_event_metadata_specials_chars.json');

    handleEventCreated(event);

    // Test agains storage [Entity, id, attr, expected_value]
    assert.fieldEquals('Event', 'e0x1', 'id', 'e0x1');
    assert.fieldEquals('Event', 'e0x1', 'organizer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a');
    assert.fieldEquals('Event', 'e0x1', 'metadata', 'FAKE_URI');
    assert.fieldEquals('Event', 'e0x1', 'indexStatus', 'PARSED')
    assert.fieldEquals('Event', 'e0x1', 'eventFanzUri', 'metaverse-lollapalooza-2022-e0x1')
  })

  test("Handle event creation with not valid ipfs", () => {
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
    mockIpfsFile('FAKE_URI', 'tests/ipfs/not_valid.txt');
    
    event.parameters = [
      param('eventId', BigInt.fromString('1')),
      param('organizer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a'),
      param('uri', 'FAKE_URI')
    ];

    handleEventCreated(event);

    assert.fieldEquals('Event', 'e0x1', 'indexStatus', 'NOT_VALID')
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
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.event = 'e0x0';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED';
    ticket.save(); 

    let entity = Event.load('e0x0');
    if(!entity) throw Error('Event not found');
    entity.description = 'asd';
    entity.tickets = ['tt0x1'];
    entity.save();

    let mockEvent = newMockEvent();
    let event = new CreatorRoyaltyModifiedOnEvent(
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
      param('newRoyalty', BigInt.fromString('1'))
    ];

    assert.fieldEquals('Ticket', ticket.id, 'creatorRoyalty', '10')
    handleCreatorRoyaltyModifiedOnEvent(event)
    assert.fieldEquals('Ticket', ticket.id, 'creatorRoyalty', '1')
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
    assert.fieldEquals('Event', 'e0x0', 'indexStatus', 'PARSED')
  });

  test("Handle event modified with invalid ipfs", () => {
    let entity = Event.load('e0x0');
    if(!entity) throw Error('Event not found');
    entity.metadata = 'FAKE_URI';
    entity.title = "Metaverse";
    entity.save();
    mockIpfsFile('FAKE_2_URI', 'tests/ipfs/fake_2_event_metadata.json');
    mockIpfsFile('newUriNotValid', 'tests/ipfs/not_valid.txt')

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
      param('newUri', 'newUriNotValid')
    ];

    assert.fieldEquals('Event', 'e0x0', 'metadata', 'FAKE_URI');
    assert.fieldEquals('Event', 'e0x0', 'title', 'Metaverse');
    handleEventUriModification(event)
    assert.fieldEquals('Event', 'e0x0', 'indexStatus', 'NOT_VALID')
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

  test("Handle membership assigned", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.event = 'e0x0';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED';
    ticket.save(); 

    let entity = Event.load('e0x0');
    if(!entity) throw Error('Event not found');
    entity.paused = true;
    entity.save();

    let mockEvent = newMockEvent();
    let event = new MembershipAssignedToTicket(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    
    let contractAddress = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';
    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('contractAddress', contractAddress),
      param('ids', []),
    ];
    let membershipId = ticket.id + '-' + contractAddress;

    assert.notInStore('AllowedMembership', membershipId);
    handleMembershipsAssigned(event)
    assert.fieldEquals('AllowedMembership', membershipId, 'address', contractAddress);
  });

  test("Handle disallow membership", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.event = 'e0x0';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED';
    ticket.save(); 

    let contractAddress = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';
    let allowed = new AllowedMembership(getAllowedMembershipId(ticket.id, contractAddress));
    allowed.address = contractAddress;
    allowed.tokenIds = [BigInt.fromString('1')];
    allowed.ticket = ticket.id;
    allowed.save();

    let mockEvent = newMockEvent();
    let event = new MembershipRemovedFromTicket(
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
      param('ticketId', BigInt.fromString('1')),
      param('contractAddress', contractAddress),
    ];
    let membershipId = ticket.id + '-' + contractAddress;

    assert.fieldEquals('AllowedMembership', membershipId, 'address', contractAddress);
    handleDisallowMembership(event)
    assert.notInStore('AllowedMembership', membershipId);
  });

  test("Handle disallow membership token id", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.event = 'e0x0';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED'
    ticket.save(); 

    let contractAddress = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';
    let allowed = new AllowedMembership(getAllowedMembershipId(ticket.id, contractAddress));
    allowed.address = contractAddress;
    allowed.tokenIds = [BigInt.fromString('1')];
    allowed.ticket = ticket.id;
    allowed.save();

    let mockEvent = newMockEvent();
    let event = new MembershipTokenIdRemovedFromTicket(
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
      param('ticketId', BigInt.fromString('1')),
      param('contractAddress', contractAddress),
      param('tokenId', BigInt.fromString('1')),
    ];
    let membershipId = ticket.id + '-' + contractAddress;

    assert.fieldEquals('AllowedMembership', membershipId, 'tokenIds', '[1]');
    handleDisallowMembershipTokenId(event)
    assert.fieldEquals('AllowedMembership', membershipId, 'tokenIds', '[]');
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
  handleEventUnpaused,
  handleCreatorRoyaltyModifiedOnEvent,
  handleMembershipsAssigned,
  handleDisallowMembership, 
  handleDisallowMembershipTokenId,
}

