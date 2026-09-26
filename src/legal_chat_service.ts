import { createServer } from 'node:http';
import { openMatterRoom } from './matter_workflow.js';

function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/matter-room/open') {
    try {
      const payload = await readJson(req);
      const result = await openMatterRoom(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    } catch (error) {
      const status = typeof error === 'object' && error && 'name' in error && error.name === 'ZodError' ? 400 : 422;
      const message = error instanceof Error ? error.message : 'request failed';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`legal chat service listening on http://localhost:${port}`);
});
