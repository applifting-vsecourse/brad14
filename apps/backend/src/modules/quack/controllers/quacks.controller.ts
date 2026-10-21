import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { QuackResponseDto } from './dto/quack.response.dto';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @ApiOperation({ summary: 'List all quacks' })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.getQuacks();
    return quacks.map(QuackResponseDto.fromDomain);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete your own quack, or any quack as an admin' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({
    status: 403,
    description: 'Non-admin cannot delete another author’s quack',
  })
  @ApiResponse({
    status: 404,
    description: 'Quack not found',
  })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async delete(@User() user: Identity, @Param('id') id: string): Promise<void> {
    await this.quacksService.deleteQuack(user, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      mood: body.mood,
      poll: body.poll,
    });
    return QuackResponseDto.fromDomain(quack);
  }
}
