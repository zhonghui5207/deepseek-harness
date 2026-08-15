# Agent Note: 共享启动器 profile overlay 放在 dsh-app-boot

Status: implemented

[English](2026-08-15-shared-launcher-profile-overlays.md) | 中文

## 问题

`dsh` 与 Desktop 都会在空根上启动指名 profile，再叠加同类启动器 overlay：home 级 `$DSH_HOME/cordis.patch.yml`、对 `agent-presets` 系统根的改写，以及 `DSH_TELEMETRY_DISABLED` 硬性退出。这些 helper 原先写在 `apps/cli/src/profile-boot.ts` 里，因此 Desktop 复制了 `homePatchPath` 和 preset 根改写，为了查找 roster 行而重新组合整份 patch 栈，并且从未应用遥测 overlay。

[默认挂载决策](../feature/2026-07-31-web-telemetry-default-mount.md) 要求硬性退出在 Loader 构造之前生效。Desktop 冒烟测试和 CI 会设置 `DSH_TELEMETRY_DISABLED=1`，但没有启动器 patch 时该环境变量并不会禁用配置行。默认 `DISABLED` 模式掩盖了这一缺口，直到部署方选择 `FULL` 或 `FEEDBACK_ONLY` 才会暴露。

## 决策

每个 profile 启动都共享的启动器 overlay helper 放在 [`@deepseek-ai/dsh-app-boot`](../../../../packages/boot/app-boot/README.md)：

- `PROFILE_ROOT_FILENAME` 与 `homePatchPath()` 命名空根配置和 home 级用户 patch。
- `indexComposedRows()` 在空根上应用各层后，按组合后的配置项 id 建立索引。
- `shippedAgentPresetOverlay(rows, root)` 在存在 `agent-presets` 行时改写其系统根；各启动器自行提供安装路径。
- `TELEMETRY_ROW_ID` 与 `resolveTelemetryPatch()` 在组合结果包含 `session-telemetry-otel` 时，把任何非空的 `DSH_TELEMETRY_DISABLED` 转成禁用 overlay。

`dsh` 仍持有 `--patch` 文件、实时 `watchUserPatches`、进程信号，以及紧邻 CLI 的 preset 目录。Desktop 仍持有回环 webserver overlay、从 `@deepseek-ai/dsh` 解析 preset 根、随附 preset 校验，以及 Electron 生命周期。两者按相同层序调用共享 helper：组合包、profile patch、home patch、启动器 overlay，然后是 preset 根与遥测。

ACP demo 不启动 profile，也不应用这些 overlay。

## 曾考虑的替代方案

**把 helper 留在 `apps/cli`，由 Desktop 导入。** 拒绝：Desktop 会依赖 CLI 应用包，把一个产品启动器混进另一个产品启动器，而且 CLI 包并不是库约定。

**抽出双方都调用的完整 `composeProfile()`。** 拒绝：Desktop 没有 `--patch` 文件或 HMR 重组合，并且在缺少 `agent-presets` 时必须明确失败；把这些差异折进一份 options 对象，会掩盖 [Desktop 外壳决策](2026-08-14-electron-desktop-shell-and-distribution.md) 已经记录的归属划分。

**因默认模式是 `DISABLED` 而不给 Desktop 加遥测 overlay。** 拒绝：CI 和冒烟测试已经设置硬性退出，启用 `DSH_TELEMETRY_MODE` 的 Desktop 用户必须获得与 `dsh` 相同的加载前禁用。

## 影响

- `dsh` 与 Desktop 不会在 home patch 路径、遥测硬性退出或 preset 根 overlay 构造上发生漂移。
- 当 `DSH_TELEMETRY_DISABLED` 非空（含 `'0'` 与 `'false'`）时，Desktop 会在 Loader 挂载前禁用 `session-telemetry-otel`。
- 第三个 profile 启动器通过调用这些 helper 添加 overlay，而不是复制 CLI 启动逻辑。
- ACP demo 仍在此约定之外，因为它不组合 profile。

## 测试

`packages/boot/app-boot/tests/profile.spec.ts` 固定 `homePatchPath`、`resolveTelemetryPatch`、`indexComposedRows` 和 `shippedAgentPresetOverlay`。`apps/desktop/tests/boot.spec.ts` 固定 Desktop 的回环、preset 根与遥测 overlay 顺序，包括缺少 roster 时的失败。
