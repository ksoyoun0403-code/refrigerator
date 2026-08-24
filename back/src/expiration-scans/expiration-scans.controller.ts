import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpirationScansService } from './expiration-scans.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

type UploadedImage = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Controller('expiration-scans')
@UseGuards(AuthGuard)
export class ExpirationScansController {
  constructor(private readonly scansService: ExpirationScansService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  scan(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() image?: UploadedImage,
  ) {
    return this.scansService.scan(
      user.id,
      image
        ? {
            bytes: image.buffer,
            fileName: image.originalname,
            mimeType: image.mimetype,
          }
        : undefined,
    );
  }
}
