import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Ticket } from "../../generated/schema";

export function getTicketId(ticketIdContract: BigInt): string {
  return "tt" + ticketIdContract.toHex();
}