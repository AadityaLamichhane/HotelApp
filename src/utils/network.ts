import { hostname, networkInterfaces } from "os";

const PRIVATE_IPV4 = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

// Interfaces that usually belong to containers/VPNs, never the LAN address
// the hotel tablet needs to reach.
const VIRTUAL_INTERFACE = /^(docker|veth|br-|virbr|vmnet|tun|tap|lo)/i;

const isIpv4 = (family: string | number) => family === "IPv4" || family === 4;

const isPrivateIpv4 = (ip: string) => PRIVATE_IPV4.some((pattern) => pattern.test(ip));

const scoreAddress = (interfaceName: string, ip: string): number => {
  if (VIRTUAL_INTERFACE.test(interfaceName)) return -1;
  if (/^169\.254\./.test(ip)) return -1;
  if (/^192\.168\./.test(ip)) return 100;
  if (/^10\./.test(ip)) return 90;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 80;
  if (isPrivateIpv4(ip)) return 70;
  return 10;
};

/**
 * Best-guess LAN IPv4 of the machine running this process.
 * Prefers 192.168.x > 10.x > 172.16-31.x and ignores internal,
 * loopback, link-local and container/VPN interfaces.
 */
export const getLocalIpv4 = (): string => {
  const interfaces = networkInterfaces();
  let bestIp = "";
  let bestScore = -1;

  for (const [interfaceName, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (!isIpv4(address.family) || address.internal) continue;
      if (address.address.startsWith("127.")) continue;

      const score = scoreAddress(interfaceName, address.address);
      if (score > bestScore) {
        bestScore = score;
        bestIp = address.address;
      }
    }
  }

  return bestIp || "127.0.0.1";
};

export const getDeviceHostname = (): string => hostname();
