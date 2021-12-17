import { eventCreated, ticketBought, AskSetted, AskRemoved } from '../generated/FanszoidMarketplace/FanszoidMarketplace'
import { Event, Ticket, TicketType } from '../generated/schema'
import { loadOrCreateUser } from '../modules/User'
import { log } from '@graphprotocol/graph-ts'

export function handleEventCreated(event: eventCreated): void {
  let organizerUser  = loadOrCreateUser(event.params.organizer)

  let eventId = event.params.eventId.toHex()
  let eventEntity = Event.load(eventId)
  if (eventEntity == null) {
    eventEntity = new Event(eventId)
  }
  eventEntity.organizer = organizerUser.id
  eventEntity.save()
}

export function handleTicketBought(event: ticketBought): void {
    let ticketType = TicketType.load(event.params.tokenId.toHex())
    if (ticketType == null) {
      log.error("TicketType not found, id : {}", [event.params.tokenId.toHex()])
      return;
    }

    let sellerTicket = Ticket.load(event.params.tokenId.toHex() + '-' + event.params.seller.toHex())
    let buyerTicket = Ticket.load(event.params.tokenId.toHex() + '-' + event.params.buyer.toHex())

    if(sellerTicket != null && sellerTicket.amount > 0){
      if( sellerTicket.askingPrice == null || sellerTicket.askingPrice != event.params.price) {
        log.error("Incorrect price on ticket sale, price: {}", [event.params.price.toHex()])
      }

      sellerTicket.amount -= 1

      if(buyerTicket == null) {
        buyerTicket = new Ticket(event.params.tokenId.toHex() + '-' + event.params.buyer.toHex())
        buyerTicket.ticketType = event.params.tokenId.toHex()
        buyerTicket.amount = 1
        buyerTicket.owner = event.params.buyer.toHex()
      } else {
        buyerTicket.amount += 1
      }
      buyerTicket.save()
    } else {
      log.error("Seller ticket not found or no amount left for id: {}, and user: {}", [event.params.tokenId.toHex(), event.params.seller.toHex()])
    }
  }

export function handleAskSetted(event: AskSetted): void {
  let ticket = Ticket.load(event.params.tokenId.toHex() + '-' + event.params.seller.toHex())
  if(ticket == null) {
    ticket = new Ticket(event.params.tokenId.toHex() + '-' + event.params.seller.toHex())
    ticket.ticketType = event.params.tokenId.toHex()
    ticket.amount = 0
    ticket.owner = event.params.seller.toHex()
    
  }
  ticket.askingPrice = event.params.askingPrice

  ticket.save()
}

export function handleAskRemoved(event: AskRemoved): void {
  let ticket = Ticket.load(event.params.tokenId.toHex() + '-' + event.params.seller.toHex())
  if(ticket == null) {
    ticket = new Ticket(event.params.tokenId.toHex() + '-' + event.params.seller.toHex())
    ticket.ticketType = event.params.tokenId.toHex()
    ticket.amount = 0
    ticket.owner = event.params.seller.toHex()
    
  }
  ticket.askingPrice = null
  
  ticket.save()
}