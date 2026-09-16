import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext, TenantContextPayload } from './tenant-context.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.tenantId) {
      const payload: TenantContextPayload = {
        tenantId: user.tenantId,
        userId: user.id || user.userId,
        role: user.role,
      };

      return new Observable((subscriber) => {
        TenantContext.run(payload, () => {
          next.handle().subscribe(subscriber);
        });
      });
    }

    return next.handle();
  }
}
