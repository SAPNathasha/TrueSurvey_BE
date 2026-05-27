import { UserRole } from '../../generated/prisma/enums';

export type TokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};
