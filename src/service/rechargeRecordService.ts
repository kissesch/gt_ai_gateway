import { SgRechargeRecord } from "../model/sgRechargeRecord";

interface RechargeRecordsQuery {
    user_id?: number;
    type?: string;
    limit?: number;
    offset?: number;
}

async function listRechargeRecords(query: RechargeRecordsQuery = {}) {
    const { user_id, type, limit = 100, offset = 0 } = query;

    const dbQuery = SgRechargeRecord.query();

    if (user_id !== undefined) {
        dbQuery.where("user_id", user_id);
    }

    if (type !== undefined) {
        dbQuery.where("type", type);
    }

    return dbQuery.orderBy("id", "desc").limit(limit).offset(offset).get();
}

async function getRechargeRecord(id: number) {
    return await SgRechargeRecord.query().find(id);
}

export default {
    listRechargeRecords,
    getRechargeRecord,
};