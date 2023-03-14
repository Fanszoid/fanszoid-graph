import { Address, BigInt, log } from "@graphprotocol/graph-ts";

export function getReservationId(ticketId: BigInt, owner: Address, buyer: Address): string {
    return "r-" + ticketId.toHex() + "-" + owner.toHex() + "-" + buyer.toHex();
  }