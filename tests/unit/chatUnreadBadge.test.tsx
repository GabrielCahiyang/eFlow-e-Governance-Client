// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatUnreadBadge } from "../../src/app/features/chat-calls/components/ChatUnreadBadge";

afterEach(cleanup);

describe("ChatUnreadBadge", () => {
  it("announces the full unread total while keeping the compact sidebar badge bounded", () => {
    render(<ChatUnreadBadge count={12} />);

    expect(screen.getByLabelText("12 unread conversations").textContent).toBe("9+");
  });
});
