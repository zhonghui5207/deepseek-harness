# Agent Note: Final-payload output-cap omission for strict Responses gateways

Status: implemented

English | [中文](2026-08-14-pi-ai-final-payload-output-cap-omission.zh.md)

## Problem

Some OpenAI Responses-compatible gateways route selected models to a target backend with a strict request allowlist that rejects `max_output_tokens`. Harness request producers regularly supply `GenerateOptions.maxTokens`, and pi-ai's `streamSimple()` also restores an absent value from `Model.maxTokens`, so removing the option before adapter dispatch cannot remove the final wire field. Every conversation and auxiliary request to such a model fails with 400 even though the same gateway and model work when the field is absent.

The compatibility rule is model-specific. One declared route may serve the strict backend beside models whose providers accept and enforce `max_output_tokens`, so a route-wide omission would discard valid caps from unrelated requests.

## Decision

The [declared-provider catalog](../architecture/2026-08-03-pi-ai-declared-provider-catalog.md) exposes `PiAiModelProfile.omitMaxOutputTokens`. Resolution accepts `true` only for a model whose effective API is `openai-responses`, records that model id in the immutable resolved profile, and omits its configured `maxTokens` from the adapter's advertised request default. `Model.maxTokens` remains the output capacity used by pi-ai's context calculation.

`PiAiAdapter.stream()` installs pi-ai's `onPayload` hook only for a recorded model. The hook removes `max_output_tokens` after `streamSimple()` has built the final JSON body, so it covers caller-supplied caps, adapter defaults, session-title limits, compaction limits, and pi-ai's fallback to `Model.maxTokens`. Other models retain ordinary serialization.

## Alternatives considered

**Strip `GenerateOptions.maxTokens` through the `llm/stream` waterfall.** This runs before `streamSimple()`, which replaces the missing value from `Model.maxTokens`; the final payload still carries `max_output_tokens`.

**Infer strict behavior from a gateway URL or model id.** Endpoint ownership and compatibility are deployment facts. Hardcoded recognition would silently change behavior when a proxy moves or serves the same id through another backend.

**Patch the observed gateway alone.** Gateway-side stripping fixes one installation but leaves the adapter unable to describe another strict Responses endpoint. The per-model declaration keeps the compatibility decision with the route configuration and remains independently testable.

## Consequences

An opted-in model cannot enforce a Harness output-token cap; the provider owns output length. The model still reports its context capacity and output capability, while `resolveModelInfo()` exposes no default output cap that the adapter cannot send. Setting the flag on another protocol fails profile resolution rather than becoming a no-op.

## Verification

Transport coverage sends two models through a real local Responses endpoint and proves the opted-in request omits `max_output_tokens` while its sibling keeps the explicit cap. Catalog and schema coverage pin protocol validation, per-model resolution, and the absence of an advertised request default.
