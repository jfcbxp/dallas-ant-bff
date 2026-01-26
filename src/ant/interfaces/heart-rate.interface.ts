export interface HeartRateData {
	deviceId: number;
	heartRate: number;
	beatTime: number;
	beatCount: number;
	manufacturerId: number | null;
	serialNumber: number | null;
	stickId: number;
	receivedAt: string;
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
