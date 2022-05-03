import { Address, BigInt } from "@graphprotocol/graph-ts";

export var membershipAttrs: string[] = [
  'name', 'description', 'image'
];

export function getMembershipId(membershipIdContract: BigInt): string {
  return "mem" + membershipIdContract.toHex();
}