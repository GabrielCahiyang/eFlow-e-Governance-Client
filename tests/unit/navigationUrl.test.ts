// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getNavigationPath,
  getNavigationUrl,
  readNavigationLocation,
  useRoleNavigationState,
} from "../../src/app/features/navigation";

const getInitialPage = (section: string) =>
  ({
    dashboard: "Dashboard",
    projects: "Projects",
    tasks: "Task Board",
    reviews: "For Review",
    settings: "Appearance",
  })[section];

beforeEach(() => {
  window.history.replaceState({}, "", "/overview?page=Dashboard");
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("navigation URL contract", () => {
  it('lands a new account on its own home instead of the previous Admin page',()=>{
    window.history.replaceState({eflowActorId:'admin',eflowActorRole:'admin'},'', '/users?page=All+Users&workspace=old-office');
    const {result}=renderHook(()=>useRoleNavigationState('head',getInitialPage,'head'));
    expect(result.current.activeSection).toBe('dashboard');
    expect(window.location.pathname).toBe('/overview');
    expect(new URLSearchParams(window.location.search).has('workspace')).toBe(false);
    expect(window.history.state.eflowActorId).toBe('head');
  });
  it('keeps the same account’s authorized project deep link on reload',()=>{
    window.history.replaceState({eflowActorId:'head',eflowActorRole:'head'},'', '/projects?page=Projects&project=current&view=tasks');
    const {result}=renderHook(()=>useRoleNavigationState('head',getInitialPage,'head'));
    expect(result.current.activeSection).toBe('projects');
    expect(new URLSearchParams(window.location.search).get('project')).toBe('current');
  });
  it('starts at the new role’s home when the account role changes',()=>{
    window.history.replaceState({eflowActorId:'same-user',eflowActorRole:'admin'},'', '/users?page=All+Users');
    const {result}=renderHook(()=>useRoleNavigationState('head',getInitialPage,'same-user'));
    expect(result.current.activeSection).toBe('dashboard');
  });
  it('rejects an obsolete accepted navigation and restores only safe display parameters',async()=>{
    const {result}=renderHook(()=>useRoleNavigationState('head',getInitialPage));let moved=true;
    await act(async()=>{moved=await result.current.selectPageAsync('projects','Projects',{project:'stale',isCurrent:()=>false});});expect(moved).toBe(false);expect(window.location.pathname).toBe('/overview');
    await act(async()=>{expect(await result.current.selectPageAsync('projects','Projects',{project:'current',parameters:{project:'current',workspace:'office',view:'tasks',token:'never',subtask:'never'} as Record<string,string>})).toBe(true);});const query=new URLSearchParams(window.location.search);expect(query.get('project')).toBe('current');expect(query.get('workspace')).toBe('office');expect(query.get('token')).toBeNull();expect(query.get('subtask')).toBeNull();
  });
  it("uses readable section paths and a stable page query", () => {
    expect(getNavigationPath("reviews")).toBe("/reviews");
    expect(getNavigationPath("dashboard")).toBe("/overview");
    expect(getNavigationUrl("reviews", "For Review")).toBe(
      "/reviews?page=For+Review",
    );
  });

  it("parses a deep link without changing role navigation candidates", () => {
    window.history.replaceState({}, "", "/reviews?page=For+Review");
    expect(readNavigationLocation("head", getInitialPage)).toEqual({
      section: "reviews",
      page: "For Review",
    });
  });

  it("falls back to the registered page when a query is stale", () => {
    window.history.replaceState({}, "", "/reviews?page=Removed+page");
    expect(readNavigationLocation("head", getInitialPage)).toEqual({
      section: "reviews",
      page: "For Review",
    });
  });

  it("keeps an invitation's project and Office tab while restoring navigation", () => {
    window.history.replaceState(
      {},
      "",
      "/projects?page=Projects&project=shared-project&view=offices",
    );
    const { result } = renderHook(() =>
      useRoleNavigationState("head", getInitialPage),
    );
    expect(result.current.activeSection).toBe("projects");
    expect(new URLSearchParams(window.location.search).get("view")).toBe(
      "offices",
    );
    act(() => result.current.selectPage("reviews", "For Review"));
    expect(new URLSearchParams(window.location.search).has("view")).toBe(false);
  });

  it("retains Office Budget handoff view and fiscal year at startup and clears the view when leaving", () => {
    window.history.replaceState(
      {},
      "",
      "/office-budget?page=Office%20Budget&view=approvals&fy=2026",
    );
    const { result } = renderHook(() =>
      useRoleNavigationState("head", getInitialPage),
    );
    expect(result.current.activeSection).toBe("budget");
    expect(new URLSearchParams(window.location.search).get("view")).toBe(
      "approvals",
    );
    expect(new URLSearchParams(window.location.search).get("fy")).toBe("2026");
    act(() => result.current.selectPage("reviews", "For Review"));
    expect(new URLSearchParams(window.location.search).has("view")).toBe(false);
  });

  it("writes selections and follows browser back/forward", async () => {
    const { result } = renderHook(() =>
      useRoleNavigationState("head", getInitialPage),
    );

    act(() => result.current.selectPage("reviews", "For Review"));
    expect(window.location.pathname).toBe("/reviews");
    expect(new URLSearchParams(window.location.search).get("page")).toBe(
      "For Review",
    );

    window.history.pushState({}, "", "/tasks?page=Task+Board");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(result.current.activeSection).toBe("tasks"));
    expect(result.current.activePage).toBe("Task Board");
  });
});
