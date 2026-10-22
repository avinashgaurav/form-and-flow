/**
 * Eval-only: sends one coach request (built by the app's own coachRequest) through the local
 * Claude Code CLI (`claude -p`) instead of the Anthropic API. Never imported by app code.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { coachRequest } from '../../supabase/functions/_shared/requests.ts';

type Params = ReturnType<typeof coachRequest>;

// Empty working directory so no project CLAUDE.md or git context is picked up.
const CWD = mkdtempSync(join(tmpdir(), 'ff-coach-eval-'));

export interface CliResult {
  ok: boolean;
  structured: unknown;
  error?: string;
  models: string[];
  ms: number;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number } | null;
  costUsd: number | null;
}

export function cliArgs(req: Params, model: string): string[] {
  const schema = req.output_config?.format?.type === 'json_schema' ? req.output_config.format.schema : undefined;
  const args = [
    '-p',
    '--tools', '',
    '--strict-mcp-config',
    '--setting-sources', '',
    '--no-session-persistence',
    '--output-format', 'json',
    '--model', model,
    '--system-prompt', String(req.system),
  ];
  if (req.output_config?.effort) args.push('--effort', req.output_config.effort);
  if (schema) args.push('--json-schema', JSON.stringify(schema));
  return args;
}

export function callCli(req: Params, model: string, timeoutMs = 180_000): Promise<CliResult> {
  const msg = req.messages[0]!;
  const user = typeof msg.content === 'string' ? msg.content : '';
  const t0 = Date.now();
  return new Promise((resolve) => {
    const p = spawn('claude', cliArgs(req, model), { cwd: CWD, env: { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' } });
    let out = '';
    let err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.stdin.end(user);
    p.on('close', (code) => {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let env: any = null;
      try {
        env = JSON.parse(out);
      } catch {
        /* reported below */
      }
      const u = env?.usage;
      resolve({
        ok: !!env && !env.is_error && env.structured_output != null,
        structured: env?.structured_output ?? null,
        error: !env ? `exit ${code}: ${(err || out).slice(0, 300)}` : env.is_error ? String(env.result ?? '').slice(0, 300) : env.structured_output == null ? 'no structured output' : undefined,
        models: env?.modelUsage ? Object.keys(env.modelUsage) : [],
        ms: Date.now() - t0,
        usage: u ? { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 } : null,
        costUsd: env?.total_cost_usd ?? null,
      });
    });
  });
}
