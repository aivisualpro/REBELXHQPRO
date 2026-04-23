import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export function apiSuccess<T = any>(data: T, status: number = 200) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function apiError(message: string, status: number = 500, details?: any) {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error: message,
      ...(details !== undefined && { details }),
    },
    { status }
  );
}
