import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../src/users/users.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UserResponse } from '../../src/users/interfaces/user-types.interface';

describe('UsersService', () => {
	let service: UsersService;
	let prismaService: PrismaService;

	const mockUser = {
		id: '1',
		name: 'João Silva',
		gender: 'M',
		weight: 75,
		height: 180,
		birthDate: new Date('1990-01-15'),
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockUserDevice = {
		id: '1',
		userId: '1',
		deviceId: 12345,
		linkedAt: new Date(),
		updatedAt: new Date(),
	};

	const mockPrismaService = {
		user: {
			create: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			findUnique: jest.fn(),
		},
		userDevice: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			delete: jest.fn(),
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UsersService,
				{
					provide: PrismaService,
					useValue: mockPrismaService,
				},
			],
		}).compile();

		service = module.get<UsersService>(UsersService);
		prismaService = module.get<PrismaService>(PrismaService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('createUser', () => {
		it('should create a user successfully', async () => {
			const createUserDto: CreateUserDto = {
				name: 'João Silva',
				gender: 'M',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			};

			mockPrismaService.user.create.mockResolvedValue(mockUser);
			mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

			const result = await service.createUser(createUserDto);

			expect(result).toBeDefined();
			expect(result.name).toBe('João Silva');
			expect(result.gender).toBe('M');
			expect(mockPrismaService.user.create).toHaveBeenCalled();
			expect(mockPrismaService.user.findFirst).toHaveBeenCalled();
		});

		it('should throw error when user creation fails', async () => {
			const createUserDto: CreateUserDto = {
				name: 'João Silva',
				gender: 'M',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			};

			mockPrismaService.user.create.mockRejectedValue(new Error('Database error'));

			await expect(service.createUser(createUserDto)).rejects.toThrow(BadRequestException);
		});

		it('should throw error when user is not found after creation', async () => {
			const createUserDto: CreateUserDto = {
				name: 'João Silva',
				gender: 'M',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			};

			mockPrismaService.user.create.mockResolvedValue(mockUser);
			mockPrismaService.user.findFirst.mockResolvedValue(null);

			await expect(service.createUser(createUserDto)).rejects.toThrow(BadRequestException);
		});
	});

	describe('getUsers', () => {
		it('should return all users with their devices', async () => {
			mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
			mockPrismaService.userDevice.findFirst.mockResolvedValue(mockUserDevice);

			const result = await service.getUsers();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('João Silva');
			expect(result[0].deviceId).toBe(12345);
			expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
				orderBy: { name: 'asc' },
			});
		});

		it('should return users without device if not linked', async () => {
			mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
			mockPrismaService.userDevice.findFirst.mockResolvedValue(null);

			const result = await service.getUsers();

			expect(result).toHaveLength(1);
			expect(result[0].deviceId).toBeNull();
		});

		it('should throw error when fetching users fails', async () => {
			mockPrismaService.user.findMany.mockRejectedValue(new Error('Database error'));

			await expect(service.getUsers()).rejects.toThrow(BadRequestException);
		});

		it('should handle empty user list', async () => {
			mockPrismaService.user.findMany.mockResolvedValue([]);

			const result = await service.getUsers();

			expect(result).toHaveLength(0);
		});
	});

	describe('unlinkDevice', () => {
		it('should unlink device successfully', async () => {
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.userDevice.delete.mockResolvedValue(mockUserDevice);

			await service.unlinkDevice(12345);

			expect(mockPrismaService.userDevice.findUnique).toHaveBeenCalledWith({
				where: { deviceId: 12345 },
			});
			expect(mockPrismaService.userDevice.delete).toHaveBeenCalledWith({
				where: { deviceId: 12345 },
			});
		});

		it('should throw NotFoundException when device link does not exist', async () => {
			mockPrismaService.userDevice.findUnique.mockResolvedValue(null);

			await expect(service.unlinkDevice(12345)).rejects.toThrow(NotFoundException);
		});

		it('should throw error when deletion fails', async () => {
			mockPrismaService.userDevice.findUnique.mockResolvedValue(mockUserDevice);
			mockPrismaService.userDevice.delete.mockRejectedValue(new Error('Database error'));

			await expect(service.unlinkDevice(12345)).rejects.toThrow(BadRequestException);
		});
	});
});
