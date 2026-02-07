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
    // Set game settings so they're shared with the joiner
    peerManager.setGameSettings({ timerSeconds });
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
    console.error('Failed to create room. Please try again.');
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
    alert('Failed to join room. Please check the code and try again.\nError: ' + (err instanceof Error ? err.message : String(err)));
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) connectionStatus.classList.add('hidden');
  }
};

// Wire up PeerManager callbacks
peerManager.onConnect = (info) => {
  // Hide waiting/connection screens
  hideAllModeScreens();

  if (info.isHost) {
    // Host logic is already handled partly by startRemoteGame
  } else {
    // Joiner logic
    game.startRemoteGame(peerManager, info.timerSeconds || 0);
    game.gameState.resetGameNumber(); // Ensure sync?
  }

  const uiOverlay = document.getElementById('ui-overlay');
  if (uiOverlay) {
    uiOverlay.classList.remove('hidden');
  }

  try {
    renderManager.rebuildBoard(game.gameState.getBoard());
    inputManager.updateUI();
    game.startTimer();
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
    case 'full-sync':
      // Apply complete game state from host (used for initial sync or after rematch)
      const fullSyncMsg = data as import('./types/multiplayer').FullSyncMessage;
      game.applyFullState({
        gameState: fullSyncMsg.gameState,
        scores: fullSyncMsg.scores,
        timerSeconds: fullSyncMsg.timerSeconds,
        gameStarted: fullSyncMsg.gameStarted
      });
      renderManager.rebuildBoard(game.gameState.getBoard());
      inputManager.updateUI();
      if (fullSyncMsg.gameStarted) {
        game.setupTimer();
        game.startTimer();
      }
      break;
    case 'timer-sync':
      // Sync timer state from host (for keeping timers in sync)
      const timerSyncMsg = data as import('./types/multiplayer').TimerSyncMessage;
      // Update local timer display and stage colors based on remote timer
      if (game.timerSeconds > 0) {
        const progress = timerSyncMsg.remaining / game.timerSeconds;
        renderManager.updateStageColors(progress);

        // Show timer container
        const timersContainer = document.getElementById('timers-container');
        timersContainer?.classList.remove('hidden');

        // Update timer display for the player whose turn it is
        const playerAsX = game.gameState.getPlayerAsX();
        const currentPlayer = timerSyncMsg.player;
        const isP1Turn = (currentPlayer === 'X' && playerAsX === 1) || (currentPlayer === 'O' && playerAsX === 2);

        const timerP1 = document.getElementById('timer-p1');
        const timerP2 = document.getElementById('timer-p2');

        if (isP1Turn && timerP1) {
          const timerFill = timerP1.querySelector('.timer-fill') as HTMLElement;
          const timerText = timerP1.querySelector('.timer-text');
          if (timerFill) timerFill.style.width = `${progress * 100}%`;
          if (timerText) timerText.textContent = Math.ceil(timerSyncMsg.remaining).toString();
          timerP1.classList.add('active');
          timerP2?.classList.remove('active');
        } else if (timerP2) {
          const timerFill = timerP2.querySelector('.timer-fill') as HTMLElement;
          const timerText = timerP2.querySelector('.timer-text');
          if (timerFill) timerFill.style.width = `${progress * 100}%`;
          if (timerText) timerText.textContent = Math.ceil(timerSyncMsg.remaining).toString();
          timerP2.classList.add('active');
          timerP1?.classList.remove('active');
        }
      }
      break;
    case 'timer-timeout':
      // Handle remote player timeout
      const timeoutMsg = data as import('./types/multiplayer').TimerTimeoutMessage;
      const winner = timeoutMsg.timedOutPlayer === 'X' ? 'O' : 'X';
      game.gameState.setGameOver(winner, null);
      const winnerNum = game.getPlayerNumberFromSymbol(winner);
      game.scores[winnerNum]++;
      showMessage(`Time's up! Player ${winnerNum} Wins!`);
      inputManager.updateUI();
      break;
  }
};

// Handle URL room code
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  const modeSelectPanel = document.getElementById('mode-select-panel');
  if (modeSelectPanel) {
    inputManager.onJoinRoom(roomParam);
  }
}

// Tick loop for timer UI updates
game.onTimerTick = (remaining, total) => {
  // Update stage colors for visual effect
  renderManager.updateStageColors(total > 0 ? remaining / total : 1);

  // Show/hide timer container
  const timersContainer = document.getElementById('timers-container');
  if (total > 0) {
    timersContainer?.classList.remove('hidden');
  }

  // Update timer display for current player
  const currentPlayer = game.gameState.getCurrentPlayer();
  const timerP1 = document.getElementById('timer-p1');
  const timerP2 = document.getElementById('timer-p2');
  const progress = total > 0 ? remaining / total : 1;

  // Determine which player's timer to update
  const playerAsX = game.gameState.getPlayerAsX();
  const isP1Turn = (currentPlayer === 'X' && playerAsX === 1) || (currentPlayer === 'O' && playerAsX === 2);

  if (isP1Turn && timerP1) {
    const timerFill = timerP1.querySelector('.timer-fill') as HTMLElement;
    const timerText = timerP1.querySelector('.timer-text');
    if (timerFill) timerFill.style.width = `${progress * 100}%`;
    if (timerText) timerText.textContent = Math.ceil(remaining).toString();
    timerP1.classList.add('active');
    timerP2?.classList.remove('active');
  } else if (timerP2) {
    const timerFill = timerP2.querySelector('.timer-fill') as HTMLElement;
    const timerText = timerP2.querySelector('.timer-text');
    if (timerFill) timerFill.style.width = `${progress * 100}%`;
    if (timerText) timerText.textContent = Math.ceil(remaining).toString();
    timerP2.classList.add('active');
    timerP1?.classList.remove('active');
  }

  // Send timer sync to remote peer (only if we're the one whose turn it is)
  if (game.isRemote() && game.isMyTurn() && peerManager.isConnected) {
    peerManager.sendTimerSync(remaining, currentPlayer);
  }
};

// Timer timeout handler - player loses when timer runs out
game.onTimerTimeout = () => {
  const currentPlayer = game.gameState.getCurrentPlayer();
  // The player whose turn it was loses
  const loser = currentPlayer;
  const winner = loser === 'X' ? 'O' : 'X';

  // Set game over state
  game.gameState.setGameOver(winner, null);

  // Update scores
  const winnerPlayerNum = game.getPlayerNumberFromSymbol(winner);
  game.scores[winnerPlayerNum]++;

  // Send timeout notification to remote peer
  if (game.isRemote() && peerManager.isConnected) {
    peerManager.sendTimerTimeout(loser);
  }

  // Show message
  if (game.mode === 'ai' && loser === 'O') {
    showMessage('AI ran out of time! You Win!');
  } else if (game.mode === 'ai' && loser === 'X') {
    showMessage('Time\'s up! AI Wins!');
  } else {
    showMessage(`Time's up! Player ${winnerPlayerNum} Wins!`);
  }

  inputManager.updateUI();
};