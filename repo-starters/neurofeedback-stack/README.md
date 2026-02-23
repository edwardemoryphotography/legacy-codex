# neurofeedback-stack

> Real-time EEG and biometrics integration platform

## Overview

Unify Muse EEG ingestion, signal analysis, session telemetry, and CI-tested deployment flows.

## Project Status

- **Phase**: build-out bootstrap
- **Primary stack**: Python backend + web dashboard + Docker
- **First milestone**: Run end-to-end Muse stream -> processing -> dashboard with containerized local bring-up.

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
cd neurofeedback-stack
./scripts/bootstrap.sh
```

## Initial Build-Out Checklist

- [ ] Confirm module ownership for each top-level folder
- [ ] Add first executable vertical slice
- [ ] Add test coverage for core behavior
- [ ] Wire release/version cadence
