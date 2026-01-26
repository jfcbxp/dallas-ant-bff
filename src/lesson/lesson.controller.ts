import { Controller, Post, Get, Logger } from '@nestjs/common';
import { LessonService } from './lesson.service';
import type { LessonEndResponse, LessonStatusResponse, LessonResultResponse } from './lesson.service';

@Controller('lesson')
export class LessonController {
	private readonly logger = new Logger(LessonController.name);

	constructor(private readonly lessonService: LessonService) {}

	@Post('start')
	async startLesson() {
		this.logger.log('Starting lesson endpoint called');
		return await this.lessonService.startLesson();
	}

	@Post('end')
	async endLesson(): Promise<LessonEndResponse> {
		this.logger.log('Ending lesson endpoint called');
		return await this.lessonService.endLesson();
	}

	@Get('status')
	async getLessonStatus(): Promise<LessonStatusResponse> {
		this.logger.log('Getting lesson status endpoint called');
		return await this.lessonService.getLessonStatus();
	}

	@Get('result')
	async getLatestLessonResult(): Promise<LessonResultResponse> {
		this.logger.log('Getting latest lesson result');
		return await this.lessonService.getLessonResult();
	}
}
