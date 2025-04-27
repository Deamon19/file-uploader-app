import { Test, TestingModule } from '@nestjs/testing'
import { FilesController } from '../files.controller'
import { FilesService } from '../files.service'
import { UploadUrlsDto } from '../dto/upload-urls.dto'
import { File, FileStatus } from '../entities/file.entity'

const mockFilesService = {
  initiateFileUploads: jest.fn(),
  getAllFiles: jest.fn(),
  getFileById: jest.fn()
}

describe('FilesController', () => {
  let controller: FilesController
  let service: any

  const mockFileId = 'mock-uuid-123'
  const mockUrl = 'http://example.com/file.txt'
  const mockFile: File = {
    id: mockFileId,
    originalUrl: mockUrl,
    status: FileStatus.COMPLETED,
    googleDriveId: 'drive-id',
    googleDriveLink: 'http://drive.link',
    fileName: 'file.txt',
    mimeType: 'text/plain',
    createdAt: new Date(),
    updatedAt: new Date(),
    errorMessage: null
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: mockFilesService
        }
      ]
    }).compile()

    controller = module.get<FilesController>(FilesController)
    service = module.get<FilesService>(FilesService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('uploadFromUrls', () => {
    it('should call filesService.initiateFileUploads and return accepted response', async () => {
      const uploadDto: UploadUrlsDto = { urls: [mockUrl] }
      const jobReferences = [{ jobId: 'job-1', originalUrl: mockUrl }]
      mockFilesService.initiateFileUploads.mockResolvedValue(jobReferences)

      const result = await controller.uploadFromUrls(uploadDto)

      expect(service.initiateFileUploads).toHaveBeenCalledWith(uploadDto)
      expect(result).toEqual({
        message: 'File processing initiated for the provided URLs.',
        jobs: jobReferences
      })
    })
  })

  describe('getAllFiles', () => {
    it('should call filesService.getAllFiles and return the result', async () => {
      const files = [mockFile]
      mockFilesService.getAllFiles.mockResolvedValue(files)

      const result = await controller.getAllFiles()

      expect(service.getAllFiles).toHaveBeenCalled()
      expect(result).toEqual(files)
    })
  })

  describe('getFileById', () => {
    it('should call filesService.getFileById and return the result', async () => {
      mockFilesService.getFileById.mockResolvedValue(mockFile)

      const result = await controller.getFileById(mockFileId)

      expect(service.getFileById).toHaveBeenCalledWith(mockFileId)
      expect(result).toEqual(mockFile)
    })

    it('should let exceptions from service bubble up (e.g., NotFoundException)', async () => {
      const error = new Error('Not Found')
      mockFilesService.getFileById.mockRejectedValue(error)

      await expect(controller.getFileById(mockFileId)).rejects.toThrow(Error)
      expect(service.getFileById).toHaveBeenCalledWith(mockFileId)
    })
  })
})
