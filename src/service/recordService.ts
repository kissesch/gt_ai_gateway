import { SgRecord, RECORD_SUMMARY_COLUMNS } from "../model/sgRecord";
import { SgRecordStatus, ApiFormat } from "../constants";

function isLogEnabled(): boolean {
    return process.env.RECORD_LOG_ENABLED === "true";
}

async function create(
    userId: number,
    modelId: number | null,
    requestData: string | null,
    clientFormat: string | null = null,
    upstreamFormat: string | null = null,
    vendorId: number | null = null,
    vendorModelName: string | null = null,
) {
    if (isLogEnabled()) {
        console.log(`[RecordService] Creating record: user=${userId}, model=${modelId}`);
        if (requestData) {
            console.log(`[RecordService] Request data: ${requestData}`);
        }
    }

    return SgRecord.query().create({
        user_id: userId,
        model_id: modelId,
        vendor_id: vendorId,
        vendor_model_name: vendorModelName,
        request_data: requestData,
        response_data: null,
        status: SgRecordStatus.INIT,
        client_format: clientFormat,
        upstream_format: upstreamFormat !== clientFormat ? upstreamFormat : null,
        first_token_latency: null,
        start_at: null,
        end_at: null,
        cost: 0,
    });
}

async function update(recordId: number, data: Partial<SgRecord>) {
    if (isLogEnabled()) {
        console.log(`[RecordService] Updating record ${recordId}:`, JSON.stringify(data, null, 2));
    }

    return SgRecord.query().where("id", recordId).update(data);
}

async function latest(limit: number = 10, summaryOnly: boolean = false) {
    const q = SgRecord.query().orderBy("id", "desc").limit(limit);
    if (summaryOnly) {
        q.select(RECORD_SUMMARY_COLUMNS);
    }
    return q.get();
}

async function recordFailedRequest(
    userId: number,
    modelName: string | null,
    body: string,
    clientFormat: ApiFormat,
    failedCode: string,
    modelId: number | null = null,
    vendorId: number | null = null
) {
    try {
        const record = await create(
            userId,
            modelId,
            body,
            clientFormat,
            null,
            vendorId,
            modelName
        );
        await update(record.id, {
            status: SgRecordStatus.FAILED,
            failed_code: failedCode,
            end_at: new Date(),
        });
    } catch (e) {
        console.error("Failed to write failed record:", e);
    }
}

export default {
    create,
    update,
    latest,
    recordFailedRequest,
};
