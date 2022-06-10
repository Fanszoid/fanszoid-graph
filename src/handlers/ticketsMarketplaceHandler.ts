import {
  TicketPublished,
  TicketsDeleted,
  AskSetted,
  AskRemoved,
  TicketBought,
  CreatorRoyaltyModifiedOnTicket,
  TicketEdited
} from "../../build/generated/TicketsMarketplace/TicketsMarketplace";
import { Ticket, Balance } from "../../build/generated/schema";
import { 
  loadOrCreateEvent,
} from "../modules/Event";
import {
  getTicketId, ticketAttrs,
} from "../modules/Ticket";
import {
  loadOrCreateTransfer,
} from "../modules/Transfer";
import { 
  getBalanceId,
  balanceHasNAmountAvailable,
  balanceHasNAmountOnSell,
  balancePriceMatches,
} from "../modules/Balance";
import { store, log } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils";

export function handleTicketUriModification(event: TicketEdited): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if (!ticketEntity) {
    log.error("Ticket Not Found on handleTicketUriModification. id : {}", [event.params.ticketId.toString()]);
    return;
  }
  parseMetadata(event.params.newUri, ticketEntity, ticketAttrs);
  ticketEntity.metadata = event.params.newUri;
  ticketEntity.save();
}

export function handleTicketPublished(event: TicketPublished): void {
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
  ticket.creatorRoyalty = event.params.saleInfo.royalty.toI32();
  ticket.isResellable = event.params.saleInfo.isResellable;
  ticket.metadata = event.params.uri;
  ticket.totalAmount = event.params.amount.toI32();
  ticket.isPrivate = event.params.saleInfo.isPrivate;
  
  parseMetadata(event.params.uri, ticket, ticketAttrs);
  
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
  ticketBalance.askingPrice = event.params.saleInfo.price;
  ticketBalance.amountOnSell = event.params.saleInfo.amountToSell.toI32();
  ticketBalance.amountOwned = event.params.amount.toI32();
  ticketBalance.owner = event.params.organizer.toHex();
  ticketBalance.isEventOwner = true;

  ticketBalance.save();
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

export function handleAskSetted(event: AskSetted): void {
  let ticketBalance = Balance.load(getBalanceId(event.params.ticketId, event.params.seller, false));
  if(ticketBalance != null ) {
    ticketBalance.amountOnSell = event.params.amount.toI32();
    ticketBalance.askingPrice = event.params.ticketPrice;
    
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
