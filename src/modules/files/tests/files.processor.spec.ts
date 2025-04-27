import { Test, TestingModule } from '@nestjs/testing'
import { HttpService } from '@nestjs/axios'
import { Job } from 'bull'
import { Readable } from 'stream'
import { FilesProcessor } from '../files.processor'
import { FilesService } from '../files.service'
import { GoogleDriveService } from '../google-drive.service'
import { FileStatus } from '../entities/file.entity'

const mockFilesService = {
  updateFileStatus: jest.fn(),
  updateCompletedFile: jest.fn()
}

const mockGoogleDriveService = {
  uploadFile: jest.fn()
}

const mockHttpService = {
  axiosRef: jest.fn()
}

describe('FilesProcessor', () => {
  let processor: FilesProcessor
  let filesService: any
  let googleDriveService: any
  let httpService: HttpService

  const mockFileId = 'proc-uuid-123'
  const mockUrl = 'http://download.com/file.zip'
  const mockJobPayload = { fileId: mockFileId, url: mockUrl }
  const mockJob = { data: mockJobPayload } as Job<typeof mockJobPayload>

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        { provide: FilesService, useValue: mockFilesService },
        { provide: GoogleDriveService, useValue: mockGoogleDriveService },
        { provide: HttpService, useValue: mockHttpService }
      ]
    }).compile()

    processor = module.get<FilesProcessor>(FilesProcessor)
    filesService = module.get<FilesService>(FilesService)
    googleDriveService = module.get<GoogleDriveService>(GoogleDriveService)
    httpService = module.get<HttpService>(HttpService)
  })

  it('should be defined', () => {
    expect(processor).toBeDefined()
  })

  describe('handleFileProcessing', () => {
    it('should process file successfully: download -> upload -> update DB', async () => {
      const mockStream = Readable.from(['test data'])
      const mockAxiosResponse = {
        data: mockStream,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename="file.zip"'
        }
      }
      const mockDriveResponse = {
        id: 'drive-id-success',
        webViewLink: 'http://drive.link/success'
      }

      mockFilesService.updateFileStatus.mockResolvedValue(undefined)
      mockHttpService.axiosRef.mockResolvedValue(mockAxiosResponse)
      mockGoogleDriveService.uploadFile.mockResolvedValue(mockDriveResponse)
      mockFilesService.updateCompletedFile.mockResolvedValue(undefined)

      const result = await processor.handleFileProcessing(mockJob)

      expect(filesService.updateFileStatus).toHaveBeenCalledWith(mockFileId, FileStatus.PROCESSING)
      expect(httpService.axiosRef).toHaveBeenCalledWith({
        method: 'get',
        url: mockUrl,
        responseType: 'stream',
        timeout: 300000
      })
      expect(googleDriveService.uploadFile).toHaveBeenCalledWith(mockStream, 'file.zip', 'application/zip')
      expect(filesService.updateCompletedFile).toHaveBeenCalledWith(mockFileId, mockDriveResponse.id, mockDriveResponse.webViewLink, 'file.zip', 'application/zip')
      expect(result).toEqual({ driveFileId: mockDriveResponse.id, message: 'Upload successful' })
    })

    it('should handle file processing failure during download', async () => {
      const downloadError = new Error('Download failed')

      mockFilesService.updateFileStatus.mockResolvedValue(undefined)
      mockHttpService.axiosRef.mockRejectedValue(downloadError)

      await expect(processor.handleFileProcessing(mockJob)).rejects.toThrow(downloadError)

      expect(filesService.updateFileStatus).toHaveBeenCalledWith(mockFileId, FileStatus.PROCESSING)
      expect(httpService.axiosRef).toHaveBeenCalledWith(expect.objectContaining({ url: mockUrl }))
      expect(filesService.updateFileStatus).toHaveBeenCalledWith(mockFileId, FileStatus.FAILED, downloadError.message)
      expect(googleDriveService.uploadFile).not.toHaveBeenCalled()
      expect(filesService.updateCompletedFile).not.toHaveBeenCalled()
    })

    it('should handle file processing failure during upload', async () => {
      const mockStream = Readable.from(['test data'])
      const mockAxiosResponse = {
        data: mockStream,
        headers: { 'content-type': 'image/png', 'content-disposition': 'filename="image.png"' }
      }
      const uploadError = new Error('Upload to Drive failed')

      mockFilesService.updateFileStatus.mockResolvedValue(undefined)
      mockHttpService.axiosRef.mockResolvedValue(mockAxiosResponse)
      mockGoogleDriveService.uploadFile.mockRejectedValue(uploadError)

      await expect(processor.handleFileProcessing(mockJob)).rejects.toThrow(uploadError)

      expect(filesService.updateFileStatus).toHaveBeenCalledWith(mockFileId, FileStatus.PROCESSING)
      expect(httpService.axiosRef).toHaveBeenCalled()
      expect(googleDriveService.uploadFile).toHaveBeenCalledWith(mockStream, 'image.png', 'image/png')
      expect(filesService.updateFileStatus).toHaveBeenCalledWith(mockFileId, FileStatus.FAILED, uploadError.message)
      expect(filesService.updateCompletedFile).not.toHaveBeenCalled()
    })

    it('should extract filename from URL if Content-Disposition is missing', async () => {
      const mockStream = Readable.from(['test data'])
      const mockUrlFilename = 'http://example.com/path/to/document.pdf?query=param'
      const mockJobWithUrlFilename = { data: { fileId: mockFileId, url: mockUrlFilename } } as Job<any>
      const mockAxiosResponse = {
        data: mockStream,
        headers: { 'content-type': 'application/pdf' }
      }
      const mockDriveResponse = { id: 'drive-id', webViewLink: 'http://drive.link' }

      mockFilesService.updateFileStatus.mockResolvedValue(undefined)
      mockHttpService.axiosRef.mockResolvedValue(mockAxiosResponse)
      mockGoogleDriveService.uploadFile.mockResolvedValue(mockDriveResponse)
      mockFilesService.updateCompletedFile.mockResolvedValue(undefined)

      await processor.handleFileProcessing(mockJobWithUrlFilename)

      expect(googleDriveService.uploadFile).toHaveBeenCalledWith(mockStream, 'document.pdf', 'application/pdf')
      expect(filesService.updateCompletedFile).toHaveBeenCalledWith(mockFileId, expect.any(String), expect.any(String), 'document.pdf', 'application/pdf')
    })
  })

  describe('Queue Event Handlers', () => {
    it('onFailed should call filesService.updateFileStatus with FAILED', () => {
      const failedError = new Error('Job processing error')
      mockFilesService.updateFileStatus.mockResolvedValue(undefined)

      processor.onFailed(mockJob, failedError)

      expect(filesService.updateFileStatus).toHaveBeenCalledWith(mockFileId, FileStatus.FAILED, failedError.message)
    })
  })
})
