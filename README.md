# 3D Tic Tac Toe

A beautiful 3D Tic Tac Toe game built with Three.js, featuring local multiplayer, AI opponents, and real-time remote play via WebRTC.

![Game Preview](https://img.shields.io/badge/Three.js-black?style=flat&logo=three.js) ![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-45ba4b?style=flat&logo=playwright&logoColor=white)

## 🎮 Features

### Game Modes
- **Local 2 Players** - Play with a friend on the same device
- **Remote 2 Players** - Play online via shareable link (WebRTC peer-to-peer)
- **VS Computer** - Challenge the AI with 3 difficulty levels:
  - **Easy** - Random moves
  - **Medium** - Strategic with some randomness
  - **Hard** - Unbeatable (minimax algorithm with alpha-beta pruning)

### Visual Features
- 3D game board with glowing neon aesthetics
- Animated piece placement
- Winning pieces highlight and float
- Orbit controls - rotate and zoom the board
- Mobile-first responsive design
- iOS safe area support

## 🚀 Quick Start

### Play Online
Visit the deployed version: [3d-tic-tac-toe-game.netlify.app](https://3d-tic-tac-toe-game.netlify.app)

### Run Locally
```bash
# Clone the repository
git clone https://github.com/yourusername/3d-tic-tac-toe.git
cd 3d-tic-tac-toe

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Then open `http://localhost:5173` (default Vite port) in your browser.

> **Note:** Remote multiplayer requires HTTPS or localhost due to WebRTC security requirements.

## 🎯 How to Play

1. **Select a game mode** from the main menu
2. **Click on any empty cell** to place your piece
3. **Get three in a row** (horizontal, vertical, or diagonal) to win
4. **Rotate the board** by dragging (desktop) or swiping (mobile)
5. **Zoom** with scroll wheel or pinch gesture

### Players
- **P1** (Cyan/X) - Always goes first
- **P2** (Magenta/O) - Always goes second
- In AI mode, the computer plays as P2

## 🏗️ Architecture

The project uses a modular architecture using TypeScript:

```
3d-tic-tac-toe/
├── src/
│   ├── game/
│   │   ├── constants.ts      # Game constants
│   │   ├── GameState.ts      # State management
│   │   ├── GameLogic.ts      # Win/draw detection (pure functions)
│   │   ├── GameController.ts # Orchestrates game flow
│   │   └── AI.ts             # Minimax AI algorithm
│   ├── multiplayer/
│   │   └── PeerManager.ts    # WebRTC P2P connections
│   ├── rendering/            # Three.js rendering logic
│   └── ui/                   # UI DOM manipulation
├── e2e/                      # Playwright E2E tests
├── tests/                    # Unit tests
├── main.ts                   # Entry point
├── index.html
└── package.json
```

### Key Modules

| Module | Description |
|--------|-------------|
| `GameState` | Manages board state, current player, game over status |
| `GameLogic` | Pure functions for win detection, draw checking |
| `AI` | Minimax algorithm with alpha-beta pruning |
| `PeerManager` | WebRTC peer-to-peer connection handling |
| `GameController` | Bridges UI, Input, and Game State |

## 🧪 Testing

The project includes both unit tests (Vitest) and end-to-end tests (Playwright).

### Unit Tests
Cover game logic, AI, and multiplayer components.

```bash
# Run unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### End-to-End (E2E) Tests
Cover full game flows including local PvP, AI matches, and UI interactions.

```bash
# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI runner
npm run test:e2e:ui
```

## 🛠️ Technologies

- **[Three.js](https://threejs.org/)** - 3D rendering
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety and modern JS features
- **[Vite](https://vitejs.dev/)** - Next Generation Frontend Tooling
- **[PeerJS](https://peerjs.com/)** - WebRTC abstraction for P2P connections
- **[Vitest](https://vitest.dev/)** - Unit testing framework
- **[Playwright](https://playwright.dev/)** - Reliable End-to-End testing

## 📱 Mobile Support

- Responsive design (mobile-first CSS)
- Touch controls for piece placement
- Gesture support for camera rotation
- iOS safe area insets for notched devices
- Dynamic viewport height (`100dvh`)

## 🌐 Deployment

### Netlify (Recommended)
```bash
# Deploy to Netlify
npx netlify-cli deploy --prod --dir dist
```

### Other Static Hosts
Build the project first:
```bash
npm run build
```
The output will be in the `dist` folder. Deploy this folder to any static host (Vercel, GitHub Pages, etc.).

> **Important:** Remote multiplayer requires HTTPS for WebRTC to work.

## 🔧 Browser Requirements

- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- For remote play: HTTPS or localhost
- WebGL support for 3D rendering

### Troubleshooting Remote Play

If remote play shows "WebRTC blocked":
1. **Check your URL** - Must be HTTPS or localhost
2. **Disable ad blockers** - Some block WebRTC to prevent IP leaks
3. **Try Incognito mode** - Extensions are disabled by default
4. **Check browser settings** - WebRTC might be disabled in flags

## 📄 License

MIT License - feel free to use this project for learning or as a starting point for your own games!

## 🙏 Credits

- 3D rendering powered by [Three.js](https://threejs.org/)
- P2P connections via [PeerJS](https://peerjs.com/)
- Fonts: [Orbitron](https://fonts.google.com/specimen/Orbitron) & [Rajdhani](https://fonts.google.com/specimen/Rajdhani)
