import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeAll, beforeEach, clearStore, describe, log, mockIpfsFile, newMockEvent, test } from "matchstick-as"
import { Allowance, Balance, Event, Membership, User } from "../../build/generated/schema";
import { param, parseValue } from "../utils";
import { getBalanceId } from "../../src/modules/Balance";
import { handleAllowanceAdded, handleAllowanceConsumed, handleAllowanceRemoved, handleAskRemoved, handleAskSetted, handleCreatorRoyaltyModifiedOnMembership, handleMembershipBought, handleMembershipDeleted, handleMembershipPublished, handleMembershipUriModification } from "../../src/handlers/membershipsMarketplaceHandler";
import { AllowanceAdded, AllowanceAddedAllowanceStruct, AllowanceConsumed, AllowanceRemoved, AskRemoved, AskSetted, CreatorRoyaltyModifiedOnMembership, MembershipBought, MembershipDeleted, MembershipEdited, MembershipPublished, MembershipPublished1, MembershipPublished1SaleInfoAllowancesStruct, MembershipPublished1SaleInfoStruct, MembershipsDeleted } from "../../build/generated/MembershipsMarketplace/MembershipsMarketplace";
import { getMembershipId } from "../../src/modules/Membership";


let address1:string = '';
let address2:string = '';
let org:string = '';

describe("MembershipsMarketplace", () => {  

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
      let membership = new Membership(getMembershipId(BigInt.fromString('0')));
      membership.organizer = org;
      membership.creatorRoyalty = 15;
      membership.isResellable = true;
      membership.totalAmount = 150;
      membership.isPrivate = false;
      membership.validTickets = [];
      membership.save();
      let balance1 = new Balance("t0x0-".concat(address1));
      balance1.type = 'Membership';
      balance1.amountOwned = 5;
      balance1.event = 'e0x0';
      balance1.membership = membership.id;
      balance1.owner = org;
      balance1.amountOnSell = 5;
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
      param('membershipId', BigInt.fromString('0')),
      param('allowanceId', BigInt.fromString('1')),
      param('allowance', struct)
    ];

    assert.notInStore('Allowance', 'ma-0x1')
    handleAllowanceAdded(event)
    assert.fieldEquals('Allowance', 'ma-0x1', 'id', 'ma-0x1')
  });

  test("Handle allowance consumed", () => {
    let allowance = new Allowance("ma-0x1");
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

    assert.fieldEquals('Allowance', 'ma-0x1', 'amount', '2')
    handleAllowanceConsumed(event)
    assert.fieldEquals('Allowance', 'ma-0x1', 'amount', '1')
  });

  test("Handle allowance removed", () => {
    let allowance = new Allowance("ma-0x1");
    allowance.amount = 2;
    allowance.allowedAddresses = [];
    allowance.save(); 
    let membership = new Membership(getMembershipId(BigInt.fromString('1')));
    membership.organizer = org;
    membership.creatorRoyalty = 15;
    membership.isResellable = true;
    membership.totalAmount = 150;
    membership.isPrivate = false;
    membership.allowances = ['ma-0x1'];
    membership.validTickets = [];
    membership.save(); 
    
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
      param('membershipId', BigInt.fromString('1')),
      param('allowanceId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Allowance', 'ma-0x1', 'amount', '2')
    handleAllowanceRemoved(event)
    assert.notInStore('Allowance', 'ma-0x1')
  });

  test("Handle membership uri modification", () => {
    let membership = new Membership(getMembershipId(BigInt.fromString('1')));
    membership.organizer = org;
    membership.creatorRoyalty = 15;
    membership.isResellable = true;
    membership.totalAmount = 150;
    membership.isPrivate = false;
    membership.name = 'NAME';
    membership.validTickets = [];
    membership.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new MembershipEdited(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_2_membership_metadata.json');

    event.parameters = [
      param('membershipId', BigInt.fromString('1')),
      param('newUri', 'FAKE_URI'),
    ];
    assert.fieldEquals('Membership', 'mem0x1', 'name', 'NAME')
    handleMembershipUriModification(event)
    assert.fieldEquals('Membership', 'mem0x1', 'name', 'FAKE')
  });

  test("Handle membership published", () => {   
    let eventInStorage = new Event("e0x0");
    eventInStorage.organizer = org;
    eventInStorage.attendees = BigInt.fromI32(0);
    eventInStorage.collaborators = [];
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
    
    let event = new MembershipPublished1(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_2_membership_metadata.json');

    let allowance = new MembershipPublished1SaleInfoAllowancesStruct();
    allowance[0] = parseValue(BigInt.fromString('1'));
    allowance[1] = parseValue([]);

    let saleInfo = new MembershipPublished1SaleInfoStruct();
    saleInfo[0] = parseValue(BigInt.fromString('10')); 
    saleInfo[1] = parseValue(BigInt.fromString('0')); 
    saleInfo[2] = parseValue(BigInt.fromString('0')); 
    saleInfo[3] = parseValue(BigInt.fromString('10')); 
    saleInfo[4] = ethereum.Value.fromBoolean(true); 
    saleInfo[5] = parseValue('FAKE_URI'); 
    saleInfo[6] = ethereum.Value.fromBoolean(true); 
    saleInfo[7] = parseValue([allowance]); 
    
    event.parameters = [
      param('organizer', org),
      param('membershipId', BigInt.fromString('1')),
      param('amount', BigInt.fromString('10')),
      param('saleInfo', saleInfo),
      param('uri', 'FAKE_URI'),
    ];

    assert.notInStore('Membership', 'mem0x1')
    handleMembershipPublished(event)
    assert.fieldEquals('Membership', 'mem0x1', 'name', 'FAKE')
    let balanceId = getBalanceId(BigInt.fromString('1'), Address.fromString(org), true);
    assert.fieldEquals('Balance', balanceId, 'amountOwned', '10')
  });

  test("Handle membership deleted", () => {
    let membership = new Membership(getMembershipId(BigInt.fromString('1')));
    membership.organizer = org;
    membership.creatorRoyalty = 15;
    membership.isResellable = true;
    membership.totalAmount = 150;
    membership.isPrivate = false;
    membership.name = 'NAME';
    membership.validTickets = [];
    membership.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      true
    );
    let balance = new Balance(balanceId);
    balance.membership = 'mem0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.type = 'Membership';
    balance.event = 'e0x0';
    balance.isEventOwner = false;
    balance.type = 'Membership';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new MembershipsDeleted(
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
    handleMembershipDeleted(event)
    assert.notInStore('Balance', balanceId)
  });

  test("Handle membership bought", () => {
    let membership = new Membership(getMembershipId(BigInt.fromString('1')));
    membership.organizer = org;
    membership.creatorRoyalty = 15;
    membership.isResellable = true;
    membership.totalAmount = 150;
    membership.isPrivate = false;
    membership.name = 'NAME';
    membership.validTickets = [];
    membership.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      true
    );
    let balance = new Balance(balanceId);
    balance.membership = 'mem0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.askingPrice = BigInt.fromString('10');
    balance.isEventOwner = false;
    balance.type = 'Membership';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new MembershipBought(
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
      param('membershipId', BigInt.fromString('1')),
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('buyer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a'),
      param('price', BigInt.fromString('10')),
      param('amount', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    handleMembershipBought(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '2')
    assert.fieldEquals('Transfer', event.transaction.hash.toHex(), 'isSale', 'true')
  });

  test("Handle ask sememed", () => {
    let membership = new Membership(getMembershipId(BigInt.fromString('1')));
    membership.organizer = org;
    membership.creatorRoyalty = 15;
    membership.isResellable = true;
    membership.totalAmount = 150;
    membership.isPrivate = false;
    membership.name = 'NAME';
    membership.validTickets = [];
    membership.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      true
    );
    let balance = new Balance(balanceId);
    balance.membership = 'mem0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 0;
    balance.isEventOwner = false;
    balance.type = 'Membership';
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
      param('membershipId', BigInt.fromString('1')),
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('membershipPrice', BigInt.fromString('1')),
      param('amount', BigInt.fromString('3')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '0')
    handleAskSetted(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
  });

  test("Handle ask removed", () => {
    let membership = new Membership(getMembershipId(BigInt.fromString('1')));
    membership.organizer = org;
    membership.creatorRoyalty = 15;
    membership.isResellable = true;
    membership.totalAmount = 150;
    membership.isPrivate = false;
    membership.name = 'NAME';
    membership.validTickets = [];
    membership.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      true
    );
    let balance = new Balance(balanceId);
    balance.membership = 'mem0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.isEventOwner = false;
    balance.type = 'Membership';
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
      param('membershipId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    handleAskRemoved(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '0')
  });

  test("Handle royalty modified", () => {
    let membership = new Membership(getMembershipId(BigInt.fromString('1')));
    membership.organizer = org;
    membership.isResellable = true;
    membership.totalAmount = 150;
    membership.isPrivate = false;
    membership.name = 'NAME';
    membership.creatorRoyalty = 1;
    membership.validTickets = [];
    membership.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      true
    );
    let balance = new Balance(balanceId);
    balance.membership = 'mem0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.isEventOwner = false;
    balance.type = 'Membership';
    balance.ticketIdentifiersIds = [];
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new CreatorRoyaltyModifiedOnMembership(
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
      param('membershipId', BigInt.fromString('1')),
      param('newRoyalty', BigInt.fromString('2')),
    ];

    assert.fieldEquals('Membership', membership.id, 'creatorRoyalty', '1')
    handleCreatorRoyaltyModifiedOnMembership(event)
    assert.fieldEquals('Membership', membership.id, 'creatorRoyalty', '2')
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
  handleCreatorRoyaltyModifiedOnMembership, 
  handleMembershipBought,
  handleMembershipDeleted, 
  handleMembershipPublished, 
  handleMembershipUriModification
}