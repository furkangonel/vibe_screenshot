// A dependency-free stdio transport. Runs with the app's bundled Node runtime.
const fs = require('node:fs/promises');
const readline = require('node:readline');
const connectionPath = process.argv[process.argv.indexOf('--connection') + 1];
if (!process.argv.includes('--connection') || !connectionPath) {
  process.stderr.write('Vibe Screenshots: missing connection file. Connect this agent in Settings.\n');
  process.exit(1);
}
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
lines.on('line', (line) => {
  if (!line.trim()) return;
  queue = queue.then(async () => {
    let message;
    try {
      if (line.length > 32_000_000) throw new Error('MCP message is too large.');
      message = JSON.parse(line);
      const connection = JSON.parse(await fs.readFile(connectionPath, 'utf8'));
      if (!connection.enabled) throw new Error('MCP is off. Enable it in Vibe Screenshots Settings.');
      const url = new URL(connection.url);
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/mcp')
        throw new Error('Invalid local MCP endpoint.');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${connection.token}`,
          'MCP-Protocol-Version': '2025-11-25',
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok)
        throw new Error(`Local MCP returned ${response.status}. Open Vibe Screenshots and check Settings.`);
      if (response.status !== 202 && message.id !== undefined) {
        const data = await response.json();
        process.stdout.write(JSON.stringify(data) + '\n');
      }
    } catch (error) {
      if (message?.id !== undefined)
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32603, message: error.message },
          }) + '\n',
        );
      else process.stderr.write(`Vibe Screenshots: ${error.message}\n`);
    }
  });
});
lines.on('close', () => {
  queue.finally(() => process.exit(0));
});
