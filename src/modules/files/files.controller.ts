import { Controller, Post, Body, Get, Logger, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common'
import { FilesService } from './files.service'
import { UploadUrlsDto } from './dto/upload-urls.dto'
import { File } from './entities/file.entity'

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name)

  constructor(private readonly filesService: FilesService) {}

  @Post('upload-from-urls')
  @HttpCode(HttpStatus.ACCEPTED)
  async uploadFromUrls(@Body() uploadUrlsDto: UploadUrlsDto): Promise<any> {
    this.logger.log(`Received request to upload from URLs: ${uploadUrlsDto.urls.join(', ')}`)
    const jobReferences = await this.filesService.initiateFileUploads(uploadUrlsDto)
    return {
      message: 'File processing initiated for the provided URLs.',
      jobs: jobReferences
    }
  }

  @Get()
  async getAllFiles(): Promise<File[]> {
    this.logger.log('Received request to list all files')
    return this.filesService.getAllFiles()
  }

  @Get(':id')
  async getFileById(@Param('id', ParseUUIDPipe) id: string): Promise<File> {
    this.logger.log(`Received request to get file with ID: ${id}`)
    return this.filesService.getFileById(id)
  }
}
