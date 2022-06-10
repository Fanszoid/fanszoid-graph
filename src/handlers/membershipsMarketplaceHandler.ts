import {
  MembershipPublished,
  MembershipsDeleted,
  AskSetted,
  AskRemoved,
  MembershipBought,
  CreatorRoyaltyModifiedOnMembership,
  MembershipEdited,
  AllowanceAdded,
  AllowanceRemoved,
  AllowanceConsumed
} from "../../build/generated/MembershipsMarketplace/MembershipsMarketplace";
import { Membership, Balance, Allowance,  } from "../../build/generated/schema";
import { 
  loadOrCreateEvent,
} from "../modules/Event";
import {
  getMembershipId, membershipAttrs,
} from "../modules/Membership";
import {
  loadOrCreateTransfer,
} from "../modules/Transfer";
import { 
  getBalanceId,
  balanceHasNAmountAvailable,
  balanceHasNAmountOnSell,
  balancePriceMatches,
} from "../modules/Balance";
import { store, log, Address } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils"
import { loadOrCreateUser } from "../modules/User";

export function handleAllowanceAdded(event: AllowanceAdded): void {
  let membershipEntity = Membership.load(getMembershipId(event.params.membershipId));
  if (!membershipEntity) {
    log.error("Membership Not Found on handleAllowanceAdded. id : {}", [event.params.membershipId.toString()]);
    return;
  }
  let allowance = new Allowance(event.params.allowanceId.toString());
  allowance.amount = event.params.allowance.amount.toI32();
  allowance.allowedAddresses = event.params.allowance.allowedAddresses.map<string>( (add:Address) => add.toHex());
  allowance.save();

  membershipEntity.allowances.push(allowance.id);
  membershipEntity.save();
}

export function handleAllowanceConsumed(event: AllowanceConsumed): void {
  let allowance = Allowance.load(event.params.allowanceId.toString());
  if (!allowance) {
    log.error("Allowance Not Found on handleAllowanceConsumed. id : {}", [event.params.allowanceId.toString()]);
    return;
  }
  allowance.amount--;
  allowance.save();
}

export function handleAllowanceRemoved(event: AllowanceRemoved): void {
  let membershipEntity = Membership.load(getMembershipId(event.params.membershipId));
  if (!membershipEntity) {
    log.error("Membership Not Found on handleAllowanceAdded. id : {}", [event.params.membershipId.toString()]);
    return;
  }
  let allowanceLoaded = Allowance.load(event.params.allowanceId.toString());
  if (!allowanceLoaded) {
    log.error("Allowance Not Found on handleAllowanceConsumed. id : {}", [event.params.allowanceId.toString()]);
    return;
  }
  let index = membershipEntity.allowances.indexOf(allowanceLoaded.id);
  if (index == -1) {
    log.error("Allowance Not Found on saved. id : {}", [allowanceLoaded.id.toString()]);
    return;
  }
  membershipEntity.allowances.splice(index, 1);
  membershipEntity.save();
}

export function handleMembershipUriModification(event: MembershipEdited): void {
  let membershipEntity = Membership.load(getMembershipId(event.params.membershipId));
  if (!membershipEntity) {
    log.error("Membership Not Found on handleMembershipUriModification. id : {}", [event.params.membershipId.toString()]);
    return;
  }
  parseMetadata(event.params.newUri, membershipEntity, membershipAttrs);
  membershipEntity.metadata = event.params.newUri;
  membershipEntity.save();
}

export function handleMembershipPublished(event: MembershipPublished): void {
  let userEntity = loadOrCreateUser(
    event.params.organizer
  );

  let membershipId = getMembershipId(event.params.membershipId);
  let membership = Membership.load(membershipId);
  if (membership != null) {
    log.error("handleMembershipPublished: MembershipType already existed, id : {}", [membershipId]);
    return;
  }

  membership = new Membership(membershipId);

  membership.organizer = userEntity.address;
  membership.creatorRoyalty = event.params.saleInfo.royalty.toI32();
  membership.isResellable = event.params.saleInfo.isResellable;
  membership.metadata = event.params.uri;
  membership.totalAmount = event.params.amount.toI32();
  membership.isPrivate = event.params.saleInfo.isPrivate;
  
  parseMetadata(event.params.uri, membership, membershipAttrs);
  
  membership.save();

  let membershipBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.organizer, true));
  if( membershipBalance !== null ){
    log.error("handleMembershipPublished: Balance already existed, id : {}", [getBalanceId(event.params.membershipId, event.params.organizer, true)]);
    return;
  }
  membershipBalance = new Balance(getBalanceId(event.params.membershipId, event.params.organizer, true));
  membershipBalance.membership = membershipId;
  membershipBalance.type = 'Membership';
  membershipBalance.askingPrice = event.params.saleInfo.price;
  membershipBalance.amountOnSell = event.params.saleInfo.amountToSell.toI32();
  membershipBalance.amountOwned = event.params.amount.toI32();
  membershipBalance.owner = event.params.organizer.toHex();
  membershipBalance.isEventOwner = true;

  membershipBalance.save();
}

export function handleMembershipDeleted(event: MembershipsDeleted): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.amounts[i].toI32();

    let membershipBalanceId = getBalanceId(id, event.params.owner, true)
    let membershipBalance = Balance.load(membershipBalanceId);
    if(membershipBalance == null ){
      log.error("membershipBalance not found, id : {}", [membershipBalanceId]);
      return;
    }

    if( !balanceHasNAmountAvailable(membershipBalance, amount) ) {
      log.error("Not enough amount owned on membershipBalance, id : {}", [membershipBalanceId]);
      return;
    }

    membershipBalance.amountOwned = membershipBalance.amountOwned - amount;
    if( membershipBalance.amountOwned == 0 ) {
      store.remove(
        "Balance",
        membershipBalanceId
      );
    } else {
      membershipBalance.save()
    }

  }
}

/* 
  the handling on transferSingle/transferBatch does most of the entity updating for the membership balances.
*/
export function handleMembershipBought(event: MembershipBought): void {
  let amount = event.params.amount.toI32();

  let sellerBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.seller, true));

  if( sellerBalance == null ){
    log.error("sellerBalance not found on handleMembershipBought. id : {}", [getBalanceId(event.params.membershipId, event.params.seller, true)]);
    return;
  }
  if( !balanceHasNAmountOnSell(sellerBalance, amount)  ){
    log.error("sellerBalance.amountOnSell not enough on internalTransferToken. balance amount: {}, transfer value: {}", [sellerBalance.amountOnSell.toString(), amount.toString()]);
    return;
  }
  if( !balancePriceMatches(event.params.price, sellerBalance) ) {
    log.error("sellerBalance incongruent price on handleMembershipBought. id : {}, tx price: {}", [getBalanceId(event.params.membershipId, event.params.seller, true), event.params.price.toHex()]);
    return;
  }

  sellerBalance.amountOnSell = sellerBalance.amountOnSell - amount;

  sellerBalance.save();

  let transfer = loadOrCreateTransfer(event.transaction.hash.toHex());
  transfer.price = event.params.price;
  transfer.isSale = true;

  transfer.save()
}

export function handleAskSetted(event: AskSetted): void {
  let membershipBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.seller, true));
  if(membershipBalance != null ) {
    membershipBalance.amountOnSell = event.params.amount.toI32();
    membershipBalance.askingPrice = event.params.membershipPrice;
    
    membershipBalance.save();
  } else {
    log.error("membershipBalance not found on handleAskSetted. id : {}", [getBalanceId(event.params.membershipId, event.params.seller, true)]);
    return;
  }
}

export function handleAskRemoved(event: AskRemoved): void {
  let membershipBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.seller, true));
  if(membershipBalance != null ) {
    membershipBalance.amountOnSell = 0;
    membershipBalance.askingPrice = null;
    
    membershipBalance.save();
  } else {
    log.error("membershipBalance not found on handleAskRemoved. id : {}", [getBalanceId(event.params.membershipId, event.params.seller, true)]);
    return;
  }
}

export function handleCreatorRoyaltyModifiedOnMembership(event: CreatorRoyaltyModifiedOnMembership): void {
  let membership = Membership.load(getMembershipId(event.params.membershipId));
  if(membership == null ) {
    log.error("Membership not found on handleCreatorRoyaltyModifiedOnMembership. id : {}", [event.params.membershipId.toHex()]);
    return;
  }

  membership.creatorRoyalty = event.params.newRoyalty.toI32();
  membership.save();
}
