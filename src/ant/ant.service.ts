import { Injectable, OnModuleInit, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HeartRateData, AntDeviceData, AvailableDevice, HeartRateCurrentDb } from './interfaces/heart-rate.interface';
import { AntStick, HeartRateSensor, AntModule } from './interfaces/ant-types.interface';
import { LinkDeviceDto, UserDeviceResponse } from '../users/interfaces/user-types.interface';
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

	async getAvailableDevices(): Promise<AvailableDevice[]> {
		try {
			const devices = await this._prisma.heartRateCurrent.findMany();
			return devices.map((device: HeartRateCurrentDb) => ({
				deviceId: device.deviceId,
				heartRate: device.heartRate,
				beatTime: device.beatTime,
				beatCount: device.beatCount,
				manufacturerId: device.manufacturerId,
				serialNumber: device.serialNumber,
				stickId: device.stickId,
				receivedAt: device.receivedAt,
			}));
		} catch (error) {
			this.logger.error('Error fetching available devices:', error);
			return [];
		}
	}

	async getAvailableDevicesWithUser(): Promise<AvailableDevice[]> {
		try {
			const devices = await this.getAvailableDevices();

			return Promise.all(
				devices.map(async (device) => {
					const userDevice = await this._prisma.userDevice.findUnique({
						where: { deviceId: device.deviceId },
					});

					if (userDevice) {
						const user = await this._prisma.user.findUnique({
							where: { id: userDevice.userId },
						});

						if (user) {
							device.user = {
								id: user.id,
								name: user.name,
								gender: user.gender as 'M' | 'F',
								weight: user.weight,
								height: user.height,
								birthDate: user.birthDate.toISOString(),
								createdAt: user.createdAt.toISOString(),
								updatedAt: user.updatedAt.toISOString(),
								deviceId: device.deviceId,
							};
						}
					}

					return device;
				}),
			);
		} catch (error) {
			this.logger.error('Error fetching available devices with user:', error);
			return [];
		}
	}

	async linkDevice(linkDeviceDto: LinkDeviceDto): Promise<UserDeviceResponse> {
		try {
			const user = await this._prisma.user.findUnique({
				where: { id: linkDeviceDto.userId },
			});

			if (!user) {
				throw new NotFoundException('Usuário não encontrado');
			}

			this.logger.log('Linking device:', linkDeviceDto);
			const userDevice = await this._prisma.userDevice.upsert({
				where: { deviceId: linkDeviceDto.deviceId },
				update: {
					userId: linkDeviceDto.userId,
				},
				create: {
					userId: linkDeviceDto.userId,
					deviceId: linkDeviceDto.deviceId,
				},
			});

			return {
				id: userDevice.id,
				userId: userDevice.userId,
				deviceId: userDevice.deviceId,
				linkedAt: userDevice.linkedAt.toISOString(),
				updatedAt: userDevice.updatedAt.toISOString(),
			};
		} catch (error) {
			this.logger.error('Error linking device:', error);
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new BadRequestException('Erro ao vincular dispositivo ao usuário');
		}
	}

	private async updateCache(stickId: number, data: AntDeviceData): Promise<HeartRateData | undefined> {
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

		// Buscar informações do usuário vinculado ao device
		try {
			const userDevice = await this._prisma.userDevice.findUnique({
				where: { deviceId: data.DeviceID },
			});

			if (userDevice) {
				const user = await this._prisma.user.findUnique({
					where: { id: userDevice.userId },
				});

				if (user) {
					record.user = {
						id: user.id,
						name: user.name,
						gender: user.gender as 'M' | 'F',
						weight: user.weight,
						height: user.height,
						birthDate: user.birthDate.toISOString(),
						createdAt: user.createdAt.toISOString(),
						updatedAt: user.updatedAt.toISOString(),
						deviceId: data.DeviceID,
					};
				}
			}
		} catch (error) {
			this.logger.error('Erro ao buscar usuário para o device:', error);
		}

		this.cache.set(data.DeviceID, record);
		return record;
	}

	private async upsertMongo(record: HeartRateData): Promise<void> {
		this.logger.log('Saving heartrate data:', record);

		try {
			// Salvar registro histórico para cálculos de gamificação
			await this._prisma.heartRateRecord.create({
				data: {
					deviceId: record.deviceId,
					heartRate: record.heartRate,
					beatTime: record.beatTime,
					beatCount: record.beatCount,
					manufacturerId: record.manufacturerId,
					serialNumber: record.serialNumber,
					stickId: record.stickId,
				},
			});

			// Manter HeartRateCurrent atualizado com a última leitura
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
		} catch (error) {
			this.logger.error('Erro ao salvar dados de frequência cardíaca:', error);
			throw error;
		}
	}

	private async checkLessonStatusBeforeSaving(record: HeartRateData): Promise<void> {
		try {
			// Buscar a lesson mais recente do usuário
			const lesson = await this._prisma.lesson.findFirst({
				orderBy: { createdAt: 'desc' },
			});

			// Se a lesson tem status ENDED, não salva os dados
			if (!lesson || lesson?.status === 'ENDED') {
				this.logger.log(`Lesson com status ENDED encontrada. Ignorando dados do device ${record.deviceId}`);
				return;
			}

			// Caso contrário, salva normalmente
			await this.upsertMongo(record);
		} catch (error) {
			this.logger.error('Erro ao verificar status da lesson:', error);
		}
	}

	private openStick(stick: AntStick, stickId: number): void {
		const sensor: HeartRateSensor = new (Ant as unknown as AntModule).HeartRateSensor(stick);
		let devId = 0;

		sensor.on('hbdata', (data: AntDeviceData) => {
			void this.updateCache(stickId, data)
				.then((record) => {
					if (!record) return;

					// Verificar se a lesson está com status ENDED antes de salvar
					void this.checkLessonStatusBeforeSaving(record).catch((err) => {
						this.logger.error('Erro ao verificar status da lesson:', err);
					});

					if (data.DeviceID !== 0 && devId === 0) {
						devId = data.DeviceID;
						sensor.detach();
						sensor.once('detached', () => {
							sensor.attach(0, devId);
						});
					}
				})
				.catch((err) => {
					this.logger.error('Erro ao atualizar cache:', err);
				});
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
