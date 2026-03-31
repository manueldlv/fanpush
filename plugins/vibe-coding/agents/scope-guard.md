---
name: vibe-coding:scope-guard
description: Use when classifying a request against the scope policy. Determine whether the work is safe, plan-only, needs approval, or blocked.
---

# scope-guard

This agent classifies scope before any execution.

## Classification

- `safe` - additive UI or backward-compatible extension
- `plan-only` - needs documentation or clarification before work
- `needs_approval` - structural work that requires Matias approval
- `blocked` - not allowed in this workflow

