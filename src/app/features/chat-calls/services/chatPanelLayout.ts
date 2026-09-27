const PANEL_MARGIN = 8;
const MIN_PANEL_WIDTH = 280;
const MIN_PANEL_HEIGHT = 320;

export type ChatPanelSize = { w: number; h: number };
export type ChatPanelPosition = { x: number; y: number };
export type ChatViewport = { width: number; height: number };

export function clampChatPanelSize(size: ChatPanelSize, viewport: ChatViewport): ChatPanelSize {
  const maxWidth = Math.max(0, viewport.width - PANEL_MARGIN * 2);
  const maxHeight = Math.max(0, viewport.height - PANEL_MARGIN * 2);
  return {
    w: Math.min(Math.max(MIN_PANEL_WIDTH, size.w), Math.max(MIN_PANEL_WIDTH, maxWidth)),
    h: Math.min(Math.max(MIN_PANEL_HEIGHT, size.h), Math.max(MIN_PANEL_HEIGHT, maxHeight)),
  };
}

export function clampChatPanelPosition(position: ChatPanelPosition, size: ChatPanelSize, viewport: ChatViewport): ChatPanelPosition {
  return {
    x: Math.max(PANEL_MARGIN, Math.min(position.x, Math.max(PANEL_MARGIN, viewport.width - size.w - PANEL_MARGIN))),
    y: Math.max(PANEL_MARGIN, Math.min(position.y, Math.max(PANEL_MARGIN, viewport.height - size.h - PANEL_MARGIN))),
  };
}
