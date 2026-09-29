import { describe, expect, it } from "vitest";
import { validateLoginFields } from "../../src/app/features/authentication";

describe("login validation", () => {
  it("identifies missing fields and malformed email before authentication", () => {
    expect(validateLoginFields("", "")).toEqual({ email: "Enter your email address.", password: "Enter your password." });
    expect(validateLoginFields("name", "password")).toEqual({ email: "Enter a valid email address." });
    expect(validateLoginFields(" user@example.com ", "password")).toEqual({});
  });
});
