import { Context } from "hono";
import { SgRecord } from "../model/sgRecord";
import { SgRecordStatus } from "../constants";

async function dashboardStats(c: Context) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sutando get() 返回 Collection，不保证有原生数组的 length
    const records = await SgRecord.query().get();
    const allRecords = records.toData() as Array<{
        user_id: number | null;
        model_id: number | null;
        status: string | null;
        created_at: string | Date | null;
    }>;

    // 今日请求数
    const todayRequests = allRecords.filter(r => {
        if (!r.created_at) return false;
        const recordDate = new Date(r.created_at);
        return recordDate >= today;
    });

    // 今日成功率统计
    const successCount = todayRequests.filter(r => r.status === SgRecordStatus.SUCCESS).length;
    const failedCount = todayRequests.filter(r => r.status === SgRecordStatus.FAILED).length;
    const totalRequests = allRecords.length;
    const todayTotalRequests = todayRequests.length;
    const successRate = todayTotalRequests > 0 ? successCount / todayTotalRequests : null;

    // 今日活跃用户（今天有请求的用户）
    const activeUserIds = new Set(todayRequests.map(r => r.user_id).filter(Boolean));

    // 今日活跃模型（今天有请求的模型）
    const activeModelIds = new Set(todayRequests.map(r => r.model_id).filter(Boolean));

    return c.json({
        total_requests: totalRequests,
        success_count: successCount,
        failed_count: failedCount,
        success_rate: successRate,
        active_users: activeUserIds.size,
        active_models: activeModelIds.size,
        today_requests: todayRequests.length,
    });
}

async function recentRecords(c: Context) {
    const { limit = '10' } = c.req.query();
    const limitNumber = parseInt(limit, 10);

    const records = await SgRecord.query()
        .orderBy('id', 'desc')
        .limit(limitNumber)
        .get();

    // 简化返回数据
    const simplified = records.map(r => ({
        id: r.id,
        user_id: r.user_id,
        model_id: r.model_id,
        status: r.status,
        created_at: r.created_at,
    }));

    return c.json(simplified);
}

export default {
    dashboardStats,
    recentRecords,
};
