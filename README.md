# Stellar

Native desktop utility for managing and building Unreal Engine projects.

## Features

- Auto-detect Unreal Engine installations
- Manage multiple UE projects
- Build projects with visual progress and log output
- Remembers engine selection and project list between sessions

## Tech Stack

Tauri 2 desktop app with React + TypeScript frontend, Hono backend (Node.js) for RPC, and Rust host.

## Requirements

- Windows 10/11
- Unreal Engine 5.x installed

## Installation

Download the latest release (`Stellar_x.x.x_x64-setup.exe`) and run the installer.

## Development

### Prerequisites

- Node.js 18+
- Rust toolchain
- npm

### Setup

```bash
npm install
```

### Run in development

```bash
npm run dev:tauri
```

### Build for production

```bash
npm run build:tauri
```

The installer will be created at `src-tauri/target/release/bundle/nsis/`.

## Project Structure

```
Stellar/
├── frontend/          # React + TypeScript UI
├── backend/           # Hono RPC server (Node.js)
├── shared/            # Shared types and constants
├── src-tauri/         # Tauri host (Rust)
└── scripts/           # Build and sync scripts
```

## Architecture

- The backend exposes RPC routes via Hono, and the frontend uses a typed Hono client.
- Shared types live in shared/ to keep UI and backend contracts aligned.
- The Tauri host spawns the Node backend and manages the window.
- Config is persisted to the user's app data directory.

## License

MIT
