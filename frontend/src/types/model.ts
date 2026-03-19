import type { BaseEntity, TableQuery } from './index';

export interface Model extends BaseEntity {
    name: string;
    vendor_id: number;
    enable: boolean;
    input_price: number;
    output_price: number;
}

export interface CreateModelRequest {
    name: string;
    vendor_id: number;
    enable?: boolean;
    input_price?: number;
    output_price?: number;
}

export interface UpdateModelRequest {
    name?: string;
    vendor_id?: number;
    enable?: boolean;
    input_price?: number;
    output_price?: number;
}

export interface ModelQuery extends TableQuery {
    vendor_id?: number;
}
