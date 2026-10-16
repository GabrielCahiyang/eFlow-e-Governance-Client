import { realpathSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBrowserExecutable } from "../helpers/browserExecutable";

afterEach(() => vi.restoreAllMocks());

describe("browser executable resolution", () => {
  it("uses native Windows resolution for a virtualized AppData alias", () => {
    const alias = "C:\\fixture\\AppData\\Local\\firefox.exe";
    const physical = "C:\\fixture\\Packages\\LocalCache\\firefox.exe";
    const native = vi.spyOn(realpathSync, "native").mockReturnValue(physical);

    expect(resolveBrowserExecutable(alias, "win32")).toBe(physical);
    expect(native).toHaveBeenCalledWith(alias);
  });

  it("resolves the explicitly selected executable without choosing another browser", () => {
    const selected = "C:\\fixture\\custom-firefox\\firefox.exe";
    const native = vi.spyOn(realpathSync, "native").mockReturnValue(selected);

    expect(resolveBrowserExecutable(selected, "win32")).toBe(selected);
    expect(native).toHaveBeenCalledWith(selected);
  });

  it.each(["ENOENT", "ENOTDIR"])(
    "preserves Playwright's missing-installation diagnostic for %s",
    (code) => {
      vi.spyOn(realpathSync, "native").mockImplementation(() => {
        throw Object.assign(new Error("Missing fixture installation"), { code });
      });

      expect(resolveBrowserExecutable("missing-firefox.exe", "win32")).toBe(
        "missing-firefox.exe",
      );
    },
  );

  it.each(["EACCES", "EPERM"])("does not hide %s failures", (code) => {
    const error = Object.assign(new Error("Access denied"), { code });
    vi.spyOn(realpathSync, "native").mockImplementation(() => {
      throw error;
    });

    expect(() => resolveBrowserExecutable("selected-firefox.exe", "win32")).toThrow(
      error,
    );
  });

  it.each(["linux", "darwin"] as const)(
    "retains the selected path without a Windows lookup on %s",
    (platform) => {
      const native = vi.spyOn(realpathSync, "native");

      expect(resolveBrowserExecutable("/fixture/firefox", platform)).toBe(
        "/fixture/firefox",
      );
      expect(native).not.toHaveBeenCalled();
    },
  );
});
