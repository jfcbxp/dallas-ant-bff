import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';

describe('PrismaService', () => {
	let service: PrismaService;

	const mockPrismaClient = {
		$connect: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PrismaService],
		})
			.useMocker((token) => {
				if (token === PrismaService) {
					return mockPrismaClient;
				}
				return jest.fn();
			})
			.compile();

		service = module.get<PrismaService>(PrismaService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('onModuleInit', () => {
		it('should call $connect on module init', async () => {
			// Mock the parent class $connect
			const connectSpy = jest.spyOn(service as any, '$connect').mockResolvedValue(undefined);

			await service.onModuleInit();

			expect(connectSpy).toHaveBeenCalled();
		});
	});

	describe('enableShutdownHooks', () => {
		it('should register beforeExit listener', () => {
			const processSpy = jest.spyOn(process, 'on');
			const mockApp = {
				close: jest.fn().mockResolvedValue(undefined),
			} as unknown as INestApplication;

			service.enableShutdownHooks(mockApp);

			expect(processSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function));

			processSpy.mockRestore();
		});

		it('should close app on beforeExit event', async () => {
			let beforeExitCallback: (() => void) | undefined;

			const processSpy = jest.spyOn(process, 'on').mockImplementation((event, callback: any) => {
				if (event === 'beforeExit') {
					beforeExitCallback = callback;
				}
				return process;
			});

			const mockApp = {
				close: jest.fn().mockResolvedValue(undefined),
			} as unknown as INestApplication;

			service.enableShutdownHooks(mockApp);

			expect(beforeExitCallback).toBeDefined();

			if (beforeExitCallback) {
				await beforeExitCallback();
			}

			expect(mockApp.close).toHaveBeenCalled();

			processSpy.mockRestore();
		});

		it('should handle error during app close', async () => {
			let beforeExitCallback: (() => void) | undefined;
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

			jest.spyOn(process, 'on').mockImplementation((event, callback: any) => {
				if (event === 'beforeExit') {
					beforeExitCallback = callback;
				}
				return process;
			});

			const mockError = new Error('Close error');
			const mockApp = {
				close: jest.fn().mockRejectedValue(mockError),
			} as unknown as INestApplication;

			service.enableShutdownHooks(mockApp);

			if (beforeExitCallback) {
				await beforeExitCallback();
			}

			expect(consoleErrorSpy).toHaveBeenCalledWith('Error during app shutdown:', mockError);

			consoleErrorSpy.mockRestore();
		});
	});
});
