/**
 * GitHub Actions CI workflow contract (CI only, no deployment).
 *
 * Pins `.github/workflows/ci.yml` to the agreed scope:
 * 1. Triggers on pull requests targeting `main` and on pushes to `main`.
 * 2. Minimal token permissions: `contents: read`, never write-capable.
 * 3. Ubuntu hosted runner with Node 20.
 * 4. Lockfile installs (`npm ci`) at the root and inside `client/`.
 * 5. Verification commands: `npm test -- --runInBand`, `npx tsc --noEmit`,
 *    `npm run build`, and the client build.
 * 6. No secrets, SSH/VPS/deploy steps, GitHub `environment:`, write
 *    permissions, self-hosted runners, or installs beyond the lockfile.
 *
 * The workflow file does not exist yet: content is read defensively so the
 * suite fails through assertions against the missing content, not through a
 * setup error.
 */

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const workflowFile = path.join(rootDir, '.github/workflows/ci.yml');
const workflow = existsSync(workflowFile) ? readFileSync(workflowFile, 'utf8') : '';

/** Every `it` asserts the file exists first, so an absent workflow is RED. */
const workflowExists = (): void => {
  expect(workflow.length).toBeGreaterThan(0);
};

describe('.github/workflows/ci.yml — CI-only contract', () => {
  it('triggers on pull requests targeting main and on pushes to main', () => {
    workflowExists();
    expect(workflow).toMatch(/pull_request:/);
    expect(workflow).toMatch(/push:/);
    expect(workflow).toMatch(/pull_request:[\s\S]{0,200}?branches:[^\n]*\bmain\b/);
    expect(workflow).toMatch(/\bpush:[\s\S]{0,200}?branches:[^\n]*\bmain\b/);
  });

  it('restricts the workflow token to permissions: contents: read', () => {
    workflowExists();
    expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read\b/);
  });

  it('runs on the ubuntu hosted runner with Node 20', () => {
    workflowExists();
    expect(workflow).toMatch(/runs-on:\s*ubuntu-/);
    expect(workflow).toMatch(/actions\/setup-node@/);
    expect(workflow).toMatch(/node-version:\s*['"]?20\b/);
  });

  it('installs from the lockfile at the root and for the client', () => {
    workflowExists();
    const lockfileInstalls = workflow.match(/\bnpm ci\b/g) ?? [];
    expect(lockfileInstalls.length).toBeGreaterThanOrEqual(2);
    expect(workflow).toMatch(
      /working-directory:\s*client|npm --prefix client\b|client\/package-lock/,
    );
  });

  it('runs the unit suite serially', () => {
    workflowExists();
    expect(workflow).toContain('npm test -- --runInBand');
  });

  it('type-checks without emitting', () => {
    workflowExists();
    expect(workflow).toContain('npx tsc --noEmit');
  });

  it('builds the backend and the client', () => {
    workflowExists();
    expect(workflow).toContain('npm run build');
    const backendBuilds = workflow.match(/\bnpm run build\b/g) ?? [];
    const clientPrefixedBuild = /npm --prefix client run build/.test(workflow);
    expect(clientPrefixedBuild || backendBuilds.length >= 2).toBe(true);
  });
});

describe('.github/workflows/ci.yml — forbidden content', () => {
  const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
    ['secrets reference', /secrets[\.\[]/],
    ['ssh/scp/rsync invocation', /\b(?:ssh|scp|rsync)\b/i],
    ['vps reference', /\bvps\b/i],
    ['deploy step', /\bdeploy(?:ment)?s?\b/i],
    ['GitHub environment block', /(^|\n)[ \t]*environment:/],
    ['write-capable permission', /\b(?:contents|packages|actions|issues|pull-requests|id-token|statuses|deployments):\s*write\b|permissions:\s*write-all|\bwrite-all\b/],
    ['self-hosted runner', /runs-on:\s*self-hosted/],
    ['dependency install other than the lockfile', /\bnpm\s+(?:install|i)\b/],
  ];

  for (const [label, pattern] of FORBIDDEN) {
    it(`declares no ${label}`, () => {
      workflowExists();
      expect(pattern.test(workflow)).toBe(false);
    });
  }
});
