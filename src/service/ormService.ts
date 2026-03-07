import { sutando } from "sutando";
import { DatabaseAdapter, D1Adapter, SQLiteAdapter } from "./dbAdapter";

interface ORMOptions {
    mode: "cloud" | "local";
    dbPath?: string;
}

class ORMService {
    private _dbAdapter: DatabaseAdapter | null = null;
    public mode: "cloud" | "local" = "cloud";

    async init(options: ORMOptions): Promise<DatabaseAdapter> {
        const { mode, dbPath } = options;
        this.mode = mode;

        if (mode === "cloud") {
            this._dbAdapter = new D1Adapter();
        } else {
            if (!dbPath) {
                throw new Error("dbPath is required for local mode");
            }
            const Database = (await import("better-sqlite3")).default;

            sutando.addConnection({
                client: "better-sqlite3",
                connection: {
                    filename: dbPath,
                },
                useNullAsDefault: true,
            });

            const db = new Database(dbPath);
            this._dbAdapter = new SQLiteAdapter(db);
        }

        return this._dbAdapter;
    }

    private _cloudConnected = false;
    private _connectPromise: Promise<void> | null = null;

    async connectCloud(db: any) {
        if (this._dbAdapter instanceof D1Adapter) {
            this._dbAdapter.setDB(db);
        }

        if (!this._cloudConnected) {
            // 使用 Promise 锁防止并发请求重复初始化连接
            // 第一个请求创建 Promise，后续并发请求 await 同一个 Promise
            if (!this._connectPromise) {
                this._connectPromise = this._doConnectCloud(db);
            }
            await this._connectPromise;
        }

        // === 每次请求都更新 D1 binding ===
        //
        // Cloudflare Workers 中每个请求都有独立的 I/O 上下文，
        // env.DB（D1 binding）是 per-request 的。
        // 但 sutando/knex 在首次初始化时缓存了 Client_D1 实例，
        // 其中 d1Driver 指向第一个请求的 env.DB。
        // 后续并发请求如果复用这个 client，会触发：
        // "Cannot perform I/O on behalf of a different request"
        //
        // 解决方案：每次请求都将当前的 env.DB 更新到 Client_D1 实例上，
        // 确保 acquireRawConnection() 和 _query() 使用的是当前请求的 D1 binding。
        this._updateD1Binding(db);
    }

    private _updateD1Binding(db: any): void {
        try {
            const instance = (sutando as any).getInstance();
            const queryBuilder = instance.manager?.['default'];
            if (queryBuilder) {
                // QueryBuilder 是 Proxy，通过 connector 访问 Knex 实例
                const knexInstance = queryBuilder.connector;
                if (knexInstance?.client) {
                    knexInstance.client.d1Driver = db;
                    knexInstance.client.driver = db;
                }
            }
        } catch (e) {
            // 静默处理，避免更新失败影响请求
        }
    }

    private async _doConnectCloud(db: any): Promise<void> {
        const ClientD1 = (await import("knex-cloudflare-d1")).default;

        // === Cloudflare Workers 跨请求 I/O 修复 ===
        //
        // 【问题】Cloudflare Workers 中每个请求的 env.DB（D1 binding）有独立 I/O 上下文。
        // knex 内部使用 tarn.js 连接池缓存连接对象（acquireRawConnection 返回值），
        // 当并发请求从池中获取到其他请求创建的连接时会触发：
        // "Cannot perform I/O on behalf of a different request"
        //
        // 【解决方案】
        // 1. 覆盖 acquireConnection：绕过连接池，始终返回 this.d1Driver（当前请求的 env.DB）
        // 2. 覆盖 releaseConnection：无需归还到池中
        // 3. 在 _query 中使用 this.d1Driver 替代 connection 参数
        //
        // this.d1Driver 通过 _updateD1Binding() 在每次请求的 dbMiddleware 中更新。

        // 绕过连接池，始终使用当前请求的 D1 binding
        ClientD1.prototype.acquireConnection = async function () {
            return this.d1Driver;
        };

        ClientD1.prototype.releaseConnection = async function () {
            return;
        };

        // Date 补丁 + 使用当前请求的 D1 binding
        // worker 模式的 knex-cloudflare-d1 不实现 _formatBindings()，
        // Date 对象直接传给 D1 bind() 会报错（只接受 string|number|null）
        const originalQuery = ClientD1.prototype._query;
        ClientD1.prototype._query = async function (connection: any, obj: any) {
            if (obj.bindings) {
                obj.bindings = obj.bindings.map((b: any) =>
                    b instanceof Date ? b.toISOString() : b
                );
            }
            // 始终使用 this.d1Driver 而非 connection 参数（可能来自过期的连接池）
            return originalQuery.call(this, this.d1Driver, obj);
        };

        sutando.addConnection({
            client: ClientD1,
            connection: {
                database: db,
            },
            useNullAsDefault: true,
        });
        this._cloudConnected = true;
    }

    async prepareDBConnection(db: any) {
        if (this.mode === "cloud") {
            await this.connectCloud(db);
        }
    }

    get isLocal(): boolean {
        return this.mode === "local";
    }

    get isCloud(): boolean {
        return this.mode === "cloud";
    }

    get dbAdapter(): DatabaseAdapter {
        if (!this._dbAdapter) {
            throw new Error("ORMService not initialized");
        }
        return this._dbAdapter;
    }
}

const ormService = new ORMService();

export default ormService;
