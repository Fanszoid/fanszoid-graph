import { JSONValue, JSONValueKind, log, TypedMap } from "@graphprotocol/graph-ts";
import { Restriction, Ticket } from "../../../build/generated/schema";
import { loadMetadata, parseJSONValueToString } from "../../handlers/utils";

export function getRestrictionId(conditionType: string, condition: string) : string {
    return `${conditionType}-${condition}`
}

export function loadOrCreateRestriction(conditionType: string, condition: string) : Restriction {
    let restrictionId = getRestrictionId(conditionType, condition);
    let restriction = Restriction.load(restrictionId);

    if(!restriction) {
        restriction = new Restriction(restrictionId);
        restriction.condition = condition;
        restriction.conditionType = conditionType;
    }

    return restriction;
}

export function createRestrictionForTicketForMetadata(ticket: Ticket, uri: string) : boolean {
    let value = loadMetadata(uri)
    
    if(!value) {
        return false;
    }

    if(!value.get('minAmountRestrictions') || (value.get('minAmountRestrictions') as JSONValue).kind != JSONValueKind.NUMBER) {
        log.debug('NOT MIN AMOUNT', [])
        return false;
    }
    
    ticket.minAmountRestrictions = (value.get('minAmountRestrictions') as JSONValue).toBigInt().toI32();

    if(!value.get('restrictions') || (value.get('restrictions') as JSONValue).kind != JSONValueKind.ARRAY) {
        return false;
    }

    let restrictionListArray = (value.get('restrictions') as JSONValue).toArray() as Array<JSONValue>;
    let finalRestrictionList : string[] = [];

    for(let i = 0; i < restrictionListArray.length; i++) {
        log.debug("DEBUG {}", [i.toString()])
        if(restrictionListArray[i].kind == JSONValueKind.OBJECT) {
            let restrictionObject = restrictionListArray[i].toObject();
            if(!!restrictionObject.get('condition') && !!restrictionObject.get('conditionType')) {
                let restriction = loadOrCreateRestriction(parseJSONValueToString(restrictionObject.get('conditionType') as JSONValue), parseJSONValueToString(restrictionObject.get('condition') as JSONValue));
                finalRestrictionList.push(getRestrictionId(parseJSONValueToString(restrictionObject.get('conditionType') as JSONValue), parseJSONValueToString(restrictionObject.get('condition') as JSONValue)));
                restriction.save()
            }
        }
    }

    ticket.restrictions = finalRestrictionList;

    return restrictionListArray.length > 0;
}