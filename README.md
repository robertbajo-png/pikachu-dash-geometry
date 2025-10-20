# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/d8079354-cc29-4cbf-a890-64ce6df9428b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d8079354-cc29-4cbf-a890-64ce6df9428b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## How do I test the Pikachu Dash game locally?

Once the dependencies are installed, you can playtest the game locally with the
development server:

1. Start the dev server (if it is not already running). You can still launch it
   directly, or use the convenience runner that chooses the right mode for you:
   ```bash
   # shorthand helper that defaults to the local dev server
   npm run run
   # force the hosted variant (equivalent to npm run dev:host)
   npm run run --host
   # ...or, if you prefer the explicit npm argument separator
   npm run run -- --host
   ```
   The helper also understands `--build` and `--preview` flags if you want to
   chain into a production-style test without memorising the underlying npm
   scripts. Run `npm run run -- --help` (or `npm run run --help` in newer npm
   releases) at any time to see the available modes
   and the optional `RUN_GAME_HOST` environment toggle.
   You can also pin the dev port or enforce exclusivity without the separator.
   For example, `npm run run --port 5173` and `npm run run --strictPort` are
   forwarded directly to Vite, and the explicit script variant
   `npm run dev -- --strictPort --port 5173` still works if you prefer to call
   the underlying command yourself.
   Both dev flavours keep their logs visible by default (`--clearScreen false`).
   If you prefer the old behaviour, append `-- --clearScreen true` to the
   command you launch.
2. By default, the banner shows the localhost URL
   (for example, `Local:   http://localhost:5173`). If you need to share the
   session across your LAN, run the hosted variant (`npm run run --host`,
   `npm run dev:host`, or `VITE_HOST=0.0.0.0 npm run dev`) so Vite advertises
   both the local and network addresses. Use whichever address matches your
   playtesting setup.
3. The page hot-reloads automatically as you tweak code, so you can iterate on
   mechanics like the shield power-up in real time.

If you want to test a production build instead, run `npm run run -- --build`
followed by `npm run run -- --preview` and open the preview URL that Vite prints
in the terminal.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d8079354-cc29-4cbf-a890-64ce6df9428b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
