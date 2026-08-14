import { posix, win32 } from "node:path";

export type Platform = "darwin" | "win32" | "linux";

export type PlatformPaths = {
  appData: string;
  harnessHome: string;
  logs: string;
  temp: string;
  workspaceRoot: string;
};

type PathModule = {
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
};

const appFolderByPlatform: Record<Platform, string> = {
  darwin: "DeepSeek Harness",
  linux: "deepseek-harness",
  win32: "DeepSeek Harness",
};

export function resolvePlatformPaths(
  appDataRoot: string,
  platform: Platform,
  homeDir?: string,
): PlatformPaths {
  const pathModule: PathModule = platform === "win32" ? win32 : posix;
  const normalizedRoot = pathModule.resolve(appDataRoot);
  const appData = pathModule.resolve(
    normalizedRoot,
    appFolderByPlatform[platform],
  );
  const workspaceBase = pathModule.resolve(homeDir ?? normalizedRoot);

  return {
    appData,
    harnessHome: pathModule.join(appData, "harness"),
    logs: pathModule.join(appData, "logs"),
    temp: pathModule.join(appData, "tmp"),
    workspaceRoot: pathModule.join(workspaceBase, appFolderByPlatform[platform]),
  };
}
