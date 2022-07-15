import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import { Match, RegExp } from "assemblyscript-regex";
import { log, newMockEvent } from "matchstick-as";
import * as Admin from "../build/generated/Admin/Admin";
import * as Membership from "../build/generated/Membership/Membership";
import * as MembershipsMarketplace from "../build/generated/MembershipsMarketplace/MembershipsMarketplace";
import * as Ticket from "../build/generated/Ticket/Ticket";
import * as TicketsMarketplace from "../build/generated/TicketsMarketplace/TicketsMarketplace";
// import * as Event from "../build/generated/Event/Event";

export function param<T>(name: string, value:T): ethereum.EventParam {
    return new ethereum.EventParam(name, parseValue(value, name));
}

export function parseValue<T>(value:T, name:string = 'undefined'): ethereum.Value {
    if (value instanceof BigInt) {
        return ethereum.Value.fromUnsignedBigInt(value as BigInt)
    } else if (value instanceof String && validAddress((value as String).toString())) {
        return ethereum.Value.fromAddress(Address.fromString((value as String).toString()));
    } else if (value instanceof String) {
        return ethereum.Value.fromString((value as String).toString());
    } else if (value instanceof Bytes) {
        return ethereum.Value.fromBytes(value);
    } else if (value instanceof ethereum.Tuple) {
        return ethereum.Value.fromTuple(value);
    } else if (value instanceof Array) {
        let items: ethereum.Value[] = [];
        for (let i = 0; i < value.length; i++) {
            items.push(parseValue(value[i]));
        }
        return ethereum.Value.fromArray(items);
    } else if (value instanceof Boolean) {
        return ethereum.Value.fromBoolean(Boolean(value));
    } else {
        log.warning("Invalid param type " + name, []);
        throw Error('Invalid parameter type');
    }
}

function validAddress(text: String): boolean {
    const regex = new RegExp('^0x[0-9a-fA-F]{40}$');
    let match: Match | null = regex.exec(text.toString());
    if(match == null || match.matches.length == 0 || match.matches[0] != text) {
        return false;
    }
    return true;
}
