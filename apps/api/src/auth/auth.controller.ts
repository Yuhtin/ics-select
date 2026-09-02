import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ACCOUNT_DISABLED, AuthService, EMAIL_NOT_INVITED } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from './strategies/jwt.strategy.js';

const REFRESH_COOKIE = 'ics_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Passport redirects to Google's consent screen
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as Parameters<AuthService['loginWithGoogle']>[0];
    const frontend = this.config.getOrThrow<string>('FRONTEND_BASE_URL');
    let result: Awaited<ReturnType<AuthService['loginWithGoogle']>>;
    try {
      result = await this.auth.loginWithGoogle(profile);
    } catch (err) {
      // Allowlist reject: redirect to login with a specific error code so
      // the UI can show "email not invited". Rethrow anything else so the
      // global filter maps it normally (500 / wrapped Unauthorized etc.).
      const msg = err instanceof UnauthorizedException ? err.message : null;
      if (msg === EMAIL_NOT_INVITED || msg === ACCOUNT_DISABLED) {
        const url = new URL('/login', frontend);
        url.searchParams.set(
          'error',
          msg === ACCOUNT_DISABLED ? 'account_disabled' : 'not_invited',
        );
        res.redirect(url.toString());
        return;
      }
      throw err;
    }
    this.setRefreshCookie(res, result.refreshToken);
    const url = new URL('/auth/callback', frontend);
    url.searchParams.set('token', result.accessToken);
    res.redirect(url.toString());
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null;
    if (!token) throw new UnauthorizedException('missing refresh cookie');
    const result = await this.auth.refreshSession(token);
    if (!result) {
      res.clearCookie(REFRESH_COOKIE);
      throw new UnauthorizedException('invalid refresh');
    }
    this.setRefreshCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, user: result.user });
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null;
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE);
    res.json({ ok: true });
  }

  @Get('me')
  me(@CurrentUser() user: JwtStrategyPayload) {
    return user;
  }

  private setRefreshCookie(
    res: Response,
    token: { plaintext: string; expiresAt: Date },
  ): void {
    const isProd = this.config.getOrThrow<string>('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, token.plaintext, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      expires: token.expiresAt,
      path: '/auth',
    });
  }
}
