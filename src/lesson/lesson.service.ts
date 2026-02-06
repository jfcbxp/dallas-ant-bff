import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AntService } from '../ant/ant.service';
import { HeartRateUtil } from '../utils/heart-rate.util';

interface ZoneStats {
	zone1: number; // segundos
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
	receivedAt: Date;
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

	constructor(
		private readonly prisma: PrismaService,
		private readonly antService: AntService,
	) {}

	async startLesson(): Promise<{ lessonId: string; startedAt: Date }> {
		try {
			await this.prisma.heartRateRecord.deleteMany({});
			await this.prisma.lessonResult.deleteMany({});
			await this.prisma.lesson.deleteMany({});

			const lesson = await this.prisma.lesson.create({
				data: { status: 'ACTIVE' },
			});

			return { lessonId: lesson.id, startedAt: lesson.startedAt };
		} catch {
			throw new BadRequestException('Erro ao iniciar aula');
		}
	}

	async endLesson(): Promise<LessonEndResponse> {
		const lesson = await this.prisma.lesson.findFirst({
			where: { status: 'ACTIVE' },
		});

		if (!lesson) {
			throw new NotFoundException('Nenhuma aula ativa encontrada');
		}

		const updatedLesson = await this.prisma.lesson.update({
			where: { id: lesson.id },
			data: {
				status: 'ENDED',
				endedAt: new Date(),
			},
		});

		await this.calculateAndStoreLessonResult(updatedLesson.id);
		await this.prisma.userDevice.deleteMany({});
		this.antService.clearCache();

		return {
			lessonId: updatedLesson.id,
			message: 'Aula finalizada com sucesso',
		};
	}

	async getLessonStatus(): Promise<LessonStatusResponse> {
		try {
			this.logger.log('Getting current lesson status');

			const lesson = await this.prisma.lesson.findFirst({
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

	/* ======================================================
     CÁLCULO FISIOLÓGICO E GAMIFICAÇÃO (MELHORADO)
     ====================================================== */

	private resolveZone(hr: number, fcMax: number): keyof ZoneStats {
		const pct = (hr / fcMax) * 100;

		if (pct >= 90) return 'zone5';
		if (pct >= 80) return 'zone4';
		if (pct >= 70) return 'zone3';
		if (pct >= 60) return 'zone2';
		return 'zone1';
	}

	private pointsPerSecond(zone: keyof ZoneStats): number {
		switch (zone) {
			case 'zone1':
				return 0.5;
			case 'zone2':
				return 1;
			case 'zone3':
				return 2;
			case 'zone4':
				return 3;
			case 'zone5':
				return 4;
		}
	}

	private calculateGamificationByTime(
		records: HeartRateRecordWithDevice[],
		user: UserInfo,
	): { zones: ZoneStats; points: number; avgHeartRate: number } {
		const fcMax = HeartRateUtil.calculateFcMax(user.gender as 'M' | 'F', user.birthDate);

		const zones: ZoneStats = {
			zone1: 0,
			zone2: 0,
			zone3: 0,
			zone4: 0,
			zone5: 0,
		};

		let totalSeconds = 0;
		let totalPoints = 0;
		let weightedHrSum = 0;

		const sorted = [...records].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

		for (let i = 0; i < sorted.length - 1; i++) {
			const current = sorted[i];
			const next = sorted[i + 1];

			const deltaSeconds = Math.max(1, Math.round((next.receivedAt.getTime() - current.receivedAt.getTime()) / 1000));

			const zone = this.resolveZone(current.heartRate, fcMax);

			zones[zone] += deltaSeconds;
			totalSeconds += deltaSeconds;
			weightedHrSum += current.heartRate * deltaSeconds;
			totalPoints += deltaSeconds * this.pointsPerSecond(zone);
		}

		return {
			zones,
			points: Math.round(totalPoints),
			avgHeartRate: totalSeconds ? Math.round(weightedHrSum / totalSeconds) : 0,
		};
	}

	/* ======================================================
     RESULTADO DA AULA
     ====================================================== */

	async calculateAndStoreLessonResult(lessonId: string): Promise<LessonResultResponse> {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
		});

		if (!lesson) {
			throw new NotFoundException('Aula não encontrada');
		}

		const heartRateRecords = await this.prisma.heartRateRecord.findMany({
			orderBy: { receivedAt: 'asc' },
		});

		const userDevices = await this.prisma.userDevice.findMany({});
		const users = await this.prisma.user.findMany({
			where: { id: { in: userDevices.map((u) => u.userId) } },
		});

		const deviceToUserMap = new Map<number, UserInfo>();

		for (const ud of userDevices) {
			const user = users.find((u) => u.id === ud.userId);
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

		const recordsByDevice = new Map<number, HeartRateRecordWithDevice[]>();

		for (const record of heartRateRecords) {
			if (!recordsByDevice.has(record.deviceId)) {
				recordsByDevice.set(record.deviceId, []);
			}
			recordsByDevice.get(record.deviceId)!.push(record);
		}

		const deviceResults = new Map<number, DeviceResult>();

		for (const [deviceId, records] of recordsByDevice.entries()) {
			const user = deviceToUserMap.get(deviceId);
			if (!user) continue;

			const { zones, points, avgHeartRate } = this.calculateGamificationByTime(records, user);

			deviceResults.set(deviceId, {
				deviceId,
				user,
				totalHeartRateRecords: records.length,
				zones,
				points,
				avgHeartRate,
			});
		}

		const totalPoints = Array.from(deviceResults.values()).reduce((sum, r) => sum + r.points, 0);

		const startTime = new Date(lesson.startedAt).getTime();
		const endTime = lesson.endedAt ? new Date(lesson.endedAt).getTime() : Date.now();

		const duration = Math.round((endTime - startTime) / 1000 / 60);

		const result = await this.prisma.lessonResult.create({
			data: {
				lessonId,
				totalDevices: deviceResults.size,
				deviceResults: Array.from(deviceResults.values()),
				totalPoints,
				duration,
			},
		});

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
	}

	async getLessonResult(): Promise<LessonResultResponse> {
		const result = await this.prisma.lessonResult.findFirst({
			orderBy: { createdAt: 'desc' },
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
	}
}
