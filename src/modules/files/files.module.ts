import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bull'
import { HttpModule } from '@nestjs/axios'
import { FilesService, FILE_PROCESSING_QUEUE } from './files.service'
import { FilesController } from './files.controller'
import { File } from './entities/file.entity'
import { GoogleDriveService } from './google-drive.service'
import { FilesProcessor } from './files.processor'

@Module({
  imports: [
    TypeOrmModule.forFeature([File]),
    BullModule.registerQueue({
      name: FILE_PROCESSING_QUEUE
    }),
    HttpModule
  ],
  controllers: [FilesController],
  providers: [FilesService, GoogleDriveService, FilesProcessor]
})
export class FilesModule {}
