import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getQueueToken } from '@nestjs/bull'
import { NotFoundException } from '@nestjs/common'
import { FilesService, FILE_PROCESSING_QUEUE } from '../files.service'
import { File, FileStatus } from '../entities/file.entity'
import { UploadUrlsDto } from '../dto/upload-urls.dto'

describe('FilesService', () => {
  const mockQueue = {
    add: jest.fn()
  }
  const mockRepository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn()
  }

  let service: FilesService

  const mockFileId = 'mock-uuid-123'
  const mockUrl = 'http://example.com/file.txt'
  const mockFile: File = {
    id: mockFileId,
    originalUrl: mockUrl,
    status: FileStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    fileName: 'null',
    mimeType: null,
    googleDriveId: null,
    googleDriveLink: null,
    errorMessage: null
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getRepositoryToken(File),
          useValue: mockRepository
        },
        {
          provide: getQueueToken(FILE_PROCESSING_QUEUE),
          useValue: mockQueue
        }
      ]
    }).compile()

    service = module.get<FilesService>(FilesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('initiateFileUploads', () => {
    it('should create pending file records and add jobs to the queue', async () => {
      const uploadDto: UploadUrlsDto = { urls: [mockUrl, 'http://another.com/img.png'] }
      const savedFile = { ...mockFile }

      mockRepository.create.mockReturnValue(savedFile)
      mockRepository.save.mockResolvedValue(savedFile)
      mockQueue.add.mockResolvedValue({ id: 'job-123' })

      const result = await service.initiateFileUploads(uploadDto)

      expect(mockRepository.create).toHaveBeenCalledTimes(uploadDto.urls.length)
      expect(mockRepository.save).toHaveBeenCalledTimes(uploadDto.urls.length)
      expect(mockQueue.add).toHaveBeenCalledTimes(uploadDto.urls.length)
      expect(mockQueue.add).toHaveBeenCalledWith('process-file', {
        fileId: savedFile.id,
        url: mockUrl
      })
      expect(mockQueue.add).toHaveBeenCalledWith('process-file', {
        fileId: savedFile.id,
        url: 'http://another.com/img.png'
      })
      expect(result).toHaveLength(uploadDto.urls.length)
      expect(result[0]).toHaveProperty('jobId')
      expect(result[0].originalUrl).toEqual(mockUrl)
    })
  })

  describe('getAllFiles', () => {
    it('should return an array of files', async () => {
      const files = [mockFile, { ...mockFile, id: 'uuid-456', status: FileStatus.COMPLETED }]
      mockRepository.find.mockResolvedValue(files)

      const result = await service.getAllFiles()

      expect(mockRepository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } })
      expect(result).toEqual(files)
    })
  })

  describe('getFileById', () => {
    it('should return a file if found', async () => {
      mockRepository.findOneBy.mockResolvedValue(mockFile)

      const result = await service.getFileById(mockFileId)

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: mockFileId })
      expect(result).toEqual(mockFile)
    })

    it('should throw NotFoundException if file not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null)

      await expect(service.getFileById(mockFileId)).rejects.toThrow(NotFoundException)
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: mockFileId })
    })
  })

  describe('updateStatus', () => {
    it('should call repository.update with correct parameters', async () => {
      const status = FileStatus.PROCESSING
      const errorMsg = 'Test Error'
      mockRepository.update.mockResolvedValue({ affected: 1 })

      await service.updateFileStatus(mockFileId, status, errorMsg)

      expect(mockRepository.update).toHaveBeenCalledWith(mockFileId, {
        status: status,
        errorMessage: errorMsg
      })
    })
    it('should call repository.update without error message if not provided', async () => {
      const status = FileStatus.PROCESSING
      mockRepository.update.mockResolvedValue({ affected: 1 })

      await service.updateFileStatus(mockFileId, status)

      expect(mockRepository.update).toHaveBeenCalledWith(mockFileId, {
        status: status,
        errorMessage: null
      })
    })
  })

  describe('updateCompleted', () => {
    it('should call repository.update with completed status and drive details', async () => {
      const driveId = 'drive-id-123'
      const driveLink = 'http://drive.link/file'
      const fileName = 'completed_file.pdf'
      const mimeType = 'application/pdf'
      mockRepository.update.mockResolvedValue({ affected: 1 })

      await service.updateCompletedFile(mockFileId, driveId, driveLink, fileName, mimeType)

      expect(mockRepository.update).toHaveBeenCalledWith(mockFileId, {
        status: FileStatus.COMPLETED,
        googleDriveId: driveId,
        googleDriveLink: driveLink,
        fileName: fileName,
        mimeType: mimeType,
        errorMessage: null
      })
    })
  })
})
