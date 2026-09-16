import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantContext } from '../interceptors/tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SuperAdmin bypasses tenant bounding for platform administration
    if (user?.isSuperAdmin || user?.role === 'SUPER_ADMIN') {
      return true;
    }

    const contextPayload = TenantContext.get();
    const effectiveTenantId = contextPayload?.tenantId || user?.tenantId;

    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant context is strictly required to access this resource');
    }

    // Check for parameter tampering in route params or body
    const paramTenantId = request.params?.tenantId;
    if (paramTenantId && paramTenantId !== effectiveTenantId) {
      throw new ForbiddenException(
        `Cross-tenant access violation: Authenticated for tenant '${effectiveTenantId}', cannot access '${paramTenantId}'`,
      );
    }

    const bodyTenantId = request.body?.tenantId;
    if (bodyTenantId && bodyTenantId !== effectiveTenantId) {
      throw new ForbiddenException(
        `Cross-tenant payload violation: Body specifies tenant '${bodyTenantId}' but active context is '${effectiveTenantId}'`,
      );
    }

    return true;
  }
}
