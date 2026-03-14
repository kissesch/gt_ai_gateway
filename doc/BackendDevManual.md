# 后端开发手册

本文档描述如何进行后端项目开发，包括环境配置、后端架构、开发规范等。

---

## 后端技术栈

| 部分 | 技术栈 | 说明 |
|------|--------|------|
| **后端框架** | Hono + TypeScript | 轻量级 Web 框架 |
| **运行时** | Cloudflare Workers / Node.js | 无服务器 / 本地运行 |
| **数据库** | D1 (Cloudflare) / SQLite | 生产 / 开发环境 |
| **ORM** | Sutando | 统一数据库操作接口 |

## 后端项目结构

```
.
├── src/                   # 后端源代码
│   ├── controller/        # 控制器层
│   ├── middleware/        # 中间件
│   ├── model/            # 数据模型
│   ├── service/          # 服务层
│   ├── constants.ts      # 常量定义
│   ├── routes.ts         # 路由配置
│   └── local.ts          # 本地服务器入口
├── tests/                # 测试目录
├── resource/migrate/     # 数据库迁移文件
├── script/              # 工具脚本
├── wrangler.toml        # Cloudflare Workers 配置
└── package.json         # 项目依赖
```

---

## 环境配置

### 前置要求

- Node.js (推荐 v20+)
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
npm install
```

### 环境变量配置

在项目根目录创建 `.dev.vars` 文件（用于 Wrangler 本地开发）：

```bash
# .dev.vars
ROOT_TOKEN=your-admin-token-here
PORT=8787
```

---

## 后端开发

### 启动开发服务器

#### Node 模式（本地开发）

```bash
npm run backend:dev:local
```

Node 模式使用本地 SQLite 数据库，运行在 `http://localhost:8787`

#### 前后端联合开发建议

1. **开发前端**：启动后端服务后，再启动前端开发服务器（`npm run frontend:dev`）。
2. **测试集成产物**：如果后端需要提供前端静态资源服务，必须先运行前端构建：`npm run frontend:build`。构建后的产物将被放置在 `frontend/dist/` 目录，后端会从中读取并提供服务。

#### Cloudflare Workers 模式

```bash
npm run backend:dev
```

Wrangler 会启动本地开发服务器，模拟 Cloudflare Workers 环境

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run backend:dev` | Cloudflare Workers 开发模式 |
| `npm run backend:dev:local` | Node 本地开发模式 |
| `npm run backend:start` | Node 生产模式 |
| `npm run backend:deploy` | 部署到 Cloudflare Workers |
| `npm run backend:test` | 运行后端测试 |

## 数据库配置与管理

### 数据库类型

| 环境 | 数据库 | 说明 |
|------|--------|------|
| **本地模式 (Node.js)** | SQLite (`better-sqlite3`) | 本地文件存储 |
| **云端模式 (Cloudflare)** | Cloudflare D1 | 分布式 SQL 数据库 |

### 数据库管理工具

项目提供 `script/db.ts` 脚本用于数据库运维，支持以下命令和环境：

#### 命令

| 命令 | 说明 |
|------|------|
| `migrate` | 执行待应用的数据库迁移 |
| `status` | 查看所有迁移文件的应用状态 |
| `clear` | 清空数据库（删除所有自定义表） |

#### 环境（`--env`）

| 环境 | 说明 |
|------|------|
| `local`（默认） | 本地 Node.js 环境，操作 `local.db` |
| `worker-local` | Wrangler 本地 D1 模拟器 |
| `worker-cloud` | Cloudflare D1 云端数据库 |

#### 使用示例

```bash
# 执行迁移（local 环境）
npm run db:migrate:local

# 查看迁移状态
npm run db:status:local

# 清空数据库
npm run db:clear:local

# 指定 worker 环境
npx tsx script/db.ts migrate --env worker-local
npx tsx script/db.ts migrate --env worker-cloud
```

### 本地模式数据库路径

在本地 Node.js 模式运行或使用 `script/db.ts` 脚本时，数据库位置遵循以下规则：

1.  **优先级 1**: 环境变量 `DB_PATH`（支持绝对路径或相对路径）。
2.  **优先级 2**: 默认为项目根目录下的 `local.db` 文件。

#### 修改数据库位置

你可以通过在 `.dev.vars` 文件中设置 `DB_PATH` 来修改位置：

```bash
# .dev.vars
DB_PATH=/path/to/your/custom.db
```

---

## 部署说明

### Cloudflare Workers 部署

#### 开发模式
```bash
# 启动 Cloudflare Workers 本地开发环境
npm run backend:dev
```

#### 部署到生产环境
```bash
# 部署到 Cloudflare Workers
npm run backend:deploy
```

### Docker 部署

#### 使用 Docker Compose

创建 `.env` 文件配置环境变量：

```bash
ROOT_TOKEN=your-secret-root-token
PORT=8787
DB_PATH=/app/data/local.db
```

启动服务：
```bash
docker-compose up -d
```

#### 使用 Docker 直接构建和运行

```bash
# 构建镜像
docker build -t serverless_ai_gateway .

# 运行容器
docker run -d \
    --name serverless_ai_gateway \
    -p 8787:8787 \
    -v $(pwd)/data:/app/data \
    -e ROOT_TOKEN=your-secret-root-token \
    serverless_ai_gateway
```

#### 使用 Docker Hub

```bash
# 拉取最新镜像
docker pull alexazhou/serverless_ai_gateway:latest

# 运行容器
docker run -d \
    --name serverless_ai_gateway \
    -p 8787:8787 \
    -v $(pwd)/data:/app/data \
    -e ROOT_TOKEN=your-secret-root-token \
    alexazhou/serverless_ai_gateway:latest
```

---

## 核心架构与规范

### MVC 架构

项目遵循 MVC 架构模式：

- **Model**: `src/model/` - 数据模型和计算逻辑
- **View**: (前端部分)
- **Controller**: `src/controller/` - 处理 HTTP 请求和响应
- **Service**: `src/service/` - 核心业务逻辑

### 资源服务说明

Node 模式下，后端服务器可以提供前端构建后的静态文件：

1. **静态文件目录**：从 `frontend/dist/` 提供
2. **SPA 支持**：非 API 请求会自动回退到 `index.html`

### 开发规范

详见 `GEMINI.md`，核心规范如下：

1. **代码缩进**：使用 4 个空格，方法之间空两行
2. **模块划分**：
   - 业务逻辑 → service 层
   - controller 层 → 简单逻辑 + 调用 service
   - model 层 → 数据模型和计算逻辑
3. **API 风格**：REST 风格，URL 以 `.json` 结尾
4. **导出方式**：统一使用默认导出

### 添加新 API 步骤

1. **定义路由**：在 `src/routes.ts` 中添加路由
2. **创建 Controller**：在 `src/controller/` 中创建处理函数
3. **创建 Service**：在 `src/service/` 中实现业务逻辑
4. **定义 Model**（如需）：在 `src/model/` 中创建数据模型

---

## 相关文档

- **LLM API 使用指南**：`doc/LlmApiUsage.md`
- **前端开发手册**：`doc/FrontendDevManual.md`
- **测试手册**：`doc/TestManual.md`
- **编程规范**：`GEMINI.md`
