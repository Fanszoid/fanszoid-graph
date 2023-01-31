import {
  TransferBatch,
  TransferSingle,
} from "../../build/generated/Membership/Membership";
import { Event, Balance, Membership } from "../../build/generated/schema";
import {
  getBalanceId,
  balanceHasNAmountAvailable
} from "../modules/Balance";
import {
  getMembershipId,
} from "../modules/Membership";
import {
  loadOrCreateTransfer,
} from "../modules/Transfer";
import { loadOrCreateUser } from "../modules/User";
import { Address, log, store } from "@graphprotocol/graph-ts";
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

    let fromBalance = Balance.load(getBalanceId(id, from, true));
    if( fromBalance == null ){
      log.error("fromBalance not found on internalTransferToken. membership id : {}, address: {}", [ id.toHex(),from.toHex()]);
      return;
    }
    if( !balanceHasNAmountAvailable(fromBalance, value.toI32()) ){
      log.error("fromBalance.amount not enough on internalTransferToken. balance amount: {}, transfer value: {}", [fromBalance.amountOwned.toString(), value.toI32().toString()]);
      return;
    }

    let membership = Membership.load((fromBalance.membership as string));
    if(membership == null ) {
      log.error("membership not found on internalTransferToken. id : {}", [(fromBalance.membership as string)]);
      return;
    }

    fromBalance.amountOwned = fromBalance.amountOwned - value.toI32();

    let toBalanceId = getBalanceId(id, to, true)
    let toBalance = Balance.load(toBalanceId);
    if( toBalance == null ){
      toBalance = new Balance(toBalanceId);
      toBalance.type = fromBalance.type;
      toBalance.membership = getMembershipId(id);
      toBalance.owner = to.toHex();
      toBalance.amountOwned = value.toI32();
      toBalance.amountOnSell = 0;
      toBalance.isEventOwner = to.toHex() == membership.organizer;
      toBalance.ticketIdentifiersIds = [];

    } else {
      toBalance.amountOwned = toBalance.amountOwned + value.toI32();
    }

    let transfer = loadOrCreateTransfer(txHash);

    // the isSale field on transfer is only setted on the membershipBought handler
    transfer.membership = fromBalance.membership;
    transfer.sender = from.toHex();
    transfer.senderBalance = fromBalance.id;
    transfer.receiver = to.toHex();
    transfer.receiverBalance = toBalance.id;
    transfer.amount = value.toI32();
    transfer.createdAt = txTimestamp;
    transfer.save()

    if(fromBalance.amountOwned == 0 && !fromBalance.isEventOwner) {
      store.remove(
        "Balance",
        fromBalance.id
      );
    } else {
      fromBalance.save()
    }
    toBalance.save();
  } else {
    log.info("Transfer single, to: {}, from: {}. Nothing done...", [
      to.toHex(),
      from.toHex(),
    ]);
  }
}

