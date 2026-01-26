export interface AntStick {
	on(event: 'startup', callback: () => void): void;
	openAsync(callback: (err: Error | null) => void): void;
}

export interface HeartRateSensor {
	on(event: 'hbdata', callback: (data: any) => void): void;
	once(event: 'detached', callback: () => void): void;
	attach(channel: number, deviceId: number): void;
	detach(): void;
}

export interface AntModule {
	GarminStick2: new () => AntStick;
	GarminStick3: new () => AntStick;
	HeartRateSensor: new (stick: AntStick) => HeartRateSensor;
}
