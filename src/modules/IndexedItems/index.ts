import { Address, BigInt } from "@graphprotocol/graph-ts";
import { IndexedItem } from "../../../build/generated/schema";
import { getEventId } from "../Event";
import { getTicketId } from "../Ticket";

export function getIndexedItemId(
    id: BigInt,
    itemType: string
): string {
    if(itemType == 'ticket') {
        return "ii-" + getTicketId(id);
    }
    else if(itemType == 'event') {
        return "ii-" + getEventId(id);
    }
    throw new Error('Invalid item type');
}

export function loadOrCreateIndexedItem(
    id: string
): IndexedItem {
    let indexedItem = IndexedItem.load(id);
    if (indexedItem == null) {
      indexedItem = new IndexedItem(id);
    }
    return indexedItem;
}