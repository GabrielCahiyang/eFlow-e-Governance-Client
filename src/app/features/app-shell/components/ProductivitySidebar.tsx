import { Button, Tooltip } from "@vibe/core";
import { NavigationChevronDown } from "@vibe/icons";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useMemo, useState } from "react";
import type { RoleNavItem } from "../../navigation";
import { motionTransition } from "../../../shared/motion";
import eflowLogo from "../../../shared/branding/eflow-logo.svg";
import eflowIcon from "../../../shared/branding/icon.svg";
import { getEflowNavigationIcon } from "../eflowNavigationIcons";

export interface ShellPage {
  label: string;
}

export interface ShellNavigationItem extends RoleNavItem {
  group: string;
  pages: ShellPage[];
  hasAlert?: boolean;
}

interface ProductivitySidebarProps {
  activePage?: string;
  activeSection: string;
  mobile?: boolean;
  navigationItems: ShellNavigationItem[];
  onPageSelect: (section: string, page: string) => void;
  workspaceName: string;
}

function groupNavigationItems(items: ShellNavigationItem[]) {
  const groups: Array<{ title: string; items: ShellNavigationItem[] }> = [];
  for (const item of items) {
    const existingGroup = groups.find((group) => group.title === item.group);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.push({ title: item.group, items: [item] });
    }
  }
  return groups;
}

export function ProductivitySidebar({
  activePage,
  activeSection,
  mobile = false,
  navigationItems,
  onPageSelect,
  workspaceName,
}: ProductivitySidebarProps) {
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set([activeSection]),
  );
  const navigationGroups = useMemo(
    () => groupNavigationItems(navigationItems),
    [navigationItems],
  );
  const isCompact = !mobile && !isHovered && !hasFocusWithin;

  useEffect(() => {
    setExpandedSections((current) => new Set(current).add(activeSection));
  }, [activeSection]);

  const selectSection = (item: ShellNavigationItem) => {
    if (mobile && item.pages.length > 1) {
      setExpandedSections((current) => {
        const next = new Set(current);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
      return;
    }

    if (item.pages.length > 1) {
      setExpandedSections((current) => new Set(current).add(item.id));
    }
    onPageSelect(item.id, item.pages[0]?.label ?? item.label);
  };

  return (
    <m.aside
      layout
      transition={motionTransition.navigation}
      aria-label="Primary navigation"
      data-tour-id="primary-navigation"
      data-navigation-density={isCompact ? "compact" : "expanded"}
      className={`eflow-productivity-sidebar ${isCompact ? "eflow-productivity-sidebar--compact" : ""}`}
      onFocusCapture={() => setHasFocusWithin(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setHasFocusWithin(false);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Brand Box */}
      <div className="eflow-productivity-sidebar__brand" data-tour-id="brand">
        <AnimatePresence initial={false} mode="wait">
          {isCompact ? (
            <m.img
              key="compact-brand"
              alt="eFlow"
              className="eflow-productivity-sidebar__icon"
              src={eflowIcon}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={motionTransition.productive}
            />
          ) : (
            <m.div
              key="expanded-brand"
              className="eflow-productivity-sidebar__brand-lockup"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={motionTransition.productive}
            >
              <img alt="eFlow" className="eflow-productivity-sidebar__logo" src={eflowLogo} />
              <p className="eflow-productivity-sidebar__workspace" title={workspaceName}>{workspaceName}</p>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Items */}
      <nav className="eflow-productivity-sidebar__nav" aria-label="Workspace destinations">
        {navigationGroups.map((group) => (
          <m.section layout="position" transition={motionTransition.navigation} className="eflow-productivity-sidebar__group" key={group.title} aria-label={group.title}>
            {!isCompact && <p className="eflow-productivity-sidebar__group-label">{group.title}</p>}
            <div className="eflow-productivity-sidebar__items">
              {group.items.map((item) => {
                const Icon = getEflowNavigationIcon(item.id);
                const isCurrentSection = activeSection === item.id;
                const hasSubpages = item.pages.length > 1;
                const isExpanded = mobile
                  ? expandedSections.has(item.id)
                  : isCurrentSection && expandedSections.has(item.id);

                if (isCompact) {
                  return (
                    <div className="eflow-productivity-sidebar__item-wrap" data-tour-section={item.id} key={item.id}>
                      <div className="eflow-productivity-sidebar__item-main">
                        {isCurrentSection && (
                          <m.span
                            aria-hidden="true"
                            className="eflow-productivity-sidebar__active-surface"
                            layoutId="eflow-sidebar-active-destination"
                            transition={motionTransition.navigation}
                          />
                        )}
                        <Tooltip content={item.label}>
                          <m.button
                            aria-label={item.label}
                            aria-current={isCurrentSection ? "page" : undefined}
                            aria-pressed={isCurrentSection}
                            className={`eflow-productivity-sidebar__compact-item ${
                              isCurrentSection ? "eflow-productivity-sidebar__compact-item--active" : ""
                            }`}
                            onClick={() => selectSection(item)}
                            type="button"
                            whileTap={{ scale: 0.92 }}
                          >
                            <span className="eflow-productivity-sidebar__compact-icon relative">
                              <Icon size={20} />
                              {item.hasAlert && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 pointer-events-none" title="Actions pending">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                                </span>
                              )}
                            </span>
                          </m.button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="eflow-productivity-sidebar__item-wrap" data-tour-section={item.id} key={item.id}>
                    <div className="eflow-productivity-sidebar__item-main">
                      {isCurrentSection && (
                        <m.span
                          aria-hidden="true"
                          className="eflow-productivity-sidebar__active-surface"
                          layoutId="eflow-sidebar-active-destination"
                          transition={motionTransition.navigation}
                        />
                      )}
                      <Button
                        aria-current={isCurrentSection ? "page" : undefined}
                        aria-pressed={isCurrentSection}
                        className={`eflow-productivity-sidebar__item ${isCurrentSection ? "eflow-productivity-sidebar__item--active" : ""}`}
                        key={item.id}
                        kind="tertiary"
                        leftIcon={Icon}
                        onClick={() => selectSection(item)}
                      >
                        <span className="eflow-productivity-sidebar__item-label">{item.label}</span>
                        {item.hasAlert && (
                          <span className="ml-auto mr-1.5 flex h-2 w-2 shrink-0 pointer-events-none" title="Actions pending">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                          </span>
                        )}
                        {hasSubpages && (
                          <span
                            aria-hidden="true"
                            className={`eflow-productivity-sidebar__chevron ${isExpanded ? "eflow-productivity-sidebar__chevron--expanded" : ""}`}
                          >
                            <NavigationChevronDown size={14} />
                          </span>
                        )}
                      </Button>
                    </div>
                    <AnimatePresence initial={false}>
                      {hasSubpages && isExpanded && (
                        <m.div
                          key={`${item.id}-pages`}
                          className="eflow-productivity-sidebar__subpages"
                          aria-label={`${item.label} pages`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={motionTransition.navigation}
                        >
                          {item.pages.map((page) => (
                            <Button
                              aria-current={activeSection === item.id && activePage === page.label ? "page" : undefined}
                              aria-pressed={activeSection === item.id && activePage === page.label}
                              className={`eflow-productivity-sidebar__subpage ${activeSection === item.id && activePage === page.label ? "eflow-productivity-sidebar__subpage--active" : ""}`}
                              key={`${item.id}-${page.label}`}
                              kind="tertiary"
                              onClick={() => onPageSelect(item.id, page.label)}
                            >
                              {page.label}
                            </Button>
                          ))}
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </m.section>
        ))}
      </nav>

    </m.aside>
  );
}
