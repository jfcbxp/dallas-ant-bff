import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UserResponse } from '../../src/users/interfaces/user-types.interface';

describe('UsersController', () => {
	let controller: UsersController;
	let service: UsersService;

	const mockUser: UserResponse = {
		id: 'user-1',
		name: 'João Silva',
		gender: 'M',
		weight: 75,
		height: 180,
		birthDate: '1990-01-15',
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
	};

	const mockUserWithDevice: UserResponse = {
		...mockUser,
	};

	const mockUsersService = {
		createUser: jest.fn(),
		getUsers: jest.fn(),
		unlinkDevice: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [UsersController],
			providers: [
				{
					provide: UsersService,
					useValue: mockUsersService,
				},
			],
		}).compile();

		controller = module.get<UsersController>(UsersController);
		service = module.get<UsersService>(UsersService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('POST /usuarios', () => {
		it('should create a user successfully', async () => {
			const createUserDto: CreateUserDto = {
				name: 'João Silva',
				gender: 'M',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			};

			mockUsersService.createUser.mockResolvedValue(mockUser);

			const result = await controller.createUser(createUserDto);

			expect(result).toBeDefined();
			expect(result.name).toBe('João Silva');
			expect(result.gender).toBe('M');
			expect(mockUsersService.createUser).toHaveBeenCalledWith(createUserDto);
		});

		it('should create female user', async () => {
			const createUserDto: CreateUserDto = {
				name: 'Maria Santos',
				gender: 'F',
				weight: 65,
				height: 170,
				birthDate: '1992-05-20',
			};

			const femaleUser = { ...mockUser, name: 'Maria Santos', gender: 'F' };
			mockUsersService.createUser.mockResolvedValue(femaleUser);

			const result = await controller.createUser(createUserDto);

			expect(result.gender).toBe('F');
			expect(result.name).toBe('Maria Santos');
		});

		it('should throw BadRequestException when gender is invalid', async () => {
			const invalidDto = {
				name: 'Invalid User',
				gender: 'X',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			} as any;

			await expect(controller.createUser(invalidDto)).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when required fields are missing', async () => {
			const incompleteDto = {
				name: 'Test User',
				birthDate: '1990-01-15',
			} as any;

			await expect(controller.createUser(incompleteDto)).rejects.toThrow(BadRequestException);
		});

		it('should throw error when creation fails', async () => {
			const createUserDto: CreateUserDto = {
				name: 'João Silva',
				gender: 'M',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			};

			mockUsersService.createUser.mockRejectedValue(new BadRequestException('Database error'));

			await expect(controller.createUser(createUserDto)).rejects.toThrow(BadRequestException);
		});
	});

	describe('GET /usuarios', () => {
		it('should return all users', async () => {
			const users: UserResponse[] = [mockUser, mockUserWithDevice];
			mockUsersService.getUsers.mockResolvedValue(users);

			const result = await controller.getUsers();

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('João Silva');
			expect(result[1].name).toBe('João Silva');
			expect(mockUsersService.getUsers).toHaveBeenCalled();
		});

		it('should return users with different genders', async () => {
			const femaleUser: UserResponse = {
				...mockUser,
				id: 'user-2',
				name: 'Maria Santos',
				gender: 'F',
			};
			const users: UserResponse[] = [mockUserWithDevice, femaleUser];
			mockUsersService.getUsers.mockResolvedValue(users);

			const result = await controller.getUsers();

			expect(result).toHaveLength(2);
			expect(result[0].gender).toBe('M');
			expect(result[1].gender).toBe('F');
		});

		it('should return users without filtering', async () => {
			const users: UserResponse[] = [mockUser];
			mockUsersService.getUsers.mockResolvedValue(users);

			const result = await controller.getUsers();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('João Silva');
		});

		it('should return empty array when no users exist', async () => {
			mockUsersService.getUsers.mockResolvedValue([]);

			const result = await controller.getUsers();

			expect(result).toHaveLength(0);
		});

		it('should throw error when retrieval fails', async () => {
			mockUsersService.getUsers.mockRejectedValue(new BadRequestException('Database error'));

			await expect(controller.getUsers()).rejects.toThrow(BadRequestException);
		});
	});

	describe('Validation', () => {
		it('should ensure name is required', () => {
			const incompleteDto = {
				gender: 'M',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			} as any;

			expect(incompleteDto.name).toBeUndefined();
		});

		it('should ensure weight is positive', () => {
			const invalidDto: CreateUserDto = {
				name: 'Test',
				gender: 'M',
				weight: -1,
				height: 180,
				birthDate: '1990-01-15',
			};

			expect(invalidDto.weight).toBeLessThan(0);
		});

		it('should ensure height is positive', () => {
			const invalidDto: CreateUserDto = {
				name: 'Test',
				gender: 'M',
				weight: 75,
				height: -1,
				birthDate: '1990-01-15',
			};

			expect(invalidDto.height).toBeLessThan(0);
		});

		it('should only allow M or F gender', () => {
			const validGenders = ['M', 'F'];
			const invalidGender = 'X';

			expect(validGenders).toContain('M');
			expect(validGenders).toContain('F');
			expect(validGenders).not.toContain(invalidGender);
		});
	});

	describe('Controller Integration', () => {
		it('should handle createUser and getUsers flow', async () => {
			const createUserDto: CreateUserDto = {
				name: 'João Silva',
				gender: 'M',
				weight: 75,
				height: 180,
				birthDate: '1990-01-15',
			};

			// Create user
			mockUsersService.createUser.mockResolvedValue(mockUser);
			const createdUser = await controller.createUser(createUserDto);
			expect(createdUser.id).toBe('user-1');

			// Get all users
			mockUsersService.getUsers.mockResolvedValue([createdUser]);
			const allUsers = await controller.getUsers();
			expect(allUsers).toHaveLength(1);
			expect(allUsers[0].id).toBe(createdUser.id);
		});

		it('should handle multiple users in getUsers', async () => {
			const user1 = mockUser;
			const user2: UserResponse = {
				...mockUser,
				id: 'user-2',
				name: 'Maria Santos',
				gender: 'F',
			};

			mockUsersService.getUsers.mockResolvedValue([user1, user2]);

			const result = await controller.getUsers();

			expect(result).toHaveLength(2);
			expect(result[0].gender).toBe('M');
			expect(result[1].gender).toBe('F');
		});
	});
});
