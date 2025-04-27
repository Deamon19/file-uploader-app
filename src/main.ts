import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const port = configService.get<number>('PORT') || 3000

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  )

  app.enableCors({
    origin: '*', // TODO: For non-prod purposes only :)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
  })

  await app.listen(port)
  Logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap')
}
bootstrap()
