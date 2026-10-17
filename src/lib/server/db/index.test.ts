import { describe, expect, it } from "vitest";
import { isLocalPlaintextDatabase } from "@/lib/server/db";

describe("isLocalPlaintextDatabase", () => {
  it("allows plain text only for loopback hosts that opt out of TLS", () => {
    expect(isLocalPlaintextDatabase(new URL("postgres://u:p@127.0.0.1:5433/db?sslmode=disable"))).toBe(true);
    expect(isLocalPlaintextDatabase(new URL("postgres://u:p@localhost/db?sslmode=disable"))).toBe(true);
    expect(isLocalPlaintextDatabase(new URL("postgres://u:p@[::1]/db?sslmode=disable"))).toBe(true);
  });

  it("keeps verified TLS everywhere else", () => {
    expect(isLocalPlaintextDatabase(new URL("postgres://u:p@127.0.0.1/db"))).toBe(false);
    expect(isLocalPlaintextDatabase(new URL("postgres://u:p@127.0.0.1/db?sslmode=require"))).toBe(false);
    expect(isLocalPlaintextDatabase(new URL("postgres://u:p@ep-x.neon.tech/db?sslmode=disable"))).toBe(false);
    expect(isLocalPlaintextDatabase(new URL("postgres://u:p@localhost.evil.com/db?sslmode=disable"))).toBe(false);
  });
});
