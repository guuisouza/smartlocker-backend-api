import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NfcCaptureController } from './nfc-capture.controller';
import { NfcCaptureService } from './nfc-capture.service';

@Module({
  imports: [PrismaModule],
  controllers: [NfcCaptureController],
  providers: [NfcCaptureService],
  exports: [NfcCaptureService],
})
export class NfcCaptureModule {}
