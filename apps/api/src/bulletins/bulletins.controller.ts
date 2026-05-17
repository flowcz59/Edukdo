import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulletinStatus } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { BulletinsService } from './bulletins.service';
import { UploadBulletinDto } from './dto/upload-bulletin.dto';

@UseGuards(JwtAuthGuard)
@Controller('bulletins')
export class BulletinsController {
  constructor(private readonly bulletinsService: BulletinsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadBulletinDto,
  ) {
    return this.bulletinsService.upload(user.sub, file, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: BulletinStatus,
  ) {
    return this.bulletinsService.findAll(user.sub, page, limit, status);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.bulletinsService.findOne(user.sub, id);
  }
}
