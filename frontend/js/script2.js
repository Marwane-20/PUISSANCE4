document.addEventListener('DOMContentLoaded', function() {

    const rows = 6;
    const cols = 7;
    const board = Array.from(Array(rows), () => Array(cols).fill(null));
    let previousBoardState = Array.from({ length: rows }, () => Array(cols).fill(0));
  
    let currentPlayer = 1;
    let player1Name = document.getElementById('player1Name') || 'Joueur1';
    let player2Name = document.getElementById('player2Name') ||'Joueur2';
    let player1Score = 0;
    let player2Score = 0;
    const BASE_URL = "http://127.0.0.1:8000";
  
    const boardElement = document.getElementById('board');
    const messageElement = document.getElementById('message');
    const confettiElement = document.getElementById('confetti');
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');
    const createOnlineGameButton = document.getElementById('createOnlineGameButton');
    const joinOnlineGameButton = document.getElementById('joinOnlineGameButton');
    const onlinePlayerNameInput = document.getElementById('onlinePlayerName');
    const onlineGameCodeInput = document.getElementById('onlineGameCode');
  
    let scoreboardElement = document.getElementById('scoreboard');
    if (!scoreboardElement) {
      scoreboardElement = document.createElement('div');
      scoreboardElement.id = "scoreboard";
      scoreboardElement.style.marginBottom = "10px";
      scoreboardElement.style.fontWeight = "bold";
      document.body.prepend(scoreboardElement);
    }
  
  /*   document.getElementById('player1Name').value = player1Name; */
  
    let isOnlineGame = false;
    let onlineGameCode = null;
    let localPlayerId = 1;
    let pollIntervalId = null;
    let gameOver = false;
  
  
  const backgroundMusic = new Audio('js/fond-sonore4.mp3'); 
  backgroundMusic.loop = true; 
  
  backgroundMusic.play().catch((error) => {
      console.warn('Lecture automatique bloquée par le navigateur. Interaction requise.', error);
  });
  
  document.addEventListener('click', () => {
      backgroundMusic.play();
  }, { once: true });
  
  
  
    // Offline Start
    startButton.addEventListener('click', async () => {
        player1Name = document.getElementById('player1Name').value.trim() || 'Joueur1';
        player2Name = document.getElementById('player2Name').value.trim() || 'Joueur2';
        document.getElementById("player1NameDisplay").textContent = player1Name;
        document.getElementById("player2NameDisplay").textContent = player2Name;
        console.log("lES JOUEURS SONT ", player1Name, player2Name)
        document.getElementById('nameForm').style.display = 'none';
        boardElement.style.display = 'grid';
        messageElement.style.display = 'block';
        restartButton.style.display = 'none';
        isOnlineGame = false;
  
        const gameData = await createGame(player1Name, player2Name);
        if (gameData) {
            createBoard(gameData);
            messageElement.textContent = `${player1Name}, c'est votre tour !`;
        }
    });
  
    restartButton.addEventListener('click', resetGame);
  
    // CREATE an online game
    createOnlineGameButton.addEventListener('click', async () => {
      const playerName = onlinePlayerNameInput.value.trim();
      const gameCode = onlineGameCodeInput.value.trim();
  
      if (!playerName || !gameCode) {
          alert("Veuillez remplir le nom et le code de la partie.");
          return;
      }
  
      try {
          const response = await fetch(`${BASE_URL}/game/online`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerName, gameCode })
          });
  
          if (response.ok) {
              alert("Partie en ligne créée ! Attente de l'autre joueur...");
              isOnlineGame = true;
              localPlayerId = 1;
              onlineGameCode = gameCode;
              player1Name = playerName;
              player2Name = '';
  
              document.getElementById('nameForm').style.display = 'none';
              boardElement.style.display = 'grid';
              messageElement.style.display = 'block';
              messageElement.textContent = "Vous êtes l'hôte. En attente d'un autre joueur...";
              createBoard({});
              previousBoardState = blankBoard(rows, cols);
  
              pollForOpponent(gameCode);
              updateOnlineScoreboard();
          } else {
              const err = await response.json();
              alert(err.detail || "Erreur création.");
          }
      } catch (err) {
          console.error("Erreur création online:", err);
      }
  });
  
  joinOnlineGameButton.addEventListener('click', async () => {
      const playerName = onlinePlayerNameInput.value.trim();
      const gameCode = onlineGameCodeInput.value.trim();
  
      if (!playerName || !gameCode) {
          alert("Veuillez remplir le nom et le code.");
          return;
      }
  
      try {
          const response = await fetch(`${BASE_URL}/game/online/join`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerName, gameCode })
          });
  
          if (response.ok) {
              const data = await response.json();
              alert("Partie rejointe : " + data.message);
              isOnlineGame = true;
              localPlayerId = 2;
              onlineGameCode = gameCode;
              player2Name = playerName;
  
              document.getElementById('nameForm').style.display = 'none';
              boardElement.style.display = 'grid';
              messageElement.style.display = 'block';
              createBoard({});
              previousBoardState = blankBoard(rows, cols);
  
              loadGameGrid(gameCode);
              updateOnlineScoreboard();
          } else {
              const err = await response.json();
              alert(err.detail || "Erreur join.");
          }
      } catch (err) {
          console.error("Erreur joinOnlineGame:", err);
      }
  });
  
  
    //WAIT for Opponent
    function pollForOpponent(gameCode) {
        const intervalId = setInterval(async () => {
            try {
                const resp = await fetch(`${BASE_URL}/game/online/${gameCode}`);
                if (!resp.ok) return;
                const data = await resp.json();
  
                if (data.player1) player1Name = data.player1;
                if (data.player2) player2Name = data.player2;
  
                if (data.status === 'ready') {
                    clearInterval(intervalId);
                    messageElement.textContent = `Le joueur ${player2Name} a rejoint !`;
                    pollForMoves(gameCode);
  
                    updateOnlineScoreboard();
                }
            } catch (err) {
                console.error("pollForOpponent:", err);
            }
        }, 2000);
    }
  
    //  MAIN ONLINE POLLING
    function pollForMoves(gameCode) {
      console.log("pollformoves");
      if (pollIntervalId) {
          clearInterval(pollIntervalId);
      }
  
      let previousBoardHash = null;
  
      pollIntervalId = setInterval(async () => {
          try {
              const resp = await fetch(`${BASE_URL}/game/online/${gameCode}`);
              if (!resp.ok) return;
              const data = await resp.json();
  
              if (data.player1) player1Name = data.player1;
              if (data.player2) player2Name = data.player2;
  
              // Check status
              if (data.status === "won") {
                  if (!gameOver) {
                      gameOver = true;
                      renderOnlineBoard(data);
                      celebrateWinOnline(data.winner_id);
                  }
              } else if (data.status === "draw") {
                  if (!gameOver) {
                      gameOver = true;
                      renderOnlineBoard(data);
                      messageElement.textContent = "Match nul !";
                      boardElement.style.pointerEvents = "none";
                      restartButton.style.display = "block";
                  }
              } else if (data.status === "active") {
                  if (gameOver) {
                      gameOver = false;
                      boardElement.style.pointerEvents = "auto";
                      restartButton.style.display = "none";
                      messageElement.textContent = "La partie est réinitialisée !";
                  }
  
                  // Vérifier si le plateau a changé avant de le rendre
                  const currentBoardHash = JSON.stringify(data.board); // Convertir le plateau en chaîne pour comparaison
                  if (currentBoardHash !== previousBoardHash) {
                      renderOnlineBoard(data);
                      previousBoardHash = currentBoardHash; // Mettre à jour le hash
                  }
  
                  updateOnlineTurn(data);
              }
          } catch (err) {
              console.error("pollForMoves error:", err);
          }
      }, 2000);
  }
  
  
    // DETERMINE WHOSE TURN
    function updateOnlineTurn(data) {
      if (gameOver) {
        boardElement.style.pointerEvents = "none";
        return;
      }
      if (data.current_turn === localPlayerId) {
          boardElement.style.pointerEvents = "auto";
          messageElement.textContent = "C'est votre tour !";
      } else {
          boardElement.style.pointerEvents = "none";
          const other = (localPlayerId === 1) ? (data.player2 || 'Joueur2') : (data.player1 || 'Joueur1');
          messageElement.textContent = `C'est au tour de ${other} !`;
      }
    }
  
    // RENDER the Board
    function renderOnlineBoard(data) {
        boardElement.innerHTML = '';
        createCellsForClick();
  
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const val = data.board[r][c];
                if (val !== 0) {
                    const piece = document.createElement('div');
                    piece.classList.add('piece', val === 1 ? 'player1' : 'player2');
                    piece.style.left = `calc(${c * 90}px + 20px)`;
                    piece.style.top = '20px';
                    piece.style.zIndex = 1;
  
                    if (previousBoardState[r][c] === 0) {
                        requestAnimationFrame(() => {
                            piece.style.transition = 'transform 0.2s ease';
                            piece.style.transform = `translateY(${r * 90}px)`;
                        });
                    } else {
                        piece.style.transform = `translateY(${r * 90}px)`;
                    }
                    boardElement.appendChild(piece);
                }
            }
        }
        previousBoardState = data.board.map(row => [...row]);
    }
  
    //RESET an ONLINE GAME
    async function resetOnlineGame(gameCode) {
      try {
          const resp = await fetch(`${BASE_URL}/game/online/${gameCode}/reset`, { method: 'PUT' });
          if (!resp.ok) {
              const e = await resp.json();
              alert(e.detail || "Erreur lors de la réinitialisation de la partie en ligne");
              return;
          }
          const data = await resp.json();
  
          gameOver = false;
          if (pollIntervalId) {
              clearInterval(pollIntervalId);
          }
          boardElement.innerHTML = '';
          previousBoardState = blankBoard(rows, cols);
          createBoard({});
          messageElement.textContent = "La partie est réinitialisée !";
  
          pollForMoves(gameCode);
      } catch (error) {
          console.error("resetOnlineGame error:", error);
      }
    }
  
    async function resetGame() {
        if (isOnlineGame && onlineGameCode) {
          await resetOnlineGame(onlineGameCode);
          return;
        }
        // offline
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                board[r][c] = null;
            }
        }
        currentPlayer = 1;
        messageElement.textContent = `${player1Name}, c'est votre tour !`;
        boardElement.innerHTML = '';
        confettiElement.innerHTML = '';
        confettiElement.style.display = 'none';
        boardElement.style.pointerEvents = 'auto';
        restartButton.style.display = 'none';
  
        previousBoardState = blankBoard(rows, cols);
  
        const gd = await createGame(player1Name, player2Name);
        if (gd) createBoard(gd);
    }
  
    // CREATE the Board
    async function createBoard(gameData) {
        boardElement.innerHTML = '';
        createCellsForClick(gameData);
    }
  
    function createCellsForClick(gameData) {
      for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
              const cell = document.createElement('div');
              cell.classList.add('cell');
              cell.dataset.col = c;
  
              // Écouteur pour le clic
              cell.addEventListener('click', () => handleClick(c, gameData));
  
              // Écouteur pour le survol
              cell.addEventListener('mouseover', () => highlightColumn(c, true));
              cell.addEventListener('mouseout', () => highlightColumn(c, false));
  
              boardElement.appendChild(cell);
          }
      }
  }
  
  // Fonction pour gérer le survol de la colonne
  function highlightColumn(colIndex, highlight) {
      // Récupère toutes les cellules de la colonne
      const cells = document.querySelectorAll(`.cell[data-col="${colIndex}"]`);
  
      cells.forEach(cell => {
          if (highlight) {
              cell.classList.add('highlight');
          } else {
              cell.classList.remove('highlight');
          }
      });
  }
  
  
    //HANDLE a Click on a Column
    async function handleClick(col, gameData) {
        if (isOnlineGame && onlineGameCode) {
            try {
                const st = await fetch(`${BASE_URL}/game/online/${onlineGameCode}`);
                if (!st.ok) return;
                const currentData = await st.json();
  
                if (currentData.current_turn !== localPlayerId) {
                    alert("Pas votre tour!");
                    return;
                }
                const moveResult = await playMoveOnline(onlineGameCode, col, localPlayerId);
                if (moveResult) {
                    const updatedData = {
                        ...currentData,
                        board: moveResult.board
                    };
                    renderOnlineBoard(updatedData);
                    previousBoardState = updatedData.board.map(row => [...row]);
  
                    if (moveResult.status === 'won') {
                        setTimeout(() => celebrateWinOnline(moveResult.winner_id), 100);
                    } else if (moveResult.status === 'draw') {
                        messageElement.textContent = "Match nul !";
                        boardElement.style.pointerEvents = 'none';
                        restartButton.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error("handleClick(online) err:", err);
            }
        } else {
            // offline code
            const st = await playMove(gameData.id, col, currentPlayer);
            if (st) {
                const { row } = st;
                board[row][col] = st.player_id;
                dropPiece(row, col);
  
                if (st.status === 'won') {
                    // offline
                    setTimeout(() => celebrateWinOffline(st.player_id), 100);
                } else if (st.status === 'draw') {
                    messageElement.textContent = "Match nul !";
                    boardElement.style.pointerEvents = 'none';
                    restartButton.style.display = 'block';
                } else {
                    currentPlayer = st.current_turn;
                    if (currentPlayer === 1) {
                        messageElement.textContent = "C'est votre tour !";
                    } else {
                        messageElement.textContent = "C'est au tour de l'adversaire !";
                    }
                }
            }
        }
    }
  
    // ONLINE Move
    async function playMoveOnline(gc, col, pid) {
        try {
            const resp = await fetch(`${BASE_URL}/game/online/${gc}/play?column=${col}&player_id=${pid}`, {
                method: 'PUT'
            });
            if (!resp.ok) {
                const e = await resp.json();
                console.error("playMoveOnline error:", e);
                return null;
            }
            return await resp.json();
        } catch (err) {
            console.error("playMoveOnline catch:", err);
            return null;
        }
    }
  
    // ------------- LOAD an Existing Online Game -------------
    async function loadGameGrid(gc) {
        try {
            const r = await fetch(`${BASE_URL}/game/online/${gc}`);
            if (!r.ok) {
                const e = await r.json();
                alert(e.detail || "Erreur loadGameGrid");
                return;
            }
            const data = await r.json();
            if (data.player1) player1Name = data.player1;
            if (data.player2) player2Name = data.player2;
  
            document.getElementById('nameForm').style.display = 'none';
            boardElement.style.display = 'grid';
            messageElement.style.display = 'block';
            createBoard({});
            previousBoardState = blankBoard(rows, cols);
  
            if (data.status === 'ready') {
                pollForMoves(gc);
            } else if (data.status === 'waiting') {
                alert("En attente d'un autre joueur...");
                messageElement.textContent = "En attente...";
                pollForMoves(gc);
            } else {
                pollForMoves(gc);
            }
  
            updateOnlineScoreboard();
        } catch (er) {
            console.error("loadGameGrid err:", er);
        }
    }
  
    // DROP a Piece Animation (Offline) -------------
    function dropPiece(row, col) {
        const dropSound = new Audio('js/drop-piece4.mp3'); // Remplacez 'drop-sound.mp3' par le chemin de votre fichier audio
        // Démarrer l'animation
        dropSound.play(); 
      const piece = document.createElement('div');
      piece.classList.add('piece', currentPlayer === 1 ? 'player1' : 'player2');
      boardElement.appendChild(piece);
  
      piece.style.left = `calc(${col * 90}px + 20px)`;
      piece.style.top = '20px';
      piece.style.zIndex = 1;
      // Ajouter un son
      requestAnimationFrame(() => {
          piece.style.transition = 'transform 0.2s ease';
          piece.style.transform = `translateY(${row * 90}px)`;
      });
  
  }
  
    // WIN OFFLINE
    function celebrateWinOffline(wpid) {
      const winnerName = (wpid === 1) ? player1Name : player2Name;
      const jsConfetti = new JSConfetti();
      const winSound = new Audio("js/win.mp3"); // Chargement du son de victoire
      messageElement.textContent = `${winnerName} a gagné !`;
      boardElement.style.pointerEvents = 'none';
      restartButton.style.display = 'block';
  
      document.getElementById("player1NameDisplay").textContent = player1Name;
      document.getElementById("player2NameDisplay").textContent = player2Name;
  
      setTimeout(async () => {
          // Mettre le son de fond en pause
          backgroundMusic.pause();
  
          // Jouer le son de victoire
          winSound.play().catch((error) => console.error("Impossible de lire le son :", error));
  
          if (wpid === 1) {
              // Incrémenter le score du joueur 1
              player1Score += 1; 
              document.getElementById("player1ScoreDisplay").textContent = player1Score;
  
              jsConfetti.addConfetti({
                  confettiColors: ["#ff0000"],
                  confettiRadius: 6,
                  confettiNumber: 500,
              });
          } else {
              // Incrémenter le score du joueur 2
              player2Score += 1;
              document.getElementById("player2ScoreDisplay").textContent = player2Score;
  
              jsConfetti.addConfetti({
                  confettiColors: ["#ffff00"],
                  confettiRadius: 6,
                  confettiNumber: 500,
              });
          }
  
          // Optionnel : Reprendre le son de fond après un délai
          setTimeout(() => {
              backgroundMusic.play().catch((error) => console.error("Impossible de lire le son :", error));
          }, 1500); // Reprend après 1.5 secondes
      }, 100);
  }
  
  
    // WIN ONLINE
    function celebrateWinOnline(winnerId) {
        gameOver = true;
        const winnerName = (winnerId === 1) ? player1Name : player2Name;
        messageElement.textContent = `${winnerName} a gagné !`;
        boardElement.style.pointerEvents = "none";
        restartButton.style.display = "block";
  
        if (winnerId === localPlayerId) {
            setTimeout(async () => {
                createConfetti();
                // 2) Then fetch updated totals
                await updateOnlineScoreboard();
            }, 100);
        } else {
            // If the opponent wins, we just refresh scoreboard after a moment
            setTimeout(() => updateOnlineScoreboard(), 500);
        }
    }
  
    // CREATE an OFFLINE game
    async function createGame(p1, p2) {
        const payload = {
            id: Date.now(),
            players: [
                { id: 1, name: p1 },
                { id: 2, name: p2 }
            ],
            current_turn: 1,
            board: Array.from({ length: 6 }, () => Array(7).fill(0)),
            status: "active"
        };
        try {
            const resp = await fetch(`${BASE_URL}/game/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const e = await resp.json();
                console.error("createGame error:", e);
                return null;
            }
            return await resp.json();
        } catch (err) {
            console.error("createGame catch:", err);
            return null;
        }
    }
  
    // PLAY MOVE OFFLINE
    async function playMove(gameId, column, playerId) {
        try {
            const resp = await fetch(`${BASE_URL}/game/${gameId}/play?column=${column}&player_id=${playerId}`, {
                method: 'PUT'
            });
            if (!resp.ok) {
                const e = await resp.json();
                console.error("Failed to play move offline:", e);
                return null;
            }
            return await resp.json();
        } catch (err) {
            console.error("Error offline playMove:", err);
            return null;
        }
    }
  
    // Update Score for Online Mode
    async function updateOnlineScore(gameCode, name, sc) {
        try {
            const resp = await fetch(`${BASE_URL}/game/online/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameCode, name, score: sc })
            });
            if (!resp.ok) {
                const e = await resp.json();
                console.error("updateOnlineScore error:", e);
                return null;
            }
            const data = await resp.json();
            console.log("Online score updated:", data);
            return data;
        } catch (err) {
            console.error("updateOnlineScore catch:", err);
            return null;
        }
    }
  
    // REFRESH the Online Scoreboard
    async function updateOnlineScoreboard() {
        if (!player1Name || !player2Name) return;
  
        try {
            let p1 = 0, p2 = 0;
  
            // get player1Name
            const r1 = await fetch(`${BASE_URL}/game/get_score/${player1Name}`);
            if (r1.ok) {
                const d1 = await r1.json();
                p1 = d1.score || 0;
            }
  
            // get player2Name
            const r2 = await fetch(`${BASE_URL}/game/get_score/${player2Name}`);
            if (r2.ok) {
                const d2 = await r2.json();
                p2 = d2.score || 0;
            }
  
  /*           scoreboardElement.textContent =
              `Score: ${player1Name} = ${p1} | ${player2Name} = ${p2}`; */
              document.getElementById("player1NameDisplay").textContent = player1Name;
              document.getElementById("player1ScoreDisplay").textContent = p1;
            
              document.getElementById("player2NameDisplay").textContent = player2Name;
              document.getElementById("player2ScoreDisplay").textContent = p2;
        } catch (err) {
            console.error("updateOnlineScoreboard error:", err);
        }
    }
  
    function blankBoard(r, c) {
        return Array.from({ length: r }, () => Array(c).fill(0));
    }
  
    function createConfetti() {
        confettiElement.style.display = 'block';
        for (let i = 0; i < 100; i++) {
            const confettiPiece = document.createElement('div');
            confettiPiece.classList.add('confetti-piece');
            confettiPiece.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
            confettiPiece.style.left = `${Math.random() * 100}%`;
            confettiPiece.style.animationDelay = `${Math.random() * 2}s`;
            confettiPiece.style.transform = `translateY(-50px) rotate(${Math.random() * 360}deg)`;
            confettiElement.appendChild(confettiPiece);
  
            setTimeout(() => {
                confettiPiece.remove();
            }, 3000);
        }
    }
  
  
          // Déplacer le code de reconnaissance vocale à l'intérieur du DOMContentLoaded
          if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
              const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
              const recognition = new SpeechRecognition();
              recognition.lang = "fr-FR";
              recognition.interimResults = false;
              recognition.continuous = false;
      
              recognition.onresult = async (event) => {
                  const command = event.results[0][0].transcript.toLowerCase();
                  console.log("Commande reçue : ", command);
      
                  // Vérifier si le jeu est initialisé
                  if (!boardElement || boardElement.style.display === 'none') {
                      alert("Veuillez d'abord démarrer une partie avant d'utiliser les commandes vocales");
                      return;
                  }
      
                  const columnMatch = command.match(/colonne (\d+)/);
                  if (columnMatch) {
                      const column = parseInt(columnMatch[1], 10);
                      if (column >= 1 && column <= 7) {
                          await window.placePiece(column - 1);
                      } else {
                          alert("Colonne invalide. Choisissez une colonne entre 1 et 7.");
                      }
                  } else {
                      alert("Commande non reconnue. Dites par exemple : 'Placer un pion en colonne 4'.");
                  }
              };
      
              recognition.onerror = (event) => {
                  console.error("Erreur de reconnaissance vocale :", event.error);
                  alert("Erreur de reconnaissance vocale. Essayez à nouveau.");
              };
      
              // Modifier le gestionnaire du bouton vocal
              document.getElementById("startVoiceButton").addEventListener("click", () => {
                  // Vérifier si une partie est en cours
                  if (!boardElement || boardElement.style.display === 'none') {
                      alert("Veuillez d'abord démarrer une partie avant d'utiliser les commandes vocales");
                      return;
                  }
                  recognition.start();
              });
          }
      
          // Fonction placePiece mise à jour
          window.placePiece = async function(column) {
              // Vérifie si la partie est en cours
              if (!boardElement || boardElement.style.pointerEvents === 'none') {
                  alert("La partie n'est pas active ou c'est un tour invalide");
                  return;
              }
      
              // Trouve la cellule correspondante dans la colonne
              const cells = document.querySelectorAll(`.cell[data-col="${column}"]`);
              if (cells.length === 0) {
                  alert("Colonne invalide");
                  return;
              }
      
              if (isOnlineGame && onlineGameCode) {
                  try {
                      // Vérifie si c'est le tour du joueur
                      const response = await fetch(`${BASE_URL}/game/online/${onlineGameCode}`);
                      if (!response.ok) {
                          throw new Error('Erreur lors de la récupération de l\'état du jeu');
                      }
                      const gameState = await response.json();
                      
                      if (gameState.current_turn !== localPlayerId) {
                          alert("Ce n'est pas votre tour!");
                          return;
                      }
  
                      const moveResult = await playMoveOnline(onlineGameCode, column, localPlayerId);
                      if (moveResult) {
                          const feedbackSound = new Audio('js/drop-piece4.mp3');
                          feedbackSound.play().catch(error => console.warn("Erreur lors de la lecture du son:", error));
                      }
                  } catch (error) {
                      console.error("Erreur lors de la vérification du tour:", error);
                      alert("Impossible de vérifier l'état du jeu");
                      return;
                  }
              } else {
                  // Mode hors ligne
                  const clickEvent = new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                  });
                  cells[0].dispatchEvent(clickEvent);
              }
          };
      });
  
  
  
  