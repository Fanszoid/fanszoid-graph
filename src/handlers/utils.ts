import {
  log,
  ipfs,
  json,
  JSONValue,
  TypedMap,
  Entity,
  JSONValueKind,
  TypedMapEntry,
  BigInt,
  Bytes,
  Value,
  ValueKind,
} from "@graphprotocol/graph-ts";
import { bigIntEventAttrs } from "../modules/Event";
import {
  Allowance,
  Restriction,
  SocialNetwork,
  Question,
} from "../../build/generated/schema";
import { loadOrCreateRestriction } from "../modules/Restriction";
import { getQuestionId } from "../modules/Question";

export function loadMetadata(uri: string): TypedMap<string, JSONValue> | null {
  let uriParts = uri.split("/");
  let hash = uriParts[uriParts.length - 1];
  let retries = 5;
  let data: Bytes | null = null;
  while (!data && retries > 0) {
    data = ipfs.cat(hash);
    retries--;
  }
  if (!data) {
    log.error("IPFS error: Could not parse metadata for hash {}", [hash]);
    return null;
  }

  let jsonParsed = json.try_fromBytes(data);

  if (!jsonParsed.isOk) {
    return new TypedMap();
  }

  let value: TypedMap<string, JSONValue>;

  if (jsonParsed.value.kind == JSONValueKind.OBJECT) {
    value = jsonParsed.value.toObject();
  } else if (jsonParsed.value.kind == JSONValueKind.STRING) {
    let jsonObject = json.fromString(jsonParsed.value.toString());
    if (jsonObject.kind == JSONValueKind.OBJECT) {
      value = jsonObject.toObject();
    } else {
      log.error("parseMetadata: Invalid metadata obj kind {}", [
        jsonObject.kind.toString(),
      ]);
      return new TypedMap();
    }
  } else {
    log.error("parseMetadata: Invalid metadata kind {}", [
      jsonParsed.value.kind.toString(),
    ]);
    return new TypedMap();
  }

  if (!value) {
    log.error("parseMetadata: value is null, data: {}", [data.toString()]);
    return new TypedMap();
  }

  return value;
}

export function parseMetadata(
  uri: string,
  entity: Entity,
  attrs: string[]
): string {
  let valueWithNull = loadMetadata(uri);

  if (valueWithNull == null) {
    return "NOT_REACHABLE";
  } else if (valueWithNull.entries.length == 0) {
    return "NOT_VALID";
  }

  let value = valueWithNull as TypedMap<string, JSONValue>;

  if (value) {
    for (let i = 0; i < attrs.length; i++) {
      let aux = value.get(attrs[i]);
      if (aux) {
        if (bigIntEventAttrs.indexOf(attrs[i]) >= 0) {
          let parsedToStringValue = parseJSONValueToString(aux);
          if (
            parsedToStringValue == "" ||
            !isStringAnInteger(parsedToStringValue)
          ) {
            entity.setBigInt(attrs[i], BigInt.fromI32(0));
          } else {
            entity.setBigInt(attrs[i], BigInt.fromString(parsedToStringValue));
          }
        }
        // especial parsing for socials
        else if (attrs[i] == "socials") {
          if (aux.kind === JSONValueKind.ARRAY) {
            let socials = aux.toArray();
            var socialIdxCounts = new Map<string, number>();

            for (let i = 0; i < socials.length; i++) {
              let social = socials[i];

              let name: string = "";
              let url: string = "";

              let socialValues = social.toObject().entries;
              for (let i = 0; i < socialValues.length; i++) {
                let socialValue = socialValues[i];
                if (socialValue.key.toString() == "name") {
                  name = socialValue.value.toString();
                } else if (socialValue.key.toString() == "url") {
                  url = socialValue.value.toString();
                }
              }

              if (!socialIdxCounts.has(name)) {
                socialIdxCounts.set(name, 0);
              }

              let idx = socialIdxCounts.get(name);

              let socialNetwork = new SocialNetwork(
                entity.getString("id") + "-" + name + "-" + idx.toString()
              );
              socialNetwork.name = name;
              socialNetwork.url = url;
              socialNetwork.event = entity.getString("id");

              socialIdxCounts.set(name, idx + 1);

              socialNetwork.save();
            }
          }
        } else if (attrs[i] == "questions") {
          if (aux.kind === JSONValueKind.ARRAY) {
            let questions = aux.toArray();

            for (let i = 0; i < questions.length; i++) {
              let question = questions[i];

              let questionValues = question.toObject().entries;

              let description: string = "";
              let responseType: string = "SHORT";
              let required: boolean = false;

              for (let j = 0; j < questionValues.length; j++) {
                let questionValue = questionValues[j];
                if (questionValue.key.toString() == "description") {
                  description = questionValue.value.toString();
                } else if (questionValue.key.toString() == "responseType") {
                  responseType = questionValue.value.toString();
                } else if (questionValue.key.toString() == "required") {
                  required = (questionValue.value.kind == JSONValueKind.BOOL) ? questionValue.value.toBool() : false;
                }
              }

              let questionEvent = new Question(
                getQuestionId(entity.getString("id"), i.toString())
              );
              questionEvent.event = entity.getString("id");
              questionEvent.description = description;
              questionEvent.responseType = responseType;
              questionEvent.required = required;

              questionEvent.save();
            }
          }
        }
        // hardcode our IPFS server.
        else if (attrs[i] == "image") {
          let strArr = parseJSONValueToString(aux).split("/");
          if (strArr.length > 0 && strArr[strArr.length - 1].length > 0) {
            entity.setString(
              attrs[i],
              "https://ipfs.fanz.events/ipfs/" + strArr[strArr.length - 1]
            );
          } else {
            entity.setString(attrs[i], parseJSONValueToString(aux));
          }
        } else if (attrs[i] == "extra_requirement") {
          entity.setString("extraRequirement", parseJSONValueToString(aux));
        } else {
          entity.setString(attrs[i], parseJSONValueToString(aux));
        }
      } else if (attrs[i] == "extra_requirement") {
        entity.setString("extraRequirement", "none");
      } else {
        log.debug("Could not get attr: " + attrs[i].toString(), []);
      }
    }
  } else {
    return "NOT_VALID";
  }

  return "PARSED";
}

export function parseJSONValueToString(value: JSONValue): string {
  switch (value.kind) {
    case JSONValueKind.STRING:
      return value.toString();
    case JSONValueKind.NUMBER:
      let str = value.toF64().toString();
      if (str[str.length - 1] == "0" && str[str.length - 2] == ".") {
        str = str.substring(0, str.length - 2);
      }
      return str;
    case JSONValueKind.BOOL:
      return value.toBool().toString();
    case JSONValueKind.OBJECT:
      return value
        .toObject()
        .entries.map<string>(
          (entry: TypedMapEntry<string, JSONValue>) =>
            entry.key + ":" + parseJSONValueToString(entry.value) + ","
        )
        .join(",");
    case JSONValueKind.ARRAY:
      return value
        .toArray()
        .map<string>((item: JSONValue) => parseJSONValueToString(item))
        .toString();
    default:
      return "";
  }
}

export function isStringAnInteger(value: String): boolean {
  for (var i = 0; i < value.length; i++) {
    if (value.charAt(i) < "0" && value.charAt(i) > "9") {
      return false;
    }
  }
  return true;
}

export function normalizeString(value: string): string {
  let newString = "";
  for (let i = 0; i < value.length; i++) {
    if (
      value.charAt(i) == "è" ||
      value.charAt(i) == "é" ||
      value.charAt(i) == "ê" ||
      value.charAt(i) == "ë" ||
      value.charAt(i) == "ē" ||
      value.charAt(i) == "ė" ||
      value.charAt(i) == "ę"
    ) {
      newString += "e";
    } else if (value.charAt(i) == "ÿ") {
      newString += "y";
    } else if (
      value.charAt(i) == "û" ||
      value.charAt(i) == "ü" ||
      value.charAt(i) == "ü" ||
      value.charAt(i) == "ù" ||
      value.charAt(i) == "ú" ||
      value.charAt(i) == "ú" ||
      value.charAt(i) == "ū"
    ) {
      newString += "u";
    } else if (
      value.charAt(i) == "î" ||
      value.charAt(i) == "ï" ||
      value.charAt(i) == "í" ||
      value.charAt(i) == "ī" ||
      value.charAt(i) == "į" ||
      value.charAt(i) == "ì"
    ) {
      newString += "i";
    } else if (
      value.charAt(i) == "ô" ||
      value.charAt(i) == "ö" ||
      value.charAt(i) == "ò" ||
      value.charAt(i) == "ó" ||
      value.charAt(i) == "œ" ||
      value.charAt(i) == "ø" ||
      value.charAt(i) == "ō" ||
      value.charAt(i) == "õ"
    ) {
      newString += "o";
    } else if (
      value.charAt(i) == "à" ||
      value.charAt(i) == "á" ||
      value.charAt(i) == "â" ||
      value.charAt(i) == "ä" ||
      value.charAt(i) == "æ" ||
      value.charAt(i) == "ã" ||
      value.charAt(i) == "å" ||
      value.charAt(i) == "ā"
    ) {
      newString += "a";
    } else if (value.charAt(i) == "ś" || value.charAt(i) == "š") {
      newString += "s";
    } else if (value.charAt(i) == "ł") {
      newString += "l";
    } else if (
      value.charAt(i) == "ž" ||
      value.charAt(i) == "ź" ||
      value.charAt(i) == "ż"
    ) {
      newString += "z";
    } else if (
      value.charAt(i) == "ç" ||
      value.charAt(i) == "ć" ||
      value.charAt(i) == "č"
    ) {
      newString += "c";
    } else if (value.charAt(i) == "ñ" || value.charAt(i) == "ń") {
      newString += "n";
    } else if (
      (value.charAt(i) >= "0" && value.charAt(i) <= "9") ||
      (value.charAt(i) >= "a" && value.charAt(i) <= "z") ||
      value.charAt(i) == "-"
    ) {
      newString += value.charAt(i);
    }
  }
  return newString;
}
