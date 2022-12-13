import { log, ipfs, json, JSONValue, TypedMap, Entity, JSONValueKind, TypedMapEntry, BigInt, Bytes, Value, ValueKind } from "@graphprotocol/graph-ts";
import { bigIntEventAttrs } from "../modules/Event";
import { Allowance, Restriction, SocialNetwork } from "../../build/generated/schema";
import { loadOrCreateRestriction } from "../modules/Restriction";

export function loadMetadata(uri: string) : TypedMap<string, JSONValue> | null {
  let uriParts = uri.split("/");
  let hash = uriParts[uriParts.length - 1];
  let retries = 3;
  let data: Bytes | null = null;
  while(!data && retries > 0) {
    data = ipfs.cat(hash);
    retries--;
  }
  if (!data) {
    log.error("IPFS error: Could not parse metadata for hash {}", [hash]);
    return null
  };

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
      return null;
    }
  } else {
    log.error("parseMetadata: Invalid metadata kind {}", [jsonParsed.kind.toString()]);
    return null;
  }

  if(!value) {
    log.error("parseMetadata: value is null, data: {}", [data.toString()]);
  }

  return value;
}

export function parseMetadata(uri: string, entity: Entity, attrs: string[]): boolean {
    let valueWithNull = loadMetadata(uri)

    if(!valueWithNull) {
      return false
    }

    let value = valueWithNull as TypedMap<string, JSONValue>
    
    if (value) {
      for (let i = 0; i < attrs.length; i++) {
        let aux = value.get(attrs[i]);
        if (aux) {
          if( bigIntEventAttrs.indexOf(attrs[i]) >= 0 ) {
            let parsedToStringValue = parseJSONValueToString(aux)
            if( parsedToStringValue == '' || !isStringAnInteger(parsedToStringValue) ) {
              entity.setBigInt(attrs[i], BigInt.fromI32(0))
            } else {
              entity.setBigInt(attrs[i], BigInt.fromString(parsedToStringValue))
            }
          } 
          // especial parsing for socials
          else if( attrs[i] == "socials") {
            if( aux.kind === JSONValueKind.ARRAY ) {
              let socials = aux.toArray();

            for( let i=0; i< socials.length ; i++) {
              let social = socials[i];

              let name: string = '';
              let url: string = '';

              let socialValues = social.toObject().entries;
              for( let i=0; i< socialValues.length ; i++) {
                let socialValue = socialValues[i];
                if( socialValue.key.toString() == "name" ){
                  name = socialValue.value.toString();
                } else if ( socialValue.key.toString() == "url" ){
                  url = socialValue.value.toString();
                }
              }
                
                let socialNetwork = new SocialNetwork(entity.getString("id") + '-' + name + '-' + i.toString());
                socialNetwork.name = name;
                socialNetwork.url = url;
                socialNetwork.event = entity.getString("id");

                socialNetwork.save();
              }
            }
          }
          // hardcode our IPFS server.
          else if( attrs[i] == "image") {
            let strArr = parseJSONValueToString(aux).split("/")
            if(strArr.length > 0 && strArr[strArr.length - 1].length > 0) {
              entity.setString(attrs[i], "https://ipfs.fanz.events/ipfs/" + strArr[strArr.length - 1]);
            } else {
              entity.setString(attrs[i], parseJSONValueToString(aux));
            }
          }
          else if(attrs[i] == 'extra_requirement') {
            entity.setString('extraRequirement', parseJSONValueToString(aux));
          }
          else {
            entity.setString(attrs[i], parseJSONValueToString(aux));
          }
        } else if(attrs[i] == 'extra_requirement') {
          entity.setString('extraRequirement', 'none');
        } else {
          log.debug("Could not get attr: " + attrs[i].toString(), []);
        }
      }
    } 
    else {
      return false
    }

    return true
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

export function isStringAnInteger(value: String): boolean {
  for( var i = 0; i < value.length; i++ ) {
    if( value.charAt(i) < '0' && value.charAt(i) > '9' ) {
      return false;
    }
  }
  return true;
}