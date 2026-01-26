import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UserResponse, UserDeviceResponse, UserDevice, User, UserWithDeviceId } from './interfaces/user-types.interface';

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

	async getUsers(): Promise<{ user: UserWithDeviceId }[]> {
		try {
			this.logger.log('Fetching all linked devices');

			const userDevices = await this._prisma.userDevice.findMany();

			const result: { user: UserWithDeviceId }[] = [];

			for (const userDevice of userDevices) {
				const user = await this._prisma.user.findUnique({
					where: { id: userDevice.userId },
				});

				if (user) {
					const userResponse = this.mapUserToResponse(user);
					result.push({
						user: {
							...userResponse,
							deviceId: userDevice.deviceId,
						},
					});
				}
			}

			return result;
		} catch (error) {
			this.logger.error('Error fetching linked devices:', error);
			throw new BadRequestException('Erro ao buscar dispositivos vinculados');
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

	async unlinkDevice(deviceId: number): Promise<void> {
		try {
			this.logger.log('Unlinking device:', deviceId);

			const userDevice = await this._prisma.userDevice.findUnique({
				where: { deviceId },
			});

			if (!userDevice) {
				throw new NotFoundException('Vínculo de pulseira não encontrado');
			}

			await this._prisma.userDevice.delete({
				where: { deviceId },
			});

			this.logger.log('Device unlinked successfully:', deviceId);
		} catch (error) {
			this.logger.error('Error unlinking device:', error);
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new BadRequestException('Erro ao desvinculear pulseira');
		}
	}
}
