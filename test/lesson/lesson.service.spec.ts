import { Test, TestingModule } from '@nestjs/testing';
import { LessonService } from '../../src/lesson/lesson.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AntService } from '../../src/ant/ant.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('LessonService', () => {
	let service: LessonService;
	let prismaService: PrismaService;
	let antService: AntService;

	const mockLesson = {
		id: 'lesson-1',
		status: 'ACTIVE',
		startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
		endedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockUser = {
		id: 'user-1',
		name: 'João Silva',
		gender: 'M',
		weight: 75,
		height: 180,
		birthDate: new Date('1990-01-15'),
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockUserDevice = {
		id: 'device-1',
		userId: 'user-1',
		deviceId: 12345,
		linkedAt: new Date(),
		updatedAt: new Date(),
	};

	const mockHeartRateRecord = {
		id: 'record-1',
		deviceId: 12345,
		heartRate: 100,
		beatTime: 1000,
		beatCount: 5,
		manufacturerId: 1,
		serialNumber: '123456',
		stickId: 1,
		createdAt: new Date(),
	};

	const mockPrismaService = {
		lesson: {
			create: jest.fn(),
			deleteMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
		},
		heartRateRecord: {
			deleteMany: jest.fn(),
			findMany: jest.fn(),
		},
		lessonResult: {
			deleteMany: jest.fn(),
			create: jest.fn(),
		},
		userDevice: {
			deleteMany: jest.fn(),
			findMany: jest.fn(),
		},
		user: {
			findUnique: jest.fn(),
			findMany: jest.fn(),
		},
	};

	const mockAntService = {
		clearCache: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LessonService,
				{
					provide: PrismaService,
					useValue: mockPrismaService,
				},
				{
					provide: AntService,
					useValue: mockAntService,
				},
			],
		}).compile();

		service = module.get<LessonService>(LessonService);
		prismaService = module.get<PrismaService>(PrismaService);
		antService = module.get<AntService>(AntService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('startLesson', () => {
		it('should start a new lesson successfully', async () => {
			mockPrismaService.heartRateRecord.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lessonResult.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lesson.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lesson.create.mockResolvedValue(mockLesson);

			const result = await service.startLesson();

			expect(result).toBeDefined();
			expect(result.lessonId).toBe('lesson-1');
			expect(result.startedAt).toBeDefined();
			expect(mockPrismaService.lesson.create).toHaveBeenCalledWith({
				data: { status: 'ACTIVE' },
			});
		});

		it('should clear previous data when starting new lesson', async () => {
			mockPrismaService.heartRateRecord.deleteMany.mockResolvedValue({ count: 5 });
			mockPrismaService.lessonResult.deleteMany.mockResolvedValue({ count: 2 });
			mockPrismaService.lesson.deleteMany.mockResolvedValue({ count: 1 });
			mockPrismaService.lesson.create.mockResolvedValue(mockLesson);

			await service.startLesson();

			expect(mockPrismaService.heartRateRecord.deleteMany).toHaveBeenCalled();
			expect(mockPrismaService.lessonResult.deleteMany).toHaveBeenCalled();
			expect(mockPrismaService.lesson.deleteMany).toHaveBeenCalled();
		});

		it('should throw BadRequestException when creation fails', async () => {
			mockPrismaService.heartRateRecord.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lessonResult.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lesson.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lesson.create.mockRejectedValue(new Error('Database error'));

			await expect(service.startLesson()).rejects.toThrow(BadRequestException);
		});
	});

	describe('endLesson', () => {
		it('should end active lesson successfully', async () => {
			const endedLesson = {
				...mockLesson,
				status: 'ENDED',
				endedAt: new Date(),
			};

			const mockLessonResult = {
				id: 'result-1',
				lessonId: 'lesson-1',
				totalDevices: 1,
				deviceResults: [],
				totalPoints: 100,
				duration: 5,
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue(mockLesson);
			mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
			mockPrismaService.lesson.update.mockResolvedValue(endedLesson);
			mockPrismaService.lessonResult.create.mockResolvedValue(mockLessonResult);
			mockPrismaService.userDevice.findMany.mockResolvedValue([mockUserDevice]);
			mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
			mockPrismaService.userDevice.deleteMany.mockResolvedValue({ count: 1 });
			mockPrismaService.heartRateRecord.findMany.mockResolvedValue([mockHeartRateRecord]);

			const result = await service.endLesson();

			expect(result).toBeDefined();
			expect(result.lessonId).toBe('lesson-1');
			expect(result.message).toContain('sucesso');
		});

		it('should throw NotFoundException when no active lesson found', async () => {
			mockPrismaService.lesson.findFirst.mockResolvedValue(null);

			await expect(service.endLesson()).rejects.toThrow(NotFoundException);
		});

		it('should clear user devices when lesson ends', async () => {
			const endedLesson = {
				...mockLesson,
				status: 'ENDED',
				endedAt: new Date(),
			};

			const mockLessonResult = {
				id: 'result-1',
				lessonId: 'lesson-1',
				totalDevices: 1,
				deviceResults: [],
				totalPoints: 100,
				duration: 5,
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue(mockLesson);
			mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
			mockPrismaService.lesson.update.mockResolvedValue(endedLesson);
			mockPrismaService.lessonResult.create.mockResolvedValue(mockLessonResult);
			mockPrismaService.userDevice.findMany.mockResolvedValue([mockUserDevice]);
			mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
			mockPrismaService.userDevice.deleteMany.mockResolvedValue({ count: 2 });
			mockPrismaService.heartRateRecord.findMany.mockResolvedValue([mockHeartRateRecord]);

			await service.endLesson();

			expect(mockPrismaService.userDevice.deleteMany).toHaveBeenCalled();
			expect(mockAntService.clearCache).toHaveBeenCalled();
		});
	});

	describe('getLessonStatus', () => {
		it('should return active lesson status', async () => {
			mockPrismaService.lesson.findFirst.mockResolvedValue(mockLesson);

			const result = await service.getLessonStatus();

			expect(result).toBeDefined();
			expect(result.lessonId).toBe('lesson-1');
			expect(result.status).toBe('ACTIVE');
			expect(result.duration).toBeGreaterThan(0);
		});

		it('should return ended lesson status with duration', async () => {
			const endedLesson = {
				...mockLesson,
				status: 'ENDED',
				endedAt: new Date(),
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue(endedLesson);

			const result = await service.getLessonStatus();

			expect(result).toBeDefined();
			expect(result.status).toBe('ENDED');
			expect(result.duration).toBeDefined();
		});

		it('should throw NotFoundException when no lesson found', async () => {
			mockPrismaService.lesson.findFirst.mockResolvedValue(null);

			await expect(service.getLessonStatus()).rejects.toThrow(NotFoundException);
		});

		it('should calculate duration correctly for active lesson', async () => {
			const now = Date.now();
			const lessonStartedMinutesAgo = new Date(now - 10 * 60 * 1000); // 10 minutes ago

			const activeLesson = {
				...mockLesson,
				startedAt: lessonStartedMinutesAgo,
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue(activeLesson);

			const result = await service.getLessonStatus();

			expect(result.duration).toBeGreaterThanOrEqual(9);
			expect(result.duration).toBeLessThanOrEqual(11);
		});
	});

	describe('integration - Full Lesson Workflow', () => {
		it('should handle complete lesson lifecycle', async () => {
			// Start lesson
			mockPrismaService.heartRateRecord.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lessonResult.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lesson.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.lesson.create.mockResolvedValue(mockLesson);

			const startResult = await service.startLesson();
			expect(startResult.lessonId).toBe('lesson-1');

			// Get status
			mockPrismaService.lesson.findFirst.mockResolvedValue(mockLesson);
			const statusResult = await service.getLessonStatus();
			expect(statusResult.status).toBe('ACTIVE');

			// End lesson
			const endedLesson = {
				...mockLesson,
				status: 'ENDED',
				endedAt: new Date(),
			};

			const mockLessonResult = {
				id: 'result-1',
				lessonId: 'lesson-1',
				totalDevices: 0,
				deviceResults: [],
				totalPoints: 0,
				duration: 5,
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue(mockLesson);
			mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
			mockPrismaService.lesson.update.mockResolvedValue(endedLesson);
			mockPrismaService.lessonResult.create.mockResolvedValue(mockLessonResult);
			mockPrismaService.userDevice.findMany.mockResolvedValue([]);
			mockPrismaService.user.findMany.mockResolvedValue([]);
			mockPrismaService.userDevice.deleteMany.mockResolvedValue({ count: 0 });
			mockPrismaService.heartRateRecord.findMany.mockResolvedValue([]);

			const endResult = await service.endLesson();
			expect(endResult.message).toContain('sucesso');
		});
	});
});
