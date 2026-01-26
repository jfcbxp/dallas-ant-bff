import { Controller, Get, Post, Param, Body, ParseIntPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { AntService } from './ant.service';
import { HeartRateData, AvailableDevice } from './interfaces/heart-rate.interface';
import { LinkDeviceDto, UserDeviceResponse } from '../users/interfaces/user-types.interface';

@Controller('pulseiras')
export class AntController {
	private readonly _antService: AntService;

	constructor(private readonly antService: AntService) {
		this._antService = antService;
	}

	@Get()
	getAll(): HeartRateData[] {
		return this._antService.getAll();
	}

	@Get('disponiveis/todas')
	async getAvailable(): Promise<AvailableDevice[]> {
		return this._antService.getAvailableDevicesWithUser();
	}

	@Post('vincular-pulseira')
	async linkDevice(@Body() linkDeviceDto: LinkDeviceDto): Promise<UserDeviceResponse> {
		if (!linkDeviceDto.userId || linkDeviceDto.deviceId == null) {
			throw new BadRequestException('Todos os campos são obrigatórios: userId, deviceId');
		}

		if (typeof linkDeviceDto.deviceId !== 'number' || linkDeviceDto.deviceId <= 0) {
			throw new BadRequestException('deviceId deve ser um número positivo');
		}

		return this._antService.linkDevice(linkDeviceDto);
	}

	@Get(':deviceId')
	getOne(@Param('deviceId', ParseIntPipe) deviceId: number): HeartRateData {
		const data = this._antService.getByDeviceId(deviceId);
		if (!data) {
			throw new NotFoundException('Pulseira não encontrada');
		}
		return data;
	}
}
