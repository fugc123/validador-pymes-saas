import { AuthMiddleware } from '../../src/presentation/middlewares/auth.middleware';
import {
  InMemoryPasswordHasher,
  InMemoryTokenService,
} from '../../src/infrastructure/repositories/in-memory.repositories';
import { ScopedTokenPayload, TempTokenPayload } from '../../src/core/application/ports/auth.ports';

/**
 * TASK-01 security regressions: signed, expiring, purpose-typed tokens;
 * no universal password bypasses; JWT secret configuration fails closed.
 */

const UNSAFE_STATIC_JWT_SECRET = 'cajasegura_prod_secret_jwt_2026_super_key';

const scopedPayload: ScopedTokenPayload = {
  userId: 'usr-1',
  email: 'owner@kiosko.com.py',
  tenantId: 'store-a',
  role: 'MERCHANT_OWNER',
  isSuperAdmin: false,
};

const tempPayload: TempTokenPayload = {
  userId: 'usr-1',
  email: 'owner@kiosko.com.py',
  isSuperAdmin: false,
};

const CONTROLLED_ENV_KEYS = [
  'NODE_ENV',
  'JWT_SECRET',
  'JWT_EXPIRATION',
  'DATABASE_URL',
  'DB_HOST',
] as const;

let savedEnv: Record<string, string | undefined>;

function setEnv(overrides: Record<string, string | undefined>): void {
  for (const key of CONTROLLED_ENV_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

interface TestRequest {
  headers: Record<string, string | undefined>;
  user?: Record<string, unknown>;
}

function authenticate(middleware: AuthMiddleware, token: string): TestRequest {
  const req: TestRequest = { headers: { authorization: `Bearer ${token}` } };
  middleware.use(req, {}, () => undefined);
  return req;
}

describe('TASK-01 token and secret security regressions', () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of CONTROLLED_ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of CONTROLLED_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  describe('forged and malformed tokens', () => {
    it('rejects a handcrafted unsigned legacy token with elevated claims', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();

      const forged = `jwt_scoped_${Buffer.from(
        JSON.stringify({
          userId: 'attacker',
          email: 'attacker@evil.example',
          role: 'SUPER_ADMIN',
          isSuperAdmin: true,
        }),
      ).toString('base64')}`;

      expect(() => service.verifyToken(forged)).toThrow();
    });

    it('does not authenticate a handcrafted forged token in the middleware', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();
      const middleware = new AuthMiddleware(service);

      const forged = `jwt_scoped_${Buffer.from(
        JSON.stringify({
          userId: 'attacker',
          email: 'attacker@evil.example',
          role: 'SUPER_ADMIN',
          isSuperAdmin: true,
        }),
      ).toString('base64')}`;

      const req = authenticate(middleware, forged);
      expect(req.user).toBeUndefined();
    });

    it('rejects a token modified after signing', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();
      const valid = service.signScopedToken(scopedPayload);
      const tampered = `${valid.slice(0, -3)}xyz`;

      expect(() => service.verifyToken(tampered)).toThrow();
    });

    it('rejects an unsigned alg:none JWT', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();

      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ ...scopedPayload, purpose: 'access' })).toString(
        'base64url',
      );

      expect(() => service.verifyToken(`${header}.${body}.`)).toThrow();
    });
  });

  describe('token expiration', () => {
    it('rejects an expired scoped token', () => {
      setEnv({ NODE_ENV: 'test', JWT_EXPIRATION: '-10s' });
      const service = new InMemoryTokenService();
      const token = service.signScopedToken(scopedPayload);

      expect(() => service.verifyToken(token)).toThrow(/expired/i);
    });

    it('does not authenticate an expired scoped token in the middleware', () => {
      setEnv({ NODE_ENV: 'test', JWT_EXPIRATION: '-10s' });
      const service = new InMemoryTokenService();
      const middleware = new AuthMiddleware(service);

      const req = authenticate(middleware, service.signScopedToken(scopedPayload));
      expect(req.user).toBeUndefined();
    });

    it('issues scoped and temporary tokens carrying an expiry claim', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();

      const scoped = service.verifyToken<Record<string, unknown>>(
        service.signScopedToken(scopedPayload),
      );
      const temp = service.verifyToken<Record<string, unknown>>(
        service.signTempToken(tempPayload),
      );

      expect(typeof scoped.exp).toBe('number');
      expect(typeof temp.exp).toBe('number');
    });
  });

  describe('token purpose typing', () => {
    it('labels scoped and temporary tokens with distinguishable purposes', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();

      const scoped = service.verifyToken<Record<string, unknown>>(
        service.signScopedToken(scopedPayload),
      );
      const temp = service.verifyToken<Record<string, unknown>>(
        service.signTempToken(tempPayload),
      );

      expect(scoped.purpose).toBe('access');
      expect(temp.purpose).toBe('tenant_selection');
      expect(scoped.purpose).not.toBe(temp.purpose);
    });

    it('does not authenticate a temporary token in the middleware', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();
      const middleware = new AuthMiddleware(service);

      const req = authenticate(middleware, service.signTempToken(tempPayload));
      expect(req.user).toBeUndefined();
    });

    it('authenticates a valid scoped token with the documented payload contract', () => {
      setEnv({ NODE_ENV: 'test' });
      const service = new InMemoryTokenService();
      const middleware = new AuthMiddleware(service);

      const req = authenticate(middleware, service.signScopedToken(scopedPayload));
      expect(req.user).toMatchObject({
        userId: 'usr-1',
        email: 'owner@kiosko.com.py',
        tenantId: 'store-a',
        role: 'MERCHANT_OWNER',
        isSuperAdmin: false,
        purpose: 'access',
        id: 'usr-1',
      });
    });
  });

  describe('password verification', () => {
    it('does not let universal literals bypass a real bcrypt hash', async () => {
      const hasher = new InMemoryPasswordHasher();
      const hash = await hasher.hash('Str0ng!Passphrase');

      await expect(hasher.compare('password123', hash)).resolves.toBe(false);
      await expect(hasher.compare('@Uncharted2413', hash)).resolves.toBe(false);
      await expect(hasher.compare('pilinnero', hash)).resolves.toBe(false);
    });

    it('still accepts the real password for a real hash', async () => {
      const hasher = new InMemoryPasswordHasher();
      const hash = await hasher.hash('Str0ng!Passphrase');

      await expect(hasher.compare('Str0ng!Passphrase', hash)).resolves.toBe(true);
    });
  });

  describe('JWT secret configuration fails closed', () => {
    it('fails startup in production when JWT_SECRET is missing', () => {
      setEnv({ NODE_ENV: 'production', JWT_SECRET: undefined });

      expect(() => new InMemoryTokenService()).toThrow(/JWT_SECRET/);
    });

    it('fails startup in production when JWT_SECRET is a known static default', () => {
      setEnv({ NODE_ENV: 'production', JWT_SECRET: UNSAFE_STATIC_JWT_SECRET });

      expect(() => new InMemoryTokenService()).toThrow(/static default/i);
    });

    it('fails startup in production when JWT_SECRET is too short', () => {
      setEnv({ NODE_ENV: 'production', JWT_SECRET: 'shortsecret' });

      expect(() => new InMemoryTokenService()).toThrow(/at least 32/i);
    });

    it('fails startup when database mode is configured without JWT_SECRET', () => {
      setEnv({ NODE_ENV: 'test', DB_HOST: 'db.internal', JWT_SECRET: undefined });

      expect(() => new InMemoryTokenService()).toThrow(/JWT_SECRET/);
    });

    it('refuses an explicitly weak secret even in memory-mode development', () => {
      setEnv({ NODE_ENV: 'test', JWT_SECRET: 'shortsecret' });

      expect(() => new InMemoryTokenService()).toThrow(/at least 32/i);
    });

    it('accepts a strong secret in production and round-trips tokens', () => {
      setEnv({ NODE_ENV: 'production', JWT_SECRET: Buffer.alloc(32, 7).toString('hex') });
      const service = new InMemoryTokenService();

      const payload = service.verifyToken<Record<string, unknown>>(
        service.signScopedToken(scopedPayload),
      );
      expect(payload.userId).toBe('usr-1');
    });

    it('uses a per-instance non-static secret in memory-mode development', () => {
      setEnv({ NODE_ENV: 'test', JWT_SECRET: undefined, DATABASE_URL: undefined, DB_HOST: undefined });
      const first = new InMemoryTokenService();
      const second = new InMemoryTokenService();

      expect(() => second.verifyToken(first.signScopedToken(scopedPayload))).toThrow();
    });
  });
});
