import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateNfcCaptureBody {
  @IsNotEmpty()
  @IsString()
  nfc_tag: string;

  @IsNotEmpty()
  @IsDateString()
  datetime: string;
}
