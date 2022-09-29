import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Ticket } from"../../../build/generated/schema";

export var ticketAttrs: string[] = [
  'name', 'description', 'image'
];

export function getTicketId(ticketIdContract: BigInt): string {
  return "tt" + ticketIdContract.toHex();
}

export function getTicketIdentifierId(ticketIdContract: BigInt, txHash: string, user: Address): string {
  return "tid" + ticketIdContract.toHex() + "-" + txHash + "-" + user.toHex();
}

export function loadOrCreateTicket(
  ticketIdContract: BigInt
): Ticket {
  let ticketId = getTicketId(ticketIdContract);
  let ticketEntity = Ticket.load(ticketId);
  if (ticketEntity == null) {
    ticketEntity = new Ticket(ticketId);
  }
  ticketEntity.allowances = [];
  return ticketEntity;
}
