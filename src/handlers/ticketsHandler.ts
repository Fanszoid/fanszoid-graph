import {
  TransferBatch,
  TransferSingle,
} from "../generated/Ticket/Ticket";
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
import { store } from "@graphprotocol/graph-ts";

export function handleTransferSingle(event: TransferSingle): void {
  let to = event.params.to;
  let from = event.params.from;
  let id = event.params.id;
  let value =  event.params.value;

  internalTransferToken(to, from, id, value, event.transaction.hash.toHex());
}

export function handleTransferBatch(event: TransferBatch): void {
  let to = event.params.to;
  let from = event.params.from;
  let ids = event.params.ids;
  let values = event.params.values;

  for (let i = 0; i < ids.length; i++) {
    internalTransferToken(to, from, ids[i], values[i], event.transaction.hash.toHex());
  }
}

function internalTransferToken(
  to: Address,
  from: Address,
  id: BigInt,
  value: BigInt,
  txHash: String
): void {
  let zeroAddress = Address.fromString(
    "0x0000000000000000000000000000000000000000"
  );
  if (to != zeroAddress && from != zeroAddress) {
    let fromTicketBalance = TicketBalance.loadOrCreateTicketBalance(id, from);
    if( fromTicketBalance == null ){
      log.error("fromTicketBalance not found on internalTransferToken. id : {}", [fromTicketBalance.id]);
      return;
    }
    if(fromTicketBalance.amount < value.toI32()){
      log.error("fromTicketBalance.amount not enough on internalTransferToken. balance amount: {}, transfer value: {}", [fromTicketBalance.amount, value.toI32().toHex()]);
      return;
    }

    let eventEntity = Event.load(fromTicketBalance.event);
    if(eventEntity == null ) {
      log.error("Event not found on internalTransferToken. id : {}", [fromTicketBalance.event]);
      return;
    }

    fromTicketBalance.amountOwned = fromTicketBalance.amountOwned - value.toI32();

    let toTicketBalance = TicketBalance.loadOrCreateTicketBalance(getTicketBalanceId(id, to));

    toTicketBalance.ticket = getTicketTypeId(id);
    toTicketBalance.event = fromTicketBalance.event;
    toTicketBalance.owner = to.toHex();

    toTicketBalance.isEventOwner = to.toHex() == eventEntity.organizer;

    if(toTicketBalance.amountOwned) {
      toTicketBalance.amountOwned = value.toI32();
    } else {
      toTicketBalance.amountOwned = toTicketBalance.amountOwned + value.toI32();
    }

    fromTicketBalance.save();
    toTicketBalance.save();

    let transfer = loadOrCreateTransfer(txHash);

    transfer.event = fromTicketBalance.event;
    transfer.ticket = fromTicketBalance.ticket;
    transfer.sender = from.toHex();
    transfer.senderBalance = fromTicketBalance.id;
    transfer.receiver = to.toHex();
    transfer.receiverBalance = toTicketBalance.id;
    transfer.amount = value;

    if(transfer.isSale !== true) {
      transfer.isSale = false;
    }
    
    transfer.save()
  } else {
    log.info("Transfer single, to: {}, from: {}. Nothing done...", [
      to.toHex(),
      from.toHex(),
    ]);
  }
}
