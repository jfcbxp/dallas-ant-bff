import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ZoneStats {
	zone1: number;
	zone2: number;
	zone3: number;
	zone4: number;
	zone5: number;
}

interface DeviceResult {
	deviceId: number;
	userId?: string;
	totalHeartRateRecords: number;
	zones: ZoneStats;
	points: number;
	avgHeartRate: number;
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

			// Criar nova aula
			const lesson = await this._prisma.lesson.create({
				data: {
					status: 'ACTIVE',
				},
			});

			// Limpar histórico de registros
			await this._prisma.heartRateRecord.deleteMany({});
			this.logger.log('HeartRateRecord table cleared');

			// Limpar UserDevice
			await this._prisma.userDevice.deleteMany({});
			this.logger.log('UserDevice table cleared');

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

	private calculateZones(current: any, records: any[]): ZoneStats {
		// Calcular FCmax baseado no modelo de Karvonen
		// Para simplificar, usamos 220 - idade como FCmax
		// Aqui vamos usar a frequência máxima registrada como referência
		const heartRates = records.map((r: any) => (r as { heartRate: number }).heartRate);
		const maxHeartRate = heartRates.length > 0 ? Math.max(...heartRates) : 180;
		const fcmax = maxHeartRate > 0 ? maxHeartRate : 180;

		const zones: ZoneStats = {
			zone1: 0,
			zone2: 0,
			zone3: 0,
			zone4: 0,
			zone5: 0,
		};

		// Zonas ANT+ baseadas em percentual de FCmax
		// Z1: 50-60%, Z2: 60-70%, Z3: 70-80%, Z4: 80-90%, Z5: 90-100%
		for (const record of records) {
			const { heartRate } = record as { heartRate: number };
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

			const duration =
				lesson.status === 'ENDED' && lesson.endedAt
					? Math.round((new Date(lesson.endedAt).getTime() - new Date(lesson.startedAt).getTime()) / 1000 / 60)
					: lesson.status === 'ACTIVE'
						? Math.round((Date.now() - new Date(lesson.startedAt).getTime()) / 1000 / 60)
						: undefined;

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

			// Buscar informações de usuários
			const userDevices = await this._prisma.userDevice.findMany({});
			const deviceToUserMap = new Map(
				userDevices.map((ud: any) => [(ud as { deviceId: number }).deviceId, (ud as { userId: string }).userId]),
			);
			const deviceResults = new Map<number, DeviceResult>();

			for (const current of heartRateCurrents) {
				const deviceRecords = heartRateRecords.filter((r: any) => (r as { deviceId: number }).deviceId === current.deviceId);
				if (deviceRecords.length === 0) continue;

				const zones = this.calculateZones(current, deviceRecords);
				const points = this.calculateGameification(zones, deviceRecords.length);
				const totalHeartRate = deviceRecords.reduce((sum: number, r: any) => sum + (r as { heartRate: number }).heartRate, 0);
				const avgHeartRate = Math.round(totalHeartRate / deviceRecords.length);
				const userId = deviceToUserMap.get(current.deviceId);

				deviceResults.set(current.deviceId, {
					deviceId: current.deviceId,
					userId,
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
				deviceResults: result.deviceResults,
				totalPoints: result.totalPoints,
				duration: result.duration,
			};
		} catch (error) {
			this.logger.error('Error calculating lesson result:', error);
			throw error;
		}
	}

	async getLessonResult(lessonId: string): Promise<LessonResultResponse> {
		try {
			this.logger.log('Getting lesson result for lesson:', lessonId);

			const result = await this._prisma.lessonResult.findFirst({
				where: { lessonId },
			});

			if (!result) {
				throw new NotFoundException('Resultado da aula não encontrado');
			}

			return {
				lessonId: result.lessonId,
				totalDevices: result.totalDevices,
				deviceResults: result.deviceResults,
				totalPoints: result.totalPoints,
				duration: result.duration,
			};
		} catch (error) {
			this.logger.error('Error getting lesson result:', error);
			throw error;
		}
	}
}
