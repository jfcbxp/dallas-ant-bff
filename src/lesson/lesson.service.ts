import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ZoneStats {
	zone1: number;
	zone2: number;
	zone3: number;
	zone4: number;
	zone5: number;
}

interface UserInfo {
	id: string;
	name: string;
	gender: string;
	weight: number;
	height: number;
	birthDate: string;
	createdAt: string;
	updatedAt: string;
}

interface DeviceResult {
	deviceId: number;
	user?: UserInfo;
	totalHeartRateRecords: number;
	zones: ZoneStats;
	points: number;
	avgHeartRate: number;
}

interface HeartRateRecordWithDevice {
	deviceId: number;
	heartRate: number;
}

export interface LessonEndResponse {
	lessonId: string;
	message: string;
}

export interface LessonStatusResponse {
	lessonId: string;
	status: string;
	startedAt: Date;
	endedAt?: Date;
	duration?: number;
}

export interface LessonResultResponse {
	lessonId: string;
	totalDevices: number;
	deviceResults: DeviceResult[];
	totalPoints: number;
	duration: number;
}

@Injectable()
export class LessonService {
	private readonly logger = new Logger(LessonService.name);

	private readonly _prisma: PrismaService;

	constructor(private readonly prisma: PrismaService) {
		this._prisma = prisma;
	}

	async startLesson(): Promise<{ lessonId: string; startedAt: Date }> {
		try {
			this.logger.log('Starting new lesson');

			// Limpar histórico de registros
			await this._prisma.heartRateRecord.deleteMany({});
			this.logger.log('HeartRateRecord table cleared');

			// Limpar LessonResult
			await this._prisma.lessonResult.deleteMany({});
			this.logger.log('LessonResult table cleared');

			await this._prisma.lesson.deleteMany({});
			this.logger.log('Lesson table cleared');

			// Criar nova aula
			const lesson = await this._prisma.lesson.create({
				data: {
					status: 'ACTIVE',
				},
			});

			return {
				lessonId: lesson.id,
				startedAt: lesson.startedAt,
			};
		} catch (error) {
			this.logger.error('Error starting lesson:', error);
			throw new BadRequestException('Erro ao iniciar aula');
		}
	}

	async endLesson(): Promise<LessonEndResponse> {
		try {
			this.logger.log('Ending active lesson');

			// Buscar a aula ativa
			const lesson = await this._prisma.lesson.findFirst({
				where: { status: 'ACTIVE' },
			});

			if (!lesson) {
				throw new NotFoundException('Nenhuma aula ativa encontrada');
			}

			// Atualizar aula para ENDED
			const updatedLesson = await this._prisma.lesson.update({
				where: { id: lesson.id },
				data: {
					status: 'ENDED',
					endedAt: new Date(),
				},
			});

			await this.calculateAndStoreLessonResult(updatedLesson.id);

			this.logger.log('Lesson ended successfully');

			return {
				lessonId: updatedLesson.id,
				message: 'Aula finalizada com sucesso',
			};
		} catch (error) {
			this.logger.error('Error ending lesson:', error);
			throw error;
		}
	}

	private calculateZones(records: HeartRateRecordWithDevice[]): ZoneStats {
		const heartRates = records.map((r) => r.heartRate);
		const maxHeartRate = heartRates.length > 0 ? Math.max(...heartRates) : 180;
		const fcmax = maxHeartRate > 0 ? maxHeartRate : 180;

		const zones: ZoneStats = {
			zone1: 0,
			zone2: 0,
			zone3: 0,
			zone4: 0,
			zone5: 0,
		};

		for (const record of records) {
			const { heartRate } = record;
			const percentage = (heartRate / fcmax) * 100;

			if (percentage >= 90) zones.zone5++;
			else if (percentage >= 80) zones.zone4++;
			else if (percentage >= 70) zones.zone3++;
			else if (percentage >= 60) zones.zone2++;
			else zones.zone1++;
		}

		return zones;
	}

	private calculateGameification(zones: ZoneStats, totalRecords: number): number {
		// Sistema de pontuação
		// Z1: 1 ponto por batimento
		// Z2: 2 pontos por batimento
		// Z3: 3 pontos por batimento (zona ideal)
		// Z4: 4 pontos por batimento
		// Z5: 5 pontos por batimento

		const points = zones.zone1 * 1 + zones.zone2 * 2 + zones.zone3 * 3 + zones.zone4 * 4 + zones.zone5 * 5;

		// Bônus por consistência (quantos registros foram feitos)
		const consistencyBonus = Math.floor(totalRecords / 10); // 1 ponto extra a cada 10 registros

		return points + consistencyBonus;
	}

	async getLessonStatus(): Promise<LessonStatusResponse> {
		try {
			this.logger.log('Getting current lesson status');

			const lesson = await this._prisma.lesson.findFirst({
				orderBy: { startedAt: 'desc' },
				take: 1,
			});

			if (!lesson) {
				throw new NotFoundException('Nenhuma aula encontrada');
			}

			let duration: number | undefined;
			if (lesson.status === 'ENDED' && lesson.endedAt) {
				const endTime = new Date(lesson.endedAt).getTime();
				const startTime = new Date(lesson.startedAt).getTime();
				duration = Math.round((endTime - startTime) / 1000 / 60);
			} else if (lesson.status === 'ACTIVE') {
				const startTime = new Date(lesson.startedAt).getTime();
				duration = Math.round((Date.now() - startTime) / 1000 / 60);
			}

			return {
				lessonId: lesson.id,
				status: lesson.status,
				startedAt: lesson.startedAt,
				endedAt: lesson.endedAt || undefined,
				duration,
			};
		} catch (error) {
			this.logger.error('Error getting lesson status:', error);
			throw error;
		}
	}

	async calculateAndStoreLessonResult(lessonId: string): Promise<LessonResultResponse> {
		try {
			this.logger.log('Calculating and storing lesson result for lesson:', lessonId);

			// Buscar a aula
			const lesson = await this._prisma.lesson.findUnique({
				where: { id: lessonId },
			});

			if (!lesson) {
				throw new NotFoundException('Aula não encontrada');
			}

			// Ler todos os HeartRateCurrent
			const heartRateCurrents = await this._prisma.heartRateCurrent.findMany({});

			// Ler todos os HeartRateRecords para cálculos
			const heartRateRecords = await this._prisma.heartRateRecord.findMany({
				orderBy: { receivedAt: 'asc' },
			});

			const userDevices = await this._prisma.userDevice.findMany({});
			const deviceToUserMap = new Map<number, UserInfo>();

			for (const ud of userDevices) {
				const user = await this._prisma.user.findUnique({
					where: { id: ud.userId },
				});

				if (user) {
					deviceToUserMap.set(ud.deviceId, {
						id: user.id,
						name: user.name,
						gender: user.gender,
						weight: user.weight,
						height: user.height,
						birthDate: user.birthDate.toISOString(),
						createdAt: user.createdAt.toISOString(),
						updatedAt: user.updatedAt.toISOString(),
					});
				}
			}

			const deviceResults = new Map<number, DeviceResult>();

			for (const current of heartRateCurrents) {
				const deviceRecords = heartRateRecords.filter((r) => r.deviceId === current.deviceId);
				if (deviceRecords.length === 0) continue;

				const zones = this.calculateZones(deviceRecords);
				const points = this.calculateGameification(zones, deviceRecords.length);
				const totalHeartRate = deviceRecords.reduce((sum, r) => sum + r.heartRate, 0);
				const avgHeartRate = Math.round(totalHeartRate / deviceRecords.length);
				const userInfo = deviceToUserMap.get(current.deviceId) ?? undefined;

				deviceResults.set(current.deviceId, {
					deviceId: current.deviceId,
					user: userInfo,
					totalHeartRateRecords: deviceRecords.length,
					zones,
					points,
					avgHeartRate,
				});
			}

			const totalPoints = Array.from(deviceResults.values()).reduce((sum, result) => sum + result.points, 0);

			// Calcular duração em minutos
			const startTime = new Date(lesson.startedAt).getTime();
			const endTime = lesson.endedAt ? new Date(lesson.endedAt).getTime() : Date.now();
			const duration = Math.round((endTime - startTime) / 1000 / 60);

			// Armazenar resultado em um documento separado
			const result = await this._prisma.lessonResult.create({
				data: {
					lessonId,
					totalDevices: deviceResults.size,
					deviceResults: Array.from(deviceResults.values()),
					totalPoints,
					duration,
				},
			});

			this.logger.log('Lesson result calculated and stored:', result.id);

			return {
				lessonId: result.lessonId,
				totalDevices: result.totalDevices,
				deviceResults: result.deviceResults.map((dr) => ({
					...dr,
					user: dr.user ?? undefined,
				})),
				totalPoints: result.totalPoints,
				duration: result.duration,
			};
		} catch (error) {
			this.logger.error('Error calculating lesson result:', error);
			throw error;
		}
	}

	async getLessonResult(): Promise<LessonResultResponse> {
		try {
			this.logger.log('Getting latest lesson result');

			const result = await this._prisma.lessonResult.findFirst({
				orderBy: { createdAt: 'desc' },
				take: 1,
			});

			if (!result) {
				throw new NotFoundException('Resultado da aula não encontrado');
			}

			return {
				lessonId: result.lessonId,
				totalDevices: result.totalDevices,
				deviceResults: result.deviceResults.map((dr) => ({
					...dr,
					user: dr.user ?? undefined,
				})),
				totalPoints: result.totalPoints,
				duration: result.duration,
			};
		} catch (error) {
			this.logger.error('Error getting lesson result:', error);
			throw error;
		}
	}
}
