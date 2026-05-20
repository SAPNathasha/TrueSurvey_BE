import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  register(registerDto: RegisterDto) {
    return {
      message: 'Register route is working',
      user: {
        username: registerDto.username,
        email: registerDto.email,
        role: registerDto.role,
      },
    };
  }
}
