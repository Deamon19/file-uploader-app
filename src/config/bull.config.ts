import { SharedBullAsyncConfiguration } from '@nestjs/bull'
import { ConfigModule, ConfigService } from '@nestjs/config'

export const bullAsyncConfig: SharedBullAsyncConfiguration = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): any => ({
    redis: {
      host: configService.get<string>('REDIS_HOST'),
      port: configService.get<number>('REDIS_PORT')
    }
  })
}
