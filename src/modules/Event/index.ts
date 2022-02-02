import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Event } from "../../generated/schema";

export function getEventId(
  eventIdContract: BigInt,
  organizer: Address
): string {
  return "e" + eventIdContract.toHex() + "-" + organizer.toHex();
}

export function loadOrCreateEvent(
  eventIdContract: BigInt,
  organizer: Address
): Event {
  let eventId = getEventId(eventIdContract, organizer);
  let eventEntity = Event.load(eventId);
  if (eventEntity == null) {
    eventEntity = new Event(eventId);
  }
  return eventEntity;
}
