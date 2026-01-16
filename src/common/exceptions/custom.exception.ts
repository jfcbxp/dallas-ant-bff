/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { InternalServerErrorException } from '@nestjs/common';

export class CustomException extends InternalServerErrorException {
	public error: any;

	constructor(message: string, error: any) {
		super(message);
		this.message = message;
		this.error = error;
	}
}
