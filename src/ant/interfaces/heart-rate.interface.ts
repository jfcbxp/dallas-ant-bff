export interface HeartRateData {
	deviceId: number;
	heartRate: number;
	beatTime: number;
	beatCount: number;
	manufacturerId: number | null;
	serialNumber: number | null;
	stickId: number;
	receivedAt: string;
	user?: UserWithDeviceId;
}

export interface AntDeviceData {
	DeviceID: number;
	ComputedHeartRate: number;
	BeatTime: number;
	BeatCount: number;
	ManId?: number;
	SerialNumber?: number;
}

export interface AvailableDevice {
	deviceId: number;
	heartRate: number;
	beatTime: number | null;
	beatCount: number | null;
	manufacturerId: number | null;
	serialNumber: number | null;
	stickId: number;
	receivedAt: Date | string;
	user?: UserWithDeviceId;
}

export interface HeartRateCurrentDb {
	id: string;
	deviceId: number;
	heartRate: number;
	beatTime: number | null;
	beatCount: number | null;
	manufacturerId: number | null;
	serialNumber: number | null;
	stickId: number;
	receivedAt: Date;
}

export interface UserData {
	id: string;
	name: string;
	gender: string;
	weight: number;
	height: number;
	birthDate: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface UserWithDeviceId {
	id: string;
	name: string;
	gender: 'M' | 'F';
	weight: number;
	height: number;
	birthDate: string;
	createdAt: string;
	updatedAt: string;
	deviceId: number;
	zones?: {
		zone1: { min: number; max: number };
		zone2: { min: number; max: number };
		zone3: { min: number; max: number };
		zone4: { min: number; max: number };
		zone5: { min: number; max: number };
	};
}
