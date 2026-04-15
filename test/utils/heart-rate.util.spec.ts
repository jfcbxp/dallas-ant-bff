import { HeartRateUtil } from '../../src/utils/heart-rate.util';

describe('HeartRateUtil', () => {
	describe('calculateAge', () => {
		it('should calculate age correctly', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 30);

			const age = HeartRateUtil.calculateAge(birthDate.toISOString());
			expect(age).toBeGreaterThanOrEqual(29);
			expect(age).toBeLessThanOrEqual(30);
		});

		it('should return 0 for a newborn', () => {
			const today = new Date();
			const age = HeartRateUtil.calculateAge(today.toISOString());
			expect(age).toBe(0);
		});

		it('should handle dates correctly around birthdays', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 25);
			birthDate.setDate(1);

			const age = HeartRateUtil.calculateAge(birthDate.toISOString());
			expect(age).toBeGreaterThanOrEqual(24);
			expect(age).toBeLessThanOrEqual(25);
		});
	});

	describe('calculateFcMax', () => {
		it('should calculate FCMax for male correctly', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 30);

			const fcMax = HeartRateUtil.calculateFcMax('M', birthDate.toISOString());
			// FCMax = 208 - 0.7 * age
			// For age 30: 208 - 21 = 187
			expect(fcMax).toBeGreaterThan(185);
			expect(fcMax).toBeLessThan(190);
		});

		it('should calculate FCMax for female correctly', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 30);

			const fcMax = HeartRateUtil.calculateFcMax('F', birthDate.toISOString());
			// FCMax = 206 - 0.88 * age
			// For age 30: 206 - 26.4 = 179.6
			expect(fcMax).toBeGreaterThan(178);
			expect(fcMax).toBeLessThan(182);
		});

		it('should have different FCMax for males and females at same age', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 40);

			const fcMaxMale = HeartRateUtil.calculateFcMax('M', birthDate.toISOString());
			const fcMaxFemale = HeartRateUtil.calculateFcMax('F', birthDate.toISOString());

			expect(fcMaxMale).toBeGreaterThan(fcMaxFemale);
		});
	});

	describe('calculateZones', () => {
		it('should calculate zones correctly for male', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 30);

			const zones = HeartRateUtil.calculateZones('M', birthDate.toISOString());

			expect(zones.zone1.min).toBe(0);
			expect(zones.zone1.max).toBeGreaterThan(0);
			expect(zones.zone2.min).toBeGreaterThan(zones.zone1.max);
			expect(zones.zone3.min).toBeGreaterThan(zones.zone2.max);
			expect(zones.zone4.min).toBeGreaterThan(zones.zone3.max);
			expect(zones.zone5.min).toBeGreaterThan(zones.zone4.max);
		});

		it('should calculate zones correctly for female', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 35);

			const zones = HeartRateUtil.calculateZones('F', birthDate.toISOString());

			expect(zones.zone1).toHaveProperty('min');
			expect(zones.zone1).toHaveProperty('max');
			expect(zones.zone2).toHaveProperty('min');
			expect(zones.zone2).toHaveProperty('max');
			expect(zones.zone3).toHaveProperty('min');
			expect(zones.zone3).toHaveProperty('max');
			expect(zones.zone4).toHaveProperty('min');
			expect(zones.zone4).toHaveProperty('max');
			expect(zones.zone5).toHaveProperty('min');
			expect(zones.zone5).toHaveProperty('max');
		});

		it('should have zones in increasing order', () => {
			const birthDate = new Date();
			birthDate.setFullYear(birthDate.getFullYear() - 25);

			const zones = HeartRateUtil.calculateZones('M', birthDate.toISOString());

			expect(zones.zone1.max).toBeLessThan(zones.zone2.min);
			expect(zones.zone2.max).toBeLessThan(zones.zone3.min);
			expect(zones.zone3.max).toBeLessThan(zones.zone4.min);
			expect(zones.zone4.max).toBeLessThan(zones.zone5.min);
		});
	});
});
