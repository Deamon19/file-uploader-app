import { IsArray, IsUrl, ArrayNotEmpty } from 'class-validator'

export class UploadUrlsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({}, { each: true })
  urls: string[]
}
