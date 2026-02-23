# Security Policy

## Supported Versions

Security fixes are applied to the latest active branch by default.

## Reporting a Vulnerability

If you discover a vulnerability:
1. Do not disclose it publicly in issues.
2. Use a private advisory workflow on GitHub if available.
3. Otherwise contact the maintainer account directly:
   - `edwardemoryphotography`

Please include:
- affected file/path,
- impact summary,
- reproduction steps,
- suggested mitigation (if known).

## Response Targets

- Initial acknowledgment: within 72 hours.
- Mitigation plan: within 7 days (target).

## Security Baseline for This Repo

- No plaintext secrets in version control.
- Governance docs required in root (`README`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`).
- Automation scripts should avoid unsafe runtime patterns and unnecessary network actions.
