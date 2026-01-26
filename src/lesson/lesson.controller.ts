import { Controller, Post, Param, Logger } from '@nestjs/common';
import { LessonService } from './lesson.service';
import type { LessonEndResponse } from './lesson.service';

@Controller('lesson')
export class LessonController {
	private readonly logger = new Logger(LessonController.name);

	constructor(private readonly lessonService: LessonService) {}

	@Post('start')
	async startLesson() {
		this.logger.log('Starting lesson endpoint called');
		return await this.lessonService.startLesson();
	}

	@Post('end/:lessonId')
	async endLesson(@Param('lessonId') lessonId: string): Promise<LessonEndResponse> {
		this.logger.log('Ending lesson endpoint called for:', lessonId);
		return await this.lessonService.endLesson(lessonId);
	}
}
