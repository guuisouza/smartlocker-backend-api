import { Body, Controller, Post } from '@nestjs/common';
import { RegisterAuthBodyDTO } from './dto/register-auth-body.dto';
import { AuthService } from './auth.service';
import { LoginAuthBodyDTO } from './dto/login-auth-body.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() data: RegisterAuthBodyDTO) {
    return this.authService.register(data);
  }

  @Post('login')
  async login(@Body() data: LoginAuthBodyDTO) {
    return this.authService.login(data);
  }
}
