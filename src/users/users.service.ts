import { Injectable, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, LinkDeviceDto, UserResponse, UserDeviceResponse, UserDevice, User } from './interfaces/user-types.interface';

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	private readonly _prisma: PrismaService;

	constructor(private readonly prisma: PrismaService) {
		this._prisma = prisma;
	}

	async createUser(createUserDto: CreateUserDto): Promise<UserResponse> {
		try {
			this.logger.log('Creating user:', createUserDto);
			await this._prisma.user.create({
				data: {
					name: createUserDto.name,
					gender: createUserDto.gender,
					weight: createUserDto.weight,
					height: createUserDto.height,
					birthDate: new Date(createUserDto.birthDate),
				},
			});

			const user = await this._prisma.user.findFirst({
				where: { name: createUserDto.name },
				orderBy: { createdAt: 'desc' },
			});

			if (!user) {
				throw new Error('User not found after creation');
			}

			return this.mapUserToResponse(user);
		} catch (error) {
			this.logger.error('Error creating user:', error);
			throw new BadRequestException('Erro ao criar usuário');
		}
	}

	async linkDevice(linkDeviceDto: LinkDeviceDto): Promise<UserDeviceResponse> {
		const user = await this._prisma.user.findUnique({
			where: { id: linkDeviceDto.userId },
		});

		if (!user) {
			throw new NotFoundException('Usuário não encontrado');
		}

		const existingLink = await this._prisma.userDevice.findUnique({
			where: { deviceId: linkDeviceDto.deviceId },
		});

		if (existingLink) {
			throw new ConflictException('Este dispositivo já está vinculado a um usuário');
		}

		try {
			this.logger.log('Linking device:', linkDeviceDto);
			await this._prisma.userDevice.create({
				data: {
					userId: linkDeviceDto.userId,
					deviceId: linkDeviceDto.deviceId,
				},
			});

			const userDevice = await this._prisma.userDevice.findUnique({
				where: { deviceId: linkDeviceDto.deviceId },
			});

			if (!userDevice) {
				throw new Error('UserDevice not found after creation');
			}

			return this.mapUserDeviceToResponse(userDevice);
		} catch (error) {
			this.logger.error('Error linking device:', error);
			throw new BadRequestException('Erro ao vincular dispositivo ao usuário');
		}
	}

	private mapUserToResponse(user: User): UserResponse {
		const record: UserResponse = {
			id: user.id,
			name: user.name,
			gender: user.gender,
			weight: user.weight,
			height: user.height,
			birthDate: user.birthDate.toISOString(),
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
		};
		return record;
	}

	private mapUserDeviceToResponse(userDevice: UserDevice): UserDeviceResponse {
		const record: UserDeviceResponse = {
			id: userDevice.id,
			userId: userDevice.userId,
			deviceId: userDevice.deviceId,
			linkedAt: userDevice.linkedAt.toISOString(),
			updatedAt: userDevice.updatedAt.toISOString(),
		};
		return record;
	}
}
