import { Test, TestingModule } from '@nestjs/testing';
import { LessonController } from '../../src/lesson/lesson.controller';
import { LessonService } from '../../src/lesson/lesson.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('LessonController', () => {
	let controller: LessonController;
	let service: LessonService;

	const mockStartResponse = {
		lessonId: 'lesson-1',
		startedAt: new Date(),
	};

	const mockStatusResponse = {
		lessonId: 'lesson-1',
		status: 'ACTIVE',
		startedAt: new Date(Date.now() - 5 * 60 * 1000),
		duration: 5,
	};

	const mockEndResponse = {
		lessonId: 'lesson-1',
		message: 'Lição finalizada com sucesso',
	};

	const mockResultResponse = {
		lessonId: 'lesson-1',
		totalDevices: 1,
		deviceResults: [],
		totalPoints: 100,
		duration: 5,
	};

	const mockLessonService = {
		startLesson: jest.fn(),
		getLessonStatus: jest.fn(),
		endLesson: jest.fn(),
		getLessonResult: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [LessonController],
			providers: [
				{
					provide: LessonService,
					useValue: mockLessonService,
				},
			],
		}).compile();

		controller = module.get<LessonController>(LessonController);
		service = module.get<LessonService>(LessonService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('POST /lesson/start', () => {
		it('should start a new lesson successfully', async () => {
			mockLessonService.startLesson.mockResolvedValue(mockStartResponse);

			const result = await controller.startLesson();

			expect(result).toBeDefined();
			expect(result.lessonId).toBe('lesson-1');
			expect(result.startedAt).toBeDefined();
			expect(mockLessonService.startLesson).toHaveBeenCalled();
		});

		it('should throw error when start fails', async () => {
			mockLessonService.startLesson.mockRejectedValue(new BadRequestException('Start failed'));

			await expect(controller.startLesson()).rejects.toThrow(BadRequestException);
		});
	});

	describe('GET /lesson/status', () => {
		it('should return current lesson status', async () => {
			mockLessonService.getLessonStatus.mockResolvedValue(mockStatusResponse);

			const result = await controller.getLessonStatus();

			expect(result).toBeDefined();
			expect(result.lessonId).toBe('lesson-1');
			expect(result.status).toBe('ACTIVE');
			expect(result.duration).toBe(5);
			expect(mockLessonService.getLessonStatus).toHaveBeenCalled();
		});

		it('should throw NotFoundException when no active lesson', async () => {
			mockLessonService.getLessonStatus.mockRejectedValue(new NotFoundException('No active lesson'));

			await expect(controller.getLessonStatus()).rejects.toThrow(NotFoundException);
		});

		it('should return ENDED status for completed lesson', async () => {
			const endedStatusResponse = {
				lessonId: 'lesson-1',
				status: 'ENDED',
				startedAt: new Date(Date.now() - 10 * 60 * 1000),
				endedAt: new Date(),
				duration: 10,
			};

			mockLessonService.getLessonStatus.mockResolvedValue(endedStatusResponse);

			const result = await controller.getLessonStatus();

			expect(result.status).toBe('ENDED');
			expect(result.endedAt).toBeDefined();
		});
	});

	describe('POST /lesson/end', () => {
		it('should end active lesson successfully', async () => {
			mockLessonService.endLesson.mockResolvedValue(mockEndResponse);

			const result = await controller.endLesson();

			expect(result).toBeDefined();
			expect(result.lessonId).toBe('lesson-1');
			expect(result.message).toContain('sucesso');
			expect(mockLessonService.endLesson).toHaveBeenCalled();
		});

		it('should throw NotFoundException when no active lesson to end', async () => {
			mockLessonService.endLesson.mockRejectedValue(new NotFoundException('No active lesson'));

			await expect(controller.endLesson()).rejects.toThrow(NotFoundException);
		});

		it('should throw error when end fails', async () => {
			mockLessonService.endLesson.mockRejectedValue(new BadRequestException('End failed'));

			await expect(controller.endLesson()).rejects.toThrow(BadRequestException);
		});
	});

	describe('GET /lesson/result', () => {
		it('should return lesson result', async () => {
			mockLessonService.getLessonResult.mockResolvedValue(mockResultResponse);

			const result = await controller.getLatestLessonResult();

			expect(result).toBeDefined();
			expect(result.lessonId).toBe('lesson-1');
			expect(result.totalPoints).toBe(100);
			expect(result.totalDevices).toBe(1);
			expect(mockLessonService.getLessonResult).toHaveBeenCalled();
		});

		it('should throw NotFoundException when no result available', async () => {
			mockLessonService.getLessonResult.mockRejectedValue(new NotFoundException('No result available'));

			await expect(controller.getLatestLessonResult()).rejects.toThrow(NotFoundException);
		});

		it('should return lesson duration', async () => {
			mockLessonService.getLessonResult.mockResolvedValue(mockResultResponse);

			const result = await controller.getLatestLessonResult();

			expect(result.duration).toBeDefined();
			expect(result.duration).toBeGreaterThan(0);
		});
	});

	describe('Full Lesson Workflow', () => {
		it('should handle complete lesson lifecycle through controller', async () => {
			// Start lesson
			mockLessonService.startLesson.mockResolvedValue(mockStartResponse);
			const startResult = await controller.startLesson();
			expect(startResult.lessonId).toBe('lesson-1');

			// Get status
			mockLessonService.getLessonStatus.mockResolvedValue(mockStatusResponse);
			const statusResult = await controller.getLessonStatus();
			expect(statusResult.status).toBe('ACTIVE');
			expect(statusResult.duration).toBeGreaterThan(0);

			// End lesson
			mockLessonService.endLesson.mockResolvedValue(mockEndResponse);
			const endResult = await controller.endLesson();
			expect(endResult.lessonId).toBe('lesson-1');

			// Get result
			mockLessonService.getLessonResult.mockResolvedValue(mockResultResponse);
			const resultData = await controller.getLatestLessonResult();
			expect(resultData.totalPoints).toBeDefined();
		});

		it('should validate lesson state transitions', async () => {
			// Cannot get result without completing lesson
			mockLessonService.getLessonResult.mockRejectedValue(new NotFoundException('No result'));

			await expect(controller.getLatestLessonResult()).rejects.toThrow(NotFoundException);

			// Can get status for active lesson
			mockLessonService.getLessonStatus.mockResolvedValue(mockStatusResponse);
			const status = await controller.getLessonStatus();
			expect(status.status).toBe('ACTIVE');
		});
	});

	describe('Error Handling', () => {
		it('should handle service errors in startLesson', async () => {
			const error = new BadRequestException('Invalid lesson state');
			mockLessonService.startLesson.mockRejectedValue(error);

			await expect(controller.startLesson()).rejects.toThrow(error);
		});

		it('should handle service errors in endLesson', async () => {
			const error = new NotFoundException('No active lesson');
			mockLessonService.endLesson.mockRejectedValue(error);

			await expect(controller.endLesson()).rejects.toThrow(error);
		});

		it('should handle service errors in getLessonStatus', async () => {
			const error = new NotFoundException('Lesson not found');
			mockLessonService.getLessonStatus.mockRejectedValue(error);

			await expect(controller.getLessonStatus()).rejects.toThrow(error);
		});

		it('should handle service errors in getLatestLessonResult', async () => {
			const error = new NotFoundException('Result not found');
			mockLessonService.getLessonResult.mockRejectedValue(error);

			await expect(controller.getLatestLessonResult()).rejects.toThrow(error);
		});
	});

	describe('Response Validation', () => {
		it('should return valid startLesson response structure', async () => {
			mockLessonService.startLesson.mockResolvedValue(mockStartResponse);

			const result = await controller.startLesson();

			expect(result).toHaveProperty('lessonId');
			expect(result).toHaveProperty('startedAt');
			expect(typeof result.lessonId).toBe('string');
			expect(result.startedAt instanceof Date).toBe(true);
		});

		it('should return valid getLessonStatus response structure', async () => {
			mockLessonService.getLessonStatus.mockResolvedValue(mockStatusResponse);

			const result = await controller.getLessonStatus();

			expect(result).toHaveProperty('lessonId');
			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('duration');
			expect(['ACTIVE', 'ENDED']).toContain(result.status);
		});

		it('should return valid getLatestLessonResult response structure', async () => {
			mockLessonService.getLessonResult.mockResolvedValue(mockResultResponse);

			const result = await controller.getLatestLessonResult();

			expect(result).toHaveProperty('lessonId');
			expect(result).toHaveProperty('totalDevices');
			expect(result).toHaveProperty('deviceResults');
			expect(result).toHaveProperty('totalPoints');
			expect(result).toHaveProperty('duration');
		});
	});
});
