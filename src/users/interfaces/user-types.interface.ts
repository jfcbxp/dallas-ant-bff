export interface CreateUserDto {
	name: string;
	gender: 'M' | 'F';
	weight: number;
	height: number;
	birthDate: string;
}

export interface LinkDeviceDto {
	userId: string;
	deviceId: number;
}

export interface UserResponse {
	id: string;
	name: string;
	gender: 'M' | 'F';
	weight: number;
	height: number;
	birthDate: string;
	createdAt: string;
	updatedAt: string;
}

export interface UserDeviceResponse {
	id: string;
	userId: string;
	deviceId: number;
	linkedAt: string;
	updatedAt: string;
}

export interface UserDevice {
	id: string;
	userId: string;
	deviceId: number;
	linkedAt: Date;
	updatedAt: Date;
}

export interface User {
	id: string;
	name: string;
	gender: 'M' | 'F';
	weight: number;
	height: number;
	birthDate: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface UserWithDeviceId extends UserResponse {
	deviceId: number;
}
