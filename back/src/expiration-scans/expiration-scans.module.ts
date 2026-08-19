import { Module } from '@nestjs/common';
import { ExpirationScansController } from './expiration-scans.controller';
import { ExpirationScansService } from './expiration-scans.service';
import { EXPIRATION_RECOGNIZER } from './expiration-recognizer.port';
import { GoogleCloudVisionExpirationRecognizer } from './google-cloud-vision-expiration-recognizer';

@Module({
  controllers: [ExpirationScansController],
  providers: [
    ExpirationScansService,
    {
      provide: EXPIRATION_RECOGNIZER,
      useClass: GoogleCloudVisionExpirationRecognizer,
    },
  ],
})
export class ExpirationScansModule {}
