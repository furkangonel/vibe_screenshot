const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { parse: parseToml } = require('@iarna/toml');
const { parse, modify, applyEdits } = require('jsonc-parser');
const SERVER = 'vibe-screenshots';
const START = '# BEGIN Vibe Screenshots managed MCP';
const END = '# END Vibe Screenshots managed MCP';

function agentDefinitions(home = os.homedir(), platform = process.platform, env = process.env) {
  const support =
    platform === 'darwin'
      ? path.join(home, 'Library/Application Support')
      : platform === 'win32'
        ? env.APPDATA || path.join(home, 'AppData/Roaming')
        : env.XDG_CONFIG_HOME || path.join(home, '.config');
  return [
    {
      id: 'codex',
      name: 'Codex',
      format: 'toml',
      file: path.join(env.CODEX_HOME || path.join(home, '.codex'), 'config.toml'),
      signs: [
        path.join(home, '.codex'),
        ...(platform === 'darwin'
          ? ['/Applications/Codex.app', path.join(home, 'Applications/Codex.app')]
          : []),
      ],
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      format: 'json',
      file: path.join(home, '.claude.json'),
      key: 'mcpServers',
      type: 'stdio',
      signs: [path.join(home, '.claude'), path.join(home, '.claude.json')],
    },
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      format: 'json',
      file: path.join(support, 'Claude', 'claude_desktop_config.json'),
      key: 'mcpServers',
      signs: [
        path.join(support, 'Claude'),
        ...(platform === 'darwin'
          ? ['/Applications/Claude.app', path.join(home, 'Applications/Claude.app')]
          : []),
      ],
    },
    {
      id: 'cursor',
      name: 'Cursor',
      format: 'json',
      file: path.join(home, '.cursor', 'mcp.json'),
      key: 'mcpServers',
      signs: [
        path.join(home, '.cursor'),
        ...(platform === 'darwin'
          ? ['/Applications/Cursor.app', path.join(home, 'Applications/Cursor.app')]
          : []),
      ],
    },
    {
      id: 'vscode',
      name: 'VS Code',
      format: 'json',
      file: path.join(support, 'Code', 'User', 'mcp.json'),
      key: 'servers',
      type: 'stdio',
      signs: [
        path.join(support, 'Code'),
        ...(platform === 'darwin'
          ? ['/Applications/Visual Studio Code.app', path.join(home, 'Applications/Visual Studio Code.app')]
          : []),
      ],
    },
  ];
}
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
function serverConfig(agent, bridge) {
  return {
    ...(agent.type ? { type: agent.type } : {}),
    command: bridge.command,
    args: bridge.args,
    env: { ELECTRON_RUN_AS_NODE: '1' },
  };
}
function readJson(text) {
  const errors = [];
  const value = parse(text || '{}', errors, { allowTrailingComma: true });
  if (errors.length || !value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Configuration could not be parsed. Repair it in your agent before connecting.');
  return value;
}
function buildConfig(agent, text, bridge, remove = false) {
  const entry = serverConfig(agent, bridge);
  if (agent.format === 'toml') {
    const parsed = parseToml(text || '');
    const existing = parsed.mcp_servers?.[SERVER];
    const managed = text.includes(START) && text.includes(END);
    if (existing && !managed)
      throw new Error(
        'An unmanaged vibe-screenshots entry already exists. Keep it or remove it in your agent before connecting.',
      );
    let next = text;
    if (managed) {
      const start = next.indexOf(START),
        end = next.indexOf(END) + END.length;
      next = next.slice(0, start) + next.slice(end);
    }
    if (!remove)
      next =
        next.trimEnd() +
        `\n\n${START}\n[mcp_servers.${SERVER}]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\nenv = { ELECTRON_RUN_AS_NODE = "1" }\n${END}\n`;
    parseToml(next);
    return next;
  }
  const parsed = readJson(text);
  const existing = parsed[agent.key]?.[SERVER];
  if (
    existing &&
    (existing.env?.ELECTRON_RUN_AS_NODE !== '1' ||
      !existing.args?.some((a) => typeof a === 'string' && a.endsWith('stdio-bridge.cjs')))
  )
    throw new Error(
      'An unmanaged vibe-screenshots entry already exists. Keep it or remove it in your agent before connecting.',
    );
  return applyEdits(
    text || '{}\n',
    modify(text || '{}\n', [agent.key, SERVER], remove ? undefined : entry, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
    }),
  );
}
async function inspectAgents(bridge, options) {
  return Promise.all(
    agentDefinitions(options?.home, options?.platform, options?.env).map(async (agent) => {
      const detected = (await Promise.all([agent.file, ...agent.signs].map(exists))).some(Boolean);
      let connected = false,
        error = '';
      if (await exists(agent.file)) {
        try {
          const text = await fs.readFile(agent.file, 'utf8');
          const parsed = agent.format === 'toml' ? parseToml(text) : readJson(text);
          const entry = agent.format === 'toml' ? parsed.mcp_servers?.[SERVER] : parsed[agent.key]?.[SERVER];
          const expected = serverConfig(agent, bridge);
          connected =
            !!entry &&
            entry.command === expected.command &&
            JSON.stringify(entry.args) === JSON.stringify(expected.args) &&
            entry.env?.ELECTRON_RUN_AS_NODE === '1';
        } catch {
          error = 'Configuration is not readable. Open it in the agent to repair it.';
        }
      }
      const preview =
        agent.format === 'toml'
          ? buildConfig(agent, '', bridge).trim()
          : JSON.stringify({ [agent.key]: { [SERVER]: serverConfig(agent, bridge) } }, null, 2);
      return { id: agent.id, name: agent.name, path: agent.file, detected, connected, error, preview };
    }),
  );
}
async function configureAgent(id, bridge, remove = false, options) {
  const agent = agentDefinitions(options?.home, options?.platform, options?.env).find((a) => a.id === id);
  if (!agent) throw new Error('Unsupported agent.');
  let text = '';
  try {
    const stat = await fs.lstat(agent.file);
    if (stat.isSymbolicLink() || !stat.isFile())
      throw new Error('Symbolic or non-regular configuration files must be edited manually.');
    text = await fs.readFile(agent.file, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const next = buildConfig(agent, text, bridge, remove);
  await fs.mkdir(path.dirname(agent.file), { recursive: true });
  const backup = text ? `${agent.file}.vibe-backup-${Date.now()}-${randomUUID().slice(0, 8)}` : null;
  if (backup) await fs.writeFile(backup, text, { mode: 0o600, flag: 'wx' });
  const temporary = `${agent.file}.vibe-${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, next, { mode: 0o600, flag: 'wx' });
    // Detect an agent editing its config while the preview/backup is being prepared.
    const current = await fs.readFile(agent.file, 'utf8').catch((e) => {
      if (e.code === 'ENOENT') return '';
      throw e;
    });
    if (current !== text) throw new Error('The agent changed this file. Refresh and try again.');
    await fs.rename(temporary, agent.file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return { backup, path: agent.file };
}
module.exports = { agentDefinitions, buildConfig, inspectAgents, configureAgent };
