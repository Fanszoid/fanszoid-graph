import { Event } from "../../build/generated/schema";
import { eventAttrs } from "../modules/Event";
import { SetTokenURICall } from "../../build/generated/Event/Event";
import { parseMetadata } from "./utils";


export function handleSetEventUri(call: SetTokenURICall): void {
  let eventId = call.inputs._tokenURI;
  let uri = call.inputs._tokenURI;

  let event = Event.load(eventId.toString());
  if (!event) return;
  parseMetadata(uri, event, eventAttrs)
  event.save();
}
