import { Tooltip } from "@vibe/core";
import { cloneElement, useEffect, useId, useState, type ReactElement } from "react";

/** Supplemental help. Keep labels and essential guidance visible in the
 * trigger or its opened panel. Vibe supplies focus/Escape handling and portals. */
export function WorkspaceTooltip({ content, children, disabled = false }: { content: string; children: ReactElement; disabled?: boolean }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const childProps = children.props as { 'aria-describedby'?: string };
  const description = [childProps['aria-describedby'], visible && !disabled ? id : undefined].filter(Boolean).join(' ') || undefined;
  useEffect(() => {
    if (!visible || disabled) return;
    // Vibe dismisses on keyup. Protect the containing Radix dialog/menu from
    // handling the preceding keydown, so Escape dismisses only this layer.
    const dismissLayer = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', dismissLayer, true);
    return () => window.removeEventListener('keydown', dismissLayer, true);
  }, [visible, disabled]);
  return <Tooltip
    content={<span id={id} role="tooltip">{content}</span>}
    position="bottom"
    showDelay={300}
    hideDelay={100}
    hideTrigger={["mouseleave", "blur", "click", "esckey"]}
    hideWhenReferenceHidden
    disable={disabled}
    onTooltipShow={() => setVisible(true)}
    onTooltipHide={() => setVisible(false)}
    className="eflow-workspace-tooltip"
  >{cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': description })}</Tooltip>;
}
