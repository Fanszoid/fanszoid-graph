import { ticketsPublished } from "../generated/TicketsNFT/TicketsNFT";
import { Event, TicketType, Ticket } from "../generated/schema";
import { getEventId } from "../modules/Event";
import { getTicketTypeId } from "../modules/TicketType";
import { log } from "@graphprotocol/graph-ts";

export function handleTicketsPublished(event: ticketsPublished): void {
  let eventId = getEventId(event.params.eventId, event.params.publisher);
  let eventEntity = Event.load(eventId);

  if (eventEntity != null) {
    for (let i = 0; i < event.params.ticketTypesCount.toI32(); i++) {
      let ticketType = new TicketType(getTicketTypeId(event.params.newTokenIds[i]));
      ticketType.event = eventId;
      ticketType.creatorRoyalty = event.params.creatorRoyalties[i].toI32();
      ticketType.primaryAskingPrice = event.params.askingPrices[i];

      if( event.params.amounts[i].isI32() ) {
        ticketType.primarySupply = event.params.amounts[i].toI32();
        ticketType.initialAmount = event.params.amounts[i].toI32();
      } else {
        log.error("ticket supply too big!, ID : ", [eventId])
      }
      ticketType.metadata = event.params.uris[i];
      ticketType.save();
    }
  } else {
    log.error("Event not found, ID : ", [eventId]);
  }
}

/*
        let ticket = new Ticket(event.params.newTokenIds[i].toHex() + '-' + event.params.publisher.toHex())
        ticket.ticketType = event.params.newTokenIds[i].toHex()
        ticket.askingPrice = event.params.askingPrices[i]
        ticket.amount = event.params.amounts[i]
        ticket.owner = event.params.publisher.toHex()
        ticket.save()
*/
