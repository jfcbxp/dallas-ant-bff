import { Controller, Post, Get, Delete, Body, Param, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, LinkDeviceDto, UserResponse, UserDeviceResponse, UserWithDeviceId } from './interfaces/user-types.interface';

@Controller('usuarios')
export class UsersController {
	private readonly _usersService: UsersService;

	constructor(private readonly usersService: UsersService) {
		this._usersService = usersService;
	}

	@Post()
	async createUser(@Body() createUserDto: CreateUserDto): Promise<UserResponse> {
		if (
			!createUserDto.name ||
			!createUserDto.gender ||
			createUserDto.weight == null ||
			createUserDto.height == null ||
			!createUserDto.birthDate
		) {
			throw new BadRequestException('Todos os campos são obrigatórios: name, gender, weight, height, birthDate');
		}

		if (!['M', 'F'].includes(createUserDto.gender)) {
			throw new BadRequestException('Gender deve ser M ou F');
		}

		return this._usersService.createUser(createUserDto);
	}

	@Post('vincular-pulseira')
	async linkDevice(@Body() linkDeviceDto: LinkDeviceDto): Promise<UserDeviceResponse> {
		if (!linkDeviceDto.userId || linkDeviceDto.deviceId == null) {
			throw new BadRequestException('Todos os campos são obrigatórios: userId, deviceId');
		}

		if (typeof linkDeviceDto.deviceId !== 'number' || linkDeviceDto.deviceId <= 0) {
			throw new BadRequestException('deviceId deve ser um número positivo');
		}

		return this._usersService.linkDevice(linkDeviceDto);
	}

	@Get('vincular-pulseira')
	async getLinkedDevices(): Promise<{ user: UserWithDeviceId }[]> {
		return this._usersService.getLinkedDevices();
	}

	@Delete('vincular-pulseira/:deviceId')
	async unlinkDevice(@Param('deviceId') deviceId: string): Promise<{ message: string }> {
		const deviceIdNum = parseInt(deviceId, 10);

		if (isNaN(deviceIdNum) || deviceIdNum <= 0) {
			throw new BadRequestException('deviceId deve ser um número positivo');
		}

		await this._usersService.unlinkDevice(deviceIdNum);
		return { message: 'Pulseira desvinculada com sucesso' };
	}
}
