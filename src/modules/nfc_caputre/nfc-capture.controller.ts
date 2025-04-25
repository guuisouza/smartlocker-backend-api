import { Body, Controller, Post } from '@nestjs/common';
import { NfcCaptureService } from './nfc-capture.service';
import { CreateNfcCaptureBody } from './dto/create-nfc-capture-body.dto';

@Controller('nfc-capture')
export class NfcCaptureController {
  constructor(private readonly nfcCaptureService: NfcCaptureService) {}

  @Post()
  async createCapture(@Body() data: CreateNfcCaptureBody) {
    return this.nfcCaptureService.create(data);
  }
}
