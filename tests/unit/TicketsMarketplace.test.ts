import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeAll, beforeEach, clearStore, describe, log, mockIpfsFile, newMockEvent, test } from "matchstick-as"
import { Allowance, Balance, Event, Ticket, User } from "../../build/generated/schema";
import { param, parseValue } from "../utils";
import { handleTransferBatch, handleTransferSingle } from "../../src/handlers/ticketsHandler";
import { getBalanceId } from "../../src/modules/Balance";
import { handleAllowanceAdded, handleAllowanceConsumed, handleAllowanceRemoved, handleAskRemoved, handleAskSetted, handleAskSettedLegacy, handleCreatorRoyaltyModifiedOnTicket, handleTicketBought, handleTicketDeleted, handleTicketPublished, handleTicketPublishedLegacy, handleTicketUriModification } from "../../src/handlers/ticketsMarketplaceHandler";
import { AllowanceAdded, AllowanceAddedAllowanceStruct, AllowanceConsumed, AllowanceRemoved, AskRemoved, AskSetted, AskSetted1, CreatorRoyaltyModifiedOnTicket, TicketBought, TicketDeleted, TicketEdited, TicketPublished, TicketPublished1, TicketPublished1SaleInfoAllowancesStruct, TicketPublished1SaleInfoStruct, TicketPublished2, TicketPublished2SaleInfoAllowancesStruct, TicketsDeleted } from "../../build/generated/TicketsMarketplace/TicketsMarketplace";
import { getTicketId } from "../../src/modules/Ticket";


let address1:string = '';
let address2:string = '';
let org:string = '';

describe("TicketsMarketplace", () => {  

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
      event.indexStatus = 'PARSED'
      event.save();

      let user1 = new User(address1);
      user1.address = address1;
      user1.save();
      let ticket = new Ticket(getTicketId(BigInt.fromString('0')));
      ticket.creatorRoyalty = 10;
      ticket.isResellable = false;
      ticket.isPrivate = false;
      ticket.totalAmount = 10;
      ticket.minRestrictionAmount = 0;
      ticket.restrictions = [];
      ticket.indexStatus = 'PARSED'
      ticket.primaryMarketplaceRoyalty = 1500
      ticket.secondaryMarketplaceRoyalty = 750
      ticket.save();
      let balance1 = new Balance("t0x0-".concat(address1));
      balance1.type = 'Ticket';
      balance1.amountOwned = 5;
      balance1.amountOnSell = 5;
      balance1.event = 'e0x0';
      balance1.ticket = ticket.id;
      balance1.owner = org;
      balance1.isEventOwner = false;
      balance1.ticketIdentifiersIds = [];
      balance1.save();

      let user2 = new User(address2);
      user2.address = address2;
      user2.save();
  });


  test("Handle allowance added", () => {
    let mockEvent = newMockEvent();
    
    let event = new AllowanceAdded(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )

    let struct = new AllowanceAddedAllowanceStruct();
    struct[0] = parseValue(BigInt.fromString('1'));
    struct[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    event.parameters = [
      param('ticketId', BigInt.fromString('0')),
      param('allowanceId', BigInt.fromString('1')),
      param('allowance', struct)
    ];

    assert.notInStore('Allowance', 'ta-0x1')
    handleAllowanceAdded(event)
    assert.fieldEquals('Allowance', 'ta-0x1', 'id', 'ta-0x1')
  });

  test("Handle allowance consumed", () => {
    let allowance = new Allowance("ta-0x1");
    allowance.amount = 2;
    allowance.allowedAddresses = [];
    allowance.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new AllowanceConsumed(
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
      param('allowanceId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Allowance', 'ta-0x1', 'amount', '2')
    handleAllowanceConsumed(event)
    assert.fieldEquals('Allowance', 'ta-0x1', 'amount', '1')
  });

  test("Handle allowance removed", () => {
    let allowance = new Allowance("ta-0x1");
    allowance.amount = 2;
    allowance.allowedAddresses = [];
    allowance.save(); 
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.allowances = ['ta-0x1'];
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED'
    ticket.primaryMarketplaceRoyalty = 1500
    ticket.secondaryMarketplaceRoyalty = 750
    ticket.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new AllowanceRemoved(
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
      param('allowanceId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Allowance', 'ta-0x1', 'amount', '2')
    handleAllowanceRemoved(event)
    assert.notInStore('Allowance', 'ta-0x1')
  });

  test("Handle ticket uri modification", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.name = 'NAME';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED';
    ticket.primaryMarketplaceRoyalty = 1500
    ticket.secondaryMarketplaceRoyalty = 750
    ticket.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new TicketEdited(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_2_ticket_metadata.json');

    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('newUri', 'FAKE_URI'),
    ];
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'NAME')
    handleTicketUriModification(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'FAKE')
    assert.fieldEquals('Ticket', 'tt0x1', 'restrictions', '[]')
    assert.fieldEquals('Ticket', 'tt0x1', 'minRestrictionAmount', '0')
    assert.fieldEquals('Ticket', 'tt0x1', 'indexStatus', 'PARSED')
  });

  test("Handle ticket uri modification with not valid ipfs", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.name = 'NAME';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED'
    ticket.primaryMarketplaceRoyalty = 1500;
    ticket.secondaryMarketplaceRoyalty = 750;
    ticket.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new TicketEdited(
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
      param('ticketId', BigInt.fromString('1')),
      param('newUri', 'FAKE_URI'),
    ];
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'NAME')
    handleTicketUriModification(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'indexStatus', 'NOT_VALID')
  });

  test("Handle ticket published", () => {   
    let eventInStorage = new Event("e0x0");
    eventInStorage.organizer = org;
    eventInStorage.attendees = BigInt.fromString('0');
    eventInStorage.collaborators = [];
    eventInStorage.title = 'Title';
    eventInStorage.description = 'Description';
    eventInStorage.type = 'metaverse';
    eventInStorage.category = 'art'
    eventInStorage.startDateUTC = BigInt.fromString('0');
    eventInStorage.endDateUTC = BigInt.fromString('0');
    eventInStorage.indexStatus = 'PARSED'
    eventInStorage.save();
  
    let mockEvent = newMockEvent();
    
    let event = new TicketPublished2(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_2_ticket_metadata.json');

    let allowance = new TicketPublished2SaleInfoAllowancesStruct();
    allowance[0] = parseValue(BigInt.fromString('1'));
    allowance[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    let saleInfo = new TicketPublished2SaleInfoAllowancesStruct();
    saleInfo[0] = parseValue(BigInt.fromString('10')); 
    saleInfo[1] = parseValue(BigInt.fromString('0')); 
    saleInfo[2] = parseValue(BigInt.fromString('0')); 
    saleInfo[3] = parseValue(BigInt.fromString('10')); 
    saleInfo[4] = ethereum.Value.fromBoolean(true); 
    saleInfo[5] = parseValue('FAKE_URI'); 
    saleInfo[6] = ethereum.Value.fromBoolean(true); 
    saleInfo[7] = parseValue([allowance]); 
    saleInfo[8] = parseValue('0x87d250a5c9674788f946f10e95641bba4dea838f')
    
    event.parameters = [
      param('eventId', BigInt.fromString('0')),
      param('organizer', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
      param('amount', BigInt.fromString('10')),
      param('saleInfo', saleInfo),
      param('uri', 'FAKE_URI')
    ];

    assert.notInStore('Ticket', 'tt0x1')
    handleTicketPublished(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'event', 'e0x0')
    assert.fieldEquals('Ticket', 'tt0x1', 'extraRequirement', 'none')
    assert.fieldEquals('Ticket', 'tt0x1', 'restrictions', '[]')
    assert.fieldEquals('Ticket', 'tt0x1', 'minRestrictionAmount', '0')
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'FAKE')
    assert.fieldEquals('Ticket', 'tt0x1', 'indexStatus', 'PARSED')
    let balanceId = getBalanceId(BigInt.fromString('1'), Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), false);
    assert.fieldEquals('Balance', balanceId, 'amountOwned', '10')
    assert.fieldEquals('Balance', balanceId, 'paymentTokenAddress', '0x87d250a5c9674788f946f10e95641bba4dea838f')
  });

  test("Handle ticket published with invalid ipfs", () => {   
    let eventInStorage = new Event("e0x0");
    eventInStorage.organizer = org;
    eventInStorage.attendees = BigInt.fromString('0');
    eventInStorage.collaborators = [];
    eventInStorage.title = 'Title';
    eventInStorage.description = 'Description';
    eventInStorage.type = 'metaverse';
    eventInStorage.category = 'art'
    eventInStorage.startDateUTC = BigInt.fromString('0');
    eventInStorage.endDateUTC = BigInt.fromString('0');
    eventInStorage.indexStatus = 'PARSED'
    eventInStorage.save();
  
    let mockEvent = newMockEvent();
    
    let event = new TicketPublished2(
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

    let allowance = new TicketPublished2SaleInfoAllowancesStruct();
    allowance[0] = parseValue(BigInt.fromString('1'));
    allowance[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    let saleInfo = new TicketPublished2SaleInfoAllowancesStruct();
    saleInfo[0] = parseValue(BigInt.fromString('10')); 
    saleInfo[1] = parseValue(BigInt.fromString('0')); 
    saleInfo[2] = parseValue(BigInt.fromString('0')); 
    saleInfo[3] = parseValue(BigInt.fromString('10')); 
    saleInfo[4] = ethereum.Value.fromBoolean(true); 
    saleInfo[5] = parseValue('FAKE_URI'); 
    saleInfo[6] = ethereum.Value.fromBoolean(true); 
    saleInfo[7] = parseValue([allowance]); 
    saleInfo[8] = parseValue('0x87d250a5c9674788f946f10e95641bba4dea838f')
    
    event.parameters = [
      param('eventId', BigInt.fromString('0')),
      param('organizer', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
      param('amount', BigInt.fromString('10')),
      param('saleInfo', saleInfo),
      param('uri', 'FAKE_URI')
    ];

    assert.notInStore('Ticket', 'tt0x1')
    handleTicketPublished(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'indexStatus', 'NOT_VALID')
  });

  test("Handle ticket published with extra requirement", () => {   
    let eventInStorage = new Event("e0x0");
    eventInStorage.organizer = org;
    eventInStorage.attendees = BigInt.fromString('0');
    eventInStorage.collaborators = [];
    eventInStorage.title = 'Title';
    eventInStorage.description = 'Description';
    eventInStorage.type = 'metaverse';
    eventInStorage.category = 'art'
    eventInStorage.startDateUTC = BigInt.fromString('0');
    eventInStorage.endDateUTC = BigInt.fromString('0');
    eventInStorage.indexStatus = 'PARSED'
    eventInStorage.save();
  
    let mockEvent = newMockEvent();
    
    let event = new TicketPublished2(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_ticket_with_extra_requirement.json');

    let allowance = new TicketPublished1SaleInfoAllowancesStruct();
    allowance[0] = parseValue(BigInt.fromString('1'));
    allowance[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    let saleInfo = new TicketPublished1SaleInfoStruct();
    saleInfo[0] = parseValue(BigInt.fromString('10')); 
    saleInfo[1] = parseValue(BigInt.fromString('0')); 
    saleInfo[2] = parseValue(BigInt.fromString('0')); 
    saleInfo[3] = parseValue(BigInt.fromString('10')); 
    saleInfo[4] = ethereum.Value.fromBoolean(true); 
    saleInfo[5] = parseValue('FAKE_URI'); 
    saleInfo[6] = ethereum.Value.fromBoolean(true); 
    saleInfo[7] = parseValue([allowance]); 
    saleInfo[8] = parseValue('0x0000000000000000000000000000000000000000');
    
    event.parameters = [
      param('eventId', BigInt.fromString('0')),
      param('organizer', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
      param('amount', BigInt.fromString('10')),
      param('saleInfo', saleInfo),
      param('uri', 'FAKE_URI'),
    ];

    assert.notInStore('Ticket', 'tt0x1')
    handleTicketPublished(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'event', 'e0x0')
    assert.fieldEquals('Ticket', 'tt0x1', 'extraRequirement', 'extraReq')
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'FAKE')
    let balanceId = getBalanceId(BigInt.fromString('1'), Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), false);
    assert.fieldEquals('Balance', balanceId, 'amountOwned', '10')
  });

  test("Handle ticket published with extra requirement camel case", () => {   
    let eventInStorage = new Event("e0x0");
    eventInStorage.organizer = org;
    eventInStorage.attendees = BigInt.fromString('0');
    eventInStorage.collaborators = [];
    eventInStorage.title = 'Title';
    eventInStorage.description = 'Description';
    eventInStorage.type = 'metaverse';
    eventInStorage.category = 'art'
    eventInStorage.startDateUTC = BigInt.fromString('0');
    eventInStorage.endDateUTC = BigInt.fromString('0');
    eventInStorage.indexStatus = 'PARSED'
    eventInStorage.save();
  
    let mockEvent = newMockEvent();
    
    let event = new TicketPublished2(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_ticket_with_extra_requirement_camel_case.json');

    let allowance = new TicketPublished1SaleInfoAllowancesStruct();
    allowance[0] = parseValue(BigInt.fromString('1'));
    allowance[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    let saleInfo = new TicketPublished1SaleInfoStruct();
    saleInfo[0] = parseValue(BigInt.fromString('10')); 
    saleInfo[1] = parseValue(BigInt.fromString('0')); 
    saleInfo[2] = parseValue(BigInt.fromString('0')); 
    saleInfo[3] = parseValue(BigInt.fromString('10')); 
    saleInfo[4] = ethereum.Value.fromBoolean(true); 
    saleInfo[5] = parseValue('FAKE_URI'); 
    saleInfo[6] = ethereum.Value.fromBoolean(true); 
    saleInfo[7] = parseValue([allowance]); 
    saleInfo[8] = parseValue('0x0000000000000000000000000000000000000000');
    
    event.parameters = [
      param('eventId', BigInt.fromString('0')),
      param('organizer', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
      param('amount', BigInt.fromString('10')),
      param('saleInfo', saleInfo),
      param('uri', 'FAKE_URI'),
    ];

    assert.notInStore('Ticket', 'tt0x1')
    handleTicketPublished(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'event', 'e0x0')
    assert.fieldEquals('Ticket', 'tt0x1', 'extraRequirement', 'extraReq')
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'FAKE')
    let balanceId = getBalanceId(BigInt.fromString('1'), Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), false);
    assert.fieldEquals('Balance', balanceId, 'amountOwned', '10')
  });

  test("Handle ticket published with restrictions", () => {   
    let eventInStorage = new Event("e0x0");
    eventInStorage.organizer = org;
    eventInStorage.attendees = BigInt.fromString('0');
    eventInStorage.collaborators = [];
    eventInStorage.title = 'Title';
    eventInStorage.description = 'Description';
    eventInStorage.type = 'metaverse';
    eventInStorage.category = 'art'
    eventInStorage.startDateUTC = BigInt.fromString('0');
    eventInStorage.endDateUTC = BigInt.fromString('0');
    eventInStorage.indexStatus = 'PARSED'
    eventInStorage.save();
  
    let mockEvent = newMockEvent();
    
    let event = new TicketPublished2(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_ipfs_with_restrictions.json');

    let allowance = new TicketPublished1SaleInfoAllowancesStruct();
    allowance[0] = parseValue(BigInt.fromString('1'));
    allowance[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    let saleInfo = new TicketPublished1SaleInfoStruct();
    saleInfo[0] = parseValue(BigInt.fromString('10')); 
    saleInfo[1] = parseValue(BigInt.fromString('0')); 
    saleInfo[2] = parseValue(BigInt.fromString('0')); 
    saleInfo[3] = parseValue(BigInt.fromString('10')); 
    saleInfo[4] = ethereum.Value.fromBoolean(true); 
    saleInfo[5] = parseValue('FAKE_URI'); 
    saleInfo[6] = ethereum.Value.fromBoolean(true); 
    saleInfo[7] = parseValue([allowance]); 
    saleInfo[8] = parseValue('0x0000000000000000000000000000000000000000');
    
    event.parameters = [
      param('eventId', BigInt.fromString('0')),
      param('organizer', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
      param('amount', BigInt.fromString('10')),
      param('saleInfo', saleInfo),
      param('uri', 'FAKE_URI'),
    ];

    assert.notInStore('Ticket', 'tt0x1')
    handleTicketPublished(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'event', 'e0x0')
    assert.fieldEquals('Ticket', 'tt0x1', 'minRestrictionAmount', '1')
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'Test ticket 2')
    let balanceId = getBalanceId(BigInt.fromString('1'), Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), false);

    assert.fieldEquals('Restriction', 'POAP-65000', 'imageUrl', 'https://assets.poap.xyz/better-space-ep11-2022-logo-1663106437011.png')
    assert.fieldEquals('Balance', balanceId, 'amountOwned', '10')
  });


  test("Handle ticket deleted", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.name = 'NAME';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED';
    ticket.primaryMarketplaceRoyalty = 1500;
    ticket.secondaryMarketplaceRoyalty = 750;
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.type = 'Ticket';
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.isEventOwner = false;
    balance.type = 'Ticket';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new TicketsDeleted(
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
      param('ids', [BigInt.fromString('1')]),
      param('owner', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('amounts', [BigInt.fromString('3')]),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOwned', '3')
    handleTicketDeleted(event)
    assert.notInStore('Balance', balanceId)
  });

  test("Handle ticket bought", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.name = 'NAME';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED'
    ticket.primaryMarketplaceRoyalty = 1500;
    ticket.secondaryMarketplaceRoyalty = 750;
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.askingPrice = BigInt.fromString('10');
    balance.isEventOwner = false;
    balance.type = 'Ticket';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new TicketBought(
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
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('buyer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a'),
      param('price', BigInt.fromString('10')),
      param('amount', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    handleTicketBought(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '2')
    assert.fieldEquals('Transfer', event.transaction.hash.toHex(), 'isSale', 'true')
  });

  test("Handle ask setted legacy", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.name = 'NAME';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED'
    ticket.primaryMarketplaceRoyalty = 1500;
    ticket.secondaryMarketplaceRoyalty = 750;
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 0;
    balance.isEventOwner = false;
    balance.type = 'Ticket';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new AskSetted(
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
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketPrice', BigInt.fromString('1')),
      param('amount', BigInt.fromString('3'))
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '0')
    handleAskSettedLegacy(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    assert.fieldEquals('Balance', balanceId, 'paymentTokenAddress', '0x0000000000000000000000000000000000000000')
  });

  test("Handle ask setted", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.name = 'NAME';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.extraRequirement = 'none';
    ticket.indexStatus = 'PARSED'
    ticket.primaryMarketplaceRoyalty = 1500;
    ticket.secondaryMarketplaceRoyalty = 750;
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 0;
    balance.isEventOwner = false;
    balance.type = 'Ticket';
    balance.paymentTokenAddress = '0x0000000000000000000000000000000000000000';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new AskSetted1(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt,
    )
    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketPrice', BigInt.fromString('1')),
      param('amount', BigInt.fromString('3')),
      param('paymentTokenAddress', '0x87d250a5c9674788f946f10e95641bba4dea838f')
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '0')
    handleAskSetted(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    assert.fieldEquals('Balance', balanceId, 'paymentTokenAddress', '0x87d250a5c9674788f946f10e95641bba4dea838f')
  });

  test("Handle ask removed", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.creatorRoyalty = 10;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.name = 'NAME';
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED'
    ticket.primaryMarketplaceRoyalty = 1500;
    ticket.secondaryMarketplaceRoyalty = 750;
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.isEventOwner = false;
    balance.type = 'Ticket';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new AskRemoved(
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
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    handleAskRemoved(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '0')
  });

  test("Handle royalty modified", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.name = 'NAME';
    ticket.creatorRoyalty = 1;
    ticket.isResellable = false;
    ticket.isPrivate = false;
    ticket.totalAmount = 10;
    ticket.minRestrictionAmount = 0;
    ticket.restrictions = [];
    ticket.indexStatus = 'PARSED'
    ticket.primaryMarketplaceRoyalty = 1500;
    ticket.secondaryMarketplaceRoyalty = 750;
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.isEventOwner = false;
    balance.type = 'Ticket';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new CreatorRoyaltyModifiedOnTicket(
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
      param('newRoyalty', BigInt.fromString('2')),
    ];

    assert.fieldEquals('Ticket', ticket.id, 'creatorRoyalty', '1')
    handleCreatorRoyaltyModifiedOnTicket(event)
    assert.fieldEquals('Ticket', ticket.id, 'creatorRoyalty', '2')
  });
})

// For coverage analysis
// Include all handlers beign tested
export { 
  handleAllowanceAdded, 
  handleAllowanceConsumed, 
  handleAllowanceRemoved, 
  handleAskRemoved, 
  handleAskSetted, 
  handleCreatorRoyaltyModifiedOnTicket, 
  handleTicketBought,
  handleTicketDeleted, 
  handleTicketPublished, 
  handleTicketUriModification
}