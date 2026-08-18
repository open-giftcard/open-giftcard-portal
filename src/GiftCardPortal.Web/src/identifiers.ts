/**
 * A random identifier that also works when the page is not a secure context.
 *
 * `crypto.randomUUID` is secure-context only, so it is simply absent when the
 * portal is opened over plain HTTP at a LAN address, which is exactly what
 * happens when someone demonstrates from a phone. Calling it there throws a
 * TypeError from inside whatever was running at the time, which is a confusing
 * way to discover the rule.
 *
 * `crypto.getRandomValues` has no such restriction, so the fallback is still
 * cryptographically random rather than `Math.random`. That matters because
 * these values are used as idempotency keys: two operations that collide would
 * be treated by the backend as the same operation.
 */
export function newIdentifier(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Version 4, variant 1, so the value is a well-formed UUID and not merely
  // random hex the backend might reject.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
