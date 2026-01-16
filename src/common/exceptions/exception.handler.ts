/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { CustomException } from './custom.exception';

@Catch(CustomException)
export class ExceptionHandler implements ExceptionFilter {
	catch(exception: CustomException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const status = exception.error.status || exception.getStatus();

		response.status(status).json({
			code: status,
			message: exception.message,
			details: [exception?.error?.message || 'Unexpected error'],
		});
	}
}
