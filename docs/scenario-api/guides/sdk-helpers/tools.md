---
title: Tools | Scenario Docs
description: Standalone utilities shipped under dedicated @scenario-labs/sdk/tools/* subpaths.
---

Beyond the [enhanced resource methods](/sdk-helpers/index.md), the SDK ships a small set of **standalone tools** under dedicated `@scenario-labs/sdk/tools/*` subpaths. Unlike the enhanced resources, these are **not attached to the `client` instance** and are **not part of the default entry point** — you import each one explicitly from its own subpath.

They exist so that shared logic (e.g. expression evaluation) behaves identically across the Scenario backend, frontend, and MCP server.

## Available tools

| Tool                                             | Import                         | Purpose                                                                                            |
| ------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| [CEL Utilities](/sdk-helpers/tools/cel/index.md) | `@scenario-labs/sdk/tools/cel` | Shared CEL (Common Expression Language) evaluation environment for workflow transform expressions. |
