import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'
import * as fs from 'fs'

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name)
  private drive: drive_v3.Drive
  private driveFolderId: string

  constructor(private readonly configService: ConfigService) {
    const keyFilePath = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_PATH')
    this.driveFolderId = this.configService.get<string>('GOOGLE_DRIVE_FOLDER_ID') as string

    if (!keyFilePath || !fs.existsSync(keyFilePath)) {
      this.logger.error(`Google Service Account Key file not found at path: ${keyFilePath}`)
      throw new InternalServerErrorException('Google Service Account Key file is missing or path is incorrect.')
    }

    if (!this.driveFolderId) {
      this.logger.error(`Google Drive Folder ID is not configured.`)
      throw new InternalServerErrorException('Target Google Drive Folder ID is missing.')
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    })

    this.drive = google.drive({ version: 'v3', auth })
    this.logger.log('Google Drive Service Initialized')
  }

  async uploadFile(fileStream: Readable, fileName: string, mimeType: string = 'application/octet-stream'): Promise<{ id: string; webViewLink: string }> {
    this.logger.log(`Attempting to upload file: ${fileName} to folder ${this.driveFolderId}`)
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [this.driveFolderId],
          mimeType: mimeType
        },
        media: {
          mimeType: mimeType,
          body: fileStream
        },
        fields: 'id, webViewLink'
      })

      this.logger.log(`File ${fileName} uploaded successfully. Drive ID: ${response.data.id}`)
      return {
        id: response.data.id!,
        webViewLink: response.data.webViewLink!
      }
    } catch (error: any) {
      this.logger.error(`Failed to upload file ${fileName} to Google Drive: ${error.message}`, error.stack)
      if (error.response?.data?.error) {
        this.logger.error(`Google API Error: ${JSON.stringify(error.response.data.error)}`)
        throw new InternalServerErrorException(`Google API Error: ${error.response.data.error.message}`)
      }
      throw new InternalServerErrorException(`Failed to upload to Google Drive: ${error.message}`)
    }
  }
}
