import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { LinkDeviceDto } from '../../src/users/interfaces/user-types.interface';

// Mock ant-plus and USB dependencies to avoid native module conflicts
jest.mock('ant-plus');
jest.mock('usb');

import { AntService } from '../../src/ant/ant.service';

describe('AntService - Comprehensive Test Suite', () => {
	let service: AntService;
	let prismaService: PrismaService;

	const mockUser = {
		id: 'user-1',
		name: 'João Silva',
		gender: 'M' as const,
		weight: 75,
		height: 180,
		birthDate: new Date('1990-01-15'),
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockUserFemale = {
		id: 'user-2',
		name: 'Maria Santos',
		gender: 'F' as const,
		weight: 65,
		height: 170,
		birthDate: new Date('1992-05-20'),
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockUserDevice = {
		id: 'device-link-1',
		userId: 'user-1',
		deviceId: 12345,
		linkedAt: new Date(),
		updatedAt: new Date(),
	};

	const mockHeartRateCurrent = {
		id: 'hr-current-1',
		deviceId: 12345,
		heartRate: 75,
		beatTime: 1000,
		beatCount: 5,
		manufacturerId: 1,
		serialNumber: 'SN123456',
		stickId: 1,
		receivedAt: new Date(),
	};

	const mockPrismaService = {
		user: {
			findUnique: jest.fn(),
		},
		userDevice: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
		},
		heartRateCurrent: {
			findMany: jest.fn(),
			upsert: jest.fn(),
		},
		heartRateRecord: {
			create: jest.fn(),
		},
		lesson: {
			findFirst: jest.fn(),
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AntService,
				{
					provide: PrismaService,
					useValue: mockPrismaService,
				},
			],
		})
			.useMocker(() => jest.fn())
			.compile();

		service = module.get<AntService>(AntService);
		prismaService = module.get<PrismaService>(PrismaService);

		jest.spyOn(service, 'onModuleInit').mockImplementation(() => {
			// Mock implementation to prevent actual ANT+ stick initialization
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Cache Management - getAll', () => {
		it('should return all cached heart rate data', () => {
			const anyService = service as any;
			const mockData = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			anyService.cache.set(12345, mockData);

			const result = service.getAll();

			expect(result).toHaveLength(1);
			expect(result[0].deviceId).toBe(12345);
			expect(result[0].heartRate).toBe(75);
		});

		it('should return multiple cached devices', () => {
			const anyService = service as any;
			const device1 = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN1',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};
			const device2 = {
				deviceId: 54321,
				heartRate: 85,
				beatTime: 1100,
				beatCount: 6,
				manufacturerId: 2,
				serialNumber: 'SN2',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			anyService.cache.set(12345, device1);
			anyService.cache.set(54321, device2);

			const result = service.getAll();

			expect(result).toHaveLength(2);
			expect(result.map((r) => r.deviceId)).toContain(12345);
			expect(result.map((r) => r.deviceId)).toContain(54321);
		});

		it('should return empty array when cache is empty', () => {
			const result = service.getAll();

			expect(result).toHaveLength(0);
			expect(Array.isArray(result)).toBe(true);
		});

		it('should return data in array format', () => {
			const result = service.getAll();

			expect(result).toBeInstanceOf(Array);
		});
	});

	describe('Cache Management - getByDeviceId', () => {
		it('should return heart rate data for device', () => {
			const anyService = service as any;
			const mockData = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			anyService.cache.set(12345, mockData);

			const result = service.getByDeviceId(12345);

			expect(result).toBeDefined();
			expect(result?.deviceId).toBe(12345);
			expect(result?.heartRate).toBe(75);
			expect(result?.beatCount).toBe(5);
		});

		it('should return undefined when device not found in cache', () => {
			const result = service.getByDeviceId(99999);

			expect(result).toBeUndefined();
		});

		it('should return correct device when multiple devices cached', () => {
			const anyService = service as any;
			anyService.cache.set(12345, { deviceId: 12345, heartRate: 75 });
			anyService.cache.set(54321, { deviceId: 54321, heartRate: 85 });

			const result = service.getByDeviceId(54321);

			expect(result?.deviceId).toBe(54321);
			expect(result?.heartRate).toBe(85);
		});

		it('should return exact cached object', () => {
			const anyService = service as any;
			const cachedData = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN',
				stickId: 1,
				receivedAt: new Date().toISOString(),
				user: { id: 'user-1', name: 'Test' },
			};

			anyService.cache.set(12345, cachedData);

			const result = service.getByDeviceId(12345);

			expect(result).toEqual(cachedData);
		});
	});

	describe('Cache Management - clearCache', () => {
		it('should clear all cached data', () => {
			const anyService = service as any;
			anyService.cache.set(12345, { deviceId: 12345, heartRate: 75 });
			anyService.cache.set(54321, { deviceId: 54321, heartRate: 85 });
			expect(anyService.cache.size).toBe(2);

			service.clearCache();

			expect(anyService.cache.size).toBe(0);
		});

		it('should make getAll return empty after clear', () => {
			const anyService = service as any;
			anyService.cache.set(12345, { deviceId: 12345, heartRate: 75 });

			service.clearCache();

			const result = service.getAll();
			expect(result).toHaveLength(0);
		});

		it('should make getByDeviceId return undefined after clear', () => {
			const anyService = service as any;
			anyService.cache.set(12345, { deviceId: 12345, heartRate: 75 });

			service.clearCache();

			const result = service.getByDeviceId(12345);
			expect(result).toBeUndefined();
		});

		it('should handle clearing empty cache', () => {
			const anyService = service as any;
			expect(anyService.cache.size).toBe(0);

			service.clearCache();

			expect(anyService.cache.size).toBe(0);
		});
	});

	describe('getAvailableDevices', () => {
		it('should return available devices from database', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);

			const result = await service.getAvailableDevices();

			expect(result).toHaveLength(1);
			expect(result[0].deviceId).toBe(12345);
			expect(result[0].heartRate).toBe(75);
			expect(result[0].beatCount).toBe(5);
			expect(mockPrismaService.heartRateCurrent.findMany).toHaveBeenCalled();
		});

		it('should return multiple devices', async () => {
			const device2 = { ...mockHeartRateCurrent, deviceId: 54321, heartRate: 85 };
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent, device2]);

			const result = await service.getAvailableDevices();

			expect(result).toHaveLength(2);
			expect(result.map((d) => d.deviceId)).toContain(12345);
			expect(result.map((d) => d.deviceId)).toContain(54321);
		});

		it('should return empty array when no devices available', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([]);

			const result = await service.getAvailableDevices();

			expect(result).toHaveLength(0);
			expect(Array.isArray(result)).toBe(true);
		});

		it('should return empty array when database error occurs', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockRejectedValue(new Error('Database error'));

			const result = await service.getAvailableDevices();

			expect(result).toHaveLength(0);
		});

		it('should map database fields correctly', async () => {
			const dbDevice = {
				id: 'id-1',
				deviceId: 12345,
				heartRate: 100,
				beatTime: 2000,
				beatCount: 10,
				manufacturerId: 2,
				serialNumber: 'SERIAL123',
				stickId: 2,
				receivedAt: new Date(),
			};
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([dbDevice]);

			const result = await service.getAvailableDevices();

			expect(result[0]).toEqual(
				expect.objectContaining({
					deviceId: 12345,
					heartRate: 100,
					beatTime: 2000,
					beatCount: 10,
					manufacturerId: 2,
					serialNumber: 'SERIAL123',
					stickId: 2,
				}),
			);
		});
	});

	describe('getAvailableDevicesWithUser', () => {
		it('should return devices with user information when linked', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.getAvailableDevicesWithUser();

			expect(result).toHaveLength(1);
			expect(result[0].deviceId).toBe(12345);
			expect(result[0].user).toBeDefined();
			expect(result[0].user?.name).toBe('João Silva');
			expect(result[0].user?.gender).toBe('M');
			expect(result[0].user?.zones).toBeDefined();
		});

		it('should return devices without user if not linked', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);
			mockPrismaService.userDevice.findUnique.mockResolvedValue(null);

			const result = await service.getAvailableDevicesWithUser();

			expect(result).toHaveLength(1);
			expect(result[0].user).toBeUndefined();
		});

		it('should return devices when user device exists but user not found', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValue(null);

			const result = await service.getAvailableDevicesWithUser();

			expect(result).toHaveLength(1);
			expect(result[0].user).toBeUndefined();
		});

		it('should handle empty devices list', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([]);

			const result = await service.getAvailableDevicesWithUser();

			expect(result).toHaveLength(0);
		});

		it('should return empty array when error occurs', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockRejectedValue(new Error('Database error'));

			const result = await service.getAvailableDevicesWithUser();

			expect(result).toHaveLength(0);
		});

		it('should include user zones calculation', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.getAvailableDevicesWithUser();

			expect(result[0].user?.zones).toBeDefined();
			expect(result[0].user?.zones).toHaveProperty('zone1');
			expect(result[0].user?.zones).toHaveProperty('zone2');
			expect(result[0].user?.zones).toHaveProperty('zone3');
			expect(result[0].user?.zones).toHaveProperty('zone4');
			expect(result[0].user?.zones).toHaveProperty('zone5');
		});

		it('should include full user information in response', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.getAvailableDevicesWithUser();

			const userInfo = result[0].user;
			expect(userInfo).toEqual(
				expect.objectContaining({
					id: 'user-1',
					name: 'João Silva',
					gender: 'M',
					weight: 75,
					height: 180,
					birthDate: expect.any(String),
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
					deviceId: 12345,
				}),
			);
		});

		it('should handle multiple devices with different user statuses', async () => {
			const device2 = { ...mockHeartRateCurrent, deviceId: 54321 };
			const userDevice2 = { ...mockUserDevice, deviceId: 54321, userId: 'user-2' };

			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent, device2]);
			mockPrismaService.userDevice.findUnique.mockResolvedValueOnce(mockUserDevice).mockResolvedValueOnce(userDevice2);
			mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockUserFemale);

			const result = await service.getAvailableDevicesWithUser();

			expect(result).toHaveLength(2);
			expect(result[0].user?.name).toBe('João Silva');
			expect(result[1].user?.name).toBe('Maria Santos');
		});

		it('should handle user retrieval error gracefully', async () => {
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValueOnce(null); // First call returns null

			const result = await service.getAvailableDevicesWithUser();

			expect(result).toHaveLength(1);
			// When user retrieval fails or returns null, user info should be undefined
			expect(result[0].user).toBeUndefined();
			expect(result[0].deviceId).toBe(12345);
		});
	});

	describe('linkDevice', () => {
		it('should link device to user successfully', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.userDevice.upsert.mockResolvedValue(mockUserDevice);

			const result = await service.linkDevice(linkDeviceDto);

			expect(result).toBeDefined();
			expect(result.userId).toBe('user-1');
			expect(result.deviceId).toBe(12345);
			expect(result.id).toBe('device-link-1');
			expect(result.linkedAt).toBeDefined();
			expect(result.updatedAt).toBeDefined();
			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { id: 'user-1' },
			});
		});

		it('should throw NotFoundException when user not found', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'invalid-user',
				deviceId: 12345,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(null);

			await expect(service.linkDevice(linkDeviceDto)).rejects.toThrow(NotFoundException);
			await expect(service.linkDevice(linkDeviceDto)).rejects.toThrow('Usuário não encontrado');
		});

		it('should throw BadRequestException when upsert fails', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.userDevice.upsert.mockRejectedValue(new Error('Database error'));

			await expect(service.linkDevice(linkDeviceDto)).rejects.toThrow(BadRequestException);
			await expect(service.linkDevice(linkDeviceDto)).rejects.toThrow('Erro ao vincular dispositivo ao usuário');
		});

		it('should format linkedAt and updatedAt as ISO strings', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.userDevice.upsert.mockResolvedValue(mockUserDevice);

			const result = await service.linkDevice(linkDeviceDto);

			expect(typeof result.linkedAt).toBe('string');
			expect(typeof result.updatedAt).toBe('string');
			expect(() => new Date(result.linkedAt)).not.toThrow();
			expect(() => new Date(result.updatedAt)).not.toThrow();
		});

		it('should call upsert with correct parameters', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.userDevice.upsert.mockResolvedValue(mockUserDevice);

			await service.linkDevice(linkDeviceDto);

			expect(mockPrismaService.userDevice.upsert).toHaveBeenCalledWith({
				where: { deviceId: 12345 },
				update: { userId: 'user-1' },
				create: { userId: 'user-1', deviceId: 12345 },
			});
		});

		it('should handle different device IDs', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 54321,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			const differentUserDevice = { ...mockUserDevice, deviceId: 54321 };
			mockPrismaService.userDevice.upsert.mockResolvedValue(differentUserDevice);

			const result = await service.linkDevice(linkDeviceDto);

			expect(result.deviceId).toBe(54321);
		});

		it('should update existing device link', async () => {
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-2',
				deviceId: 12345,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUserFemale);
			const updatedLink = { ...mockUserDevice, userId: 'user-2' };
			mockPrismaService.userDevice.upsert.mockResolvedValue(updatedLink);

			const result = await service.linkDevice(linkDeviceDto);

			expect(result.userId).toBe('user-2');
			expect(mockPrismaService.userDevice.upsert).toHaveBeenCalled();
		});
	});

	describe('onModuleInit', () => {
		it('should call onModuleInit without errors', () => {
			const anyService = service as any;
			jest.spyOn(anyService, 'openStick').mockImplementation(() => {
				// Mock
			});

			expect(() => service.onModuleInit()).not.toThrow();
		});

		it('should be defined on service', () => {
			expect(service.onModuleInit).toBeDefined();
			expect(typeof service.onModuleInit).toBe('function');
		});
	});

	describe('Integration Tests', () => {
		it('should complete device linking and retrieval workflow', async () => {
			// Link device
			const linkDeviceDto: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.userDevice.upsert.mockResolvedValue(mockUserDevice);

			const linkResult = await service.linkDevice(linkDeviceDto);
			expect(linkResult.deviceId).toBe(12345);

			// Get available devices with user
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([mockHeartRateCurrent]);
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const devicesWithUser = await service.getAvailableDevicesWithUser();

			expect(devicesWithUser).toHaveLength(1);
			expect(devicesWithUser[0].user?.id).toBe('user-1');
		});

		it('should handle full device lifecycle', async () => {
			const anyService = service as any;

			// Cache data
			const mockData = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};
			anyService.cache.set(12345, mockData);

			// Retrieve from cache
			const cached = service.getByDeviceId(12345);
			expect(cached).toBeDefined();

			// Get all cached
			const all = service.getAll();
			expect(all).toHaveLength(1);

			// Clear cache
			service.clearCache();
			expect(service.getAll()).toHaveLength(0);
		});

		it('should handle multiple devices simultaneously', async () => {
			const device1 = {
				id: 'hr-1',
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN1',
				stickId: 1,
				receivedAt: new Date(),
			};
			const device2 = {
				id: 'hr-2',
				deviceId: 54321,
				heartRate: 85,
				beatTime: 1100,
				beatCount: 6,
				manufacturerId: 1,
				serialNumber: 'SN2',
				stickId: 1,
				receivedAt: new Date(),
			};

			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([device1, device2]);

			const result = await service.getAvailableDevices();

			expect(result).toHaveLength(2);
			expect(result.map((d) => d.deviceId).sort()).toEqual([12345, 54321]);
		});
	});

	describe('Error Handling & Edge Cases', () => {
		it('should log errors appropriately', async () => {
			const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

			mockPrismaService.heartRateCurrent.findMany.mockRejectedValue(new Error('Test error'));

			await service.getAvailableDevices();

			loggerSpy.mockRestore();
		});

		it('should recover from database errors', async () => {
			mockPrismaService.heartRateCurrent.findMany
				.mockRejectedValueOnce(new Error('Connection error'))
				.mockResolvedValueOnce([mockHeartRateCurrent]);

			const result1 = await service.getAvailableDevices();
			expect(result1).toHaveLength(0);

			const result2 = await service.getAvailableDevices();
			expect(result2).toHaveLength(1);
		});

		it('should handle concurrent linkDevice calls', async () => {
			const linkDeviceDto1: LinkDeviceDto = {
				userId: 'user-1',
				deviceId: 12345,
			};
			const linkDeviceDto2: LinkDeviceDto = {
				userId: 'user-2',
				deviceId: 54321,
			};

			mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockUserFemale);
			mockPrismaService.userDevice.upsert
				.mockResolvedValueOnce(mockUserDevice)
				.mockResolvedValueOnce({ ...mockUserDevice, userId: 'user-2', deviceId: 54321 });

			const results = await Promise.all([service.linkDevice(linkDeviceDto1), service.linkDevice(linkDeviceDto2)]);

			expect(results).toHaveLength(2);
			expect(results[0].deviceId).toBe(12345);
			expect(results[1].deviceId).toBe(54321);
		});

		it('should handle null values in database response', async () => {
			const deviceWithNulls = {
				...mockHeartRateCurrent,
				manufacturerId: null,
				serialNumber: null,
			};
			mockPrismaService.heartRateCurrent.findMany.mockResolvedValue([deviceWithNulls]);

			const result = await service.getAvailableDevices();

			expect(result).toHaveLength(1);
			expect(result[0].manufacturerId).toBeNull();
			expect(result[0].serialNumber).toBeNull();
		});
	});

	describe('Private Methods - updateCache', () => {
		it('should add device data to cache', async () => {
			const anyService = service as any;
			const antDeviceData = {
				DeviceID: 12345,
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
				ManId: 1,
				SerialNumber: 'SN123456',
			};

			mockPrismaService.userDevice.findUnique.mockResolvedValue(null);

			const result = await anyService.updateCache(1, antDeviceData);

			expect(result).toBeDefined();
			expect(result.deviceId).toBe(12345);
			expect(result.heartRate).toBe(75);
			expect(result.stickId).toBe(1);
			expect(anyService.cache.get(12345)).toBeDefined();
		});

		it('should update cache with user information when device is linked', async () => {
			const anyService = service as any;
			const antDeviceData = {
				DeviceID: 12345,
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
				ManId: 1,
				SerialNumber: 'SN123456',
			};

			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await anyService.updateCache(1, antDeviceData);

			expect(result?.user).toBeDefined();
			expect(result?.user?.id).toBe('user-1');
			expect(result?.user?.name).toBe('João Silva');
			expect(result?.user?.zones).toBeDefined();
		});

		it('should not cache when DeviceID is zero', async () => {
			const anyService = service as any;
			const antDeviceData = {
				DeviceID: 0,
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
				ManId: 1,
				SerialNumber: 'SN123456',
			};

			const result = await anyService.updateCache(1, antDeviceData);

			expect(result).toBeUndefined();
			expect(anyService.cache.size).toBe(0);
		});

		it('should handle missing DeviceID', async () => {
			const anyService = service as any;
			const antDeviceData = {
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
			};

			const result = await anyService.updateCache(1, antDeviceData as any);

			expect(result).toBeUndefined();
		});

		it('should handle user retrieval errors gracefully', async () => {
			const anyService = service as any;
			const antDeviceData = {
				DeviceID: 12345,
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
				ManId: 1,
				SerialNumber: 'SN123456',
			};

			mockPrismaService.userDevice.findUnique.mockRejectedValue(new Error('DB Error'));

			const result = await anyService.updateCache(1, antDeviceData);

			expect(result).toBeDefined();
			expect(result?.deviceId).toBe(12345);
			expect(result?.user).toBeUndefined();
		});
	});

	describe('Private Methods - upsertMongo', () => {
		it('should create heart rate record and update current', async () => {
			const anyService = service as any;
			const record = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			mockPrismaService.heartRateRecord.create.mockResolvedValue({ id: 'record-1' });
			mockPrismaService.heartRateCurrent.upsert.mockResolvedValue({ id: 'current-1' });

			await anyService.upsertMongo(record);

			expect(mockPrismaService.heartRateRecord.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					deviceId: 12345,
					heartRate: 75,
				}),
			});
			expect(mockPrismaService.heartRateCurrent.upsert).toHaveBeenCalled();
		});

		it('should handle database errors', async () => {
			const anyService = service as any;
			const record = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			mockPrismaService.heartRateRecord.create.mockRejectedValue(new Error('DB Error'));

			await expect(anyService.upsertMongo(record)).rejects.toThrow('DB Error');
		});

		it('should call upsert for both record and current', async () => {
			const anyService = service as any;
			const record = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			mockPrismaService.heartRateRecord.create.mockResolvedValue({ id: 'record-1' });
			mockPrismaService.heartRateCurrent.upsert.mockResolvedValue({ id: 'current-1' });

			await anyService.upsertMongo(record);

			expect(mockPrismaService.heartRateCurrent.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { deviceId: 12345 },
					update: expect.any(Object),
					create: expect.any(Object),
				}),
			);
		});
	});

	describe('Private Methods - checkLessonStatusBeforeSaving', () => {
		it('should save data when lesson is not ENDED', async () => {
			const anyService = service as any;
			const record = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue({ status: 'STARTED' });
			mockPrismaService.heartRateRecord.create.mockResolvedValue({ id: 'record-1' });
			mockPrismaService.heartRateCurrent.upsert.mockResolvedValue({ id: 'current-1' });

			await anyService.checkLessonStatusBeforeSaving(record);

			expect(mockPrismaService.heartRateRecord.create).toHaveBeenCalled();
		});

		it('should not save data when lesson is ENDED', async () => {
			const anyService = service as any;
			const record = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue({ status: 'ENDED' });

			await anyService.checkLessonStatusBeforeSaving(record);

			expect(mockPrismaService.heartRateRecord.create).not.toHaveBeenCalled();
		});

		it('should not save when no lesson found', async () => {
			const anyService = service as any;
			const record = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue(null);

			await anyService.checkLessonStatusBeforeSaving(record);

			expect(mockPrismaService.heartRateRecord.create).not.toHaveBeenCalled();
		});

		it('should handle errors during lesson check', async () => {
			const anyService = service as any;
			const record = {
				deviceId: 12345,
				heartRate: 75,
				beatTime: 1000,
				beatCount: 5,
				manufacturerId: 1,
				serialNumber: 'SN123456',
				stickId: 1,
				receivedAt: new Date().toISOString(),
			};

			mockPrismaService.lesson.findFirst.mockRejectedValue(new Error('DB Error'));

			// Should not throw, should handle error gracefully
			await expect(anyService.checkLessonStatusBeforeSaving(record)).resolves.toBeUndefined();
		});
	});

	describe('Private Methods - handleSensorDetached', () => {
		it('should handle reconnection delays', () => {
			const anyService = service as any;
			anyService.stick = { openAsync: jest.fn() };
			anyService.sensors.set(0, { sensor: { attach: jest.fn() }, deviceId: 44352, channel: 0 });

			// Just verify the method can be called without errors
			expect(() => {
				anyService.handleSensorDetached(0, 44352);
			}).not.toThrow();
		});

		it('should not attempt reconnection if stick is null', () => {
			const anyService = service as any;
			anyService.stick = null;
			const sensor = { sensor: {}, deviceId: 44352, channel: 0 };
			anyService.sensors.set(0, sensor);

			// Verify method doesn't throw even when stick is null
			expect(() => {
				anyService.handleSensorDetached(0, 44352);
			}).not.toThrow();

			// Sensor should still be in the map
			expect(anyService.sensors.get(0)).toEqual(sensor);
		});
	});

	describe('Private Methods - handleHeartRateData', () => {
		it('should process valid ANT device data', async () => {
			const anyService = service as any;
			const mockRecord = { deviceId: 12345, heartRate: 75, stickId: 1 };

			mockPrismaService.userDevice.findUnique.mockResolvedValue(null);

			const antData = {
				DeviceID: 12345,
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
				ManId: 1,
				SerialNumber: 'SN123456',
			};

			mockPrismaService.lesson.findFirst.mockResolvedValue(null);

			// Call the method
			anyService.handleHeartRateData(antData);

			// Wait for async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Verify cache was updated
			const cachedData = anyService.cache.get(12345);
			expect(cachedData).toBeDefined();
			expect(cachedData.deviceId).toBe(12345);
			expect(cachedData.heartRate).toBe(75);
		}, 10000);

		it('should ignore data with DeviceID 0', async () => {
			const anyService = service as any;
			const previousSize = anyService.cache.size;

			const antData = {
				DeviceID: 0,
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
			};

			anyService.handleHeartRateData(antData);

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Cache size should remain unchanged
			expect(anyService.cache.size).toBe(previousSize);
		}, 10000);

		it('should handle missing DeviceID', async () => {
			const anyService = service as any;
			const previousSize = anyService.cache.size;

			const antData = {
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
			};

			anyService.handleHeartRateData(antData as any);

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Cache should not be modified
			expect(anyService.cache.size).toBe(previousSize);
		}, 10000);

		it('should process data with user information', async () => {
			const anyService = service as any;

			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.lesson.findFirst.mockResolvedValue(null);

			const antData = {
				DeviceID: 12345,
				ComputedHeartRate: 75,
				BeatTime: 1000,
				BeatCount: 5,
				ManId: 1,
				SerialNumber: 'SN123456',
			};

			anyService.handleHeartRateData(antData);

			await new Promise((resolve) => setTimeout(resolve, 100));

			const cachedData = anyService.cache.get(12345);
			expect(cachedData).toBeDefined();
			expect(cachedData.user).toBeDefined();
			expect(cachedData.user?.id).toBe('user-1');
		}, 10000);
	});
});
