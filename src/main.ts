import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('smartlocker/api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Smartlocker API')
    .setDescription('Official smartlocker REST API endpoints documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .setContact(
      'Guilherme Dilio de Souza',
      'https://www.linkedin.com/in/guilherme-souza-579267250/',
      'guilhermedilio2003@gmail.com',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  await app.listen(5000);
}
bootstrap();
