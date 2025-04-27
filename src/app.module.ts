import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bull'
import { FilesModule } from './modules/files/files.module'
import { typeOrmAsyncConfig } from './config/typeorm.config'
import { bullAsyncConfig } from './config/bull.config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    BullModule.forRootAsync(bullAsyncConfig),
    FilesModule
  ],
  controllers: [],
  providers: []
})
export class AppModule {}
