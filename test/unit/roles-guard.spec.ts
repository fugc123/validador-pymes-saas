import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/presentation/guards/roles.guard';

describe('Tri-Tier RBAC RolesGuard (T06)', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access if route has no specific role requirements', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'CASHIER' } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow MERCHANT_OWNER to access OWNER-protected route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MERCHANT_OWNER']);

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'MERCHANT_OWNER' } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should BLOCK CASHIER from accessing MERCHANT_OWNER routes (HTTP 403)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MERCHANT_OWNER']);

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'CASHIER' } }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should allow SUPER_ADMIN to access any route under Article III governance', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MERCHANT_OWNER']);

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'SUPER_ADMIN', isSuperAdmin: true } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });
});
