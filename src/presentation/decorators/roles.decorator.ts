import { SetMetadata } from '@nestjs/common';
import { MembershipRole } from '../../core/domain/entities/merchant-membership.entity';

export type UserRole = 'SUPER_ADMIN' | MembershipRole;

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
