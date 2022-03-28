import {
  eventCreated,
  ticketBought,
  AskSetted,
  AskRemoved,
  eventDeleted,
  eventEdited,
} from "../generated/FanszoidMarketplace/FanszoidMarketplace";
import { Event, Ticket, TicketBalance } from "../generated/schema";
import { loadOrCreateUser } from "../modules/User";
import { loadOrCreateEvent } from "../modules/Event";
import {
  getTicketTypeId,
  ticketTypeHasSupply,
  ticketTypePriceMatches,
} from "../modules/TicketType";
import { getEventId } from "../modules/Event";
import {
  getTicketId,
  ticketHasAmountAvailable,
  ticketPriceMatches,
} from "../modules/Ticket";
import { log, BigInt } from "@graphprotocol/graph-ts";
import { store } from "@graphprotocol/graph-ts";


export function handleTicketPublished(event: TicketPublished): void {
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );

  let ticketTypeId = getTicketTypeId(event.params.ticketId);
  let ticketType = Ticket.load(ticketTypeId);
  if (ticketType != null) {
    log.error("handleTicketPublished: TicketType already existed, id : {}", [ticketTypeId]);
    return;
  }

  ticketType = new Ticket(ticketTypeId);

  ticketType.event = eventEntity.id;
  ticketType.creatorRoyalty = event.params.creatorRoyalty.toI32();
  ticketType.isResellable = event.params.isResellable;
  ticketType.metadata = event.params.uri;
  ticketType.totalAmount = event.params.amount.toI32();
  
  ticketType.save();

  let ticketBalance = TicketBalance.loadOrCreateTicketBalance(event.params.ticketId, event.params.organizer);
  ticketBalance.ticket = ticketTypeId;
  ticketBalance.event = eventEntity.id;
  ticketBalance.askingPrice = event.params.price;
  ticketBalance.amountOnSell = event.params.amountToSell.toI32();
  ticketBalance.amountOwned = event.params.amount.toI32();
  ticketBalance.owner = event.params.organizer.toHex();
  ticketBalance.isEventOwner = true;

  ticketBalance.save();
}

export function handleEventCreated(event: EventCreated): void {
  let organizerUser = loadOrCreateUser(event.params.organizer);
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );

  eventEntity.metadata = event.params.uri;
  eventEntity.organizer = organizerUser.address.toHex();
  eventEntity.save();
}

export function handleEventDeleted(event: EventDeleted): void {
  store.remove(
    "Event",
    getEventId(event.params.eventId)
  );
}


export function handleTicketDeleted(event: TicketDeleted): void {
  for (let i = 0; i < event.params.ids.length; i++) {

    let id = event.params.ids[i];
    let amount = event.params.amounts[i].toI32();

    let ticketBalance = TicketBalance.load(getTicketBalanceId(id, event.params.owner));
    if(ticketBalance == null ){
      log.error("ticketBalance not found, id : {}", [getTicketBalanceId(id, event.params.owner)]);
      return;
    }

    if( ticketBalance.amountOwned < amount ) {
      log.error("Not enough amount owned on ticketBalance, id : {}", [getTicketBalanceId(id, event.params.owner)]);
      return;
    }

    ticketBalance.amountOwned = ticketBalance.amountOwned - amount;
    if( ticketBalance.amountOwned == 0 ) {
      store.remove(
        "TicketBalance",
        getTicketBalanceId(id, event.params.owner)
      );
    } else {
      ticketBalance.save()
    }

  }
}

/* 
  the handling on transferSingle/transferBatch does most of the entity updating for the ticket sale.
*/
export function handleTicketBought(event: TicketBought): void {
  let amount = event.params.amount.toI32();

  let sellerTicketBalance = TicketBalance.loadOrCreateTicketBalance(event.params.ticketId, event.params.seller);

  if( sellerTicketBalance == null ){
    log.error("sellerTicketBalance not found on handleTicketBought. id : {}", [sellerTicketBalance.id]);
    return;
  }
  if(sellerTicketBalance.amountOnSell < amount){
    log.error("fromTicketBalance.amountOnSell not enough on internalTransferToken. balance amount: {}, transfer value: {}", [sellerTicketBalance.amountOnSell, amount.toHex()]);
    return;
  }
  if( sellerTicketBalance.askingPrice != event.params.price ) {
    log.error("sellerTicketBalance incongruent price on handleTicketBought. id : {}, tx price: {}, askingPrice: {}", [getTicketBalanceId(event.params.ticketId, event.params.seller), event.params.price, sellerTicketBalance.askingPrice ]);
    return;
  }

  sellerTicketBalance.amountOnSell = sellerTicketBalance.amountOnSell - amount;

  sellerTicketBalance.save();

  let transfer = loadOrCreateTransfer(event.transaction.hash.toHex());
  transfer.price = event.params.price;
  transfer.isSale = true;

  transfer.save()
}

export function handleAskSetted(event: AskSetted): void {
  let ticketBalance = TicketBalance.load(getTicketBalanceId(event.params.ticketId, event.params.seller));
  if(ticketBalance != null ) {
    ticketBalance.amountOnSell = ticketBalance.amountOnSell + event.params.amount.toI32();
    ticketBalance.askingPrice = event.params.ticketPrice;
    
    ticketBalance.save();
  } else {
    log.error("ticketBalance not found on handleAskSetted. id : {}", [getTicketBalanceId(event.params.ticketId, event.params.seller)]);
    return;
  }
}

export function handleAskRemoved(event: AskRemoved): void {
  let ticketBalance = TicketBalance.load(getTicketBalanceId(event.params.ticketId, event.params.seller));
  if(ticketBalance != null ) {
    ticketBalance.amountOnSell = null;
    ticketBalance.askingPrice = null;
    
    ticketBalance.save();
  } else {
    log.error("ticketBalance not found on handleAskRemoved. id : {}", [getTicketBalanceId(event.params.ticketId, event.params.seller)]);
    return;
  }
}

export function handleEventOwnershipTransferred(event: EventOwnershipTransferred): void {
  let eventEntity = Event.load(event.params.eventId.toHex());
  if(eventEntity == null ) {
    log.error("Event not found on handleEventOwnershipTransferred. id : {}", [event.params.eventId.toHex()]);
    return;
  }

  let ownerUser = loadOrCreateUser(event.params.newOwner);
  eventEntity.organizer = ownerUser.id;

  eventEntity.save();

  eventEntity.ticketBalances.forEach( tb => {
    let ticketBalance = TicketBalances.load(tb);
    if(ticketBalance == null ) {
      log.error("TicketBalance not found on handleEventOwnershipTransferred. id : {}", [tb]);
      return;
    }

    ticketBalance.isEventOwner = ticketBalance.owner == ownerUser.id;
    ticketBalance.save();
  });
}

export function handleCreatorRoyaltyModifiedOnEvent(event: CreatorRoyaltyModifiedOnEvent): void {
  let eventEntity = Event.load(event.params.eventId.toHex());
  if(eventEntity == null ) {
    log.error("Event not found on handleEventOwnershipTransferred. id : {}", [event.params.eventId.toHex()]);
    return;
  }

  eventEntity.tickets.forEach( t => {
    let ticket = Ticket.load(t);
    if(ticket == null ) {
      log.error("Ticket not found on handleCreatorRoyaltyModifiedOnEvent. id : {}", [t]);
      return;
    }

    ticket.creatorRoyalty = event.params.newRoyalty.toI32();
    ticket.save();
  });
}

export function handleCreatorRoyaltyModifiedOnTicket(event: CreatorRoyaltyModifiedOnTicket): void {
  let ticket = Ticket.load(event.params.ticketId.toHex());
  if(ticket == null ) {
    log.error("Ticket not found on handleCreatorRoyaltyModifiedOnTicket. id : {}", [event.params.ticketId.toHex()]);
    return;
  }

  ticket.creatorRoyalty = event.params.newRoyalty.toI32();
  ticket.save();
}
