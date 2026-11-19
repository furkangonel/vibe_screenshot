import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const load = createRequire(import.meta.url);
const { createMcpService } = load('../electron/mcp-service.cjs');
it('serves the MCP protocol, authenticates every request and fully stops when disabled', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-mcp-unit-'));
  const reservation = net.createServer();
  await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const calls: { method: string; args: Record<string, unknown> }[] = [];
  const service = createMcpService({
    userData: profile,
    executable: process.execPath,
    bridgePath: '/example/stdio-bridge.cjs',
    callRenderer: async (method: string, args: Record<string, unknown>) => {
      calls.push({ method, args });
      return { ok: true };
    },
  });
  const client = new Client({ name: 'studio-test', version: '1.0.0' });
  try {
    await service.init();
    expect(service.status().enabled).toBe(false);
    expect(service.status().running).toBe(false);
    await service.setSettings({ enabled: true, port });
    const { url, token } = JSON.parse(await fs.readFile(path.join(profile, 'mcp-connection.json'), 'utf8'));
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    };
    expect(
      (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))
        .status,
    ).toBe(401);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://untrusted.example' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    const hostileHost = await new Promise<number>((resolve) => {
      const request = http.request(
        url,
        { method: 'POST', headers: { ...headers, Host: 'attacker.example' } },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      );
      request.end('{}');
    });
    expect(hostileHost).toBe(403);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const catalog = await client.listTools();
    expect(catalog.tools).toHaveLength(34);
    expect(catalog.tools.find((t) => t.name === 'preview_render')?.annotations?.readOnlyHint).toBe(true);
    expect(catalog.tools.find((t) => t.name === 'layer_remove')?.annotations?.destructiveHint).toBe(true);
    expect((await client.listResources()).resources[0].uri).toBe('vibe://reference');
    expect((await client.listPrompts()).prompts[0].name).toBe('compose-store-screenshots');
    const result = await client.callTool({ name: 'project_create', arguments: { name: 'Local test' } });
    expect(result.isError).not.toBe(true);
    expect(calls).toEqual([
      { method: 'project_create', args: { name: 'Local test', examples: false, defaultLocale: 'en-US' } },
    ]);
    const invalid = await client.callTool({
      name: 'document_update',
      arguments: { projectId: 'a', documentId: 'b', patch: null },
    });
    expect(invalid.isError).toBe(true);
    expect(calls).toHaveLength(1);
    await client.close();
    await service.setSettings({ enabled: false });
    expect(service.status().running).toBe(false);
    expect(JSON.parse(await fs.readFile(path.join(profile, 'mcp-connection.json'), 'utf8')).enabled).toBe(
      false,
    );
    await expect(fetch(url, { method: 'POST', headers, body: '{}' })).rejects.toThrow();
    expect(JSON.stringify(service.status())).not.toContain(token);
  } finally {
    await client.close();
    await service.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
