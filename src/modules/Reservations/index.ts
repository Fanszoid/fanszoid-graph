import { BigInt } from "@graphprotocol/graph-ts";
import { getTicketId } from "../Ticket";

export function getReservationId(ticketId: BigInt, owner: string, buyer: string): string {
    return "r" + ticketId.toHex() + "-" + owner + "-" + buyer;
  }