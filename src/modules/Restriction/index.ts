import { JSONValue, JSONValueKind, log, TypedMap } from "@graphprotocol/graph-ts";
import { Restriction, Ticket } from "../../../build/generated/schema";
import { loadMetadata, parseJSONValueToString } from "../../handlers/utils";

const OPTIONAL_RESTRICTIONS_PARAMS = ['imageUrl', 'name'];

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

    if(!value.get('minRestrictionAmount') || (value.get('minRestrictionAmount') as JSONValue).kind != JSONValueKind.NUMBER) {
        return false;
    }
    
    ticket.minRestrictionAmount = (value.get('minRestrictionAmount') as JSONValue).toBigInt().toI32();

    if(!value.get('restrictions') || (value.get('restrictions') as JSONValue).kind != JSONValueKind.ARRAY) {
        return false;
    }

    let restrictionListArray = (value.get('restrictions') as JSONValue).toArray() as Array<JSONValue>;
    let finalRestrictionList : string[] = [];

    for(let i = 0; i < restrictionListArray.length; i++) {
        if(restrictionListArray[i].kind == JSONValueKind.OBJECT) {
            let restrictionObject = restrictionListArray[i].toObject();
            if(!!restrictionObject.get('condition') && !!restrictionObject.get('conditionType')) {
                let restriction = Restriction.load(getRestrictionId(parseJSONValueToString(restrictionObject.get('conditionType') as JSONValue), parseJSONValueToString(restrictionObject.get('condition') as JSONValue)));
                if(!restriction) {
                    restriction = loadOrCreateRestriction(parseJSONValueToString(restrictionObject.get('conditionType') as JSONValue), parseJSONValueToString(restrictionObject.get('condition') as JSONValue));
                    for(let j = 0; j < OPTIONAL_RESTRICTIONS_PARAMS.length; j++) {
                        if(!!restrictionObject.get(OPTIONAL_RESTRICTIONS_PARAMS[j])) {
                            restriction.setString(OPTIONAL_RESTRICTIONS_PARAMS[j], parseJSONValueToString(restrictionObject.get(OPTIONAL_RESTRICTIONS_PARAMS[j]) as JSONValue))
                        }
                    }
                    if(!restriction.imageUrl && !!restrictionObject.get('image_url')) {
                        restriction.imageUrl = parseJSONValueToString(restrictionObject.get('image') as JSONValue)
                    }
                    restriction.save()
                }
                finalRestrictionList.push(getRestrictionId(parseJSONValueToString(restrictionObject.get('conditionType') as JSONValue), parseJSONValueToString(restrictionObject.get('condition') as JSONValue)));
            }
        }
    }

    ticket.restrictions = finalRestrictionList;

    return restrictionListArray.length > 0;
}