import { Address, BigInt } from "@graphprotocol/graph-ts";
import { TicketType } from "../../generated/schema";

export function getTicketTypeId(ticketTypeIdContract: BigInt): string {
  return "tt" + ticketTypeIdContract.toHex();
}

export function ticketTypePriceMatches(
  price: BigInt,
  ticketType: TicketType
): boolean {
  return (
    ticketType.primaryAskingPrice && ticketType.primaryAskingPrice == price
  );
}

export function ticketTypeHasSupply(ticketType: TicketType): boolean {
  return ticketType.primarySupply && ticketType.primarySupply > 0;
}
