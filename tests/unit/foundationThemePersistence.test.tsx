// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UserPreferencesProvider, useUserPreferences } from "../../src/app/contexts/UserPreferencesContext";
const settings = vi.hoisted(() => ({fetch:vi.fn(),save:vi.fn()}));
vi.mock("../../src/app/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"fixture"}})}));
vi.mock("../../src/app/services/userSettingsService",()=>({fetchUserPreferences:settings.fetch,upsertUserPreferences:settings.save}));
afterEach(()=>{cleanup();vi.restoreAllMocks();document.documentElement.classList.remove("dark");});
it("follows system appearance and rolls back a rejected preference save", async () => {
  let dark = false;const listeners = new Set<()=>void>();
  vi.stubGlobal("matchMedia",(query:string)=>({get matches(){return dark;},media:query,addEventListener:(_name:string,fn:()=>void)=>listeners.add(fn),removeEventListener:(_name:string,fn:()=>void)=>listeners.delete(fn)}));
  settings.fetch.mockResolvedValue({user_id:"fixture",theme:"light"});
  settings.save.mockImplementation(async (_id,patch)=>({user_id:"fixture",...patch}));
  function Fixture(){const {theme,setTheme,error} = useUserPreferences();return <><output>{theme}</output>{["dark","light","system"].map(value=><button key={value} onClick={()=>void setTheme(value as "light"|"dark"|"system").catch(()=>{})}>{value}</button>)}{error&&<p role="alert">{error}</p>}</>;}
  render(<UserPreferencesProvider><Fixture /></UserPreferencesProvider>);
  await waitFor(()=>expect(screen.getByText("light",{selector:"output"})).toBeTruthy());
  fireEvent.click(screen.getByRole("button",{name:"dark"}));await waitFor(()=>expect(document.documentElement.classList.contains("dark")).toBe(true));
  fireEvent.click(screen.getByRole("button",{name:"system"}));await waitFor(()=>expect(screen.getByText("system",{selector:"output"})).toBeTruthy());
  dark=true;listeners.forEach(fn=>fn());expect(document.documentElement.classList.contains("dark")).toBe(true);
  settings.save.mockRejectedValueOnce(new Error("Offline"));fireEvent.click(screen.getByRole("button",{name:"light"}));
  await screen.findByRole("alert");expect(document.documentElement.classList.contains("dark")).toBe(true);expect(screen.getByText("system",{selector:"output"})).toBeTruthy();
  vi.unstubAllGlobals();
});
