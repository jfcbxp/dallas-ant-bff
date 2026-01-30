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
	private stick: AntStick | null = null;
	private sensors: Map<number, { sensor: HeartRateSensor; deviceId: number; channel: number }> = new Map();
	private readonly RECONNECT_DELAY = 2000; // 2 seconds

	constructor(private readonly prisma: PrismaService) {
		this._prisma = prisma;
	}

	onModuleInit(): void {
		this.openStick(new (Ant as unknown as AntModule).GarminStick2());
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

	private openStick(stick: AntStick): void {
		this.stick = stick;

		// Configuração dos sensores com seus respectivos canais e device IDs
		const sensorConfigs = [
			{ channel: 0, deviceId: 44352 },
			{ channel: 1, deviceId: 41990 },
			{ channel: 2, deviceId: 41923 },
		];

		// Criar e configurar cada sensor
		sensorConfigs.forEach((config) => {
			this.setupSensor(stick, config.channel, config.deviceId);
		});

		stick.on('startup', () => {
			this.logger.log('ANT+ Stick iniciado, conectando sensores...');
			// Anexar todos os sensores quando o stick iniciar
			this.sensors.forEach((sensorInfo) => {
				this.logger.log(`Conectando sensor no canal ${sensorInfo.channel} para device ${sensorInfo.deviceId}`);
				sensorInfo.sensor.attach(sensorInfo.channel, sensorInfo.deviceId);
			});
		});

		stick.openAsync((err: Error | null) => {
			if (err) {
				this.logger.error('Erro ao abrir ANT+ Stick:', err);
			} else {
				this.logger.log('ANT+ Stick encontrado e aberto com sucesso');
			}
		});
	}

	private setupSensor(stick: AntStick, channel: number, deviceId: number): void {
		const sensor: HeartRateSensor = new (Ant as unknown as AntModule).HeartRateSensor(stick);

		// Armazenar informações do sensor para reconexão
		this.sensors.set(channel, { sensor, deviceId, channel });

		// Listener para dados de frequência cardíaca
		sensor.on('hbdata', (data: AntDeviceData) => {
			this.handleHeartRateData(data);
		});

		// Listener para detecção de desconexão
		sensor.once('detached', () => {
			this.logger.warn(`Sensor desconectado no canal ${channel} (Device ID: ${deviceId}). Tentando reconectar...`);
			this.handleSensorDetached(channel, deviceId);
		});
	}

	private handleSensorDetached(channel: number, deviceId: number): void {
		// Aguardar um pouco antes de tentar reconectar
		setTimeout(() => {
			const sensorInfo = this.sensors.get(channel);
			if (sensorInfo && this.stick) {
				this.logger.log(`Reconectando sensor no canal ${channel} para device ${deviceId}...`);

				// Recriar o sensor
				const newSensor: HeartRateSensor = new (Ant as unknown as AntModule).HeartRateSensor(this.stick);

				// Atualizar o sensor armazenado
				this.sensors.set(channel, { sensor: newSensor, deviceId, channel });

				// Configurar listeners novamente
				newSensor.on('hbdata', (data: AntDeviceData) => {
					this.handleHeartRateData(data);
				});

				newSensor.once('detached', () => {
					this.logger.warn(`Sensor desconectado novamente no canal ${channel} (Device ID: ${deviceId}). Tentando reconectar...`);
					this.handleSensorDetached(channel, deviceId);
				});

				// Tentar anexar o sensor
				try {
					newSensor.attach(channel, deviceId);
					this.logger.log(`Sensor reconectado com sucesso no canal ${channel}`);
				} catch (error) {
					this.logger.error(`Erro ao reconectar sensor no canal ${channel}:`, error);
					// Tentar novamente após um intervalo maior
					setTimeout(() => this.handleSensorDetached(channel, deviceId), 5000);
				}
			}
		}, this.RECONNECT_DELAY);
	}

	private handleHeartRateData(data: AntDeviceData): void {
		void this.updateCache(data.DeviceID, data)
			.then((record) => {
				if (!record) return;

				// Verificar se a lesson está com status ENDED antes de salvar
				void this.checkLessonStatusBeforeSaving(record).catch((err) => {
					this.logger.error('Erro ao verificar status da lesson:', err);
				});
			})
			.catch((err) => {
				this.logger.error('Erro ao atualizar cache:', err);
			});
	}
}
