import {
  eventCreated,
  ticketBought,
  AskSetted,
  AskRemoved,
  eventDeleted,
  eventEdited
} from "../generated/FanszoidMarketplace/FanszoidMarketplace";
import { Event, Ticket, TicketType } from "../generated/schema";
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
import { store } from '@graphprotocol/graph-ts'

export function handleEventCreated(event: eventCreated): void {
  let organizerUser = loadOrCreateUser(event.params.organizer);
  let eventEntity = loadOrCreateEvent(
    event.params.eventId,
    event.params.organizer
  );

  eventEntity.metadata = event.params.uri;
  eventEntity.organizer = organizerUser.address.toHex();
  eventEntity.save();
}

export function handleTicketBought(event: ticketBought): void {
  let ticketTypeId = getTicketTypeId(event.params.tokenId);
  let ticketType = TicketType.load(ticketTypeId);
  if (ticketType == null) {
    log.error("TicketType not found, id : {}", [ticketTypeId]);
    return;
  }

  let ticketEventEntity = Event.load(ticketType.event);
  if (ticketEventEntity == null) {
    log.error("Event not found for ticket type, id : {}", [ticketType.id]);
    return;
  }

  let sellerUser = loadOrCreateUser(event.params.seller);
  let buyerUser = loadOrCreateUser(event.params.buyer);

  // Seller
  if (sellerUser.address.toHex() == ticketEventEntity.organizer) {
    // Ticket sold by the organizer ( primary market ).

    if (ticketTypeHasSupply(ticketType)) {
      if (!ticketTypePriceMatches(event.params.price, ticketType)) {
        log.error("Incorrect price on primary ticket sale, price: {}", [
          event.params.price.toHex(),
        ]);
        return;
      }

      ticketType.primarySupply = ticketType.primarySupply - 1;
    } else {
      log.error(
        "No supply on primary market for ticket, id: {}, and user: {}",
        [event.params.tokenId.toHex(), event.params.seller.toHex()]
      );
    }
  } else {
    // Ticket sold on Secondary market.

    let sellerTicketId = getTicketId(event.params.tokenId, event.params.seller);
    let sellerTicket = Ticket.load(sellerTicketId);

    if (sellerTicket != null && ticketHasAmountAvailable(sellerTicket)) {
      if (!ticketPriceMatches(event.params.price, sellerTicket)) {
        log.error("Incorrect price on ticket sale, price: {}", [
          event.params.price.toHex(),
        ]);
        return;
      }

      sellerTicket.amount = sellerTicket.amount - 1;
      sellerTicket.save();
    } else {
      log.error(
        "Seller ticket not found or no amount left for id: {}, and user: {}",
        [event.params.tokenId.toHex(), event.params.seller.toHex()]
      );
    }
  }

  // Buyer

  if (buyerUser.address.toHex() != ticketEventEntity.organizer) {
    let buyerTicketId = getTicketId(event.params.tokenId, event.params.buyer);
    let buyerTicket = Ticket.load(buyerTicketId);

    if (buyerTicket == null) {
      buyerTicket = new Ticket(buyerTicketId);
      buyerTicket.ticketType = ticketTypeId;
      buyerTicket.event = ticketType.event;
      buyerTicket.amount = 1;
      buyerTicket.owner = buyerUser.address.toHex();

      buyerTicket.save();
    } else {
      if (ticketHasAmountAvailable(buyerTicket)) {
        buyerTicket.amount = buyerTicket.amount + 1;
      } else {
        buyerTicket.amount = 1;
      }

      buyerTicket.save();
    }
  } else {
    // Ticket bought by the organizer of the event, rather infrequent.

    if (ticketTypeHasSupply(ticketType)) {
      ticketType.primarySupply = ticketType.primarySupply + 1;
    } else {
      ticketType.primarySupply = 1;
    }
  }

  ticketType.save();
}

export function handleAskSetted(event: AskSetted): void {
  let ticketType = TicketType.load(getTicketTypeId(event.params.tokenId));
  if (ticketType == null) {
    log.error("TicketType not found, id : {}", [event.params.tokenId.toHex()]);
    return;
  }

  let ticketEventEntity = Event.load(ticketType.event);
  if (ticketEventEntity == null) {
    log.error("Event not found for ticket type, id : {}", [ticketType.id]);
    return;
  }

  if (event.params.seller.toHex() != ticketEventEntity.organizer) {
    let sellerTicketId = getTicketId(event.params.tokenId, event.params.seller);
    let ticket = Ticket.load(sellerTicketId);
    if (ticket == null) {
      ticket = new Ticket(sellerTicketId);
      ticket.ticketType = ticketType.id;
      ticket.ticketType = ticketType.event;
      ticket.amount = 0;
      ticket.owner = event.params.seller.toHex();
    }
    ticket.askingPrice = event.params.askingPrice;

    ticket.save();
  } else {
    // changed askingPrice on primary market.
    ticketType.primaryAskingPrice = event.params.askingPrice;

    ticketType.save();
  }
}

export function handleAskRemoved(event: AskRemoved): void {
  let ticketType = TicketType.load(getTicketTypeId(event.params.tokenId));
  if (ticketType == null) {
    log.error("TicketType not found, id : {}", [event.params.tokenId.toHex()]);
    return;
  }

  let ticketEventEntity = Event.load(ticketType.event);
  if (ticketEventEntity == null) {
    log.error("Event not found for ticket type, id : {}", [ticketType.id]);
    return;
  }

  if (event.params.seller.toHex() != ticketEventEntity.organizer) {
    let sellerTicketId = getTicketId(event.params.tokenId, event.params.seller);
    let ticket = Ticket.load(sellerTicketId);
    if (ticket == null) {
      ticket = new Ticket(sellerTicketId);
      ticket.ticketType = ticketType.id;
      ticket.event = ticketType.event;
      ticket.amount = 0;
      ticket.owner = event.params.seller.toHex();
    }
    ticket.askingPrice = null;

    ticket.save();
  } else {
    // removed askingPrice on primary market.
    ticketType.primaryAskingPrice = null;

    ticketType.save();
  }
}


export function handleEventEdited(event: eventEdited): void {
  let eventEntity = Event.load(getEventId(event.params.eventId, event.params.organizer));
  if (eventEntity == null) {
    log.error("Event not found, id : {}", [event.params.eventId.toHex()]);
    return;
  }

  eventEntity.metadata = event.params.uri;
  eventEntity.save();
}


export function handleEventDeleted(event: eventDeleted): void {
  store.remove('Event', getEventId(event.params.eventId, event.params.organizer))
}