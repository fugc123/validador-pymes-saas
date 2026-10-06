/**
 * Production edge hardening (TASK-06) regression pin.
 *
 * Pins, from the checked-in configuration only:
 * 1. Nginx (production edge) enforces a general API `limit_req` plus a
 *    stricter limit on login and public onboarding, answers throttled
 *    requests with an explicit 429, and keeps the security headers present on
 *    both the API proxy locations and the static asset location that declares
 *    its own `add_header Cache-Control` (nginx `add_header` inheritance trap).
 * 2. `docker-compose.prod.yml` no longer publishes the backend port (the
 *    proxy is the only public API path) and requires the DB password and JWT
 *    secret through `${VAR:?...}` instead of unsafe `:-` defaults; the
 *    development PostgreSQL port binds to loopback.
 * 3. `seed-pilot.ts` carries no embedded connection URL or credentials, no
 *    `MASTER_WEBHOOK_SECRET` bypass, and prints no secrets.
 *
 * Behavioral seed assertions live in `seed-pilot-bootstrap.spec.ts`.
 */

import { readFileSync } from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const read = (relativePath: string) => readFileSync(path.join(rootDir, relativePath), 'utf8');

const nginx = read('client/nginx.conf');
const prodCompose = read('docker-compose.prod.yml');
const devCompose = read('docker-compose.yml');
const seedSource = read('src/infrastructure/database/seeds/seed-pilot.ts');

const SECURITY_HEADERS = [
  'X-Frame-Options',
  'X-XSS-Protection',
  'X-Content-Type-Options',
  'Referrer-Policy',
] as const;

const API_LOCATION_MARKERS = [
  'location /api/v1/auth/login {',
  'location /api/v1/onboarding/request {',
  'location /api/v1/ {',
] as const;

/** Returns the raw text of the block opened at `marker`, braces balanced. */
function block(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`marker not found in configuration: ${marker}`);
  }
  const open = source.indexOf('{', start);
  if (open < 0) {
    throw new Error(`no block opening found for marker: ${marker}`);
  }
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error(`unbalanced block for marker: ${marker}`);
}

/** Returns the text of a top-level YAML section such as `  backend:`. */
function section(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = start < 0 ? -1 : source.indexOf(to, start + from.length);
  if (start < 0 || end < 0) {
    throw new Error(`section not found: ${from} -> ${to}`);
  }
  return source.slice(start, end);
}

function parseRate(raw: string): number {
  const match = /^(\d+)r\/([sm])$/.exec(raw);
  if (!match) {
    throw new Error(`unsupported nginx rate expression: ${raw}`);
  }
  return Number(match[1]) / (match[2] === 'm' ? 60 : 1);
}

function zoneRate(zone: string): number {
  const match = new RegExp(`limit_req_zone \\$binary_remote_addr zone=${zone}:\\S+ rate=(\\d+r/[sm]);`).exec(
    nginx,
  );
  if (!match) {
    throw new Error(`limit_req_zone not declared for zone: ${zone}`);
  }
  return parseRate(match[1]);
}

function locationRate(locationBlock: string): number {
  const match = /limit_req zone=(\w+)\b/.exec(locationBlock);
  if (!match) {
    throw new Error('location declares no limit_req directive');
  }
  return zoneRate(match[1]);
}

describe('Production Nginx edge - abuse throttling', () => {
  it('declares distinct client-IP rate limit zones for general API and auth traffic', () => {
    const zones = [...nginx.matchAll(/limit_req_zone \$binary_remote_addr zone=(\w+):/g)].map((m) => m[1]);
    expect(zones.length).toBeGreaterThanOrEqual(2);
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toEqual(expect.arrayContaining(['api_general', 'api_auth']));
  });

  it('applies the general limit_req to the API proxy location', () => {
    const apiLocation = block(nginx, 'location /api/v1/ {');
    expect(apiLocation).toMatch(/limit_req zone=api_general burst=\d+ nodelay;/);
  });

  it('applies a strictly lower request rate to login and onboarding than to the general API', () => {
    const generalRate = locationRate(block(nginx, 'location /api/v1/ {'));
    for (const marker of ['location /api/v1/auth/login {', 'location /api/v1/onboarding/request {']) {
      const locationBlock = block(nginx, marker);
      expect(locationBlock).toMatch(/limit_req zone=api_auth\b/);
      expect(locationRate(locationBlock)).toBeLessThan(generalRate);
    }
  });

  it('answers every throttled location with an explicit 429', () => {
    for (const marker of API_LOCATION_MARKERS) {
      const locationBlock = block(nginx, marker);
      expect(locationBlock).toContain('limit_req');
      expect(locationBlock).toContain('limit_req_status 429');
    }
  });

  it('does not ship HSTS or an unsafe-inline CSP before TLS and content audits are verified', () => {
    expect(nginx).not.toContain('Strict-Transport-Security');
    expect(nginx).not.toContain('unsafe-inline');
  });
});

describe('Production Nginx edge - security response headers', () => {
  /** Directives that live in `server` but before the first `location` block. */
  function serverScope(): string {
    const start = nginx.indexOf('server {');
    const lines = nginx.slice(start).split('\n');
    const firstLocation = lines.findIndex((line) => line.trimStart().startsWith('location '));
    if (firstLocation < 0) {
      throw new Error('no location block found in nginx configuration');
    }
    return lines.slice(0, firstLocation).join('\n');
  }

  it('declares the security headers at server scope', () => {
    const scope = serverScope();
    expect(scope).toContain('add_header');
    for (const header of SECURITY_HEADERS) {
      expect(scope).toContain(`add_header ${header}`);
      expect(scope).toContain(`add_header ${header} `);
    }
  });

  it('repeats every security header in the static asset location that sets Cache-Control', () => {
    const staticLocation = block(nginx, 'location ~* \\.(?:css');
    expect(staticLocation).toContain('add_header Cache-Control');
    for (const header of SECURITY_HEADERS) {
      expect(staticLocation).toContain(`add_header ${header} `);
    }
  });

  it('keeps API proxy locations free of add_header so server-scope headers still apply', () => {
    for (const marker of API_LOCATION_MARKERS) {
      expect(block(nginx, marker)).not.toContain('add_header');
    }
  });
});

describe('docker-compose.prod.yml - public surface and required secrets', () => {
  const backend = () => section(prodCompose, '\n  backend:', '\n  frontend:');
  const frontend = () => section(prodCompose, '\n  frontend:', '\nnetworks:');
  const postgres = () => section(prodCompose, '\n  postgres:', '\n  backend:');

  it('does not publish the backend port, so the proxy is the only public API path', () => {
    expect(backend()).not.toMatch(/^\s*ports:/m);
    expect(frontend()).toMatch(/depends_on:[\s\S]*backend/);
    expect(frontend()).toMatch(/ports:/);
  });

  it('requires the database password explicitly instead of a default fallback', () => {
    expect(postgres()).toContain('POSTGRES_PASSWORD: ${DB_PASSWORD:?');
    expect(backend()).toContain('DB_PASSWORD: ${DB_PASSWORD:?');
    expect(prodCompose).not.toMatch(/\$\{DB_PASSWORD:-/);
    expect(prodCompose).not.toContain('cajasegura_secure_pass_2026');
  });

  it('requires the JWT secret explicitly instead of a default fallback', () => {
    expect(backend()).toContain('JWT_SECRET: ${JWT_SECRET:?');
    expect(prodCompose).not.toMatch(/\$\{JWT_SECRET:-/);
    expect(prodCompose).not.toContain('cajasegura_prod_secret_jwt_2026_super_key');
  });
});

describe('docker-compose.yml - development database exposure', () => {
  it('binds the development PostgreSQL port to loopback only', () => {
    expect(devCompose).toMatch(/ports:\s*\n\s+- "127\.0\.0\.1:\$\{DB_PORT:-5432\}:5432"/);
  });
});

describe('seed-pilot.ts - static secret hygiene', () => {
  it('requires DATABASE_URL with no embedded connection fallback', () => {
    expect(seedSource).toContain("requireEnv('DATABASE_URL')");
    expect(seedSource).not.toContain('postgres://');
    expect(seedSource).not.toMatch(/process\.env\.DATABASE_URL\s*\|\|/);
  });

  it('contains no embedded admin password or default webhook secret', () => {
    expect(seedSource).not.toContain('@Uncharted2413');
    expect(seedSource).not.toContain('cajasegura_secure_pass_2026');
    expect(seedSource).not.toContain('sec_cajasegura_admin_2026');
  });

  it('has no MASTER_WEBHOOK_SECRET bypass', () => {
    expect(seedSource).not.toContain('MASTER_WEBHOOK_SECRET');
  });

  it('logs no secret material', () => {
    const logLines = seedSource.split('\n').filter((line) => line.includes('console.log'));
    expect(logLines.length).toBeGreaterThan(0);
    for (const line of logLines) {
      expect(line).not.toMatch(/\$\{[^}]*(password|secret|connectionString)/i);
      expect(line).not.toContain('@Uncharted2413');
      expect(line).not.toContain('sec_cajasegura_admin_2026');
    }
  });
});
