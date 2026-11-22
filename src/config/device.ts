import { hostname } from "os";
import { join } from "path";
import { writeFileSync } from "fs";
import logger from "./logger";
import env from "./env";
import { getLocalIpv4 } from "@/utils/network";

export interface DeviceConfig {
  /** This device is identified by its private LAN IP. */
  deviceId: string;
  ip: string;
  hostname: string;
  port: number;
  /** Base URL a phone on the same network should call, e.g. http://192.168.1.8:8081/api */
  apiBaseUrl: string;
  mode: string;
  updatedAt: string;
}

const CONFIG_PATH = join(process.cwd(), ".device.config.json");

const buildDeviceConfig = (overrides: Partial<DeviceConfig> = {}): DeviceConfig => {
  const ip = overrides.ip ?? getLocalIpv4();
  const port = overrides.port ?? env.PORT;

  return {
    deviceId: overrides.deviceId ?? ip,
    ip,
    hostname: overrides.hostname ?? hostname(),
    port,
    apiBaseUrl: overrides.apiBaseUrl ?? `http://${ip}:${port}/api`,
    mode: overrides.mode ?? env.MODE,
    updatedAt: new Date().toISOString(),
  };
};

const persist = (config: DeviceConfig): void => {
  try {
    writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  } catch (error) {
    logger.warn(`[device] Could not persist device config: ${String(error)}`);
  }
};

let current: DeviceConfig | null = null;

export const getDeviceConfig = (): DeviceConfig => {
  if (!current) {
    current = buildDeviceConfig();
  }
  return current;
};

/** Set parts of the config and persist it to `.device.config.json`. */
export const setDeviceConfig = (partial: Partial<DeviceConfig>): DeviceConfig => {
  current = buildDeviceConfig({ ...getDeviceConfig(), ...partial });
  persist(current);
  return current;
};

/** Re-detect the machine IP (call once on startup). */
export const refreshDeviceConfig = (
  overrides: Partial<DeviceConfig> = {},
): DeviceConfig => {
  current = buildDeviceConfig(overrides);
  persist(current);
  return current;
};

export { CONFIG_PATH as DEVICE_CONFIG_PATH };
