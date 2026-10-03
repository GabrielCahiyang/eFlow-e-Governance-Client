// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  getGuidedTourStorageKey,
  readGuidedTourProgress,
  writeGuidedTourProgress,
} from "../../src/app/features/guided-tours";

const storage = new Map<string, string>();
const storageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size; },
};

Object.defineProperty(window, "localStorage", {
  value: storageMock,
  configurable: true,
  writable: true,
});

beforeEach(() => window.localStorage.clear());

describe("guided tour progress", () => {
  it("isolates first-login and resume state by authenticated user and role", () => {
    writeGuidedTourProgress("user-1", "member", {
      welcomed: true,
      systemCompleted: false,
      completedPages: ["tasks:My Tasks"],
      voiceEnabled: true,
      activeTour: { kind: "system", index: 3, section: "tasks", page: "My Tasks" },
    });

    expect(readGuidedTourProgress("user-1", "member").activeTour?.index).toBe(3);
    expect(readGuidedTourProgress("user-1", "member").voiceEnabled).toBe(true);
    expect(readGuidedTourProgress("user-2", "member").welcomed).toBe(false);
    expect(getGuidedTourStorageKey("user-1", "member")).not.toBe(getGuidedTourStorageKey("user-1", "head"));
  });

  it("recovers safely when stored progress is malformed", () => {
    window.localStorage.setItem(getGuidedTourStorageKey("user-1", "member"), "not-json");
    expect(readGuidedTourProgress("user-1", "member")).toEqual({
      welcomed: false,
      systemCompleted: false,
      completedPages: [],
      voiceEnabled: false,
    });
  });
});
