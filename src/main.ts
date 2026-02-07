import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidUnknownValues: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PasaTanda API')
    .setDescription(
      'API para autenticacion, gestion de tandas, pagos y webhooks. Usa Bearer token para rutas protegidas.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Local')
    .addServer('https://api.pasatanda.lat', 'Prod')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token emitido por /auth/login',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'PasaTanda API Docs',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
