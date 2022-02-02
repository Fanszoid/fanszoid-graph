import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Ticket } from "../../generated/schema";

export function getTicketId(ticketIdContract: BigInt, user: Address): string {
  return "t" + ticketIdContract.toHex() + "-" + user.toHex();
}

export function ticketPriceMatches(price: BigInt, ticket: Ticket): boolean {
  return ticket.askingPrice && ticket.askingPrice == price;
}

export function ticketHasAmountAvailable(ticket: Ticket): boolean {
  return ticket.amount && ticket.amount > 0;
}
