import { PollSnapshot } from '@/modules/quack/domain/poll';
import { PollEventsService } from '@/modules/quack/services/poll-events.service';
import { PollsService } from '@/modules/quack/services/polls.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  BetterAuth,
  InjectBetterAuth,
} from '@/shared/auth/providers/better-auth.provider';
import { getSessionFromRequest } from '@/shared/auth/utils/get-session-from-request';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SetPollVoteDto } from './dto/set-poll-vote.dto';

@ApiTags('polls')
@ApiCookieAuth()
@Controller('polls')
@UseGuards(AuthenticatedUserGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PollsController {
  constructor(
    private readonly polls: PollsService,
    private readonly events: PollEventsService,
    @InjectBetterAuth private readonly auth: BetterAuth,
  ) {}

  @Get('events')
  @ApiOperation({ summary: 'Stream committed poll changes' })
  eventsStream(@Req() request: Request, @Res() response: Response): void {
    if (!this.events.isReady)
      throw new ServiceUnavailableException('Live voting is reconnecting');
    response.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    const send = (type: string, data: unknown): void => {
      if (!response.writableEnded)
        response.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const subscription = this.events.events.subscribe((event) => {
      if (event) send('poll-changed', event);
      else response.end();
    });
    let isChecking = false;
    const heartbeat = setInterval(() => {
      if (isChecking) return;
      isChecking = true;
      void getSessionFromRequest(request, this.auth)
        .then((session) => {
          if (!session) {
            send('auth-expired', {});
            response.end();
          } else send('heartbeat', {});
        })
        .catch(() => response.end())
        .finally(() => {
          isChecking = false;
        });
    }, 5000);
    response.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
    });
    send('ready', {});
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get current poll snapshots in a batch' })
  list(
    @Query('ids') input: unknown,
    @User() user: Identity,
  ): Promise<{ polls: PollSnapshot[]; missingIds: string[] }> {
    if (typeof input !== 'string')
      throw new BadRequestException('Supply poll IDs');
    const ids = [...new Set(input.split(','))];
    if (
      !ids.length ||
      ids.length > 100 ||
      ids.some((id) => !/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    )
      throw new BadRequestException('Supply 1–100 valid poll IDs');
    return this.polls.list(ids, user.id);
  }
  @Get(':pollId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get current results and my own choice' })
  get(
    @Param('pollId') id: string,
    @User() user: Identity,
  ): Promise<PollSnapshot> {
    return this.polls.get(id, user.id);
  }
  @Put(':pollId/vote')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Set my choice or remove it with null' })
  vote(
    @Param('pollId') id: string,
    @User() user: Identity,
    @Body() body: SetPollVoteDto,
  ): Promise<PollSnapshot> {
    return this.polls.vote(id, user.id, body.optionId);
  }
}
