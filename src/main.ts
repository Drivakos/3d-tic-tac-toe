import '../style.css';
import { GameController } from './game/GameController';
import { RenderManager } from './rendering/RenderManager';
import { InputManager } from './ui/InputManager';
import { PeerManager } from './multiplayer/PeerManager';
import { hideAllModeScreens, showMessage, hideMessage } from './ui/UIManager';

// Initialize core systems
const game = new GameController();
const renderManager = new RenderManager('game-canvas');
const inputManager = new InputManager(game, renderManager);

// Attach event listeners
inputManager.attachAllEventListeners();

// Setup remote/multiplayer callbacks
const peerManager = new PeerManager();
game.peerManager = peerManager; // Game needs potential access, or we inject it later

// Wire up InputManager remote actions
inputManager.onCreateRoom = async (timerSeconds: number) => {
  try {
    const id = await peerManager.initialize();
    // Setup room creation logic
    game.startRemoteGame(peerManager, timerSeconds);
    // Show waiting room via UI manager or direct DOM
    const waitingRoom = document.getElementById('waiting-room');
    const roomCodeValue = document.getElementById('room-code-value');
    const shareLink = document.getElementById('share-link') as HTMLInputElement;

    if (waitingRoom) waitingRoom.classList.remove('hidden');
    if (roomCodeValue) roomCodeValue.textContent = id.replace('ttt-', '');
    if (shareLink) shareLink.value = window.location.href.split('?')[0] + '?room=' + id.replace('ttt-', '');

    // Hide other screens
    document.getElementById('remote-setup')?.classList.add('hidden');
  } catch (err) {
    console.error('Failed to create room:', err);
    alert('Failed to create room. Please try again.');
  }
};

inputManager.onJoinRoom = async (code: string) => {
  try {
    // Show connection status
    const connectionStatus = document.getElementById('connection-status');
    const connectionMessage = document.getElementById('connection-message');
    if (connectionStatus) connectionStatus.classList.remove('hidden');
    if (connectionMessage) connectionMessage.textContent = 'Connecting to room...';

    // Initialize and connect
    await peerManager.initialize();
    await peerManager.connect(code);

    // Game start will be handled by PeerManager events
  } catch (err) {
    console.error('[Main] Failed to join room:', err);
    alert('Failed to join room. Please check the code and try again.\nError: ' + (err instanceof Error ? err.message : String(err)));
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) connectionStatus.classList.add('hidden');
  }
};

// Wire up PeerManager callbacks
peerManager.onConnect = (info) => {
  console.log('[Main] onConnect triggered', info);
  // Hide waiting/connection screens
  hideAllModeScreens();
  console.log('[Main] Hidden waiting/connection screens and overlay');

  if (info.isHost) {
    console.log('[Main] I am Host');
    // Host logic is already handled partly by startRemoteGame
  } else {
    console.log('[Main] I am Joiner, starting remote game');
    // Joiner logic
    game.startRemoteGame(peerManager, info.timerSeconds || 0);
    game.gameState.resetGameNumber(); // Ensure sync?
  }

  // Update Role UI in InputManager? 
  // Ideally InputManager or RenderManager handles this, but we can do it here simply for now
  const uiOverlay = document.getElementById('ui-overlay');
  if (uiOverlay) {
    uiOverlay.classList.remove('hidden');
    console.log('[Main] Shown UI overlay');
  } else {
    console.error('[Main] UI overlay not found!');
  }

  try {
    renderManager.rebuildBoard(game.gameState.getBoard());
    console.log('[Main] Board rebuilt');
    inputManager.updateUI();
    console.log('[Main] UI updated');
    game.startTimer();
    console.log('[Main] Timer started (if any)');
  } catch (e) {
    console.error('[Main] Error updating UI/Board in onConnect:', e);
  }
};

peerManager.onMessage = (data) => {
  // Handle game messages that update state
  switch (data.type) {
    case 'move':
      const moveMsg = data as import('./types/multiplayer').MoveMessage;
      if (moveMsg.cellIndex !== undefined) {
        const moveResult = game.handleMove(moveMsg.cellIndex, true);
        if (moveResult) {
          const cellValue = game.gameState.getCell(moveMsg.cellIndex);
          if (cellValue) {
            renderManager.addPiece(moveMsg.cellIndex, cellValue);
          }
          // Check if the game is over after this move
          if (moveResult.status.isOver) {
            if (moveResult.status.winner) {
              renderManager.highlightWinning([...(moveResult.status.pattern || [])]);
              const playerNum = game.getPlayerNumberFromSymbol(moveResult.status.winner);
              showMessage(`Player ${playerNum} Wins!`);
            } else if (moveResult.status.isDraw) {
              showMessage("It's a Draw!");
            }
          }
        }
        inputManager.updateUI();
      }
      break;
    case 'reset':
      game.resetGame(false, false);
      renderManager.rebuildBoard(game.gameState.getBoard());
      inputManager.updateUI();
      game.startTimer();
      break;
    case 'rematch-request':
      // Show rematch modal to accept/decline
      const rematchModal = document.getElementById('rematch-modal');
      const rematchMessage = document.getElementById('rematch-message');
      if (rematchModal) {
        rematchModal.classList.remove('hidden');
      }
      if (rematchMessage) {
        const reqMsg = data as import('./types/multiplayer').RematchRequestMessage;
        rematchMessage.textContent = `Player ${reqMsg.playerNum} wants a rematch!`;
      }
      break;
    case 'rematch-response':
      const respMsg = data as import('./types/multiplayer').RematchResponseMessage;
      // Hide waiting modal
      document.getElementById('waiting-rematch-modal')?.classList.add('hidden');

      if (respMsg.accepted) {
        // Start new game
        game.resetGame(false, true);
        hideMessage();
        renderManager.rebuildBoard(game.gameState.getBoard());
        inputManager.updateUI();
        game.startTimer();
      } else {
        // Opponent declined
        showMessage('Opponent declined rematch');
      }
      break;
    case 'sync': // ... 
      break;
    // ... other cases
  }
};

// Handle URL room code
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  // Auto-join logic
  // We need to simulate clicking "Two Players" -> "Remote" -> "Join"
  // Or just jump straight to it.
  // Let's defer this to user interaction or auto-trigger if robust.
  const modeSelectPanel = document.getElementById('mode-select-panel');
  if (modeSelectPanel) {
    // Show join UI pre-filled?
    // For now, let's just leave it to default behavior or user manual entry.
    // Or implement the original logic:
    inputManager.onJoinRoom(roomParam);
  }
}

// Tick loop for timer UI updates
// GameController calls onTimerTick
game.onTimerTick = (remaining, total) => {
  // Update timer UI
  // We need to access UI elements. InputManager doesn't expose them directly?
  // InputManager should have an updateTimer method.
  renderManager.updateStageColors(total > 0 ? remaining / total : 1);
  // ... update text
  const timerEx = document.getElementById('timer-p1'); // ... simplistic
  // This part should be in InputManager really.
};