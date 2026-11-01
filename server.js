import { createServer } from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';

const PORT = 3000;
const LOG_DIR = new URL('./logs/', import.meta.url);
const LOG_FILE = new URL('./logs/feedback.log', import.meta.url);
const INDEX_FILE = new URL('./public/index.html', import.meta.url);

/**
 * @typedef {Object} Feedback
 * @property {'up' | 'down'} vote
 * @property {string} articleId
 * @property {string} [comment]
 */

await mkdir(LOG_DIR, { recursive: true });

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function writeLog(line) {
  console.log(line);
  await appendFile(LOG_FILE, line + '\n');
}

async function handleFeedback(req, res) {
  try {
    /** @type {Feedback} */
    const { vote, articleId, comment } = JSON.parse(await readBody(req));

    if (!vote || !articleId) {
      return sendJson(res, 400, { error: 'Missing data' });
    }

    const ip = req.socket.remoteAddress;
    await writeLog(
      `[FEEDBACK] ${new Date().toISOString()} vote=${vote} ip=${ip} article=${articleId}${comment ? ` comment="${comment}"` : ''}`
    );

    sendJson(res, 200, { ok: true });
  } catch {
    sendJson(res, 500, { error: 'Failed' });
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(await readFile(INDEX_FILE));
  }

  if (req.method === 'POST' && req.url === '/api/feedback') {
    return handleFeedback(req, res);
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Feedback API listening on http://localhost:${PORT}`);
});
