import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { AxiosResponse } from 'axios'
import { Readable } from 'stream'
import { FilesService, FILE_PROCESSING_QUEUE } from './files.service'
import { GoogleDriveService } from './google-drive.service'
import { FileStatus } from './entities/file.entity'
import * as path from 'path'
import * as url from 'url'

interface FileJobPayload {
  fileId: string
  url: string
}

@Processor(FILE_PROCESSING_QUEUE)
export class FilesProcessor {
  private readonly logger = new Logger(FilesProcessor.name)

  constructor(
    private readonly httpService: HttpService,
    private readonly filesService: FilesService,
    private readonly googleDriveService: GoogleDriveService
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`)
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed! Result: ${JSON.stringify(result)}`)
  }

  @OnQueueFailed()
  onFailed(job: Job<FileJobPayload>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack)
    this.filesService.updateFileStatus(job.data.fileId, FileStatus.FAILED, error.message).catch(err => {
      this.logger.error(`Failed to update status to FAILED for file ${job.data.fileId}: ${err.message}`)
    })
  }

  @Process('process-file')
  async handleFileProcessing(job: Job<FileJobPayload>): Promise<any> {
    const { fileId, url: fileUrl } = job.data
    this.logger.log(`Starting download for file ID: ${fileId} from URL: ${fileUrl}`)

    await this.filesService.updateFileStatus(fileId, FileStatus.PROCESSING)

    let response: AxiosResponse<Readable>
    try {
      response = await this.httpService.axiosRef({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
        timeout: 300000
      })

      const contentDisposition = response.headers['content-disposition'] as string

      let fileName = `file_${fileId}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/i)
        if (match && match[1]) {
          fileName = match[1]
        }
      } else {
        const parsedUrl = new url.URL(fileUrl)
        const baseName = path.basename(parsedUrl.pathname)
        if (baseName) {
          fileName = baseName
        }
      }
      fileName = decodeURIComponent(fileName)

      const mimeType = response.headers['content-type'] ?? 'application/octet-stream'

      this.logger.log(`Downloading ${fileName} (${mimeType}) for file ID: ${fileId}`)

      const driveResponse = await this.googleDriveService.uploadFile(response.data, fileName, mimeType)

      await this.filesService.updateCompletedFile(fileId, driveResponse.id, driveResponse.webViewLink, fileName, mimeType)

      return { driveFileId: driveResponse.id, message: 'Upload successful' }
    } catch (error: any) {
      this.logger.error(`Error processing file ID ${fileId} from URL ${fileUrl}: ${error.message}`, error.stack)
      await this.filesService.updateFileStatus(fileId, FileStatus.FAILED, error.message)
      throw error
    }
  }
}
