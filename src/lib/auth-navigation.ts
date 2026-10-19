export function postLoginPath(role: "customer" | "business_owner") {
  return role === "business_owner" ? "/business" : "/account";
}
