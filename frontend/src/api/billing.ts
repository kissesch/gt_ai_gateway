import request from '../utils/request';
import type { RechargeRecord, RechargeRecordsQuery } from '../types/billing';

export async function listRechargeRecords(params?: RechargeRecordsQuery): Promise<RechargeRecord[]> {
    return request.get('/balance/recharge/list.json', { params });
}

export async function getRechargeRecord(id: number): Promise<RechargeRecord> {
    return request.get(`/balance/recharge/${id}`);
}