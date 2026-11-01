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

// the biggest body we accept, and the longest comment we keep
const MAX_BODY = 8 * 1024;
const MAX_COMMENT = 500;
// the only votes the contract allows
const VOTES = new Set(['up', 'down']);

// reads the body, but kills the request if it grows past the limit
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY) {
        // over the limit — stop collecting, but keep the connection
        // alive so we can still answer 413
        req.removeAllListeners('data');
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function writeLog(line) {
  console.log(line);
  await appendFile(LOG_FILE, line + '\n');
}

async function handleFeedback(req, res) {
  // fix one — an oversized body is a 413, caught before we even parse
  let body;
  try { body = await readBody(req); }
  catch { return sendJson(res, 413, { error: 'Request too large' }); }

  // fix two — broken JSON is a client mistake: 400, not 500
  let data;
  try { data = JSON.parse(body); }
  catch { return sendJson(res, 400, { error: 'Malformed JSON' }); }

  // fix three — only "up"/"down" votes, and a real articleId
  const { vote, articleId, comment } = data;
  if (!VOTES.has(vote) || typeof articleId !== 'string' || !articleId)
    return sendJson(res, 400, { error: 'Invalid feedback data' });
  if (comment !== undefined && (typeof comment !== 'string' || comment.length > MAX_COMMENT))
    return sendJson(res, 400, { error: 'Comment too long or invalid' });

  // fix four — the log line is JSON now: the comment is data,
  // its line breaks stay inside quotes, it can never fake an entry
  // the real client address — taken from the connection, never from the body
  const ip = req.socket.remoteAddress;
  // one structured entry per request — fields, not free text
  await writeLog(JSON.stringify({
    event: 'feedback', at: new Date().toISOString(), vote, ip, articleId, comment
  }));
  // all checks passed — the feedback is logged, tell the client it worked
  sendJson(res, 200, { ok: true });
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
