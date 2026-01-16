export const HttpErrorConstants: any = {
	400: { code: 'BAD_REQUEST' },
	401: { code: 'UNAUTHORIZED' },
	404: { code: 'NOT_FOUND' },
	500: { code: 'INTERNAL_SERVER_ERROR' },
};

export interface HttpErrorInterface {
	code: string;
}
