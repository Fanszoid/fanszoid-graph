import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Ticket } from"../../../build/generated/schema";

export var ticketAttrs: string[] = [
  'name', 'description', 'image'
];

export function getTicketId(ticketIdContract: BigInt): string {
  return "tt" + ticketIdContract.toHex();
}