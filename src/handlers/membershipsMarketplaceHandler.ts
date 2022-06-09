import {
  MembershipPublished,
  MembershipDeleted,
  AskSetted,
  AskRemoved,
  MembershipBought,
  CreatorRoyaltyModifiedOnMembership,
  MembershipEdited
} from "../../build/generated/MembershipsMarketplace/MembershipsMarketplace";
import { Membership, Balance,  } from "../../build/generated/schema";
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
import { store, log } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils"
import { loadOrCreateUser } from "../modules/User";

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
  membership.creatorRoyalty = event.params.creatorRoyalty.toI32();
  membership.isResellable = event.params.isResellable;
  membership.metadata = event.params.uri;
  membership.totalAmount = event.params.amount.toI32();
  
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
  membershipBalance.askingPrice = event.params.price;
  membershipBalance.amountOnSell = event.params.amountToSell.toI32();
  membershipBalance.amountOwned = event.params.amount.toI32();
  membershipBalance.owner = event.params.organizer.toHex();
  membershipBalance.isEventOwner = true;

  membershipBalance.save();
}

export function handleMembershipDeleted(event: MembershipDeleted): void {
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
