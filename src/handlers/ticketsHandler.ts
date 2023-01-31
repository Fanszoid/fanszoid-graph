import {
  TransferBatch,
  TransferSingle,
} from "../../build/generated/Ticket/Ticket";
import { Event, Balance, TicketIdentifier } from "../../build/generated/schema";
import {
  getBalanceId,
  balanceHasNAmountAvailable
} from "../modules/Balance";
import {
  getTicketId,
  getTicketIdentifierId,
} from "../modules/Ticket";
import {
  loadOrCreateTransfer,
} from "../modules/Transfer";
import { loadOrCreateUser } from "../modules/User";
import { Address, ByteArray, Bytes, log, store } from "@graphprotocol/graph-ts";
import { BigInt } from "@graphprotocol/graph-ts/common/numbers";

export function handleTransferSingle(event: TransferSingle): void {
  let to = event.params.to;
  let from = event.params.from;
  let id = event.params.id;
  let value =  event.params.value;

  internalTransferToken(to, from, id, value, event.transaction.hash.toHex(), event.block.timestamp);
}

export function handleTransferBatch(event: TransferBatch): void {
  let to = event.params.to;
  let from = event.params.from;
  let ids = event.params.ids;
  let values = event.params.values;

  for (let i = 0; i < ids.length; i++) {
    internalTransferToken(to, from, ids[i], values[i], event.transaction.hash.toHex(), event.block.timestamp);
  }
}

///////////////////////////////////////////////////////////////////
/////                   INTERNAL                              /////
///////////////////////////////////////////////////////////////////

function internalTransferToken(
  to: Address,
  from: Address,
  id: BigInt,
  value: BigInt,
  txHash: string,
  txTimestamp:BigInt 
): void {
  let zeroAddress = Address.fromString(
    "0x0000000000000000000000000000000000000000"
  );
  if (to != zeroAddress && from != zeroAddress) {
    loadOrCreateUser(from);
    loadOrCreateUser(to);

    let fromBalance = Balance.load(getBalanceId(id, from, false));
    if( fromBalance == null ){
      log.error("fromBalance not found on internalTransferToken. ticket id : {}, address: {}", [ id.toHex(),from.toHex()]);
      return;
    }
    if( !balanceHasNAmountAvailable(fromBalance, value.toI32()) ){
      log.error("fromBalance.amount not enough on internalTransferToken. balance amount: {}, transfer value: {}", [fromBalance.amountOwned.toString(), value.toI32().toString()]);
      return;
    }

    let eventEntity = Event.load((fromBalance.event as string));
    if(eventEntity == null ) {
      log.error("Event not found on internalTransferToken. id : {}", [(fromBalance.event as string)]);
      return;
    }
    
    let toBalanceId = getBalanceId(id, to, false)
    let toBalance = Balance.load(toBalanceId);
    if( toBalance == null ){
      toBalance = new Balance(toBalanceId);
      toBalance.ticket = getTicketId(id);
      toBalance.type = fromBalance.type;
      toBalance.event = fromBalance.event;
      toBalance.owner = to.toHex();
      toBalance.isEventOwner = to.toHex() == eventEntity.organizer;
      toBalance.amountOwned = value.toI32();
      toBalance.amountOnSell = 0;
      toBalance.ticketIdentifiersIds = [];
      if (toBalance.owner != eventEntity.organizer) {
        eventEntity.attendees = eventEntity.attendees.plus(BigInt.fromI32(1));
      }
    } else {
      toBalance.amountOwned = toBalance.amountOwned + value.toI32();
    }

    // ticket identifiers handling.
    
    for(let i=0; i < value.toI32(); i++) {
      log.info("Ticket transfer on loop: i={}", [i.toString()])
      if(fromBalance.ticketIdentifiersIds != null && fromBalance.ticketIdentifiersIds.length > 0 ) {
        // change owner of ticketIdentifier
        log.info("Changing owner of ticket Identifier...", [])
        let tiId = fromBalance.ticketIdentifiersIds[fromBalance.ticketIdentifiersIds.length-1]
        let ticketIdentifier = TicketIdentifier.load(tiId.toString())
        if(ticketIdentifier == null ){
          log.error("Last ticketIdentifier not found on from balance. id : {}", [fromBalance.id]);
          return;
        }

        ticketIdentifier.owner = to.toHex();
        ticketIdentifier.ticketBalance = toBalance.id;
        ticketIdentifier.save();

        let fromTiIds = fromBalance.ticketIdentifiersIds;
        fromTiIds.pop();
        fromBalance.ticketIdentifiersIds = fromTiIds;

        let toTiIds = toBalance.ticketIdentifiersIds;
        toTiIds.push(tiId);
        toBalance.ticketIdentifiersIds = toTiIds;
      } else {
        log.info("creating new ticket Identifier...", [])
        // create new ticketIdentifier
        let tId = getTicketIdentifierId(id, txHash,to, i)

        let ticketIdentifier = new TicketIdentifier(tId)
        ticketIdentifier.owner = to.toHex();
        ticketIdentifier.ticket = getTicketId(id);
        ticketIdentifier.ticketBalance = toBalance.id;

        ticketIdentifier.save();

        let toTiIds = toBalance.ticketIdentifiersIds;
        toTiIds.push(Bytes.fromByteArray(ByteArray.fromUTF8(tId)));
        toBalance.ticketIdentifiersIds = toTiIds;
      }
    }

    if (fromBalance.type == 'Ticket' && fromBalance.event == null) {
      log.error("Event not found on ticket balance. id : {}", [fromBalance.id]);
      return;
    }

    

    fromBalance.amountOwned = fromBalance.amountOwned - value.toI32();

    let transfer = loadOrCreateTransfer(txHash);

    // the isSale field on transfer is only setted on the ticketBought handler
    transfer.event = fromBalance.event;
    transfer.ticket = fromBalance.ticket;
    transfer.sender = from.toHex();
    transfer.senderBalance = fromBalance.id;
    transfer.receiver = to.toHex();
    transfer.receiverBalance = toBalance.id;
    transfer.amount = value.toI32();
    transfer.createdAt = txTimestamp;
    transfer.save()

    if(fromBalance.amountOwned == 0  && !fromBalance.isEventOwner ) {
      if (fromBalance.owner != eventEntity.organizer) {
        eventEntity.attendees = eventEntity.attendees.minus(BigInt.fromI32(1));
      }
      store.remove(
        "Balance",
        fromBalance.id
      );
    } else {
      fromBalance.save()
    }
    toBalance.save();
    eventEntity.save();

    

    
  } else {
    log.info("Transfer single, to: {}, from: {}. Nothing done...", [
      to.toHex(),
      from.toHex(),
    ]);
  }

  
}