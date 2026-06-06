import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import type { TokenPayload } from '../types/token-payload.type';

export const User = createParamDecorator(
  (
    data: keyof TokenPayload | undefined,
    ctx: ExecutionContext,
  ): TokenPayload | TokenPayload[keyof TokenPayload] | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!data) {
      return user;
    }

    return user?.[data];
  },
);
