# 请求记录时间字段序列化修复

## 问题现象

请求记录页新增 `Token` 和 `时间` 列后，页面出现了明显异常的耗时显示：

- 实际应为 `3479ms`
- 页面显示成了 `3479000ms`

首 Token 延迟显示正常，说明问题只出在 `start_at` 和 `end_at` 的总耗时计算链路。

## 根因分析

数据库里的 `record.start_at` 和 `record.end_at` 实际存的是 **Unix 毫秒时间戳**，例如：

```text
start_at = 1773512219322
end_at   = 1773512222801
```

理论耗时应为：

```text
1773512222801 - 1773512219322 = 3479ms
```

但 `SgRecord` 模型中配置了：

```ts
casts = {
    start_at: "datetime",
    end_at: "datetime",
};
```

这会导致 `sutando` 在 `toData()` 时把毫秒时间戳按 `datetime` 序列化成错误的超远未来时间，例如：

```json
"start_at": "+058170-05-13T19:08:42.000Z",
"end_at": "+058170-05-13T20:06:41.000Z"
```

前端收到这类错误 ISO 时间后再做差值，结果被放大为原本的 `1000` 倍。

## 为什么不能直接删除 cast

`SgRecord` 上的 `datetime cast` 不能直接移除。

原因是项目同时支持 Node 和 Worker 环境，Worker 侧依赖现有 ORM 行为；直接改模型层可能引入兼容性问题，属于高风险修改。

因此修复策略不能放在 model 层，而应放在 **API 返回层**。

## 最终修复方案

在 `src/controller/recordController.ts` 中新增统一序列化逻辑：

1. 先调用 `record.toData()` 获取默认序列化结果
2. 再调用 `record.getAttributes()` 读取模型原始字段
3. 用原始 attributes 中的 `start_at/end_at` 覆盖 `toData()` 里的错误值
4. 对 `Date` 保持 ISO 输出，对 number 保持原始毫秒值输出

核心思路：

```ts
function serializeRecord(record: SgRecord) {
    const data = record.toData();
    const rawAttributes = record.getAttributes?.();

    return {
        ...data,
        start_at: rawAttributes?.start_at ?? data.start_at,
        end_at: rawAttributes?.end_at ?? data.end_at,
    };
}
```

并在以下接口统一使用该序列化方法：

- `GET /record/list.json`
- `GET /record/latest.json`
- `GET /record/:id`

## 前端兼容处理

前端表格组件同时兼容两类时间输入：

- 毫秒时间戳
- ISO / 普通日期字符串

格式化逻辑会先判断是否为纯数字字符串或 number，再决定按时间戳还是日期解析，从而避免不同环境返回格式不一致时再次出现计算错误。

## 验证结果

修复后，接口返回：

```json
"start_at": 1773512219322,
"end_at": 1773512222801
```

页面显示恢复正常：

- `3,479ms`
- `4,336ms`
- `5,468ms`

Chrome 实测确认请求记录页展示正确。
