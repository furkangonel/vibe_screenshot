const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { tools } = require('./mcp-tools.cjs');
const { inspectAgents, configureAgent } = require('./agent-config.cjs');
const VERSION = require('../package.json').version;

function createMcpService({
  userData,
  executable,
  bridgePath,
  callRenderer,
  onChange = () => {},
  agentOptions,
}) {
  const connectionFile = path.join(userData, 'mcp-connection.json');
  const settingsFile = path.join(userData, 'desktop-settings.json');
  const exportsFolder = path.join(userData, 'exports');
  const bridge = { command: executable, args: [bridgePath, '--connection', connectionFile] };
  let settings = { enabled: false, port: 37891 },
    token = '',
    listener = null,
    error = '',
    queue = Promise.resolve();
  let recent = [];
  const controllers = new Set();
  async function atomic(file, data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' });
    await fs.rename(tmp, file);
  }
  function status() {
    return {
      enabled: settings.enabled,
      running: !!listener?.listening,
      port: settings.port,
      url: `http://127.0.0.1:${settings.port}/mcp`,
      error,
      exportsFolder,
      version: VERSION,
      toolCount: tools.length,
      recent,
      tools: tools.map(([name, description, , readOnly = false]) => ({ name, description, readOnly })),
    };
  }
  function changed() {
    onChange(status());
  }
  async function execute(name, args) {
    const invoke = async () => {
      if (!listener?.listening || !settings.enabled) throw new Error('MCP is off.');
      const started = Date.now();
      try {
        const result = await callRenderer(name, args);
        recent = [
          { name, ok: true, time: new Date().toISOString(), duration: Date.now() - started },
          ...recent,
        ].slice(0, 30);
        changed();
        if (name === 'preview_render')
          return { content: [{ type: 'image', data: result.base64, mimeType: 'image/png' }] };
        if (['export_png', 'export_zip', 'export_project'].includes(name)) {
          const extension =
            name === 'export_png' ? 'png' : name === 'export_zip' ? 'zip' : 'vibescreens.json';
          const filename = `${(result.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}-${Date.now()}-${randomBytes(3).toString('hex')}.${extension}`;
          await fs.mkdir(exportsFolder, { recursive: true });
          const file = path.join(exportsFolder, filename);
          await fs.writeFile(file, Buffer.from(result.base64, 'base64'), { flag: 'wx' });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  path: file,
                  bytes: (await fs.stat(file)).size,
                  ...(result.width ? { width: result.width, height: result.height } : {}),
                }),
              },
            ],
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e) {
        recent = [
          { name, ok: false, time: new Date().toISOString(), duration: Date.now() - started },
          ...recent,
        ].slice(0, 30);
        changed();
        return { isError: true, content: [{ type: 'text', text: e.message }] };
      }
    };
    const next = queue.then(invoke, invoke);
    queue = next.catch(() => {});
    return next;
  }
  function makeServer() {
    const server = new McpServer(
      { name: 'vibe-screenshots', version: VERSION },
      {
        instructions:
          'Vibe Screenshots controls the open local desktop studio. Call projects_list and presets_list first. IDs are stable. All positions are canvas pixels; page indices start at zero. Write operations preserve omitted fields and use the app save/undo flow. No shell or arbitrary filesystem tools are available. Create a project before editing. Preview before export. MCP must be enabled in Settings and the app must be open.',
      },
    );
    for (const [name, description, inputSchema, readOnly = false, destructive = false] of tools)
      server.registerTool(
        name,
        {
          description,
          inputSchema,
          annotations: { readOnlyHint: readOnly, destructiveHint: destructive, openWorldHint: false },
        },
        (args) => execute(name, args),
      );
    server.registerResource(
      'studio-reference',
      'vibe://reference',
      { description: 'Canvas units, supported tools and editing workflow.', mimeType: 'application/json' },
      async () => ({
        contents: [
          {
            uri: 'vibe://reference',
            mimeType: 'application/json',
            text: JSON.stringify({
              tools: tools.map(([name, description]) => ({ name, description })),
              units: 'canvas pixels',
              pageIndex: 'zero-based',
              workflow: [
                'projects_list',
                'project_create or project_get',
                'document_add',
                'layer_add',
                'localizations_set',
                'preview_render',
                'export_png or export_zip',
              ],
            }),
          },
        ],
      }),
    );
    server.registerPrompt(
      'compose-store-screenshots',
      {
        description: 'Plan and build a localized screenshot set.',
        argsSchema: { appName: require('zod').z.string(), audience: require('zod').z.string().optional() },
      },
      ({ appName, audience }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a screenshot project for ${appName}${audience ? ` for ${audience}` : ''}. List presets and devices first. Ask for the app's real features and screenshots if missing. Use a restrained visual system, concise benefit headlines and matching device frames. Preview every page before exporting. Never invent product features.`,
            },
          },
        ],
      }),
    );
    return server;
  }
  async function handle(req, res) {
    const deny = (code, message) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    };
    if (!settings.enabled) return deny(503, 'MCP is off.');
    if (req.url !== '/mcp') return deny(404, 'Not found.');
    if (
      ![`127.0.0.1:${settings.port}`, `localhost:${settings.port}`].includes(req.headers.host) ||
      req.headers.origin
    )
      return deny(403, 'Untrusted origin.');
    const auth = Buffer.from(req.headers.authorization || ''),
      expected = Buffer.from(`Bearer ${token}`);
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected))
      return deny(401, 'Authentication required.');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return deny(405, 'Use POST.');
    }
    if (!(req.headers['content-type'] || '').includes('application/json')) return deny(415, 'JSON required.');
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 32_000_000) {
          deny(413, 'Request too large.');
          return;
        }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const server = makeServer(),
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
      controllers.add(server);
      res.on('close', () => {
        controllers.delete(server);
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) deny(400, e instanceof SyntaxError ? 'Invalid JSON.' : 'Invalid MCP request.');
      else res.end();
    }
  }
  async function stop() {
    const old = listener;
    listener = null;
    if (old) {
      old.closeAllConnections();
      await new Promise((resolve) => old.close(resolve));
    }
    for (const server of controllers) await server.close().catch(() => {});
    controllers.clear();
  }
  async function start() {
    error = '';
    const server = http.createServer((req, res) => {
      void handle(req, res);
    });
    server.requestTimeout = 125_000;
    server.headersTimeout = 10_000;
    server.maxConnections = 16;
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(settings.port, '127.0.0.1', resolve);
      });
      listener = server;
    } catch (e) {
      server.close();
      error = e.code === 'EADDRINUSE' ? 'This port is in use. Choose another port and try again.' : e.message;
    }
  }
  async function persist() {
    await atomic(settingsFile, settings);
    await atomic(connectionFile, {
      enabled: settings.enabled && !!listener?.listening,
      url: status().url,
      token,
    });
    changed();
  }
  async function setSettings(patch) {
    if (
      patch.port !== undefined &&
      (!Number.isInteger(patch.port) || patch.port < 1024 || patch.port > 65535)
    )
      throw new Error('Choose a port from 1024 to 65535.');
    if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean')
      throw new Error('Invalid MCP setting.');
    await stop();
    error = '';
    settings = { enabled: patch.enabled ?? settings.enabled, port: patch.port ?? settings.port };
    if (settings.enabled) await start();
    await persist();
    return status();
  }
  return {
    status,
    exportsFolder,
    bridge,
    async init() {
      try {
        const saved = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
        settings = {
          enabled: saved.enabled === true,
          port:
            Number.isInteger(saved.port) && saved.port >= 1024 && saved.port <= 65535 ? saved.port : 37891,
        };
      } catch {
        /* First launch uses MCP off. */
      }
      try {
        const connection = JSON.parse(await fs.readFile(connectionFile, 'utf8'));
        token = /^[a-f0-9]{64}$/.test(connection.token) ? connection.token : '';
      } catch {
        /* Generate a local token below. */
      }
      token ||= randomBytes(32).toString('hex');
      if (settings.enabled) await start();
      await persist();
    },
    setSettings,
    agents: () => inspectAgents(bridge, agentOptions),
    configure: async (id, remove) => {
      if (!remove && (!settings.enabled || !listener?.listening))
        throw new Error('Enable MCP before connecting an agent.');
      return configureAgent(id, bridge, remove, agentOptions);
    },
    async close() {
      await stop();
      await atomic(connectionFile, { enabled: false, url: status().url, token });
    },
  };
}
module.exports = { createMcpService };
