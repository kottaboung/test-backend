import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OAuth2Client } from 'google-auth-library';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client('1051415159450-ih46h07jqfflucaqh7mjhi25pmgfj2vg.apps.googleusercontent.com');

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService  
  ) {}

  async loginWithGoogle(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: '1051415159450-ih46h07jqfflucaqh7mjhi25pmgfj2vg.apps.googleusercontent.com',
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { email, name, picture } = payload;

    let user = await this.prisma.user.findUnique({ where: { email } });
    if(!user) {
      user = await this.prisma.user.create({
        data: {
          name: name || '',
          email,
          passwordHash: '',
          profileImage: picture || null,
          role: Role.USER, 
        },
      });
    }

    const tokens = await this.getTokens(user.id, user.email, user.role);

    return {
      tokens,
      user,
    };
  }

  async refreshTokens(userId: number, refreshToken: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.refreshToken) {
    throw new ForbiddenException('Access denied');
  }

  const rtMatches = await bcrypt.compare(refreshToken, user.refreshToken);
  if (!rtMatches) {
    throw new ForbiddenException('Refresh token invalid');
  }

  const tokens = await this.getTokens(user.id, user.email, user.role);

  const hashedRt = await bcrypt.hash(tokens.refreshToken, 10);
  await this.prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashedRt },
  });

  return tokens;
}

  private async getTokens(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };
    console.log('Generated Payload:', payload);
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      }),
    ]);

    return { accessToken, refreshToken };
  }

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
        role: Role.USER,
      }
    });

    const tokens = await this.getTokens(user.id, user.email, user.role);

    const hashedRt = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRt },
    });

    const { passwordHash, refreshToken, ...result } = user;

    return {
      user: result,
      ...tokens,
    };
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

      const tokens = await this.getTokens(user.id, user.email, user.role);

      const hashedRt = await bcrypt.hash(tokens.refreshToken, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRt },
      });

      const { passwordHash, ...result }= user;
      return {
        user: result,
        ...tokens,
      };
    }

    async updateProfile(userId: number, dto: UpdateProfileDto) {
      if (!userId) {
        throw new UnauthorizedException('UserId is missing');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: dto.name ?? user.name,
          email: dto.email ?? user.email,
          profileImage: dto.profileImage ?? user.profileImage,
        },
      });

      const { passwordHash, refreshToken, ...safeUser } = updatedUser;
      return safeUser;
    }


    async logout(userId: number) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
    }

}
