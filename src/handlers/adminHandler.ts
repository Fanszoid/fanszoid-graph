import {
  EventCreated,
  EventDeleted,
  EventOwnershipTransferred,
  CreatorRoyaltyModifiedOnEvent,
  EventEdited,
  MembershipAssignedToTicket,
  MembershipTokenIdRemovedFromTicket,
  MembershipRemovedFromTicket,
  EventPaused,
  EventUnpaused,
  CollaboratorAdded,
  CollaboratorRemoved
} from "../../build/generated/Admin/Admin";
import { Event, Ticket, Balance, AllowedMembership, Membership, User } from "../../build/generated/schema";
import {
  getAllowedMembershipId, getMembershipId, membershipAttrs,
} from "../modules/Membership";
import { loadOrCreateUser } from "../modules/User";
import { 
  loadOrCreateEvent,
  getEventId,
  eventAttrs
} from "../modules/Event";
import { membershipContractAddressMATIC, membershipContractAddressMUMBAI } from "../modules/Membership";
import { store, log, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils"
import { getTicketId } from "../modules/Ticket"
import { getIndexedItemId, loadOrCreateIndexedItem } from "../modules/IndexedItems";

export function handleEventPaused(event: EventPaused): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  if (!eventEntity) {
    log.error("handleEventPaused: Event not found : {}", [event.params.eventId.toString()]);
    return;
  } 
  eventEntity.paused = true;
  eventEntity.save();
}

export function handleEventUnpaused(event: EventUnpaused): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  if (!eventEntity) {
    log.error("handleEventUnpaused: Event not found : {}", [event.params.eventId.toString()]);
    return;
  } 
  eventEntity.paused = false;
  eventEntity.save();
}

export function handleCollaboratorAdded(event: CollaboratorAdded): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  if (!eventEntity) {
    log.error("handleCollaboratorAdded: Event not found : {}", [event.params.eventId.toString()]);
    return;
  } 
  let collab = loadOrCreateUser(event.params.collaborator);
  if(eventEntity.collaborators == null){
    eventEntity.collaborators = [];
  }
  eventEntity.collaborators = eventEntity.collaborators.concat([collab.id]);
  eventEntity.save();
}

export function handleCollaboratorRemoved(event: CollaboratorRemoved): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  if (!eventEntity) {
    log.error("handleEventPaused: Event not found : {}", [event.params.eventId.toString()]);
    return;
  } 
  let user = User.load(event.params.collaborator.toHex());
  if (!user) {
    log.error("handleCollaboratorRemoved: User not found : {}", [event.params.collaborator.toString()]);
    return;
  }
  if(eventEntity.collaborators == null) {
    log.error("handleCollaboratorRemoved: User not found : {}", [event.params.collaborator.toString()]);
    return;
  }
  let index = eventEntity.collaborators.indexOf(user.id);
  if (index == -1) {
    log.error("handleCollaboratorRemoved: User not found : {}", [event.params.collaborator.toString()]);
    return;
  }
  let aux = eventEntity.collaborators;
  aux.splice(index, 1);
  eventEntity.collaborators = aux;
  eventEntity.save();
}

export function handleEventUriModification(event: EventEdited): void {
  let eventEntity = loadOrCreateEvent(event.params.eventId);

  let parsed = parseMetadata(event.params.newUri, eventEntity, eventAttrs);

  let indexedItemId = getIndexedItemId(event.params.eventId, 'event');
  let indexedItem = loadOrCreateIndexedItem(indexedItemId);
  indexedItem.wasIndexed = !!parsed;
  indexedItem.save()

  if( parsed ) {
    eventEntity.metadata = event.params.newUri;
    eventEntity.save();

    indexedItem.wasIndexed = true;
    indexedItem.save()
  } else {
    log.error("Error parsing metadata on handleEventUriModification, metadata hash is: {}", [event.params.newUri])
  }
}

export function handleEventCreated(event: EventCreated): void {
  let organizerUser = loadOrCreateUser(event.params.organizer);
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );

  eventEntity.metadata = event.params.uri;
  let parsed = parseMetadata(event.params.uri, eventEntity, eventAttrs);

  let indexedItemId = getIndexedItemId(event.params.eventId, 'event');
  let indexedItem = loadOrCreateIndexedItem(indexedItemId);
  indexedItem.wasIndexed = !!parsed;
  indexedItem.save()
    
  if( parsed ) {
    eventEntity.organizer = organizerUser.address;
    eventEntity.attendees = BigInt.fromI32(0);
    eventEntity.save();
  } else {
    log.error("Error parsing metadata on handleEventCreated, metadata hash is: {}", [event.params.uri])
  }
}

export function handleEventDeleted(event: EventDeleted): void {
  store.remove(
    "Event",
    getEventId(event.params.eventId)
  );
}

export function handleMembershipsAssigned(event: MembershipAssignedToTicket): void {
  let ticketId = getTicketId(event.params.ticketId)
  let allowedMembership = new AllowedMembership(getAllowedMembershipId(ticketId, event.params.contractAddress.toHex()));
  allowedMembership.address = event.params.contractAddress.toHex();
  allowedMembership.tokenIds = event.params.ids;
  allowedMembership.ticket = ticketId

  let membershipAddress: string;
  if( dataSource.network() == 'matic') {
    membershipAddress = membershipContractAddressMATIC;
  } else {
    membershipAddress = membershipContractAddressMUMBAI;
  }
  
  if( event.params.contractAddress.toHex().toLowerCase() == membershipAddress.toLowerCase() ) {
    log.info("Found membership assignation for Fanz membership contract on handleMembershipsAssigned.", []);
    for( let i=0; i<event.params.ids.length ; i++ ){
      // Match the token ids to the membership entities
      let membership = Membership.load(getMembershipId(event.params.ids[i]));
      if(membership == null ) {
        log.error("Membership not found on handleMembershipsAssigned, id: {}", [event.params.ids[i].toHex()])
        break
      } else {
        let validTickets = membership.validTickets;
        validTickets.push(ticketId);
        membership.validTickets = validTickets;
        membership.save();
      }

    }
  }
  allowedMembership.save();
}

export function handleDisallowMembership(event: MembershipRemovedFromTicket): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if(ticketEntity == null ) {
    log.error("Ticket Not Found on handleDisallowMembership. id : {}", [event.params.ticketId.toHex()]);
    return;
  }
  store.remove(
    "AllowedMembership",
    getAllowedMembershipId(ticketEntity.id, event.params.contractAddress.toHex())
  );
}

export function handleDisallowMembershipTokenId(event: MembershipTokenIdRemovedFromTicket): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if(ticketEntity == null ) {
    log.error("Ticket Not Found on handleDisallowMembershipTokenId. id : {}", [event.params.ticketId.toString()]);
    return;
  };
  let allowedMembershipId = getAllowedMembershipId(ticketEntity.id, event.params.contractAddress.toHex())
  let allowedMembership = AllowedMembership.load(allowedMembershipId);
  if(allowedMembership == null ) {
    log.error("AllowedMembership Not Found on handleDisallowMembershipTokenId. id : {}", [allowedMembershipId]);
    return;
  };
  let currentIds = allowedMembership.tokenIds as BigInt[];
  let finalIds: Array<BigInt> = new Array<BigInt>();
  for (let j = 0 ; j < currentIds.length ; j++) {
    let id = currentIds[j];
    if (id != event.params.tokenId) {
      finalIds.push(id);
    }
  }
  allowedMembership.tokenIds = finalIds;
  allowedMembership.save();
}

export function handleEventOwnershipTransferred(event: EventOwnershipTransferred): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  
  if(eventEntity == null ) {
    log.error("Event not found on handleEventOwnershipTransferred. id : {}", [getEventId(event.params.eventId)]);
    return;
  }

  let ownerUser = loadOrCreateUser(event.params.newOwner);
  eventEntity.organizer = ownerUser.id;

  eventEntity.save();

  if(eventEntity.ticketBalances) {
    for( let i = 0; i< (eventEntity.ticketBalances as string[]).length ; i++ ){
      let tb = (eventEntity.ticketBalances as string[])[i]
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
}

export function handleCreatorRoyaltyModifiedOnEvent(event: CreatorRoyaltyModifiedOnEvent): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  if(eventEntity == null ) {
    log.error("Event not found on handleEventOwnershipTransferred. id : {}", [getEventId(event.params.eventId)]);
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
