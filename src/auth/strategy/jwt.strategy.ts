import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable() 
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    try {
      console.log('JWT PAYLOAD:', payload);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        console.log('User not found for id:', payload.sub);
        throw new UnauthorizedException('User not found');
      }

      const { passwordHash, refreshToken, ...result } = user;
      return {
        ...result,
        sub: user.id,
        email: user.email,
        role: user.role,
      };

    } catch (error) {
      console.error('JWT Validate Error:', error);
      throw new UnauthorizedException('Token invalid');
    }
    
  }
}