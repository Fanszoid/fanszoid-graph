import { BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from"../../../build/generated/schema";

export function loadOrCreateTransfer(
  id: string
): Transfer {
  let transfer = Transfer.load(id);
  if (transfer == null) {
    transfer = new Transfer(id);
  }
  return transfer;
}
