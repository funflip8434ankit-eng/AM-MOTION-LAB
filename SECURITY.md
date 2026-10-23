# Security and recovery notes

## Reporting an issue

Please report suspected vulnerabilities privately to the site owner at
`funflip8434ankit@gmail.com`. Do not include live API keys, passwords, OTPs,
or payment credentials in a public issue.

## Response checklist

1. Restrict or disable the affected integration in its provider dashboard.
2. Rotate affected secrets in the provider and Render environment settings.
3. Review Render, GitHub, Razorpay, Google, and database logs for unusual activity.
4. Redeploy the corrected code and confirm `/health`, sign-in, course access, and
   payment webhook behavior in test mode.
5. If data may have been changed or lost, pause writes and restore the latest
   verified PostgreSQL backup before reopening access.
6. Record the incident, actions taken, and any users or providers that need notice.

## Backups

Database backup creation and restoration are provider-side tasks. Configure
scheduled PostgreSQL backups in the database provider, keep an independent copy
where practical, and periodically restore one into a separate non-production
database. Record the last successful backup and restore check before launch.

## Deployment checks

- Keep all credentials in Render environment variables or local ignored `.env`
  files. Rotate a credential immediately if it appears in a commit or log.
- Use Razorpay test mode for checkout verification; never test with a real
  customer's payment details.
- Set `PUBLIC_SITE_ORIGIN` when the website uses a custom production domain.
- Review CSP violations when adding a new third-party script, font, frame, or
  API. Static page CSP allows inline scripts/styles for the current legacy pages.
- Enable GitHub Dependabot alerts and code scanning in repository settings.
- Ensure GitHub Pages enforces HTTPS and use HTTPS for all production origins.
