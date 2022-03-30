import { Address, BigInt } from "@graphprotocol/graph-ts";
import { TicketBalance } from "../../generated/schema";

export function getTicketBalanceId(ticketIdContract: BigInt, user: Address): string {
  return "t" + ticketIdContract.toHex() + "-" + user.toHex();
}

export function ticketPriceMatches(price: BigInt, ticket: TicketBalance): boolean {
  return ticket.askingPrice && ticket.askingPrice == price;
}

export function ticketHasAmountAvailable(ticket: TicketBalance): boolean {
  return ticket.amountOwned && ticket.amountOwned > 0;
}

export function ticketHasNAmountAvailable(ticket: TicketBalance, n: number): boolean {
  return ticket.amountOwned && ticket.amountOwned >= n;
}

export function ticketHasAmountOnSell(ticket: TicketBalance): boolean {
    return ticket.amountOnSell && ticket.amountOnSell > 0;
}

export function ticketHasNAmountOnSell(ticket: TicketBalance, n: number): boolean {
    return ticket.amountOnSell && ticket.amountOnSell >= n;
}

export function loadOrCreateTicketBalance(ticketIdContract: BigInt, userAddr: Address): TicketBalance {
    let id = getTicketBalanceId(ticketIdContract, userAddr);
    let tb = TicketBalance.load(id);
    if (tb == null) {
      tb = new TicketBalance(id);
      tb.save();
    }
    return tb;
  }
  