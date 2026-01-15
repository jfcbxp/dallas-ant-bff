import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HeartRateData, AntDeviceData } from './interfaces/heart-rate.interface';
import { AntStick, HeartRateSensor, AntModule } from './interfaces/ant-types.interface';
import * as Ant from 'ant-plus';

@Injectable()
export class AntService implements OnModuleInit {
	private readonly cache = new Map<number, HeartRateData>();
	private readonly logger = new Logger(AntService.name);

	private readonly _prisma: PrismaService;

	constructor(private readonly prisma: PrismaService) {
		this._prisma = prisma;
	}

	onModuleInit(): void {
		this.openStick(new (Ant as unknown as AntModule).GarminStick2(), 1);
		this.openStick(new (Ant as unknown as AntModule).GarminStick3(), 2);
	}

	getAll(): HeartRateData[] {
		return Array.from(this.cache.values());
	}

	getByDeviceId(deviceId: number): HeartRateData | undefined {
		return this.cache.get(deviceId);
	}

	private updateCache(stickId: number, data: AntDeviceData): HeartRateData | undefined {
		if (!data.DeviceID || data.DeviceID === 0) return;

		const record: HeartRateData = {
			deviceId: data.DeviceID,
			heartRate: data.ComputedHeartRate,
			beatTime: data.BeatTime,
			beatCount: data.BeatCount,
			manufacturerId: data.ManId ?? null,
			serialNumber: data.SerialNumber ?? null,
			stickId,
			receivedAt: new Date().toISOString(),
		};

		this.cache.set(data.DeviceID, record);
		return record;
	}

	private async upsertMongo(record: HeartRateData): Promise<void> {
		this.logger.log('Upserting data:', record);
		await this._prisma.heartRateCurrent.upsert({
			where: { deviceId: record.deviceId },
			update: {
				heartRate: record.heartRate,
				beatTime: record.beatTime,
				beatCount: record.beatCount,
				manufacturerId: record.manufacturerId,
				serialNumber: record.serialNumber,
				stickId: record.stickId,
			},
			create: {
				deviceId: record.deviceId,
				heartRate: record.heartRate,
				beatTime: record.beatTime,
				beatCount: record.beatCount,
				manufacturerId: record.manufacturerId,
				serialNumber: record.serialNumber,
				stickId: record.stickId,
			},
		});
	}

	private openStick(stick: AntStick, stickId: number): void {
		const sensor: HeartRateSensor = new (Ant as unknown as AntModule).HeartRateSensor(stick);
		let devId = 0;

		sensor.on('hbdata', (data: AntDeviceData) => {
			const record = this.updateCache(stickId, data);
			if (!record) return;

			void this.upsertMongo(record).catch((err) => {
				this.logger.error('Erro ao inserir no MongoDB:', err);
			});

			if (data.DeviceID !== 0 && devId === 0) {
				devId = data.DeviceID;
				sensor.detach();
				sensor.once('detached', () => {
					sensor.attach(0, devId);
				});
			}
		});

		stick.on('startup', () => {
			sensor.attach(0, 0);
		});

		stick.openAsync((err: Error | null) => {
			if (err) {
				// Error opening stick
			} else {
				// Stick found
			}
		});
	}
}
