# Security Policy

## Supported Versions

Security fixes are currently applied to the latest code on the `main` branch.

| Version | Supported |
| --- | --- |
| Latest `main` | Yes |
| Older commits and forks | No |

This project is an open-source test platform. Deployments may differ depending
on configuration, Supabase policies, hosting, and environment variables.

## Reporting a Vulnerability

Please do not report security vulnerabilities in public GitHub issues,
discussions, or pull requests.

If GitHub Security Advisories are enabled for this repository, use the
**Report a vulnerability** option under the repository's **Security** tab.
Otherwise, contact the repository maintainer privately through GitHub before
disclosing the issue publicly.

Include, where possible:

- A clear description of the vulnerability and its impact
- The affected route, file, component, or configuration
- Reproduction steps or a minimal proof of concept
- Any relevant logs, screenshots, or request details
- A suggested fix, if you have one

Please avoid including real passwords, session cookies, Supabase keys, service
role keys, or other private data in a report.

We will acknowledge valid reports as soon as practical, investigate them, and
coordinate a fix or disclosure timeline with the reporter. Please allow time
for remediation before making a vulnerability public.

## Security Expectations for Deployments

Do not commit `.env` files or real credentials. Keep these values server-side:

- `SUPABASE_SERVICE_KEY`
- `SESSION_SECRET`
- ImageKit private credentials

Deployments should:

- Run behind HTTPS with `NODE_ENV=production`
- Use a strong `SESSION_SECRET` of at least 32 characters
- Keep Supabase RLS enabled on every application table
- Keep direct `anon` and `authenticated` table access denied unless the policy
  model is intentionally redesigned
- Use a shared, persistent session store instead of the default in-memory
  session store when running more than one production instance
- Keep dependencies and `package-lock.json` up to date

## Built-in Protections

Tommy's Club currently includes CSRF tokens for state-changing requests,
secure session cookie settings, Helmet security headers, login and registration
rate limits, sanitized rich-text rendering, validated image uploads, ownership
checks, and one-time WebSocket authentication tokens.

These protections reduce risk but do not replace secure deployment, database
backups, access control review, or dependency maintenance.
