# Alfred

An honest early-career job copilot. Alfred scans the market overnight and hands you a short, curated brief of roles you genuinely qualify for, plus a tailored resume that never fabricates anything you have not done.

**Live: [alfred.app.space](https://alfred.app.space)** · MIT · Built on the [DeepSpace SDK](https://docs.deep.space)

## Quick start

Deploy your own copy in three commands:

```sh
npm install
npx deepspace login     # one-time, opens a browser tab
npx deepspace deploy    # → <name>.app.space
```

Auth, the database, cron, background jobs, file storage, AI, and hosting all come from DeepSpace, so there is nothing else to configure. Your subdomain is the `name` field in `wrangler.toml`; change it for your own deployment.

Run it locally instead:

```sh
npm install
npx deepspace login
npx deepspace dev       # http://localhost:5173
```

## Commands

| Command | What it does |
|---|---|
| `npx deepspace dev` | Local dev server (Vite + Worker, HMR on `:5173`) |
| `npx deepspace deploy` | Deploy to `<name>.app.space` |
| `npx deepspace test` | Playwright smoke + API/E2E specs |
| `npm run test:unit` | Unit tests (vitest) |
| `npm run type-check` | `tsc --noEmit` |

## Features

- **Morning brief.** A short, ranked list of roles worth your time, delivered each morning instead of an endless board you have to sift.
- **Honest matching.** Every role is judged for real fit against your profile. Alfred labels each one (a fit, a stretch, or a skip) and says in one sentence why, including the gaps. No inflated scores.
- **Tailoring that never lies.** For any role, Alfred generates a tailored resume, then verifies every line against your real history and regenerates anything that does not check out. It will not invent skills, numbers, or titles. The output is a clean one-page ATS-friendly PDF (and `.docx`), with an optional cover letter in your own voice.
- **Tracker.** A simple kanban board to move roles from saved to applied to interview, with your tailored documents attached.
- **Digest.** A daily or weekly email summary of new matches, on your chosen cadence.

Alfred never applies for you. It prepares everything up to the submit button; you make the final call.

## How it works

A DeepSpace app on Cloudflare Workers.

- **Shared job pool.** A cron-triggered ingest, run as background Jobs to stay under the Worker subrequest ceiling, pulls openings from free public sources into one shared pool. Roles are deduplicated and normalized once, for everyone.
- **Per-user matching.** Each user's profile (built from a resume upload, the onboarding flow, or direct edits) is scored against the pool. Matching runs server-side per user, so a verdict is honest and specific to that person.
- **Verify-loop tailoring.** The tailor pipeline drafts, then checks each claim back against the user's profile, then regenerates failures before rendering the final PDF, `.docx`, and cover letter. The verify step is what keeps the output truthful.

Profiles, matches, applications, and generated documents live in DeepSpace record collections with per-collection access rules, so a user only ever reads their own data.

## Tests

- **Unit tests** (vitest): matchers, scoring, the tailor verify loop, document rendering, and digest helpers.
- **E2E** (Playwright): landing, onboarding, the brief, the tailor workspace, the tracker, and digest send, run against the live pool with a fictional demo profile.

## License

MIT, see [LICENSE](LICENSE). Built with the [DeepSpace SDK](https://docs.deep.space).
