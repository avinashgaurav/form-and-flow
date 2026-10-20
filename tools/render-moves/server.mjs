// Local-only render server for exercise clips.
// Serves the render page and the private Mixamo files, and pipes the page's
// frames into ffmpeg. Raw FBX files never leave this machine (Adobe's terms
// allow rendered video, not sharing the raw files).
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MEDIA = join(ROOT, 'media-src', 'mixamo');
const OUT = join(ROOT, 'media-src', 'renders');
const PORT = Number(process.env.PORT ?? 8090);
const NAME = /^[a-z0-9_-]+$/;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.fbx': 'application/octet-stream', '.mp4': 'video/mp4', '.png': 'image/png' };
const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const SIZES = new Set([360, 480, 720, 1080]);

mkdirSync(OUT, { recursive: true });
const jobs = new Map();

function send(res, code, body, type = 'text/plain') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveFile(res, dir, name) {
  const file = join(dir, name);
  if (!NAME.test(name.slice(0, -extname(name).length)) || !existsSync(file)) return send(res, 404, 'not found');
  // The big character file is cached so each move in a batch does not reload it.
  const cache = extname(name) === '.fbx' ? 'max-age=3600' : 'no-store';
  res.writeHead(200, { 'Content-Type': TYPES[extname(name)] ?? 'application/octet-stream', 'Content-Length': statSync(file).size, 'Cache-Control': cache });
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let bytes = 0;
    req.on('data', (c) => {
      bytes += c.length;
      if (bytes > limit) req.destroy(new Error('body too large'));
      else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

function stopJob(name) {
  const old = jobs.get(name);
  if (!old) return;
  jobs.delete(name);
  old.ff.kill('SIGKILL');
}

// Frames arrive as raw RGBA straight from WebGL (bottom row first), so they are flipped here.
// ffmpeg writes to a temporary file that is renamed only when it finishes cleanly, so a
// half-written clip never sits where the publish step looks.
function startJob(name, fps, size) {
  stopJob(name);
  const out = join(OUT, `${name}.mp4`);
  const tmp = join(OUT, `${name}.part`);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${size}x${size}`, '-framerate', String(fps), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', '-f', 'mp4', tmp,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  const job = { ff, done: null, frames: 0, frameBytes: size * size * 4, err: '' };
  ff.stderr.on('data', (d) => { job.err += d; });
  ff.stdin.on('error', (e) => { job.err += String(e); });
  const done = new Promise((resolve) => {
    ff.on('error', (e) => resolve({ code: -1, err: String(e), out }));
    ff.on('close', (code) => {
      if (code === 0) renameSync(tmp, out);
      else rmSync(tmp, { force: true });
      resolve({ code, err: job.err, out });
    });
  });
  job.done = done;
  jobs.set(name, job);
}

createServer(async (req, res) => {
  // Only this machine's own pages may talk to the server (blocks DNS rebinding and drive-by posts).
  if (!HOSTS.has(req.headers.host ?? '')) return send(res, 403, 'forbidden');
  const url = new URL(req.url, 'http://localhost');
  const name = url.searchParams.get('name') ?? '';
  try {
    if (req.method === 'GET') {
      if (url.pathname === '/') return serveFile(res, HERE, 'index.html');
      if (url.pathname === '/render.js') return serveFile(res, HERE, 'render.js');
      if (url.pathname === '/review') return serveFile(res, HERE, 'review.html');
      if (url.pathname === '/batch') return serveFile(res, HERE, 'batch.html');
      // A server-side pause: browser timers in a hidden page are throttled, network replies are not.
      if (url.pathname === '/tick') return setTimeout(() => send(res, 200, 'ok'), Math.min(Number(url.searchParams.get('ms')) || 100, 2000));
      if (url.pathname === '/motions.js') {
        // The keyframed moves, bundled fresh on each request so edits show on reload.
        const out = await build({ entryPoints: [join(HERE, 'motion', 'index.ts')], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
        return send(res, 200, out.outputFiles[0].text, 'text/javascript');
      }
      if (url.pathname.startsWith('/media/')) return serveFile(res, MEDIA, url.pathname.slice(7));
      if (url.pathname.startsWith('/renders/')) return serveFile(res, OUT, url.pathname.slice(9));
      return send(res, 404, 'not found');
    }
    // Posts need a custom header, which a page on another site cannot send without asking first.
    if (req.method !== 'POST' || req.headers['x-render'] !== '1' || !NAME.test(name)) return send(res, 400, 'bad request');
    if (url.pathname === '/start') {
      const fps = Number(url.searchParams.get('fps') ?? 30);
      const size = Number(url.searchParams.get('size') ?? 720);
      if (!Number.isInteger(fps) || fps < 1 || fps > 60 || !SIZES.has(size)) return send(res, 400, 'bad fps or size');
      startJob(name, fps, size);
      return send(res, 200, 'ok');
    }
    const job = jobs.get(name);
    if (!job) return send(res, 409, 'no job');
    if (url.pathname === '/frame') {
      const count = Number(url.searchParams.get('count') ?? 1);
      if (!Number.isInteger(count) || count < 1 || count > 30) return send(res, 400, 'bad count');
      const frame = await readBody(req, job.frameBytes * count);
      if (frame.length !== job.frameBytes * count) return send(res, 400, 'wrong frame size');
      // A dead ffmpeg never drains: fail the request instead of waiting for ever.
      if (job.ff.exitCode !== null || job.ff.stdin.destroyed) return send(res, 500, job.err || 'ffmpeg is not running');
      if (!job.ff.stdin.write(frame)) await Promise.race([new Promise((r) => job.ff.stdin.once('drain', r)), job.done]);
      if (job.ff.exitCode !== null) return send(res, 500, job.err || 'ffmpeg stopped');
      job.frames += count;
      return send(res, 200, 'ok');
    }
    if (url.pathname === '/end') {
      job.ff.stdin.end();
      const { code, err, out } = await job.done;
      jobs.delete(name);
      if (code !== 0) return send(res, 500, err || `ffmpeg exited ${code}`);
      return send(res, 200, JSON.stringify({ frames: job.frames, bytes: statSync(out).size }), 'application/json');
    }
    return send(res, 404, 'not found');
  } catch (e) {
    return send(res, 500, String(e));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`render-moves on http://localhost:${PORT}`));
