import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type JwtPayload = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  name?: string;
};

export type DecodedJwt = JwtPayload & { iat: number; exp: number };

@Injectable()
export class JwtTokenService {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: JwtPayload): string {
    return this.jwt.sign(payload, { expiresIn: '15m' });
  }

  verify(token: string): DecodedJwt {
    return this.jwt.verify<DecodedJwt>(token);
  }
}
