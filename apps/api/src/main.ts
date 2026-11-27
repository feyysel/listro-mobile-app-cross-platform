import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    bodyParser: false,
  });

  app.use(
    express.json({
      limit: '2mb',
      verify: (request, _response, buffer) => {
        (request as express.Request & { rawBody?: string }).rawBody =
          buffer.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  const configService = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: configService.getOrThrow<string>('CORS_ORIGIN').split(','),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Listro API')
    .setDescription(
      'Role-based shoe cleaning and care platform API. All business rules and authorization are enforced server-side.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(
    configService.get<number>('PORT', 3000) ?? 3000,
    '0.0.0.0',
  );
}

await bootstrap();
