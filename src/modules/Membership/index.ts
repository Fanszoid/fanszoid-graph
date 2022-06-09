import { Address, BigInt } from "@graphprotocol/graph-ts";

export var fanzMembershipContractAddress: string[] = [
  '0x64bC7bB5A73563657bE31e832aB1937617cEAA1D', '0x8Ca7a5912207a772Eb0b27A1d6df5f0B136e2e9f'
]

export var membershipContractAddressMATIC = '0x64bC7bB5A73563657bE31e832aB1937617cEAA1D'
export var membershipContractAddressMUMBAI = '0x8Ca7a5912207a772Eb0b27A1d6df5f0B136e2e9f'

// 1 for Mumbai, 0 for Matic
export var env = 0

export var membershipAttrs: string[] = [
  'name', 'description', 'image'
];

export function getMembershipId(membershipIdContract: BigInt): string {
  return "mem" + membershipIdContract.toHex();
}

export function getAllowedMembershipId(ticketId: string, contract: string): string {
  return ticketId.toString() + "-" + contract;
}