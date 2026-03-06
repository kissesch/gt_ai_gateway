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

    async connectCloud(db: any) {
        if (this._dbAdapter instanceof D1Adapter) {
            this._dbAdapter.setDB(db);
        }

        if (!this._cloudConnected) {
            const ClientD1 = (await import("knex-cloudflare-d1")).default;

            // === Date 类型写入补丁（仅 worker/cloud 模式需要）===
            //
            // 【背景】SQLite 和 D1 本身都没有原生 Date 类型，日期以文本形式存储。
            // 但两种运行模式的 knex driver 对 Date 对象的处理方式不同：
            //
            // - node 模式（better-sqlite3 driver）：
            //   knex 内置了 _formatBindings()，会在绑定参数前将 Date 对象转为
            //   数值（valueOf() = 毫秒时间戳），better-sqlite3 底层再将其存为整数。
            //   读出时 sutando 的 getDates()/casts 通过 asDateTime() → new Date(value)
            //   自动还原为 Date 对象，业务代码感知不到差异。
            //
            // - worker 模式（knex-cloudflare-d1 driver）：
            //   该 driver 继承自 Client_Sqlite3，但没有实现 _formatBindings()，
            //   bindings 直接透传给 D1 的 prepare().bind() API。
            //   而 D1 的 bind() 只接受 string | number | null，传入 Date 对象会报错。
            //
            // 【读出方向无需补丁】
            //   D1 读出的始终是原始字符串，sutando 在 getAttribute 时统一处理：
            //   - created_at / updated_at：由 getDates() 自动识别，走 asDateTime()
            //   - start_at / end_at：在 SgRecord.casts 中声明为 "datetime"，同样走 asDateTime()
            //   asDateTime() 内部直接 new Date(value)，字符串和数值都能正确解析。
            //
            // 【补丁方案】在 _query 执行前拦截 bindings，将 Date 对象转为 ISO 字符串，
            // 与 sutando 写入 created_at/updated_at 时的格式保持一致。
            const originalQuery = ClientD1.prototype._query;
            ClientD1.prototype._query = async function(connection: any, obj: any) {
                if (obj.bindings) {
                    obj.bindings = obj.bindings.map((b: any) =>
                        b instanceof Date ? b.toISOString() : b
                    );
                }
                return originalQuery.call(this, connection, obj);
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
