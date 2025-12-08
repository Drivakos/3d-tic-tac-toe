# 3D Tic Tac Toe

A beautiful 3D Tic Tac Toe game built with Three.js, featuring local multiplayer, AI opponents, and real-time remote play via WebRTC.

![Game Preview](https://img.shields.io/badge/Three.js-black?style=flat&logo=three.js) ![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc) ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)

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

# Start local server
npm run serve
```

Then open `http://localhost:3000` in your browser.

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

The project uses a modular architecture for maintainability and testability:

```
3d-tic-tac-toe/
├── js/
│   ├── game/
│   │   ├── constants.js      # Game constants (players, patterns)
│   │   ├── GameState.js      # State management
│   │   ├── GameLogic.js      # Win/draw detection (pure functions)
│   │   └── AI.js             # Minimax AI algorithm
│   └── multiplayer/
│       └── PeerManager.js    # WebRTC P2P connections
├── tests/
│   ├── GameState.test.js
│   ├── GameLogic.test.js
│   ├── AI.test.js
│   └── PeerManager.test.js
├── main.js                   # Three.js renderer & game controller
├── index.html
├── style.css
└── package.json
```

### Key Modules

| Module | Description |
|--------|-------------|
| `GameState` | Manages board state, current player, game over status |
| `GameLogic` | Pure functions for win detection, draw checking |
| `AI` | Minimax algorithm with alpha-beta pruning |
| `PeerManager` | WebRTC peer-to-peer connection handling |

## 🧪 Testing

The project includes 98 unit tests covering game logic, AI, and multiplayer:

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

### Test Coverage
- **GameState** - 21 tests (state management, piece placement)
- **GameLogic** - 31 tests (win patterns, draw detection)
- **AI** - 21 tests (minimax, difficulty levels)
- **PeerManager** - 25 tests (room codes, messaging)

## 🛠️ Technologies

- **[Three.js](https://threejs.org/)** - 3D rendering
- **[PeerJS](https://peerjs.com/)** - WebRTC abstraction for P2P connections
- **[Vitest](https://vitest.dev/)** - Unit testing framework
- **Vanilla JS** - No frontend framework dependencies

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
npx netlify-cli deploy --prod --dir .
```

### Other Static Hosts
The game is a static site - deploy to any static hosting:
- Vercel
- GitHub Pages
- Cloudflare Pages
- Any web server

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

