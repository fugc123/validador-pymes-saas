import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantContext } from '../../src/presentation/interceptors/tenant-context.service';
import { TenantContextInterceptor } from '../../src/presentation/interceptors/tenant-context.interceptor';
import { TenantGuard } from '../../src/presentation/guards/tenant.guard';

describe('Tenant Context & Isolation (T04)', () => {
  describe('TenantContext AsyncLocalStorage', () => {
    it('should throw when accessing tenantId outside of an active context', () => {
      expect(() => TenantContext.getTenantId()).toThrow(
        'TenantContext: No active tenant in current execution context',
      );
    });

    it('should provide tenantId, userId, and role within run() callback', () => {
      TenantContext.run(
        {
          tenantId: 'tenant-abc',
          userId: 'user-123',
          role: 'MERCHANT_OWNER',
        },
        () => {
          expect(TenantContext.getTenantId()).toBe('tenant-abc');
          expect(TenantContext.getUserId()).toBe('user-123');
          expect(TenantContext.getRole()).toBe('MERCHANT_OWNER');
        },
      );
    });

    it('should maintain strict isolation across concurrent async operations', async () => {
      const taskA = new Promise<string>((resolve) => {
        TenantContext.run(
          { tenantId: 'tenant-A', userId: 'user-A', role: 'CASHIER' },
          async () => {
            await new Promise((r) => setTimeout(r, 20));
            resolve(TenantContext.getTenantId());
          },
        );
      });

      const taskB = new Promise<string>((resolve) => {
        TenantContext.run(
          { tenantId: 'tenant-B', userId: 'user-B', role: 'MERCHANT_OWNER' },
          async () => {
            await new Promise((r) => setTimeout(r, 10));
            resolve(TenantContext.getTenantId());
          },
        );
      });

      const [resA, resB] = await Promise.all([taskA, taskB]);
      expect(resA).toBe('tenant-A');
      expect(resB).toBe('tenant-B');
    });
  });

  describe('TenantContextInterceptor', () => {
    const interceptor = new TenantContextInterceptor();

    it('should populate TenantContext during handler execution when req.user has tenantId', (done) => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user-456',
              tenantId: 'tenant-456',
              role: 'CASHIER',
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => {
          expect(TenantContext.getTenantId()).toBe('tenant-456');
          expect(TenantContext.getUserId()).toBe('user-456');
          return of({ success: true });
        },
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({ success: true });
          done();
        },
      });
    });
  });

  describe('TenantGuard & Cross-Tenant Violation Defense', () => {
    const guard = new TenantGuard();

    it('should allow access when tenant context matches route params', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { tenantId: 'tenant-100', role: 'CASHIER' },
            params: { tenantId: 'tenant-100' },
            body: {},
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should throw ForbiddenException if tenant context is missing', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {},
            params: {},
            body: {},
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should block cross-tenant parameter tampering in URL params', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { tenantId: 'tenant-100', role: 'CASHIER' },
            params: { tenantId: 'tenant-200' }, // Tampered
            body: {},
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should block cross-tenant parameter tampering in body', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { tenantId: 'tenant-100', role: 'CASHIER' },
            params: {},
            body: { tenantId: 'tenant-300' }, // Tampered
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow SUPER_ADMIN to bypass single-tenant restriction for cross-store oversight', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { isSuperAdmin: true, role: 'SUPER_ADMIN' },
            params: { tenantId: 'any-tenant' },
            body: {},
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });
});
