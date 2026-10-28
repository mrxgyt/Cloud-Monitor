import type { ClientRequest } from "node:http";
import type { Socket } from "node:net";
import type { Duplex } from "node:stream";

export interface VpnActivitySnapshot {
  activeConnections: number;
  uploadBytes: number;
  downloadBytes: number;
  lastTrafficAt: string | null;
  startedAt: string;
}

const startedAt = new Date().toISOString();
let activeConnections = 0;
let uploadBytes = 0;
let downloadBytes = 0;
let lastTrafficAt: string | null = null;

function addBytes(direction: "upload" | "download", chunk: unknown): void {
  const bytes =
    Buffer.isBuffer(chunk)
      ? chunk.byteLength
      : typeof chunk === "string"
        ? Buffer.byteLength(chunk)
        : ArrayBuffer.isView(chunk)
          ? chunk.byteLength
          : 0;

  if (bytes === 0) return;

  if (direction === "upload") {
    uploadBytes += bytes;
  } else {
    downloadBytes += bytes;
  }

  lastTrafficAt = new Date().toISOString();
}

export function trackWebSocketProxy(
  proxyRequest: ClientRequest,
  clientSocket: Socket,
  clientHead: Buffer,
): void {
  proxyRequest.once(
    "upgrade",
    (response, upstreamSocket: Duplex, upstreamHead: Buffer) => {
      if (response.statusCode !== 101) return;

      activeConnections += 1;
      addBytes("upload", clientHead);
      addBytes("download", upstreamHead);

      const onClientData = (chunk: unknown) => addBytes("upload", chunk);
      const onUpstreamData = (chunk: unknown) => addBytes("download", chunk);
      let closed = false;

      const finish = () => {
        if (closed) return;
        closed = true;
        activeConnections = Math.max(0, activeConnections - 1);

        clientSocket.off("data", onClientData);
        upstreamSocket.off("data", onUpstreamData);
        clientSocket.off("close", finish);
        upstreamSocket.off("close", finish);
        clientSocket.off("error", finish);
        upstreamSocket.off("error", finish);
      };

      clientSocket.on("data", onClientData);
      upstreamSocket.on("data", onUpstreamData);
      clientSocket.once("close", finish);
      upstreamSocket.once("close", finish);
      clientSocket.once("error", finish);
      upstreamSocket.once("error", finish);
    },
  );
}

export function getVpnActivitySnapshot(): VpnActivitySnapshot {
  return {
    activeConnections,
    uploadBytes,
    downloadBytes,
    lastTrafficAt,
    startedAt,
  };
}
