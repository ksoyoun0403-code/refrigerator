import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpirationScansService } from './expiration-scans.service';

type UploadedImage = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Controller('expiration-scans')
export class ExpirationScansController {
  constructor(private readonly scansService: ExpirationScansService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  scan(@UploadedFile() image?: UploadedImage) {
    return this.scansService.scan(
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
