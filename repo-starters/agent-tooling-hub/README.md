# agent-tooling-hub

> Agent interfaces and artifact capture utilities

## Overview

Consolidate CLI, browser-terminal bridge, and screenshot/artifact capture into one tooling surface.

## Project Status

- **Phase**: build-out bootstrap
- **Primary stack**: TypeScript/Python CLI + browser bridge tooling
- **First milestone**: Provide a unified command runner and artifact capture pipeline with clear upstream delta notes.

## Repository Standards

This repository follows a mandatory baseline:
- `CHANGELOG.md` for version history
- `CONTRIBUTING.md` for contributor workflow
- `SECURITY.md` for vulnerability reporting
- `.github/workflows/repo-standards.yml` for baseline CI checks
- `.github/pull_request_template.md` and issue templates
- `docs/` tree for architecture, decisions, runbooks, and roadmap

## Quickstart

```bash
git clone <repo-url>
cd agent-tooling-hub
./scripts/bootstrap.sh
```

## Initial Build-Out Checklist

- [ ] Confirm module ownership for each top-level folder
- [ ] Add first executable vertical slice
- [ ] Add test coverage for core behavior
- [ ] Wire release/version cadence
