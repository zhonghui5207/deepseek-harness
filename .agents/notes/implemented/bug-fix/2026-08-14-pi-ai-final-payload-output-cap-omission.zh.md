# Agent Note: 严格 Responses 网关在最终 payload 省略输出上限

Status: implemented

[English](2026-08-14-pi-ai-final-payload-output-cap-omission.md) | 中文

## Problem

部分兼容 OpenAI Responses 的网关会把特定模型路由到采用严格请求白名单的目标后端，而该后端拒绝 `max_output_tokens`。Harness 的请求生产方通常会提供 `GenerateOptions.maxTokens`，pi-ai 的 `streamSimple()` 还会从 `Model.maxTokens` 恢复缺省值，因此在适配器分派前删除该选项无法移除最终协议字段。即使同一网关与模型在字段缺席时可以工作，所有发往该模型的会话请求和辅助请求仍会以 400 失败。

这条兼容规则归属于模型。同一条声明路由可以同时服务严格后端，以及其提供方接受并执行 `max_output_tokens` 的模型；在整条路由上省略字段会丢弃其他请求的有效上限。

## Decision

[声明式提供方 catalog](../architecture/2026-08-03-pi-ai-declared-provider-catalog.md)公开 `PiAiModelProfile.omitMaxOutputTokens`。只有模型的有效 API 为 `openai-responses` 时，解析才接受 `true`，并把该模型 id 记录在不可变的已解析 profile 中，同时不再把它配置的 `maxTokens` 公开为适配器请求默认值。`Model.maxTokens` 仍是 pi-ai 进行上下文计算时使用的输出能力。

`PiAiAdapter.stream()` 只为已记录的模型安装 pi-ai `onPayload` 钩子。该钩子会在 `streamSimple()` 构造最终 JSON 请求体后删除 `max_output_tokens`，因此调用方给出的上限、适配器默认值、会话标题上限、压缩上限，以及 pi-ai 对 `Model.maxTokens` 的回退都会被覆盖。其他模型保持普通序列化行为。

## Alternatives considered

**通过 `llm/stream` waterfall 删除 `GenerateOptions.maxTokens`。** 该操作发生在 `streamSimple()` 之前，而后者会从 `Model.maxTokens` 补回缺失值；最终 payload 仍会携带 `max_output_tokens`。

**根据网关 URL 或模型 id 推断严格行为。** 端点归属和兼容性是部署事实。硬编码识别会在 proxy 迁移或通过另一后端服务同一 id 时静默改变行为。

**只修补当前观察到的网关。** 网关侧删除可以修复一套安装，却仍使适配器无法描述另一个严格 Responses 端点。按模型声明让兼容决策留在路由配置中，并可独立测试。

## Consequences

选择加入的模型无法执行 Harness 输出 token 上限；输出长度由提供方负责。模型仍会报告其上下文容量和输出能力，而 `resolveModelInfo()` 不会公开适配器无法发送的默认输出上限。在其他协议上设置该开关会使 profile 解析失败，而不是成为无操作。

## Verification

传输覆盖让两个模型通过真实的本地 Responses 端点，并证明选择加入的请求省略 `max_output_tokens`，其同路由模型仍保留显式上限。Catalog 与 schema 覆盖固定协议校验、按模型解析，以及不公开请求默认值的行为。
