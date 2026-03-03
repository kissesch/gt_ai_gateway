# 测试架构文档

## 概述

本文档描述测试环境的架构设计，包括测试框架、目录结构、数据隔离策略、Mock 服务器实现和全局生命周期配置。

---

## 测试框架与架构

### 技术栈

| 组件 | 选择 | 说明 |
|------|------|------|
| 测试运行器 | | Vitest (Vite 原生测试框架) |
| 断言库 | | Vitest 内置 (兼容 Jest 风格的 `expect`) |
| HTTP 客户端 | | `undici` (Node.js 推荐的 fetch 实现) |
| 覆盖率 | | V8 引擎提供代码覆盖率报告 |

### 测试目录结构

```
tests/
├── api/                          # API 接口测试
├── integration/                  # 集成测试
├── unit/                         # 单元测试
├── config.ts                     # 测试配置文件
├── fixtures/                     # 测试数据固件
├── globalSetup.ts                # 全局测试生命周期钩子
├── helpers/                      # 测试辅助函数
│   ├── db.ts                     # 数据库连接工具
│   ├── dbHelper.ts               # 数据库操作辅助
│   ├── mockHelper.ts             # Mock 数据生成器
│   ├── mockServer.ts             # Mock AI 服务器实现
│   └── requestHelper.ts          # HTTP 请求封装
└── testHelpers.ts                # 测试辅助函数导出入口
```

### 测试用例分类

```
测试分类
├── 单元测试
│   └── tests/unit/enhanced.test.ts
│
├── API 测试
│   ├── 正向测试
│   │   ├── User API 测试        tests/api/user/user.test.ts
│   │   ├── Vendor API 测试      tests:api/vendor/vendor.test.ts
│   │   ├── Model API 测试       tests/api/model/model.test.ts
│   │   ├── AI Chat API 测试     tests/api/ai/chat.test.ts, tests/api/ai/messages.test.ts
│   │   ├── Record API 测试      tests/api/record/record.test.ts
│   │   └── System API 测试     tests/api/system/system.test.ts
│   │
│   └── 异常测试
│       ├── User API 异常场景    tests/api/user/user.negative.test.ts
│       ├── Vendor API 异常场景  tests/api/vendor/vendor.negative.test.ts
│       ├── Model API 异常场景   tests/api/model/model.negative.test.ts
│       └── AI Chat API 异常场景 tests/api/ai/ai.negative.test.ts
│
└── 集成测试
    └── 端到端工作流测试          tests/integration/workflow.test.ts
```

### 测试覆盖范围

| 模块 | 测试内容 |
|------|----------|
| **User API** | 用户创建、列表查询、详情查询、token 生成、边界值处理 |
| **Vendor API** | 供应商创建、列表、详情、更新、删除、不同类型供应商配置 |
| **Model API** | 模型创建、列表、详情、更新、删除、供应商关联 |
| **AI Chat API** | OpenAI 格式聊天、Anthropic 格式消息、流式/非流式响应 |
| **Record API** | 使用记录查询、统计数据验证 |
| **System API** | 健康检查、系统状态查询 |
| **Integration** | 完整业务流程：创建用户 → 配置供应商 → 创建模型 → 调用 AI → 验证记录 |

---

## Mock AI 服务器

### 实现原理

Mock AI 服务器位于 `tests/helpers/mockServer.ts`，使用 Node.js 原生 `http` 模块实现，独立运行于默认端口 `9999`。

### 支持的 API 端点

| 端点 | 说明 |
|------|------|
| `/chat/completions` | 模拟 OpenAI API（支持流式/非流式响应、token 用量统计） |
| `/messages` | 模拟 Anthropic API（支持流式/非流式响应、SSE 事件格式） |

### 启动条件

由环境变量 `TEST_UPSTREAM_MOCK_ENABLED` 或 `UPSTREAM_CONFIG.mock.enabled` 控制，默认启用。

---

## 数据隔离策略

### 隔离机制

1. **测试文件级别隔离**：`fileParallelism: false` 确保所有测试文件顺序运行，避免数据库和端口冲突
2. **测试类级别隔离**：每个 `describe` 块开始时调用 `truncateDatabase()` 清空所有表
3. **测试数据自包含**：每个测试在 `beforeAll` 中创建所需的全部数据
4. **数据库重置**：测试文件之间不共享数据状态

### 典型测试数据流

```typescript
describe('AI Chat API', () => {
  beforeAll(async () => {
    // 1. 清空数据库
    await truncateDatabase()

    // 2. 创建测试用户
    const user = await post('/user/create.json', generateUser())
    testUserToken = user.body.token

    // 3. 创建供应商
    const vendor = await post('/vendor/create.json', VENDOR_FIXTURES.openai)
    vendorId = vendor.body.id

    // 4. 创建模型
    const model = await post('/model/create.json', createRandomModel(vendorId, 'gpt-3.5-turbo'))
    modelName = model.body.name
  })

  it('should handle chat request', async () => {
    // 5. 使用创建的数据进行测试
    const response = await post('/v1/chat/completions', { model: modelName }, testUserToken)
    expect(response.status).toBe(200)
  })
})
```

---

## 全局生命周期

### 配置 (vitest.config.ts)

```typescript
globalSetup: ['./tests/globalSetup.ts'],
pool: 'forks',
fileParallelism: false,  // 所有测试文件顺序运行，避免数据库和端口冲突
```

### Setup 阶段 (开始所有测试前)

1. 删除旧的数据库文件（如果存在，避免残留数据干扰）
2. 创建新数据库文件并运行 migrations（创建表结构）
3. 启动 mock AI 服务器（可选）
4. 启动测试服务器（本地 API 服务器，等待 12 秒）

### Test Execution 阶段 (运行所有测试)

- 测试按 `.test.ts` 文件顺序执行
- 每个测试文件内部按 `describe` 和 `it` 顺序执行
- 每个测试类（describe 块）开始时自动清理所有数据表
- 数据记录在测试用例中通过 API 调用创建，由每个测试用例自行负责
- 测试类之间数据隔离，互不影响

### Teardown 阶段 (所有测试结束后)

1. 停止测试服务器
2. 停止 mock AI 服务器（如果已启动）
3. 删除所有数据库表（可选，由 `TEST_CLEANUP` 控制）
4. 删除数据库文件（可选，由 `TEST_CLEANUP` 控制）

---

## 关键流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Setup 阶段                              │
├─────────────────────────────────────────────────────────────────┤
│  1. 删除旧数据库文件 (如果存在)                                  │
│  2. 创建数据库文件 + 运行 migrations                            │
│  3. 启动 Mock AI 服务器 (可选)                                   │
│  4. 启动测试服务器 (等待 12 秒)                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Test Execution Execution 阶段               │
├─────────────────────────────────────────────────────────────────┤
│  [system.test.ts] → [user.test.ts] → [vendor.test.ts] → ...   │
│                                                                   │
│  每个测试类 (describe 块)：                                      │
│    1. beforeAll: 调用 truncateDatabase() 清空所有数据表          │
│    2. beforeAll: 创建测试所需的基础数据 (vendor, user 等)        │
│    3. 执行测试用例 (it 块)                                       │
│    4. 测试用例自行创建/验证数据                                  │
│                                                                   │
│  测试类之间数据完全隔离，互不影响                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Teardown 阶段                              │
├─────────────────────────────────────────────────────────────────┤
│  1. 停止测试服务器                                                │
│  2. 停止 Mock AI 服务器 (如果已启动)                              │
│  3. [可选] 删除所有数据库表                                      │
│  4. [可选] 删除数据库文件                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 注意事项

1. **顺序执行**：`fileParallelism: false` 确保所有测试文件顺序运行，避免数据库和端口冲突

2. **数据隔离**：每个测试类开始时自动清空数据表，测试类之间数据完全隔离，测试用例需要自行创建所需数据

3. **Cleanup 配置**：默认会清理数据库，可通过 `TEST_CLEANUP=false` 保留数据用于调试

4. **服务器启动等待**：测试服务器启动后固定等待 12 秒，确保服务器完全就绪
