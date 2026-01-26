import { Controller, Post, Get, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UserResponse, UserWithDeviceId } from './interfaces/user-types.interface';

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

	@Get()
	async getUsers(): Promise<{ user: UserWithDeviceId }[]> {
		return this._usersService.getUsers();
	}
}
