import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const load = createRequire(import.meta.url);
const { agentDefinitions, buildConfig, configureAgent, inspectAgents } = load('../electron/agent-config.cjs');
const bridge = {
  command: '/Applications/Vibe Screenshots.app/Contents/MacOS/Vibe Screenshots',
  args: [
    '/Applications/Vibe Screenshots.app/Contents/Resources/app.asar/electron/stdio-bridge.cjs',
    '--connection',
    '/private/profile/mcp-connection.json',
  ],
};
describe('agent configuration', () => {
  it('preserves TOML comments, account preferences and unrelated servers', () => {
    const agent = agentDefinitions('/tmp/home', 'darwin', {})[0];
    const original =
      '# My account\nmodel = "local-choice"\n[mcp_servers.existing]\ncommand = "existing-command"\n';
    const configured = buildConfig(agent, original, bridge);
    expect(configured).toContain(original.trim());
    expect(configured).toContain('[mcp_servers.vibe-screenshots]');
    expect(buildConfig(agent, configured, bridge)).toBe(configured);
    expect(buildConfig(agent, configured, bridge, true).trim()).toBe(original.trim());
    expect(() =>
      buildConfig(agent, '[mcp_servers.vibe-screenshots]\ncommand="my-custom-server"', bridge),
    ).toThrow('unmanaged');
  });
  it('merges JSONC without discarding existing client settings or comments', () => {
    const agent = agentDefinitions('/tmp/home', 'darwin', {}).find((a: { id: string }) => a.id === 'cursor');
    const original =
      '{\n // Keep this comment\n "theme": "system",\n "mcpServers": {"other": {"command":"safe"}}\n}\n';
    const next = buildConfig(agent, original, bridge);
    expect(next).toContain('// Keep this comment');
    expect(next).toContain('"theme": "system"');
    expect(load('jsonc-parser').parse(next).mcpServers.other).toEqual({ command: 'safe' });
    expect(next).toContain('"vibe-screenshots"');
    expect(buildConfig(agent, next, bridge, true)).not.toContain('"vibe-screenshots"');
    expect(() => buildConfig(agent, '{broken', bridge)).toThrow('parsed');
  });
  it('backs up the exact original, connects idempotently, then removes only its own entry', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-agent-unit-'));
    try {
      const options = { home, platform: 'linux', env: {} };
      await fs.mkdir(path.join(home, '.cursor'));
      const file = path.join(home, '.cursor/mcp.json');
      const original = '{"mcpServers":{"other":{"command":"keep"}}}';
      await fs.writeFile(file, original);
      const result = await configureAgent('cursor', bridge, false, options);
      expect(await fs.readFile(result.backup, 'utf8')).toBe(original);
      const agents = await inspectAgents(bridge, options);
      expect(agents.find((a: { id: string }) => a.id === 'cursor')).toMatchObject({
        connected: true,
        detected: true,
      });
      await configureAgent('cursor', bridge, false, options);
      await configureAgent('cursor', bridge, true, options);
      expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual(JSON.parse(original));
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });
  it('refuses symlink configuration writes', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-agent-link-'));
    try {
      await fs.mkdir(path.join(home, '.cursor'));
      await fs.writeFile(path.join(home, 'other.json'), '{}');
      await fs.symlink(path.join(home, 'other.json'), path.join(home, '.cursor/mcp.json'));
      await expect(
        configureAgent('cursor', bridge, false, { home, platform: 'linux', env: {} }),
      ).rejects.toThrow('Symbolic');
      expect(await fs.readFile(path.join(home, 'other.json'), 'utf8')).toBe('{}');
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });
});
