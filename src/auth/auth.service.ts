import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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

  login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Temporary test user
    // Later we will replace this with database checking
    const testUser = {
      id: 1,
      username: 'testuser',
      email: 'test@gmail.com',
      password: 'password123',
      role: 'participant',
    };

    if (email !== testUser.email || password !== testUser.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      message: 'Login successful',
      user: {
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role,
      },
    };
  }
}
