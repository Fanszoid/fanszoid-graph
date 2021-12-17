import { ticketsPublished } from '../generated/TicketsNFT/TicketsNFT'
import { Event, TicketType, Ticket } from '../generated/schema'
import { log } from '@graphprotocol/graph-ts'

export function handleTicketsPublished(event: ticketsPublished): void {
  let eventId = event.params.eventId.toHex()
  let eventEntity = Event.load(eventId)

  if (eventEntity != null) {
    for( let i=0 ; i < event.params.ticketTypesCount.toI32() ; i++ ){
        let ticketType = new TicketType(event.params.newTokenIds[i].toHex())
        ticketType.event = eventId
        ticketType.creatorRoyalty = event.params.creatorRoyalties[i]
        ticketType.save()

        let ticket = new Ticket(event.params.newTokenIds[i].toHex() + '-' + event.params.publisher.toHex())
        ticket.ticketType = event.params.newTokenIds[i].toHex()
        ticket.askingPrice = event.params.askingPrices[i]
        ticket.amount = event.params.amounts[i]
        ticket.owner = event.params.publisher.toHex()
        ticket.save()
    }
  } else {
    log.error("Event not found, ID : ", [event.params.eventId.toHex()])
  }
}