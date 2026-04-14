export class HeartRateUtil {
	static calculateAge(birthDate: string): number {
		const diff = Date.now() - new Date(birthDate).getTime();
		return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
	}

	static calculateFcMax(gender: 'M' | 'F', birthDate: string): number {
		const age = this.calculateAge(birthDate);
		return gender === 'F' ? 206 - 0.88 * age : 208 - 0.7 * age;
	}

	static calculateZones(gender: 'M' | 'F', birthDate: string) {
		const fcMax = this.calculateFcMax(gender, birthDate);
		return {
			zone1: { min: 0, max: Math.round(fcMax * 0.6) },
			zone2: { min: Math.round(fcMax * 0.61), max: Math.round(fcMax * 0.7) },
			zone3: { min: Math.round(fcMax * 0.71), max: Math.round(fcMax * 0.8) },
			zone4: { min: Math.round(fcMax * 0.81), max: Math.round(fcMax * 0.9) },
			zone5: { min: Math.round(fcMax * 0.91), max: Math.round(fcMax) },
		};
	}
}
