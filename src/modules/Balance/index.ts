import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Balance } from"../../../build/generated/schema";

export function getBalanceId(balanceIdContract: BigInt, user: Address, isMembership: boolean): string {
  return (isMembership? "m":"t") + balanceIdContract.toHex() + "-" + user.toHex();
}

export function balancePriceMatches(price: BigInt, balance: Balance): boolean {
  return balance.askingPrice && balance.askingPrice == price;
}

export function balanceHasAmountAvailable(balance: Balance): boolean {
  return balance.amountOwned && balance.amountOwned > 0;
}

export function balanceHasNAmountAvailable(balance: Balance, n: number): boolean {
  return balance.amountOwned && balance.amountOwned >= n;
}

export function balanceHasAmountOnSell(balance: Balance): boolean {
    return balance.amountOnSell && balance.amountOnSell > 0;
}

export function balanceHasNAmountOnSell(balance: Balance, n: number): boolean {
    return balance.amountOnSell && balance.amountOnSell >= n;
}

export function loadOrCreateBalance(balanceIdContract: BigInt, userAddr: Address, isMembership: boolean): Balance {
    let id = getBalanceId(balanceIdContract, userAddr, isMembership);
    let tb = Balance.load(id);
    if (tb == null) {
      tb = new Balance(id);
      tb.save();
    }
    return tb;
  }
  