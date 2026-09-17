import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { ITokenService, ScopedTokenPayload } from '../../core/application/ports/auth.ports';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject('ITokenService')
    private readonly tokenService: ITokenService,
  ) {}

  use(req: any, _res: any, next: () => void) {
    const authHeader = req.headers?.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const payload = this.tokenService.verifyToken<ScopedTokenPayload>(token);
        req.user = {
          ...payload,
          id: payload.userId,
        };
      } catch {
        // Invalid or corrupt token - req.user remains undefined so guards can handle it
      }
    }
    next();
  }
}
