import { UserRole } from '../../generated/prisma/enums';

export type TokenPayload = {
  sub: string;
  role: UserRole;
};
