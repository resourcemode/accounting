import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Create the application with explicit CORS enabled
  const app = await NestFactory.create(AppModule, {
    cors: true
  });
  
  // Enable CORS for all routes
  app.enableCors();
  
  // Set up global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  // Apply global HTTP exception filter for standardized error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Set up Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('ACME Accounting API')
    .setDescription('API for ACME Accounting services')
    .setVersion('1.0')
    .addTag('tickets', 'Ticket management endpoints')
    .addTag('reports', 'Report generation endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start the server
  const port = process.env.PORT ?? 8080; // Changed to port 8080 to avoid conflicts
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}
bootstrap();
