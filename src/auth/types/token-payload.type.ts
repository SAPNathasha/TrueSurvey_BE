import { UserRole } from '../../generated/prisma/enums';

export type TokenPayload = {
  sub: string;
  email: string;
  username: string;
  role: UserRole;
};
