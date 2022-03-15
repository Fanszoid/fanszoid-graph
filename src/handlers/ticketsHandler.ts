import {
  ticketsPublished,
  TransferBatch,
  TransferSingle,
} from "../generated/TicketsNFT/TicketsNFT";
import { Event, TicketType, Ticket } from "../generated/schema";
import { getEventId } from "../modules/Event";
import {
  getTicketTypeId,
  ticketTypeHasSupply,
  ticketTypeHasNSupplyLeft,
} from "../modules/TicketType";
import {
  getTicketId,
  ticketHasAmountAvailable,
  ticketHasNAmountAvailable,
} from "../modules/Ticket";
import { loadOrCreateUser } from "../modules/User";
import { User } from "../generated/schema";
import { Address, log } from "@graphprotocol/graph-ts";
import { BigInt } from "@graphprotocol/graph-ts/common/numbers";

export function handleTicketsPublished(event: ticketsPublished): void {
  let eventId = getEventId(event.params.eventId, event.params.publisher);
  let eventEntity = Event.load(eventId);

  if (eventEntity != null) {
    for (let i = 0; i < event.params.ticketTypesCount.toI32(); i++) {
      let ticketType = new TicketType(
        getTicketTypeId(event.params.newTokenIds[i])
      );
      ticketType.event = eventId;
      ticketType.creatorRoyalty = event.params.creatorRoyalties[i].toI32();
      ticketType.primaryAskingPrice = event.params.askingPrices[i];

      if (event.params.amounts[i].isI32()) {
        ticketType.primarySupply = event.params.amounts[i].toI32();
        ticketType.initialAmount = event.params.amounts[i].toI32();
      } else {
        log.error("ticket supply too big!, ID : ", [eventId]);
      }
      ticketType.metadata = event.params.uris[i];
      ticketType.save();
    }
  } else {
    log.error("Event not found, ID : ", [eventId]);
  }
}

export function handleTransferSingle(event: TransferSingle): void {
  let to = event.params.to;
  let from = event.params.from;
  let id = event.params.id;
  let value =  event.params.value;

  internalTransferToken(to, from, id, value);
}

export function handleTransferBatch(event: TransferBatch): void {
  let to = event.params.to;
  let from = event.params.from;
  let ids = event.params.ids;
  let values = event.params.values;

  for (let i = 0; i < ids.length; i++) {
    internalTransferToken(to, from, ids[i], values[i]);
  }
}

function internalTransferToken(
  to: Address,
  from: Address,
  id: BigInt,
  value: BigInt
): void {
  let zeroAddress = Address.fromString(
    "0x0000000000000000000000000000000000000000"
  );
  if (to != zeroAddress && from != zeroAddress) {
    log.info("Transfer single, to: {}, from: {}. Updating entities.", [
      to.toHex(),
      from.toHex(),
    ]);
    let fromUser = User.load(from.toHex());
    if (fromUser == null) {
      log.error(
        "User not found for from address on Transfer Single event. To: {}, From: {}, Id: {}",
        [to.toHex(), from.toHex(), id.toHex()]
      );
    } else {
      let toUser = loadOrCreateUser(to);
      let ticketTypeId = getTicketTypeId(id);
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

      // from user

      if (fromUser.address.toHex() == ticketEventEntity.organizer) {
        // Ticket transfered by the organizer ( primary market ).

        if (ticketTypeHasNSupplyLeft(ticketType, value.toI32())) {
          ticketType.primarySupply = ticketType.primarySupply - value.toI32();
        } else {
          log.error(
            "Transfer Single. Not enough supply on primary market for ticket, id: {}, and user: {}",
            [id.toHex(), from.toHex()]
          );
        }
      } else {
        // Ticket transfered not by organizer.

        let fromTicketId = getTicketId(id, from);
        let fromTicket = Ticket.load(fromTicketId);

        if (
          fromTicket != null &&
          ticketHasNAmountAvailable(fromTicket, value.toI32())
        ) {
          fromTicket.amount = fromTicket.amount - value.toI32();
          fromTicket.save();
        } else {
          log.error(
            "ticket not found or no enough amount left for id: {}, and user: {}",
            [id.toHex(), from.toHex()]
          );
        }
      }

      // to user

      if (toUser.address.toHex() != ticketEventEntity.organizer) {
        let toTicketId = getTicketId(id, to);
        let toTicket = Ticket.load(toTicketId);

        if (toTicket == null) {
          toTicket = new Ticket(toTicketId);
          toTicket.ticketType = ticketTypeId;
          toTicket.event = ticketType.event;
          toTicket.amount = value.toI32();
          toTicket.owner = toUser.address.toHex();

          toTicket.save();
        } else {
          if (ticketHasNAmountAvailable(toTicket, value.toI32())) {
            toTicket.amount = toTicket.amount + value.toI32();
          } else {
            toTicket.amount = value.toI32();
          }

          toTicket.save();
        }
      } else {
        // Ticket received by the organizer of the event.

        if (ticketTypeHasNSupplyLeft(ticketType, value.toI32())) {
          ticketType.primarySupply = ticketType.primarySupply + value.toI32();
        } else {
          ticketType.primarySupply = value.toI32();
        }
      }

      ticketType.save();
    }
  } else {
    log.info("Transfer single, to: {}, from: {}. Nothing done...", [
      to.toHex(),
      from.toHex(),
    ]);
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
