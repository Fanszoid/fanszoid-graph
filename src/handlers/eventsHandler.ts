import { Event } from "../generated/schema";
import { eventAttrs } from "../modules/Event";
import { SetEventUriCall } from "../generated/Marketplace/Marketplace";
import { parseMetadata } from "./utils";


export function handleSetEventUri(call: SetEventUriCall): void {
  let eventId = call.inputs.eventId;
  let uri = call.inputs.newUri;

  let event = Event.load(eventId.toString());
  if (!event) return;
  parseMetadata(uri, event, eventAttrs)
  event.save();
}
