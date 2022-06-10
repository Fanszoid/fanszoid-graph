import { log, ipfs, json, JSONValue, TypedMap, Entity, JSONValueKind, TypedMapEntry, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { bigIntEventAttrs } from "../modules/Event";
import { Allowance, SocialNetwork } from "../../build/generated/schema";

export function parseMetadata(uri: string, entity: Entity, attrs: string[]): void {
    let uriParts = uri.split("/");
    let hash = uriParts[uriParts.length - 1];
    let retries = 3;
    let data: Bytes | null = null;
    while(!data && retries > 0) {
      data = ipfs.cat(hash);
      retries--;
    }
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
          } 
          // especial parsing for socials
          else if( attrs[i] == "socials") {
            if( aux.kind === JSONValueKind.ARRAY ) {
              let socials = aux.toArray();

            for( let i=0; i< socials.length ; i++) {
              let social = socials[i];

              let name: string;
              let url: string;

              let socialValues = social.toObject().entries;
              for( let i=0; i< socialValues.length ; i++) {
                let socialValue = socialValues[i];
                if( socialValue.key.toString() == "name" ){
                  name = socialValue.value.toString();
                } else if ( socialValue.key.toString() == "url" ){
                  url = socialValue.value.toString();
                }
              }

              
              log.info("Socials reached, name: {}, url: {}", [ name, url]);
                
                let socialNetwork = new SocialNetwork(entity.getString("id") + '-' + name);
                socialNetwork.name = name;
                socialNetwork.url = url;
                socialNetwork.event = entity.getString("id");

                socialNetwork.save();
              }
            }
          } 
          else {
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