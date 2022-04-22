import { log, ipfs, json, JSONValue, TypedMap, Entity, JSONValueKind, TypedMapEntry, BigInt } from "@graphprotocol/graph-ts";
import { bigIntEventAttrs } from "../modules/Event";

export function parseMetadata(uri: string, entity: Entity, attrs: string[]): void {
    let uriParts = uri.split("/");
    let hash = uriParts[uriParts.length - 1];
    let data = ipfs.cat(hash);
    if (!data) return;
  
    let jsonParsed = json.fromBytes(data);
    let value: TypedMap<string, JSONValue>;
    if (jsonParsed.kind == JSONValueKind.OBJECT) {
      value = jsonParsed.toObject();
    } else if (jsonParsed.kind == JSONValueKind.STRING) {
      let jsonObject = json.fromString(jsonParsed.toString());
      if (jsonObject.kind == JSONValueKind.OBJECT) {
        value = jsonObject.toObject();
      } else {
        log.error("parseMetadata: Invalid metadata obj kind {}", [jsonObject.kind.toString()]);
      }
  
    } else {
      log.error("parseMetadata: Invalid metadata kind {}", [jsonParsed.kind.toString()]);
    }
  
    if (value) {
      for (let i = 0; i < attrs.length; i++) {
        let aux = value.get(attrs[i]);
        if (aux) {
          if( bigIntEventAttrs.indexOf(attrs[i]) >= 0 ) {
            entity.setBigInt(attrs[i], BigInt.fromString(parseJSONValueToString(aux)))
          } else {
            entity.setString(attrs[i], parseJSONValueToString(aux));
          }
        } else {
          log.error("parseMetadata: aux is null", []);
        }
      }
    } else {
      log.error("parseMetadata: value is null, data: {}", [data.toString()]);
    }
  }
  
export function parseJSONValueToString(value: JSONValue): string{
    switch (value.kind) {
      case JSONValueKind.STRING:
        return value.toString();
      case JSONValueKind.NUMBER:
        return value.toBigInt().toString();
      case JSONValueKind.BOOL:
        return value.toBool().toString();
      case JSONValueKind.OBJECT:
        return value.toObject().entries
          .map<string>( (entry: TypedMapEntry<string, JSONValue>) => (entry.key + ":" + parseJSONValueToString(entry.value) + ","))
          .join(',');  
      case JSONValueKind.ARRAY:
        return value.toArray().map<string>( (item: JSONValue) => parseJSONValueToString(item)).toString();
      default:
        return "";
    }
  }