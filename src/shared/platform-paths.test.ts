import { describe, expect, it } from "vitest";

import { resolvePlatformPaths } from "./platform-paths.js";

describe("resolvePlatformPaths", () => {
  it.each([
    {
      appDataRoot: "/var/app-data",
      expectedAppFolder: "DeepSeek Harness",
      expectedSeparator: "/",
      homeDir: "/Users/ada",
      platform: "darwin" as const,
    },
    {
      appDataRoot: "C:\\Users\\Ada\\AppData\\Roaming",
      expectedAppFolder: "DeepSeek Harness",
      expectedSeparator: "\\",
      homeDir: "C:\\Users\\Ada",
      platform: "win32" as const,
    },
    {
      appDataRoot: "/home/ada/.local/share",
      expectedAppFolder: "deepseek-harness",
      expectedSeparator: "/",
      homeDir: "/home/ada",
      platform: "linux" as const,
    },
  ])(
    "uses the $platform application folder name",
    ({
      appDataRoot,
      expectedAppFolder,
      expectedSeparator,
      homeDir,
      platform,
    }) => {
      const paths = resolvePlatformPaths(appDataRoot, platform, homeDir);
      const appData = `${appDataRoot}${expectedSeparator}${expectedAppFolder}`;

      expect(paths.appData).toBe(appData);
      expect(paths.logs).toBe(`${appData}${expectedSeparator}logs`);
      expect(paths.temp).toBe(`${appData}${expectedSeparator}tmp`);
      expect(paths.harnessHome).toBe(`${appData}${expectedSeparator}harness`);
    },
  );

  it("normalizes the default workspace path from the supplied home directory", () => {
    const paths = resolvePlatformPaths(
      "/var/app-data",
      "darwin",
      "/Users/ada/Projects/../Workspace/..",
    );

    expect(paths.workspaceRoot).toBe("/Users/ada/DeepSeek Harness");
  });

  it("keeps every app-owned path inside the normalized app-data root", () => {
    const paths = resolvePlatformPaths(
      "/var/app-data/managed/../managed",
      "linux",
      "/Users/ada",
    );
    const normalizedRoot = "/var/app-data/managed";

    expect(paths.appData).toBe(`${normalizedRoot}/deepseek-harness`);
    expect(paths.appData.startsWith(`${normalizedRoot}/`)).toBe(true);
    expect(paths.logs.startsWith(`${paths.appData}/`)).toBe(true);
    expect(paths.temp.startsWith(`${paths.appData}/`)).toBe(true);
    expect(paths.harnessHome.startsWith(`${paths.appData}/`)).toBe(true);
    expect(paths.appData).not.toContain("..");
    expect(paths.logs).not.toContain("..");
    expect(paths.temp).not.toContain("..");
    expect(paths.harnessHome).not.toContain("..");
  });
});
