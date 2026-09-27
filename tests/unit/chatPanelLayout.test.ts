import { describe, expect, it } from "vitest";
import { clampChatPanelPosition, clampChatPanelSize } from "../../src/app/features/chat-calls/services/chatPanelLayout";

describe("chat panel responsive placement", () => {
  it("keeps a resized chat panel inside a phone viewport", () => {
    expect(clampChatPanelSize({ w: 640, h: 700 }, { width: 375, height: 667 })).toEqual({ w: 359, h: 651 });
  });

  it("keeps a dragged panel within visible viewport margins", () => {
    expect(clampChatPanelPosition({ x: 900, y: -20 }, { w: 320, h: 420 }, { width: 1024, height: 768 })).toEqual({ x: 696, y: 8 });
  });
});
