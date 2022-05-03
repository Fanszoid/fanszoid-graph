import {
  EventCreated,
  EventDeleted,
  EventOwnershipTransferred,
  CreatorRoyaltyModifiedOnEvent,
  EventEdited
} from "../../build/generated/Admin/Admin";
import { Event, Ticket, Balance } from "../../build/generated/schema";
import { loadOrCreateUser } from "../modules/User";
import { 
  loadOrCreateEvent,
  getEventId,
  eventAttrs
} from "../modules/Event";
import { store, log } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils"

export function handleEventUriModification(event: EventEdited): void {
  let eventEntity = Event.load(event.params.eventId.toString());
  if (!eventEntity) return;
  parseMetadata(event.params.newUri, eventEntity, eventAttrs);
  eventEntity.metadata = event.params.newUri;
  eventEntity.save();
}

export function handleEventCreated(event: EventCreated): void {
  let organizerUser = loadOrCreateUser(event.params.organizer);
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );

  eventEntity.metadata = event.params.uri;
  parseMetadata(event.params.uri, eventEntity, eventAttrs);
    
  eventEntity.organizer = organizerUser.address.toHex();
  eventEntity.save();
}

export function handleEventDeleted(event: EventDeleted): void {
  store.remove(
    "Event",
    getEventId(event.params.eventId)
  );
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

  for( let i = 0; i< eventEntity.ticketBalances.length ; i++ ){
    let tb = eventEntity.ticketBalances[i]
    let ticketBalance = Balance.load(tb);
    if(ticketBalance == null ) {
      log.error("Balance not found on handleEventOwnershipTransferred. id : {}", [tb]);
      return;
    }

    if( ticketBalance.owner === ownerUser.id ) {
      ticketBalance.isEventOwner = true;
    } else {
      ticketBalance.isEventOwner = false;
    }
    ticketBalance.save();
  }
}

export function handleCreatorRoyaltyModifiedOnEvent(event: CreatorRoyaltyModifiedOnEvent): void {
  let eventEntity = Event.load(event.params.eventId.toHex());
  if(eventEntity == null ) {
    log.error("Event not found on handleEventOwnershipTransferred. id : {}", [event.params.eventId.toHex()]);
    return;
  }

  for( let i = 0; i< eventEntity.tickets.length ; i++ ){
    let t = eventEntity.tickets[i]
    let ticket = Ticket.load(t);
    if(ticket == null ) {
      log.error("Ticket not found on handleCreatorRoyaltyModifiedOnEvent. id : {}", [t]);
      return;
    }
    
    ticket.creatorRoyalty = event.params.newRoyalty.toI32();
    ticket.save();
  }
}
