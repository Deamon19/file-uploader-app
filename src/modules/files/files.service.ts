import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { File, FileStatus } from './entities/file.entity'
import { UploadUrlsDto } from './dto/upload-urls.dto'

export const FILE_PROCESSING_QUEUE = 'file-processing'

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name)

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectQueue(FILE_PROCESSING_QUEUE) private readonly fileQueue: Queue
  ) {}

  async initiateFileUploads(uploadUrlsDto: UploadUrlsDto): Promise<{ jobId: string | number; originalUrl: string }[]> {
    const jobPromises = uploadUrlsDto.urls.map(async url => {
      const newFile = this.fileRepository.create({
        originalUrl: url,
        status: FileStatus.PENDING
      })
      const savedFile = await this.fileRepository.save(newFile)
      this.logger.log(`Created pending record for URL: ${url} with ID: ${savedFile.id}`)

      const job = await this.fileQueue.add('process-file', {
        fileId: savedFile.id,
        url: url
      })
      this.logger.log(`Added job ${job.id} to queue for file ID: ${savedFile.id}`)

      return { jobId: job.id, originalUrl: url }
    })

    const results = (await Promise.all(jobPromises)).filter(result => result !== null)
    return results as { jobId: string | number; originalUrl: string }[]
  }

  async getAllFiles(): Promise<File[]> {
    return this.fileRepository.find({
      order: { createdAt: 'DESC' }
    })
  }

  async getFileById(id: string): Promise<File> {
    const file = await this.fileRepository.findOneBy({ id })
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`)
    }
    return file
  }

  async updateFileStatus(fileId: string, status: FileStatus, errorMessage?: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      status,
      errorMessage: errorMessage ?? null
    })
    this.logger.log(`Updated status for file ${fileId} to ${status}`)
  }

  async updateCompletedFile(fileId: string, googleDriveId: string, googleDriveLink: string, fileName: string, mimeType: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      status: FileStatus.COMPLETED,
      googleDriveId,
      googleDriveLink,
      fileName,
      mimeType,
      errorMessage: null
    })
    this.logger.log(`File ${fileId} processing completed. Drive ID: ${googleDriveId}`)
  }
}
