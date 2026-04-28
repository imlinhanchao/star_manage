# star_manage

A pure frontend web app to manage your GitHub starred repositories.

## Features

- 🔑 **GitHub Token Auth** — Enter your Personal Access Token to access your stars. Token is stored securely in `localStorage`.
- ⭐ **Browse Starred Repos** — View all your starred repositories with pagination support.
- 🔀 **Sorting** — Sort by Star Time, Update Time, or Star Count in ascending or descending order.
- 📋 **Lists** — Organize repos into custom named lists (stored in `localStorage`).
- ✖️ **Unstar** — Remove a star from any repo directly from the app.
- 🌙 **Dark Mode** — Toggle between light and dark themes.
- 🔍 **Filter** — Filter repos by name or description on the current page.

## Tech Stack

- **Vue 3** + **Vite** — Reactive frontend framework
- **UnoCSS** — Instant atomic CSS engine (icons via `@iconify-json/mdi`)
- **DaisyUI v4** + **Tailwind CSS v3** — Component library with theming

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and enter your GitHub Personal Access Token.

### Generating a Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens/new?scopes=public_repo,user&description=star_manage)
2. Grant `public_repo` and `user` scopes (add `repo` for private repos)
3. Copy and paste the token into the app

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
