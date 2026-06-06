import type { Request } from 'express';

import type { TokenPayload } from './token-payload.type';

export type AuthenticatedRequest = Request & {
  user: TokenPayload;
};
