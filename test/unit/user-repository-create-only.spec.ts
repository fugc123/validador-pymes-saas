import { ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../src/infrastructure/database/database.service';
import { User } from '../../src/core/domain/entities/user.entity';
import { InMemoryUserRepository } from '../../src/infrastructure/repositories/in-memory.repositories';

/**
 * `IUserRepository.save` is create-only: every production caller looks the
 * account up first and only calls save when no user exists, so no legitimate
 * flow updates an existing user through this method. These tests pin that
 * contract so a concurrent signup, a swallowed database error, or an INSERT
 * that silently writes nothing can never overwrite an existing account.
 */

const FIRST_HASH = '$2a$10$firstAccountHashValue0000000000000000000000000000';
const SECOND_HASH = '$2a$10$secondAccountHashValue000000000000000000000000000';

const UNIQUE_VIOLATION = Object.assign(
  new Error('duplicate key value violates unique constraint "users_email_key"'),
  { code: '23505' },
);
const WRITE_FAILURE = new Error('connection terminated unexpectedly');

const INSERT_SQL = /^\s*insert into users/i;

type QueryResultLike = { rows: unknown[]; rowCount: number };

/** Builds a repository wired to a stubbed database service in database mode. */
function dbModeRepository() {
  const query = jest.fn(
    async (_text: string, _params?: unknown[]): Promise<QueryResultLike> => ({ rows: [], rowCount: 0 }),
  );
  const dbService = { isMemoryMode: false, query } as unknown as DatabaseService;
  return { query, repo: new InMemoryUserRepository(dbService) };
}

function newUser(props: { id: string; email: string; passwordHash: string; isSuperAdmin?: boolean }): User {
  return new User({ fullName: 'Account Holder', ...props });
}

describe('IUserRepository.save create-only contract', () => {
  describe('memory mode', () => {
    it('still creates an account when the email is unused', async () => {
      const repo = new InMemoryUserRepository();

      const saved = await repo.save(
        newUser({ id: 'usr-new-1', email: 'fresh@acme.test', passwordHash: FIRST_HASH }),
      );

      expect(saved.id).toBe('usr-new-1');
      const stored = await repo.findByEmail('fresh@acme.test');
      expect(stored?.passwordHash).toBe(FIRST_HASH);
    });

    it('rejects a duplicate email with ConflictException and keeps the first password hash', async () => {
      const repo = new InMemoryUserRepository();
      await repo.save(
        newUser({ id: 'usr-first-1', email: 'dup@acme.test', passwordHash: FIRST_HASH }),
      );

      // Concurrent signup for the same email, normalised differently.
      await expect(
        repo.save(
          newUser({
            id: 'usr-attacker-1',
            email: '  DUP@acme.test ',
            passwordHash: SECOND_HASH,
            isSuperAdmin: true,
          }),
        ),
      ).rejects.toThrow(ConflictException);

      const stored = await repo.findByEmail('dup@acme.test');
      expect(stored?.id).toBe('usr-first-1');
      expect(stored?.passwordHash).toBe(FIRST_HASH);
      expect(stored?.isSuperAdmin).toBe(false);
    });
  });

  describe('database mode', () => {
    it('still inserts a brand new account', async () => {
      const { query, repo } = dbModeRepository();
      const createdAt = '2026-10-05T10:00:00.000Z';
      query.mockImplementation(async () => ({
        rows: [
          {
            id: '3f1d2a4e-6b7c-4d8e-9f0a-1b2c3d4e5f60',
            email: 'created@acme.test',
            password_hash: SECOND_HASH,
            full_name: 'Account Holder',
            is_super_admin: false,
            created_at: createdAt,
            updated_at: createdAt,
          },
        ],
        rowCount: 1,
      }));

      const saved = await repo.save(
        newUser({
          id: '3f1d2a4e-6b7c-4d8e-9f0a-1b2c3d4e5f60',
          email: 'created@acme.test',
          passwordHash: SECOND_HASH,
        }),
      );

      expect(saved.email).toBe('created@acme.test');
      expect(query.mock.calls[0][0]).toMatch(INSERT_SQL);
    });

    it('maps SQLSTATE 23505 to ConflictException', async () => {
      const { query, repo } = dbModeRepository();
      query.mockImplementation(async () => {
        throw UNIQUE_VIOLATION;
      });

      await expect(
        repo.save(newUser({ id: 'usr-db-dup', email: 'dbdup@acme.test', passwordHash: SECOND_HASH })),
      ).rejects.toThrow(ConflictException);
    });

    it('issues a plain INSERT without ON CONFLICT DO UPDATE and without a retry', async () => {
      const { query, repo } = dbModeRepository();
      query.mockImplementation(async () => {
        throw UNIQUE_VIOLATION;
      });

      // The rejection itself is asserted by the SQLSTATE mapping test; here the
      // statement shape and the single-attempt guarantee are what matter.
      await repo.save(newUser({ id: 'usr-db-dup', email: 'dbdup@acme.test', passwordHash: SECOND_HASH })).catch(
        () => undefined,
      );

      expect(query).toHaveBeenCalledTimes(1);
      const [sql] = query.mock.calls[0];
      expect(sql).toMatch(INSERT_SQL);
      expect(sql).not.toMatch(/do update/i);
    });

    it('does not fall back to an in-memory write after a unique violation', async () => {
      const { query, repo } = dbModeRepository();
      query.mockImplementation(async (sql: string) => {
        if (/^\s*insert into users/i.test(String(sql))) {
          throw UNIQUE_VIOLATION;
        }
        return { rows: [], rowCount: 0 };
      });

      await expect(
        repo.save(newUser({ id: 'usr-db-dup', email: 'dbdup@acme.test', passwordHash: SECOND_HASH })),
      ).rejects.toThrow(ConflictException);

      expect(await repo.findByEmail('dbdup@acme.test')).toBeNull();
      expect(await repo.findById('usr-db-dup')).toBeNull();
    });

    it('propagates a non-unique database write error instead of succeeding in memory', async () => {
      const { query, repo } = dbModeRepository();
      query.mockImplementation(async (sql: string) => {
        if (/^\s*insert into users/i.test(String(sql))) {
          throw WRITE_FAILURE;
        }
        return { rows: [], rowCount: 0 };
      });

      await expect(
        repo.save(newUser({ id: 'usr-db-write', email: 'dbfail@acme.test', passwordHash: SECOND_HASH })),
      ).rejects.toBe(WRITE_FAILURE);

      expect(await repo.findByEmail('dbfail@acme.test')).toBeNull();
      expect(await repo.findById('usr-db-write')).toBeNull();
    });

    it('treats an INSERT returning no rows as an error instead of an in-memory success', async () => {
      const { repo } = dbModeRepository();

      await expect(
        repo.save(newUser({ id: 'usr-db-empty', email: 'dbempty@acme.test', passwordHash: SECOND_HASH })),
      ).rejects.toBeInstanceOf(Error);

      expect(await repo.findByEmail('dbempty@acme.test')).toBeNull();
      expect(await repo.findById('usr-db-empty')).toBeNull();
    });
  });
});
