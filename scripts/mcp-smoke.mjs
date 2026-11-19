import { _electron as electron, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-mcp-desktop-'));
const profile = path.join(root, 'profile'),
  home = path.join(root, 'agents');
await fs.mkdir(path.join(home, '.codex'), { recursive: true });
await fs.mkdir(path.join(home, '.cursor'), { recursive: true });
const codexOriginal =
  '# Existing preferences\nmodel = "keep-my-model"\n[mcp_servers.other]\ncommand = "keep-this-server"\n';
await fs.writeFile(path.join(home, '.codex/config.toml'), codexOriginal);
await fs.writeFile(
  path.join(home, '.cursor/mcp.json'),
  '{"mcpServers":{"other":{"command":"keep-this-server"}},"examplePreference":true}',
);
const executablePath = process.env.VIBE_PACKAGED_EXECUTABLE;
let app, client, stdio;
const errors = [];
async function launch() {
  return electron.launch({
    ...(executablePath ? { executablePath, args: [] } : { args: ['.'] }),
    env: {
      ...process.env,
      VIBE_DEV_URL: '',
      VIBE_PROFILE_DIR: profile,
      VIBE_AGENT_TEST_HOME: home,
      VIBE_HIDE_TEST_WINDOW: '1',
    },
  });
}
function text(result) {
  const item = result.content.find((c) => c.type === 'text');
  if (result.isError) throw new Error(item?.text);
  return JSON.parse(item.text);
}
try {
  app = await launch();
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('heading', { name: /Your workspace|Çalışma alanın/ })).toBeVisible();
  await page.getByLabel(/Interface language|Arayüz dili/).selectOption('en');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Agent connections', exact: true }).click();
  const enabled = page.getByRole('checkbox', { name: 'Enable MCP', exact: true });
  await expect(enabled).not.toBeChecked();
  // Pick an available loopback port without depending on a user's running copy.
  const net = await import('node:net');
  const reservation = net.createServer();
  await new Promise((r) => reservation.listen(0, '127.0.0.1', r));
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  await page.getByText('Connection details', { exact: true }).click();
  await page.getByLabel('Local port', { exact: true }).fill(String(port));
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await enabled.click();
  await expect(enabled).toBeChecked();
  await expect(page.getByText('Running locally', { exact: true })).toBeVisible();
  const codex = page
    .locator('.agent-card')
    .filter({ has: page.locator('.agent-identity strong', { hasText: 'Codex' }) });
  await codex.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(codex.getByText('Configuration added', { exact: true })).toBeVisible();
  const config = await fs.readFile(path.join(home, '.codex/config.toml'), 'utf8');
  expect(config).toContain(codexOriginal.trim());
  expect(config).toContain('[mcp_servers.vibe-screenshots]');
  expect((await fs.readdir(path.join(home, '.codex'))).some((n) => n.includes('vibe-backup'))).toBe(true);
  const cursor = page
    .locator('.agent-card')
    .filter({ has: page.locator('.agent-identity strong', { hasText: 'Cursor' }) });
  await cursor.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(cursor.getByText('Configuration added', { exact: true })).toBeVisible();
  const cursorConfig = JSON.parse(await fs.readFile(path.join(home, '.cursor/mcp.json'), 'utf8'));
  expect(cursorConfig.mcpServers.other.command).toBe('keep-this-server');
  expect(cursorConfig.examplePreference).toBe(true);
  const connection = JSON.parse(await fs.readFile(path.join(profile, 'mcp-connection.json'), 'utf8'));
  client = new Client({ name: 'desktop-regression', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(connection.url), {
      requestInit: { headers: { Authorization: `Bearer ${connection.token}` } },
    }),
  );
  expect((await client.listTools()).tools).toHaveLength(34);
  await page.evaluate(() => {
    window.vibeTestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
  });
  const projectId = text(
    await client.callTool({ name: 'project_create', arguments: { name: 'MCP regression', examples: false } }),
  ).projectId;
  const documents = text(await client.callTool({ name: 'documents_list', arguments: { projectId } }));
  const documentId = documents.find((d) => d.presetId === 'android-phone-portrait').id;
  await client.callTool({
    name: 'document_update',
    arguments: { projectId, documentId, patch: { background: { type: 'solid', color: '#eef2fa' } } },
  });
  await client.callTool({
    name: 'localizations_set',
    arguments: {
      projectId,
      copy: { headline: { 'en-US': 'Made on this device', tr: 'Bu cihazda hazırlandı' } },
    },
  });
  const { layerId } = text(
    await client.callTool({
      name: 'layer_add',
      arguments: {
        projectId,
        documentId,
        type: 'text',
        properties: { translationKey: 'headline', x: 90, y: 120, width: 900, height: 250 },
      },
    }),
  );
  await client.callTool({
    name: 'layer_update',
    arguments: { projectId, documentId, layerId, locale: 'tr', patch: { fontSize: 62 } },
  });
  const image = await client.callTool({
    name: 'preview_render',
    arguments: { projectId, documentId, locale: 'en-US' },
  });
  expect(image.content[0].type).toBe('image');
  expect(Buffer.from(image.content[0].data, 'base64').subarray(1, 4).toString()).toBe('PNG');
  const exported = text(
    await client.callTool({ name: 'export_png', arguments: { projectId, documentId, locale: 'en-US' } }),
  );
  const png = await fs.readFile(exported.path);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  expect(path.dirname(exported.path)).toBe(path.join(profile, 'exports'));
  const archive = text(
    await client.callTool({
      name: 'export_zip',
      arguments: { projectId, documentIds: [documentId], locales: ['en-US', 'tr'] },
    }),
  );
  expect((await fs.readFile(archive.path)).subarray(0, 2).toString()).toBe('PK');
  const portable = text(await client.callTool({ name: 'export_project', arguments: { projectId } }));
  const saved = JSON.parse(await fs.readFile(portable.path, 'utf8'));
  expect(saved.copy.headline.tr).toBe('Bu cihazda hazırlandı');
  await client.callTool({ name: 'history_undo', arguments: {} });
  await client.callTool({ name: 'history_redo', arguments: {} });
  await client.callTool({ name: 'project_save', arguments: { projectId } });
  await page.evaluate(() => {
    window.requestAnimationFrame = window.vibeTestAnimationFrame;
    delete window.vibeTestAnimationFrame;
  });
  // The generated agent configuration must really start the stdio bridge.
  const bridge = cursorConfig.mcpServers['vibe-screenshots'];
  stdio = new Client({ name: 'stdio-regression', version: '1.0.0' });
  await stdio.connect(
    new StdioClientTransport({
      command: bridge.command,
      args: bridge.args,
      env: { ...process.env, ...bridge.env },
      stderr: 'pipe',
    }),
  );
  expect(
    text(await stdio.callTool({ name: 'projects_list', arguments: {} })).some(
      (p) => p.name === 'MCP regression',
    ),
  ).toBe(true);
  await stdio.close();
  stdio = null;
  await client.close();
  client = null;
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Agent connections', exact: true }).click();
  await enabled.click();
  await expect(enabled).not.toBeChecked();
  await expect(page.getByText('MCP is off', { exact: true })).toBeVisible();
  await expect(fetch(connection.url)).rejects.toThrow();
  await enabled.click();
  await expect(enabled).toBeChecked();
  await expect(page.getByText('Running locally', { exact: true })).toBeVisible();
  await app.close();
  app = null;
  app = await launch();
  const reopened = await app.firstWindow();
  await expect(reopened.locator('.project-card')).toContainText('MCP regression');
  const nextConnection = JSON.parse(await fs.readFile(path.join(profile, 'mcp-connection.json'), 'utf8'));
  expect(nextConnection.enabled).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'PASS: packaged MCP, 34 tools, project editing, translated layout, PNG/ZIP/project exports, generated stdio connection, config backups, disabling and relaunch persistence.',
  );
} finally {
  if (stdio) await stdio.close();
  if (client) await client.close();
  if (app) await app.close();
  await fs.rm(root, { recursive: true, force: true });
}
