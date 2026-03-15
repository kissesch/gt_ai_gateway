import { beforeAll, describe, expect, it } from "vitest";
import requestHelper from "../../helpers/requestHelper";
import dbHelper from "../../helpers/dbHelper";
import { setupAdminUser } from "../../globalSetup";

let adminToken: string;

describe("Stats API", () => {
    beforeAll(async () => {
        await dbHelper.truncate();
        adminToken = await setupAdminUser();
    });

    describe("GET /stats/dashboard.json", () => {
        it("should calculate success rate based on today's requests only", async () => {
            await dbHelper.truncate();
            adminToken = await setupAdminUser();

            dbHelper.execute(`
                INSERT INTO record (user_id, model_id, request_data, response_data, status, created_at, updated_at)
                VALUES
                (1, 101, '{}', '{}', 'success', datetime('now'), datetime('now')),
                (2, 102, '{}', '{}', 'success', datetime('now'), datetime('now')),
                (3, 103, '{}', '{}', 'failed',  datetime('now'), datetime('now')),
                (4, 104, '{}', '{}', 'failed',  datetime('now', '-1 day'), datetime('now', '-1 day')),
                (5, 105, '{}', '{}', 'success', datetime('now', '-1 day'), datetime('now', '-1 day'))
            `);

            const response = await requestHelper.get("/stats/dashboard.json", adminToken);

            expect(response.status).toBe(200);
            expect(response.body.total_requests).toBe(5);
            expect(response.body.today_requests).toBe(3);
            expect(response.body.success_count).toBe(2);
            expect(response.body.failed_count).toBe(1);
            expect(response.body.success_rate).toBeCloseTo(2 / 3, 5);
        });

        it("should calculate active users and active models based on today's requests only", async () => {
            await dbHelper.truncate();
            adminToken = await setupAdminUser();

            dbHelper.execute(`
                INSERT INTO record (user_id, model_id, request_data, response_data, status, created_at, updated_at)
                VALUES
                (11, 201, '{}', '{}', 'success', datetime('now'), datetime('now')),
                (11, 201, '{}', '{}', 'failed',  datetime('now'), datetime('now')),
                (12, 202, '{}', '{}', 'success', datetime('now'), datetime('now')),
                (13, 203, '{}', '{}', 'success', datetime('now', '-1 day'), datetime('now', '-1 day')),
                (14, 204, '{}', '{}', 'failed',  datetime('now', '-1 day'), datetime('now', '-1 day'))
            `);

            const response = await requestHelper.get("/stats/dashboard.json", adminToken);

            expect(response.status).toBe(200);
            expect(response.body.today_requests).toBe(3);
            expect(response.body.active_users).toBe(2);
            expect(response.body.active_models).toBe(2);
        });

        it("should return null success rate and zero active counts when there are no requests today", async () => {
            await dbHelper.truncate();
            adminToken = await setupAdminUser();

            dbHelper.execute(`
                INSERT INTO record (user_id, model_id, request_data, response_data, status, created_at, updated_at)
                VALUES
                (21, 301, '{}', '{}', 'success', datetime('now', '-2 day'), datetime('now', '-2 day')),
                (22, 302, '{}', '{}', 'failed',  datetime('now', '-1 day'), datetime('now', '-1 day'))
            `);

            const response = await requestHelper.get("/stats/dashboard.json", adminToken);

            expect(response.status).toBe(200);
            expect(response.body.total_requests).toBe(2);
            expect(response.body.today_requests).toBe(0);
            expect(response.body.success_count).toBe(0);
            expect(response.body.failed_count).toBe(0);
            expect(response.body.success_rate).toBeNull();
            expect(response.body.active_users).toBe(0);
            expect(response.body.active_models).toBe(0);
        });
    });
});
