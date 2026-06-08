import { UserRole } from '../../generated/prisma/enums';

export type TokenPayload = {
  sub: string;
  username: string;
  role: UserRole;
  isEmailVerified: boolean;
};
