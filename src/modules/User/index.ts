import { Address } from "@graphprotocol/graph-ts";
import { User } from"../../../build/generated/schema";

export function loadOrCreateUser(id: Address): User {
  let user = User.load(id.toHex());
  if (user == null) {
    user = new User(id.toHex());
    user.address = id.toHex();
    user.save();
  }
  return user;
}
