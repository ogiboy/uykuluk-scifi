import net from "node:net";

const nativeFetch = globalThis.fetch.bind(globalThis);
const nativeConnect = net.Socket.prototype.connect;

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  requireLoopbackHost(url.hostname);
  return nativeFetch(input, init);
};

net.Socket.prototype.connect = function guardedConnect(
  this: net.Socket,
  ...args: unknown[]
): net.Socket {
  const host = connectHost(args);
  if (host) requireLoopbackHost(host);
  return Reflect.apply(nativeConnect, this, args) as net.Socket;
} as typeof net.Socket.prototype.connect;

function connectHost(args: unknown[]): string | undefined {
  const first: unknown = args[0];
  if (typeof first === "object" && first !== null) {
    const options = first as { host?: string; path?: string };
    if (options.path) return undefined;
    return options.host ?? "localhost";
  }
  if (typeof first === "number") {
    const second: unknown = args[1];
    return typeof second === "string" ? second : "localhost";
  }
  return undefined;
}

function requireLoopbackHost(rawHost: string): void {
  const host = rawHost.replace(/^\[|\]$/g, "").toLowerCase();
  const allowed =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host.startsWith("::ffff:127.");
  if (!allowed) {
    throw new Error(`Outbound network is disabled in tests: ${rawHost}.`);
  }
}
