import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ExceptionHandler } from '@exceptions/exception.handler';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	app.useGlobalPipes(new ValidationPipe());
	app.useGlobalFilters(new ExceptionHandler());
	app.enableCors({ origin: true, methods: 'POST,GET,PATCH,PUT,DELETE,OPTIONS' });
	await app.listen(3000);
}
bootstrap();
