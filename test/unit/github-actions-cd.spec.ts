/**
 * GitHub Actions CD workflow contract (Continuous Deployment via SSH).
 */

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const workflowFile = path.join(rootDir, '.github/workflows/cd.yml');
const workflow = existsSync(workflowFile) ? readFileSync(workflowFile, 'utf8') : '';

const workflowExists = (): void => {
  expect(workflow.length).toBeGreaterThan(0);
};

describe('.github/workflows/cd.yml — CD workflow contract', () => {
  it('triggers on push to main branch and supports manual workflow_dispatch', () => {
    workflowExists();
    expect(workflow).toMatch(/\bpush:\s*\n\s*branches:\s*\[?main\]?/);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it('declares concurrency guard to prevent overlapping production deployments', () => {
    workflowExists();
    expect(workflow).toMatch(/concurrency:\s*\n\s*group:\s*production-deployment/);
  });

  it('runs on ubuntu hosted runner', () => {
    workflowExists();
    expect(workflow).toMatch(/runs-on:\s*ubuntu-latest/);
  });

  it('uses appleboy/ssh-action for SSH remote execution', () => {
    workflowExists();
    expect(workflow).toMatch(/uses:\s*appleboy\/ssh-action@/);
  });

  it('supports flexible SSH secrets fallback (VPS_HOST, SSH_HOST, HOST, etc.)', () => {
    workflowExists();
    expect(workflow).toMatch(/secrets\.VPS_HOST|secrets\.SSH_HOST|secrets\.HOST/);
    expect(workflow).toMatch(/secrets\.VPS_USER|secrets\.SSH_USER|secrets\.USERNAME/);
    expect(workflow).toMatch(/secrets\.VPS_SSH_KEY|secrets\.SSH_KEY|secrets\.SSH_PRIVATE_KEY/);
    expect(workflow).toMatch(/secrets\.VPS_PASSWORD|secrets\.SSH_PASSWORD|secrets\.PASSWORD/);
  });

  it('navigates to /var/www/cajasegura, pulls main, builds, and restarts PM2', () => {
    workflowExists();
    expect(workflow).toContain('/var/www/cajasegura');
    expect(workflow).toContain('git pull origin main');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('pm2 restart cajasegura-backend');
  });
});
