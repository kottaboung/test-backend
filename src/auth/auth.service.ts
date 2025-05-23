import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { Prisma } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if(existingUser) {
      throw new UnauthorizedException('Email already use');
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: hash,
        role: 'USER'
      }
    });

    const { passwordHash, ...result } = user;
    return result;

    }

    async login(dto: LoginDto) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email }
      });

      if(!user) {
        throw new UnauthorizedException('Invalid Email');
      }

      const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
      if(!isMatch) {
        throw new UnauthorizedException('Invalid password');
        }

        const { passwordHash, ...result }= user;
        return result;
    }
}
