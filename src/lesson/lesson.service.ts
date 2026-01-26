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

	async startLesson(): Promise<{ lessonId: string; startedAt: string }> {
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

	async endLesson(lessonId: string): Promise<LessonEndResponse> {
		try {
			this.logger.log('Ending lesson:', lessonId);

			// Verificar se existe aula ativa
			const lesson = await this._prisma.lesson.findUnique({
				where: { id: lessonId },
			});

			if (!lesson) {
				throw new NotFoundException('Aula não encontrada');
			}

			if (lesson.status !== 'ACTIVE') {
				throw new BadRequestException('Aula já foi encerrada');
			}

			// Ler todos os HeartRateCurrent
			const heartRateCurrents = await this._prisma.heartRateCurrent.findMany({});

			// Ler todos os HeartRateRecords para cálculos
			const heartRateRecords = await this._prisma.heartRateRecord.findMany({
				orderBy: { receivedAt: 'asc' },
			});

			// Buscar informações de usuários
			const userDevices = await this._prisma.userDevice.findMany({});
			const deviceToUserMap = new Map(userDevices.map((ud: any) => [ud.deviceId, ud.userId]));

			// Calcular resultados por pulseira
			const deviceResults = new Map<number, DeviceResult>();

			for (const current of heartRateCurrents) {
				const deviceRecords = heartRateRecords.filter((r: any) => r.deviceId === current.deviceId);

				if (deviceRecords.length === 0) continue;

				const zones = this.calculateZones(current, deviceRecords);
				const points = this.calculateGameification(zones, deviceRecords.length);
				const avgHeartRate = Math.round(deviceRecords.reduce((sum: number, r: any) => sum + r.heartRate, 0) / deviceRecords.length);

				const userId = deviceToUserMap.get(current.deviceId) as string | undefined;

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

			// Calcular duração
			const duration = Math.round((new Date().getTime() - new Date(lesson.startedAt).getTime()) / 1000 / 60); // em minutos

			// Atualizar aula
			const updatedLesson = await this._prisma.lesson.update({
				where: { id: lessonId },
				data: {
					status: 'ENDED',
					endedAt: new Date(),
					summary: {
						totalDevices: deviceResults.size,
						deviceResults: Array.from(deviceResults.values()),
						totalPoints,
						duration,
					},
				},
			});

			this.logger.log('Lesson ended successfully');

			return {
				lessonId: updatedLesson.id,
				totalDevices: deviceResults.size,
				deviceResults: Array.from(deviceResults.values()),
				totalPoints,
				duration,
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
		const maxHeartRate = Math.max(...records.map((r: any) => r.heartRate));
		const fcmax = maxHeartRate > 0 ? maxHeartRate : 180; // valor padrão

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
			const percentage = (record.heartRate / fcmax) * 100;

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
}
