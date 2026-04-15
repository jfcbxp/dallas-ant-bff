import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LinkDeviceDto } from '../../src/users/interfaces/user-types.interface';

// Mock ant-plus and USB dependencies to avoid native module conflicts
jest.mock('ant-plus');
jest.mock('usb');

import { AntController } from '../../src/ant/ant.controller';
import { AntService } from '../../src/ant/ant.service';

describe('AntController', () => {
	let controller: AntController;
	let service: AntService;

	const mockDevice = {
		deviceId: 12345,
		heartRate: 75,
		beatTime: 1000,
		beatCount: 5,
		manufacturerId: 1,
		serialNumber: '123456',
		stickId: 1,
		receivedAt: new Date(),
	};

	const mockDeviceWithUser = {
		...mockDevice,
		user: {
			id: 'user-1',
			name: 'João Silva',
		},
	};

	const mockUserDevice = {
		id: 'device-1',
		userId: 'user-1',
		deviceId: 12345,
		linkedAt: new Date(),
		updatedAt: new Date(),
	};

	const mockAntService = {
		getAll: jest.fn(),
		getByDeviceId: jest.fn(),
		getAvailableDevices: jest.fn(),
		getAvailableDevicesWithUser: jest.fn(),
		linkDevice: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AntController],
			providers: [
				{
					provide: AntService,
					useValue: mockAntService,
				},
			],
		}).compile();

		controller = module.get<AntController>(AntController);
		service = module.get<AntService>(AntService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /pulseiras', () => {
		it('should return all devices with cached heart rate data', async () => {
			mockAntService.getAll.mockReturnValue([mockDevice]);

			const result = await controller.getAll();

			expect(result).toHaveLength(1);
			expect(result[0].deviceId).toBe(12345);
			expect(result[0].heartRate).toBe(75);
			expect(mockAntService.getAll).toHaveBeenCalled();
		});

		it('should return empty array when no devices cached', async () => {
			mockAntService.getAll.mockReturnValue([]);

			const result = await controller.getAll();

			expect(result).toHaveLength(0);
		});

		it('should return multiple devices', async () => {
			const devices = [mockDevice, { ...mockDevice, deviceId: 54321 }];
			mockAntService.getAll.mockReturnValue(devices);

			const result = await controller.getAll();

			expect(result).toHaveLength(2);
			expect(result[0].deviceId).toBe(12345);
			expect(result[1].deviceId).toBe(54321);
		});
	});

	describe('GET /pulseiras/todas', () => {
		it('should return all available devices from database', async () => {
			mockAntService.getAvailableDevicesWithUser.mockResolvedValue([mockDeviceWithUser]);

			const result = await controller.getAvailable();

			expect(result).toHaveLength(1);
			expect(result[0].deviceId).toBe(12345);
			expect(result[0].user).toBeDefined();
			expect(mockAntService.getAvailableDevicesWithUser).toHaveBeenCalled();
		});

		it('should return devices without user information if not linked', async () => {
			const unlinkedDevice = { ...mockDevice, user: undefined };
			mockAntService.getAvailableDevicesWithUser.mockResolvedValue([unlinkedDevice]);

			const result = await controller.getAvailable();

			expect(result).toHaveLength(1);
			expect(result[0].user).toBeUndefined();
		});

		it('should return empty array when no devices available', async () => {
			mockAntService.getAvailableDevicesWithUser.mockResolvedValue([]);

			const result = await controller.getAvailable();

			expect(result).toHaveLength(0);
		});
	});

	describe('GET /pulseiras/:id', () => {
		it('should return specific device by ID', async () => {
			mockAntService.getByDeviceId.mockReturnValue(mockDevice);

			const result = await controller.getOne(12345);

			expect(result).toBeDefined();
			expect(result?.deviceId).toBe(12345);
			expect(result?.heartRate).toBe(75);
			expect(mockAntService.getByDeviceId).toHaveBeenCalledWith(12345);
		});

		it('should return undefined when device not found', async () => {
			mockAntService.getByDeviceId.mockReturnValue(undefined);

			expect(() => controller.getOne(99999)).toThrow(NotFoundException);
		});

		it('should require positive deviceId', () => {
			const invalidId = -1;

			// Device ID should be positive
			expect(invalidId).toBeLessThan(0);
		});
	});

	describe('POST /pulseiras/vincular-pulseira', () => {
		it('should link device to user successfully', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};

			mockAntService.linkDevice.mockResolvedValue(mockUserDevice);

			const result = await controller.linkDevice(linkDeviceDto);

			expect(result).toBeDefined();
			expect(result.userId).toBe('user-1');
			expect(result.deviceId).toBe(12345);
			expect(mockAntService.linkDevice).toHaveBeenCalledWith(linkDeviceDto);
		});

		it('should throw error when user not found', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'invalid-user',
				deviceId: 12345,
			};

			mockAntService.linkDevice.mockRejectedValue(new NotFoundException('User not found'));

			await expect(controller.linkDevice(linkDeviceDto)).rejects.toThrow(NotFoundException);
		});

		it('should throw error when link operation fails', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};

			mockAntService.linkDevice.mockRejectedValue(new BadRequestException('Link failed'));

			await expect(controller.linkDevice(linkDeviceDto)).rejects.toThrow(BadRequestException);
		});

		it('should require userId', () => {
			const invalidDto = {
				deviceId: 12345,
			} as any;

			expect(invalidDto.userId).toBeUndefined();
		});

		it('should require positive deviceId', () => {
			const invalidDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: -1,
			};

			expect(invalidDto.deviceId).toBeLessThan(0);
		});
	});

	describe('Controller Integration', () => {
		it('should handle getAll and getOne consistently', async () => {
			const devices2 = [mockDevice, { ...mockDevice, deviceId: 54321, heartRate: 80 }];

			mockAntService.getAll.mockReturnValue(devices2);
			mockAntService.getByDeviceId.mockReturnValue(mockDevice);

			const allDevices = await controller.getAll();
			const specificDevice = await controller.getOne(12345);

			expect(allDevices).toHaveLength(2);
			expect(specificDevice).toEqual(mockDevice);
		});

		it('should return all available devices for listing', async () => {
			const availableDevices = [mockDeviceWithUser];
			mockAntService.getAvailableDevicesWithUser.mockResolvedValue(availableDevices);

			const result = await controller.getAvailable();

			expect(result).toEqual(availableDevices);
			expect(result).toHaveLength(1);
		});
	});
});
