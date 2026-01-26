import { Controller, Get, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { AntService } from './ant.service';
import { HeartRateData, AvailableDevice } from './interfaces/heart-rate.interface';

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
		return this._antService.getAvailableDevices();
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
