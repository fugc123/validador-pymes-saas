import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DDL_SCHEMA_SQL } from './schema';

export interface DatabaseHealth {
  connected: boolean;
  poolTotalCount: number;
  poolIdleCount: number;
  poolWaitingCount: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  private isMemoryMode = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    const host = this.configService.get<string>('DB_HOST');

    if (!dbUrl && !host) {
      this.logger.warn('No PostgreSQL connection string configured. DatabaseService running in simulated mode.');
      this.isMemoryMode = true;
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: dbUrl,
        host: host || 'localhost',
        port: this.configService.get<number>('DB_PORT') || 5432,
        user: this.configService.get<string>('DB_USER') || 'postgres',
        password: this.configService.get<string>('DB_PASSWORD') || 'postgres',
        database: this.configService.get<string>('DB_NAME') || 'validador_saas',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      const client = await this.pool.connect();
      this.logger.log('PostgreSQL pool successfully connected.');
      client.release();

      await this.runMigrations();
    } catch (err: any) {
      this.logger.warn(`PostgreSQL connection failed (${err.message}). Defaulting to simulated mode for unit/testing.`);
      this.isMemoryMode = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL connection pool closed.');
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.pool || this.isMemoryMode) {
      this.logger.log('Skipping real PostgreSQL migration execution (memory mode active).');
      return;
    }
    await this.query(DDL_SCHEMA_SQL);
    this.logger.log('PostgreSQL DDL schema migrations executed successfully.');
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (this.isMemoryMode || !this.pool) {
      return {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };
    }
    return this.pool.query<T>(text, params);
  }

  async getClient(): Promise<PoolClient | null> {
    if (!this.pool || this.isMemoryMode) {
      return null;
    }
    return this.pool.connect();
  }

  getHealth(): DatabaseHealth {
    if (this.isMemoryMode || !this.pool) {
      return {
        connected: false,
        poolTotalCount: 0,
        poolIdleCount: 0,
        poolWaitingCount: 0,
      };
    }
    return {
      connected: true,
      poolTotalCount: this.pool.totalCount,
      poolIdleCount: this.pool.idleCount,
      poolWaitingCount: this.pool.waitingCount,
    };
  }
}
