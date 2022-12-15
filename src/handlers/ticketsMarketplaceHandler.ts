import {
  TicketPublished,
  TicketsDeleted,
  AskSetted,
  AskRemoved,
  TicketBought,
  CreatorRoyaltyModifiedOnTicket,
  TicketEdited,
  AllowanceAdded,
  AllowanceConsumed,
  AllowanceRemoved,
  TicketDeleted,
  TicketPublished1,
  AskSetted1,
  TicketPublished2
} from "../../build/generated/TicketsMarketplace/TicketsMarketplace";
import { Ticket, Balance, Allowance } from "../../build/generated/schema";
import { 
  loadOrCreateEvent,
} from "../modules/Event";
import {
  getTicketId, loadOrCreateTicket, ticketAttrs,
} from "../modules/Ticket";
import {
  loadOrCreateTransfer,
} from "../modules/Transfer";
import { 
  getBalanceId,
  balanceHasNAmountAvailable,
  balanceHasNAmountOnSell,
  balancePriceMatches,
  getAllowanceId,
  loadOrCreateAllowances,
} from "../modules/Balance";
import { store, log, Address } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils";
import { createRestrictionForTicketForMetadata } from "../modules/Restriction";

export function handleAllowanceAdded(event: AllowanceAdded): void {
  let allowance = new Allowance(getAllowanceId(event.params.allowanceId, false));
  allowance.amount = event.params.allowance.amount.toI32();
  allowance.allowedAddresses = event.params.allowance.allowedAddresses.map<string>( (add:Address) => add.toHex());
  allowance.save();
  let ticketId = getTicketId(event.params.ticketId)
  let ticketEntity = Ticket.load(ticketId);
  if (!ticketEntity) {
    // not created yet. create it empty, it will be filled by handleTicketPublished
    ticketEntity = new Ticket(ticketId);

    ticketEntity.creatorRoyalty = 0;
    ticketEntity.isResellable = false;
    ticketEntity.totalAmount = 0;
    ticketEntity.isPrivate = false;
    ticketEntity.allowances = [allowance.id];
    ticketEntity.minAmountRestrictions = 0;
    ticketEntity.restrictions = [];
    
  } else {
    let allowances = ticketEntity.allowances || []
    if(allowances && allowances.length > 0) {
      allowances.push(allowance.id)
    } else {
      allowances = [allowance.id];
    }
    ticketEntity.allowances = allowances
  }

  ticketEntity.save();
}

export function handleAllowanceConsumed(event: AllowanceConsumed): void {
  let allowance = Allowance.load(getAllowanceId(event.params.allowanceId, false));
  if (!allowance) {
    log.error("Allowance Not Found on handleAllowanceConsumed. id : {}", [event.params.allowanceId.toString()]);
    return;
  }
  allowance.amount--;
  allowance.save();
}

export function handleAllowanceRemoved(event: AllowanceRemoved): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if (!ticketEntity) {
    log.error("Ticket Not Found on handleAllowanceRemoved. id : {}", [event.params.ticketId.toString()]);
    return;
  }
  let allowanceLoaded = Allowance.load(getAllowanceId(event.params.allowanceId, false));
  if (!allowanceLoaded) {
    log.error("Allowance Not Found on handleAllowanceRemoved. id : {}", [event.params.allowanceId.toString()]);
    return;
  }
  let index = ticketEntity.allowances!.indexOf(allowanceLoaded.id);
  if (  ticketEntity.allowances === null || index == -1) {
    log.error("Allowance Not Found on saved. id : {}", [allowanceLoaded.id.toString()]);
    return;
  }
  let aux = ticketEntity.allowances || [];
  aux!.splice(index, 1);
  ticketEntity.allowances = aux;
  ticketEntity.save();
  store.remove(
    'Allowance',
    getAllowanceId(event.params.allowanceId, false)
  );
}

export function handleTicketUriModification(event: TicketEdited): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if (!ticketEntity) {
    log.error("Ticket Not Found on handleTicketUriModification. id : {}", [event.params.ticketId.toString()]);
    return;
  }
  let parsed = parseMetadata(event.params.newUri, ticketEntity, ticketAttrs);
  let parsedRestrictions = createRestrictionForTicketForMetadata(ticketEntity, event.params.newUri);
  if(!parsedRestrictions) {
    ticketEntity.minAmountRestrictions = 0;
    ticketEntity.restrictions = [];
  }

  if(parsed) { 
    ticketEntity.metadata = event.params.newUri;
    ticketEntity.save();
  } else {
    log.error("Error parsing metadata on handleTicketUriModification, metadata hash is: ", [event.params.newUri])
  }
}

export function handleTicketPublished(event: TicketPublished2): void {
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );
    
  let ticket = loadOrCreateTicket(event.params.ticketId);  
  ticket.event = eventEntity.id;
  ticket.creatorRoyalty = event.params.saleInfo.royalty.toI32();
  ticket.isResellable = event.params.saleInfo.isResellable;
  ticket.metadata = event.params.uri;
  ticket.totalAmount = event.params.amount.toI32();
  ticket.isPrivate = event.params.saleInfo.isPrivate;
  
  let parsed = parseMetadata(event.params.uri, ticket, ticketAttrs);

  let parsedRestrictions = createRestrictionForTicketForMetadata(ticket, event.params.uri);
  if(!parsedRestrictions) {
    ticket.minAmountRestrictions = 0;
    ticket.restrictions = [];
  }
  
  if(parsed) {
    ticket.save();
    
    let ticketBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.organizer, false));
    if( ticketBalance !== null ){
      log.error("handleTicketPublished: Balance already existed, id : {}", [getBalanceId(event.params.ticketId, event.params.organizer, false)]);
      return;
    }
    ticketBalance = new Balance(getBalanceId(event.params.ticketId, event.params.organizer, false));
    ticketBalance.type = 'Ticket';
    ticketBalance.ticket = ticket.id;
    ticketBalance.event = eventEntity.id;
    ticketBalance.askingPrice = event.params.saleInfo.price;
    ticketBalance.amountOnSell = event.params.saleInfo.amountToSell.toI32();
    ticketBalance.amountOwned = event.params.amount.toI32();
    ticketBalance.owner = event.params.organizer.toHex();
    ticketBalance.isEventOwner = true;
    ticketBalance.paymentTokenAddress = event.params.saleInfo.paymentTokenAddress.toHex();

    ticketBalance.save();
  } else {
    log.error("Error parsing metadata on handleTicketPublished, metadata hash is: {}", [event.params.uri])
  }
}

export function handleTicketDeleted(event: TicketsDeleted): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.amounts[i].toI32();
    let ticketBalanceId = getBalanceId(id, event.params.owner, false)
    let ticketBalance = Balance.load(ticketBalanceId);
    if(ticketBalance == null ){
      log.error("ticketBalance not found, id : {}", [ticketBalanceId]);
      return;
    }

    if( !balanceHasNAmountAvailable(ticketBalance, amount) ) {
      log.error("Not enough amount owned on ticketBalance, id : {}", [ticketBalanceId]);
      return;
    }

    ticketBalance.amountOwned = ticketBalance.amountOwned - amount;
    if( ticketBalance.amountOwned == 0 ) {
      store.remove(
        "Balance",
        ticketBalanceId
      );
    } else {
      ticketBalance.save()
    }

  }
}

/* 
  the handling on transferSingle/transferBatch does most of the entity updating for the ticket balances.
*/
export function handleTicketBought(event: TicketBought): void {
  let amount = event.params.amount.toI32();

  let sellerBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.seller, false));

  if( sellerBalance == null ){
    log.error("sellerBalance not found on handleTicketBought. id : {}", [getBalanceId(event.params.ticketId, event.params.seller, false)]);
    return;
  }
  if( !balanceHasNAmountOnSell(sellerBalance, amount)  ){
    log.error("sellerBalance.amountOnSell not enough on internalTransferToken. balance amount: {}, transfer value: {}", [sellerBalance.amountOnSell.toString(), amount.toString()]);
    return;
  }
  if( !balancePriceMatches(event.params.price, sellerBalance) ) {
    log.error("sellerBalance incongruent price on handleTicketBought. id : {}, tx price: {}", [getBalanceId(event.params.ticketId, event.params.seller, false), event.params.price.toHex()]);
    return;
  }

  sellerBalance.amountOnSell = sellerBalance.amountOnSell - amount;

  sellerBalance.save();

  let transfer = loadOrCreateTransfer(event.transaction.hash.toHex());
  transfer.price = event.params.price;
  transfer.isSale = true;

  transfer.save()
}

export function handleAskSetted(event: AskSetted1): void {
  let ticketBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.seller, false));
  if(ticketBalance != null ) {
    ticketBalance.amountOnSell = event.params.amount.toI32();
    ticketBalance.askingPrice = event.params.ticketPrice;
    ticketBalance.paymentTokenAddress = event.params.paymentTokenAddress.toHex();
    
    ticketBalance.save();
  } else {
    log.error("ticketBalance not found on handleAskSetted. id : {}", [getBalanceId(event.params.ticketId, event.params.seller, false)]);
    return;
  }
}

export function handleAskRemoved(event: AskRemoved): void {
  let ticketBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.seller, false));
  if(ticketBalance != null ) {
    ticketBalance.amountOnSell = 0;
    ticketBalance.askingPrice = null;
    
    ticketBalance.save();
  } else {
    log.error("ticketBalance not found on handleAskRemoved. id : {}", [getBalanceId(event.params.ticketId, event.params.seller, false)]);
    return;
  }
}

export function handleCreatorRoyaltyModifiedOnTicket(event: CreatorRoyaltyModifiedOnTicket): void {
  let ticket = Ticket.load(getTicketId(event.params.ticketId));
  if(ticket == null ) {
    log.error("Ticket not found on handleCreatorRoyaltyModifiedOnTicket. id : {}", [event.params.ticketId.toHex()]);
    return;
  }

  ticket.creatorRoyalty = event.params.newRoyalty.toI32();
  ticket.save();
}




/////////   Legacy    /////////////

export function handleTicketDeletedLegacy(event: TicketDeleted): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.amounts[i].toI32();
    let ticketBalanceId = getBalanceId(id, event.params.owner, false)
    let ticketBalance = Balance.load(ticketBalanceId);
    if(ticketBalance == null ){
      log.error("ticketBalance not found, id : {}", [ticketBalanceId]);
      return;
    }
    if( !balanceHasNAmountAvailable(ticketBalance, amount) ) {
      log.error("Not enough amount owned on ticketBalance, id : {}", [ticketBalanceId]);
      return;
    }
    ticketBalance.amountOwned = ticketBalance.amountOwned - amount;
    if( ticketBalance.amountOwned == 0 ) {
      store.remove(
        "Balance",
        ticketBalanceId
      );
    } else {
      ticketBalance.save()
    }
  }
}

export function handleTicketPublishedLegacyLegacy(event: TicketPublished): void {
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );

  let ticketId = getTicketId(event.params.ticketId);
  let ticket = Ticket.load(ticketId);
  if (ticket == null) {
    ticket = new Ticket(ticketId);
  } else {
    log.error("Warning: ticket already existed on handleTicketPublished. id : {}", [event.params.ticketId.toString()]);
  }

  ticket.event = eventEntity.id;
  ticket.creatorRoyalty = event.params.creatorRoyalty.toI32();
  ticket.isResellable = event.params.isResellable;
  ticket.metadata = event.params.uri;
  ticket.totalAmount = event.params.amount.toI32();
  ticket.isPrivate = false;

  let parsed = parseMetadata(event.params.uri, ticket, ticketAttrs);
  let parsedRestrictions = createRestrictionForTicketForMetadata(ticket, event.params.uri);
  if(!parsedRestrictions) {
    ticket.minAmountRestrictions = 0;
    ticket.restrictions = [];
  }

  if(parsed) {
    ticket.save();
    let ticketBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.organizer, false));
    if( ticketBalance !== null ){
      log.error("handleTicketPublished: Balance already existed, id : {}", [getBalanceId(event.params.ticketId, event.params.organizer, false)]);
      return;
    }
    ticketBalance = new Balance(getBalanceId(event.params.ticketId, event.params.organizer, false));
    ticketBalance.type = 'Ticket';
    ticketBalance.ticket = ticketId;
    ticketBalance.event = eventEntity.id;
    ticketBalance.askingPrice = event.params.price;
    ticketBalance.amountOnSell = event.params.amountToSell.toI32();
    ticketBalance.amountOwned = event.params.amount.toI32();
    ticketBalance.owner = event.params.organizer.toHex();
    ticketBalance.isEventOwner = true;
    ticketBalance.paymentTokenAddress = '0x0000000000000000000000000000000000000000';

    ticketBalance.save();
  } else {
    log.error("Error parsing metadata on handleTicketPublishedLegacy, metadata hash is: {}", [event.params.uri])
  }
  
}

export function handleTicketPublishedLegacy(event: TicketPublished1): void {
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );
    
  let ticket = loadOrCreateTicket(event.params.ticketId);  
  ticket.event = eventEntity.id;
  ticket.creatorRoyalty = event.params.saleInfo.royalty.toI32();
  ticket.isResellable = event.params.saleInfo.isResellable;
  ticket.metadata = event.params.uri;
  ticket.totalAmount = event.params.amount.toI32();
  ticket.isPrivate = event.params.saleInfo.isPrivate;
  
  let parsed = parseMetadata(event.params.uri, ticket, ticketAttrs);
  let parsedRestrictions = createRestrictionForTicketForMetadata(ticket, event.params.uri);
  if(!parsedRestrictions) {
    ticket.minAmountRestrictions = 0;
    ticket.restrictions = [];
  }

  
  if(parsed) {
    ticket.save();
    
    let ticketBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.organizer, false));
    if( ticketBalance !== null ){
      log.error("handleTicketPublished: Balance already existed, id : {}", [getBalanceId(event.params.ticketId, event.params.organizer, false)]);
      return;
    }
    ticketBalance = new Balance(getBalanceId(event.params.ticketId, event.params.organizer, false));
    ticketBalance.type = 'Ticket';
    ticketBalance.ticket = ticket.id;
    ticketBalance.event = eventEntity.id;
    ticketBalance.askingPrice = event.params.saleInfo.price;
    ticketBalance.amountOnSell = event.params.saleInfo.amountToSell.toI32();
    ticketBalance.amountOwned = event.params.amount.toI32();
    ticketBalance.owner = event.params.organizer.toHex();
    ticketBalance.isEventOwner = true;
    ticketBalance.paymentTokenAddress = '0x0000000000000000000000000000000000000000';

    ticketBalance.save();
  } else {
    log.error("Error parsing metadata on handleTicketPublished, metadata hash is: {}", [event.params.uri])
  }
}

export function handleAskSettedLegacy(event: AskSetted): void {
  let ticketBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.seller, false));
  if(ticketBalance != null ) {
    ticketBalance.amountOnSell = event.params.amount.toI32();
    ticketBalance.askingPrice = event.params.ticketPrice;
    ticketBalance.paymentTokenAddress = '0x0000000000000000000000000000000000000000';
    
    ticketBalance.save();
  } else {
    log.error("ticketBalance not found on handleAskSetted. id : {}", [getBalanceId(event.params.ticketId, event.params.seller, false)]);
    return;
  }
}