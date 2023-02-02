import { Address, BigInt } from "@graphprotocol/graph-ts";
import { IndexedItem } from "../../../build/generated/schema";

export function getIndexedItemId(
    id: BigInt,
    itemType: string
): string {
    if(itemType == 'ticket') {
        return "ii-tt" + id.toHex();
    }
    else if(itemType == 'event') {
        return "ii-e" + id.toHex();
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