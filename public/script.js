/**
 * ============================================================================
 * LÓGICA FRONTEND - SIMULADOR ESTILO VIDEOJUEGO CLÁSICO POKÉMON (VANILLA JS)
 * ============================================================================
 * 
 * CARACTERÍSTICAS PRINCIPALES DE CONSOLA CLÁSICA NINTENDO:
 * 1. Uso de DELEGACIÓN DE EVENTOS GLOBAL: Cualquier botón con clase .move-btn
 *    o .item-btn en el DOM responde inmediatamente al clic sin depender del
 *    momento de creación ni de cachés antiguas.
 * 2. Ejecución Inmediata ("de una"): Al hacer clic en un ataque o poción, el
 *    turno se envía a Express en el acto (sin necesidad de botones extra de
 *    enviar o reiniciar en el menú inferior).
 * 3. Mini Modal de Fin de Combate (Victoria/Derrota): Aparece en pantalla
 *    cuando la vida llega a 0, permite elegir el próximo Pokémon (o dejar
 *    en blanco para continuar con el mismo) y lanza un Nuevo Desafío con un
 *    rival generado aleatoriamente en Express.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  let battleState = {
    myHp: undefined,
    rivalHp: undefined,
    isBattleOver: false,
    isProcessingTurn: false
  };

  const battleForm = document.getElementById('battle-form');
  const btnRandomRival = document.getElementById('btn-random-rival');
  const btnLoadMy = document.getElementById('btn-load-my');
  const btnLoadRival = document.getElementById('btn-load-rival');
  
  const myInput = document.getElementById('myPokemon');
  const rivalInput = document.getElementById('rivalPokemon');
  
  const tabAttack = document.getElementById('tab-attack');
  const tabHeal = document.getElementById('tab-heal');
  const attackSubmenu = document.getElementById('attack-submenu');
  const healSubmenu = document.getElementById('heal-submenu');
  const moveNameInput = document.getElementById('moveName');
  const itemNameInput = document.getElementById('itemName');
  const movesGrid = document.getElementById('moves-grid');

  const errorBanner = document.getElementById('error-banner');
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const closeErrorBtn = document.getElementById('close-error-btn');
  const battleLogList = document.getElementById('battle-log-list');

  // ELEMENTOS DE LA MODAL RETRO DE VICTORIA / NUEVO DESAFÍO
  const battleModal = document.getElementById('battle-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const nextPokemonInput = document.getElementById('next-pokemon-input');
  const btnNewChallenge = document.getElementById('btn-new-challenge');

  // ELEMENTOS DE MARCADOR DE RACHAS Y RÉCORD
  let streakStats = {
    current: Number(localStorage.getItem('pokemon_current_streak')) || 0,
    record: Number(localStorage.getItem('pokemon_max_record')) || 0
  };

  const streakCurrentVal = document.getElementById('streak-current-val');
  const streakRecordVal = document.getElementById('streak-record-val');
  const modalStreakVal = document.getElementById('modal-streak-val');
  const modalRecordVal = document.getElementById('modal-record-val');
  const modalNewRecordBanner = document.getElementById('modal-new-record-banner');

  function updateStreakScoreboard() {
    if (streakCurrentVal) streakCurrentVal.textContent = streakStats.current;
    if (streakRecordVal) streakRecordVal.textContent = streakStats.record;
  }
  updateStreakScoreboard();

  /**
   * 1. INICIALIZAR COMBATE AL CARGAR
   */
  loadMyPokemonData(myInput.value || 'charizard');
  fetchRandomRival();

  if (btnLoadMy) {
    btnLoadMy.addEventListener('click', () => {
      if (myInput.value.trim()) {
        resetBattleState();
        loadMyPokemonData(myInput.value.trim(), true);
      }
    });
  }

  myInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (myInput.value.trim()) {
        resetBattleState();
        loadMyPokemonData(myInput.value.trim(), true);
      }
    }
  });

  let myTypeTimer = null;
  myInput.addEventListener('input', () => {
    clearTimeout(myTypeTimer);
    const val = myInput.value.trim();
    if (val.length >= 3) {
      myTypeTimer = setTimeout(() => {
        resetBattleState();
        loadMyPokemonData(val, true);
      }, 1000); // 1 segundo después de dejar de escribir
    }
  });

  if (btnLoadRival) {
    btnLoadRival.addEventListener('click', () => {
      if (rivalInput.value.trim()) {
        resetBattleState();
        loadRivalPokemonData(rivalInput.value.trim(), true);
      }
    });
  }

  rivalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rivalInput.value.trim()) {
        resetBattleState();
        loadRivalPokemonData(rivalInput.value.trim(), true);
      }
    }
  });

  let rivalTypeTimer = null;
  rivalInput.addEventListener('input', () => {
    clearTimeout(rivalTypeTimer);
    const val = rivalInput.value.trim();
    if (val.length >= 3) {
      rivalTypeTimer = setTimeout(() => {
        resetBattleState();
        loadRivalPokemonData(val, true);
      }, 1000); // 1 segundo después de dejar de escribir
    }
  });

  btnRandomRival.addEventListener('click', () => {
    fetchRandomRival();
  });

  let hasUsedPotionInBattle = false;

  /**
   * 2. DELEGACIÓN DE EVENTOS GLOBAL PARA ATAQUES Y POCIONES (100% FIABLE)
   * Permite cambiar o hacer clic sobre cualquier ataque o la poción en la pantalla.
   */
  document.addEventListener('click', (e) => {
    // CLIC EN BOTÓN DE ATAQUE (.move-btn)
    const moveBtn = e.target.closest('.move-btn');
    if (moveBtn && !moveBtn.disabled) {
      const move = moveBtn.getAttribute('data-move');
      if (move) {
        document.querySelectorAll('.move-btn').forEach(b => b.classList.remove('selected'));
        moveBtn.classList.add('selected');
        moveNameInput.value = move;
        
        // Activar tipo de acción ATAQUE
        const radioAttack = document.querySelector('input[name="actionType"][value="attack"]');
        if (radioAttack) radioAttack.checked = true;
        
        // ¡EJECUCIÓN INMEDIATA DEL TURNO!
        executeBattleTurn();
      }
      return;
    }

    // CLIC EN BOTÓN DE POCIÓN/MOCHILA (.item-btn)
    const itemBtn = e.target.closest('.item-btn');
    if (itemBtn && !itemBtn.disabled && !hasUsedPotionInBattle) {
      const item = itemBtn.getAttribute('data-item') || 'potion';
      hasUsedPotionInBattle = true;
      itemBtn.disabled = true;
      itemBtn.classList.add('disabled');
      itemBtn.innerHTML = `
        <span class="btn-title">🧪 POCIÓN UTILIZADA (Agotada)</span>
        <span class="btn-sub">Mochila vacía durante este combate</span>
      `;

      itemNameInput.value = item;

      // Activar tipo de acción CURAR
      const radioHeal = document.querySelector('input[name="actionType"][value="heal"]');
      if (radioHeal) radioHeal.checked = true;

      // ¡EJECUCIÓN INMEDIATA DEL TURNO DE CURACIÓN!
      executeBattleTurn();
      return;
    }
  });

  /**
   * 4. CONSULTAR DATOS DEL JUGADOR Y RIVAL DESDE EL BACKEND
   */
  async function loadMyPokemonData(name, refreshOther = false) {
    try {
      const res = await fetch(`/api/pokemon-info/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.success && data.pokemon) {
        updatePokemonCard({ prefix: 'my', pokemon: data.pokemon, isPlayer: true });
        renderMoveButtons(data.pokemon.availableMoves);
        document.getElementById('current-pkm-label').textContent = data.pokemon.name.toUpperCase();
        appendSystemLog(`✨ ¡Tu Pokémon ${data.pokemon.name.toUpperCase()} está listo para la batalla! Elige tu ataque.`);
        if (refreshOther) {
          loadRivalPokemonData(rivalInput.value.trim() || 'blastoise', false);
        }
      } else {
        showError('Pokémon no encontrado', `No existe un Pokémon con el nombre '${name}'.`);
      }
    } catch (err) {
      console.error('Error al cargar Pokémon propio:', err);
    }
  }

  async function loadRivalPokemonData(name, refreshOther = false) {
    try {
      const res = await fetch(`/api/pokemon-info/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.success && data.pokemon) {
        updatePokemonCard({ prefix: 'rival', pokemon: data.pokemon, isPlayer: false });
        appendSystemLog(`⚔️ ¡El rival ${data.pokemon.name.toUpperCase()} está listo en la arena de combate!`);
        if (refreshOther) {
          loadMyPokemonData(myInput.value.trim() || 'charizard', false);
        }
      } else {
        showError('Rival no encontrado', `No existe un Pokémon rival con el nombre '${name}'.`);
      }
    } catch (err) {
      console.error('Error al cargar Pokémon rival:', err);
    }
  }

  function renderMoveButtons(movesArray) {
    movesGrid.innerHTML = '';
    const spanishMoveNames = {
      'flamethrower': 'LANZALLAMAS',
      'thunderbolt': 'RAYO',
      'tackle': 'PLACAJE',
      'dragon-claw': 'GARRA DRAGÓN',
      'ice-beam': 'RAYO HIELO',
      'surf': 'SURF',
      'earthquake': 'TERREMOTO',
      'psychic': 'PSÍQUICO',
      'shadow-ball': 'BOLA SOMBRA',
      'quick-attack': 'AT. RÁPIDO',
      'fire-punch': 'PUÑO FUEGO',
      'thunder-punch': 'PUÑO TRUENO',
      'ice-punch': 'PUÑO HIELO',
      'water-pulse': 'PULSO AGUA',
      'aerial-ace': 'GOLPE AÉREO'
    };

    movesArray.forEach((move, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `game-btn move-btn ${idx === 0 ? 'selected' : ''}`;
      btn.setAttribute('data-move', move);
      
      const title = spanishMoveNames[move] || move.toUpperCase();
      btn.innerHTML = `
        <span class="btn-title">${title}</span>
        <span class="btn-sub">${move}</span>
      `;

      if (idx === 0) moveNameInput.value = move;
      movesGrid.appendChild(btn);
    });
  }

  async function fetchRandomRival() {
    try {
      btnRandomRival.disabled = true;
      btnRandomRival.innerHTML = '<span>🎲 Generando rival...</span>';
      
      const res = await fetch('/api/random-rival');
      const data = await res.json();
      
      if (data.success && data.pokemon) {
        rivalInput.value = data.pokemon.name;
        resetBattleState();
        updatePokemonCard({ prefix: 'rival', pokemon: data.pokemon, isPlayer: false });
        // ¡RESTAURAR TAMBIÉN NUESTRO POKÉMON AL 100% PARA QUE EMPIECE UN DUELO CON HP CORRECTO!
        loadMyPokemonData(myInput.value.trim() || 'charizard', false);
        appendSystemLog(`🎲 ¡El oponente rival sacó a ${data.pokemon.name.toUpperCase()}! ¡El combate empieza!`);
      }
    } catch (err) {
      console.error('Error al solicitar rival aleatorio:', err);
    } finally {
      btnRandomRival.disabled = false;
      btnRandomRival.innerHTML = '<span>🎲 Rival Aleatorio</span>';
    }
  }

  /**
   * 5. EJECUCIÓN INMEDIATA DEL TURNO (/api/battle)
   */
  battleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    executeBattleTurn();
  });

  async function executeBattleTurn() {
    hideError();

    if (battleState.isBattleOver) {
      showError('Combate finalizado', 'El combate ya ha finalizado. Elige tu Pokémon y pulsa en "NUEVO DESAFÍO" en la ventana modal.');
      return;
    }

    if (battleState.isProcessingTurn) {
      // Ignorar clics repetidos mientras se está animando el turno actual
      return;
    }

    const payload = {
      myPokemon: myInput.value.trim(),
      rivalPokemon: rivalInput.value.trim(),
      actionType: document.querySelector('input[name="actionType"]:checked').value,
      moveName: moveNameInput.value.trim(),
      itemName: itemNameInput.value.trim(),
      myCurrentHp: battleState.myHp,
      rivalCurrentHp: battleState.rivalHp
    };

    setLoadingState(true);

    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo procesar la acción en el servidor.');
      }

      renderTurnSequence(data);

    } catch (error) {
      showError('Error de consulta a PokéAPI / Servidor', error.message);
      setLoadingState(false);
    }
  }

  /**
   * 6. SECUENCIA ANIMADA POR TURNOS
   */
  function renderTurnSequence(data) {
    const { myPokemon, rivalPokemon, turnResult } = data;

    updatePokemonCard({ prefix: 'my', pokemon: myPokemon, isPlayer: true });
    updatePokemonCard({ prefix: 'rival', pokemon: rivalPokemon, isPlayer: false });

    // PASO 1: TU ACCIÓN
    triggerSpriteAnimations(turnResult.playerAction.action, false);
    appendLogItem(turnResult.playerAction.action, turnResult.playerAction.logMessage);

    battleState.rivalHp = rivalPokemon.currentHp;
    updateHpBar('rival', rivalPokemon);

    // PASO 2: CONTRAATAQUE DEL RIVAL O FIN DE COMBATE
    if (turnResult.rivalAction) {
      setTimeout(() => {
        triggerSpriteAnimations('attack', true);
        appendLogItem('counterattack', turnResult.rivalAction.logMessage);

        battleState.myHp = myPokemon.currentHp;
        updateHpBar('my', myPokemon);

        checkWinner(turnResult.winner);
        setLoadingState(false);
      }, 750);
    } else {
      battleState.myHp = myPokemon.currentHp;
      updateHpBar('my', myPokemon);
      checkWinner(turnResult.winner);
      setLoadingState(false);
    }
  }

  function updatePokemonCard({ prefix, pokemon, isPlayer }) {
    document.getElementById(`${prefix}-name`).textContent = pokemon.name.toUpperCase();

    const spriteEl = document.getElementById(`${prefix}-sprite`);
    const targetSprite = isPlayer ? (pokemon.spriteBack || pokemon.spriteFront) : pokemon.spriteFront;
    if (targetSprite && spriteEl.src !== targetSprite) {
      spriteEl.src = targetSprite;
    }

    const typesContainer = document.getElementById(`${prefix}-types`);
    typesContainer.innerHTML = '';
    pokemon.types.forEach(type => {
      const badge = document.createElement('span');
      badge.className = `type-badge type-${type}`;
      badge.textContent = type;
      typesContainer.appendChild(badge);
    });

    updateHpBar(prefix, pokemon);
  }

  function updateHpBar(prefix, pokemon) {
    const maxHp = Number(pokemon.maxHp) || 100;
    const currentHp = (pokemon.currentHp !== undefined && pokemon.currentHp !== null) ? Number(pokemon.currentHp) : maxHp;

    // Sincronizar siempre la vida en battleState para que no se arrastre el HP del duelo anterior
    if (prefix === 'my') {
      battleState.myHp = currentHp;
    } else if (prefix === 'rival') {
      battleState.rivalHp = currentHp;
    }

    const hpBar = document.getElementById(`${prefix}-hp-bar`);
    const hpText = document.getElementById(`${prefix}-hp-text`);
    
    hpBar.max = maxHp;
    hpBar.value = currentHp;
    hpText.textContent = `${currentHp} / ${maxHp}`;

    const hpPercentage = (currentHp / maxHp) * 100;
    hpBar.classList.remove('hp-medium', 'hp-low');
    if (hpPercentage <= 25) {
      hpBar.classList.add('hp-low');
    } else if (hpPercentage <= 50) {
      hpBar.classList.add('hp-medium');
    }
  }

  function triggerSpriteAnimations(action, isRivalAttacking) {
    const mySprite = document.getElementById('my-sprite');
    const rivalSprite = document.getElementById('rival-sprite');

    if (action === 'attack' && !isRivalAttacking) {
      mySprite.classList.add('anim-attack');
      setTimeout(() => mySprite.classList.remove('anim-attack'), 400);

      setTimeout(() => {
        rivalSprite.classList.add('anim-damage');
        setTimeout(() => rivalSprite.classList.remove('anim-damage'), 500);
      }, 200);
    } 
    else if (action === 'attack' && isRivalAttacking) {
      rivalSprite.classList.add('anim-attack');
      setTimeout(() => rivalSprite.classList.remove('anim-attack'), 400);

      setTimeout(() => {
        mySprite.classList.add('anim-damage');
        setTimeout(() => mySprite.classList.remove('anim-damage'), 500);
      }, 200);
    }
    else if (action === 'heal') {
      mySprite.classList.add('anim-heal');
      setTimeout(() => mySprite.classList.remove('anim-heal'), 800);
    }
  }

  function appendLogItem(actionClass, message) {
    const li = document.createElement('li');
    li.className = `log-item log-${actionClass}`;
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

    li.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-text">${message}</span>
    `;

    battleLogList.appendChild(li);
    battleLogList.parentElement.scrollTop = battleLogList.parentElement.scrollHeight;
  }

  function appendSystemLog(message) {
    const li = document.createElement('li');
    li.className = 'log-item log-system';
    li.innerHTML = `
      <span class="log-time">[SISTEMA]</span>
      <span class="log-text">${message}</span>
    `;
    battleLogList.appendChild(li);
    battleLogList.parentElement.scrollTop = battleLogList.parentElement.scrollHeight;
  }

  /**
   * 7. DETECTAR GANADOR Y MOSTRAR MINI MODAL RETRO
   */
  function checkWinner(winnerName) {
    if (winnerName) {
      battleState.isBattleOver = true;
      const li = document.createElement('li');
      li.className = 'log-item log-win';
      li.innerHTML = `
        <span class="log-time">[VICTORIA]</span>
        <span class="log-text">🏆 ¡El combate ha finalizado! ¡${winnerName.toUpperCase()} es el ganador indiscutible de la batalla!</span>
      `;
      battleLogList.appendChild(li);
      battleLogList.parentElement.scrollTop = battleLogList.parentElement.scrollHeight;

      // Determinar si el jugador es quien ganó
      const isPlayerWinner = winnerName.trim().toLowerCase() === myInput.value.trim().toLowerCase();
      let isNewRecord = false;

      if (isPlayerWinner) {
        streakStats.current += 1;
        if (streakStats.current > streakStats.record) {
          streakStats.record = streakStats.current;
          isNewRecord = true;
        }
      } else {
        streakStats.current = 0; // Si te derrotan, la racha de victorias se reinicia a 0
      }

      localStorage.setItem('pokemon_current_streak', streakStats.current);
      localStorage.setItem('pokemon_max_record', streakStats.record);
      updateStreakScoreboard();

      setTimeout(() => showBattleModal(winnerName, isPlayerWinner, isNewRecord), 600);
    }
  }

  function showBattleModal(winnerName, isPlayerWinner, isNewRecord) {
    if (isPlayerWinner) {
      modalTitle.textContent = '🏆 ¡VICTORIA COMBATE!';
      modalTitle.style.color = '#fbbf24';
      modalMessage.textContent = `¡Excelente combate! Tu Pokémon ha superado y derrotado a ${rivalInput.value.toUpperCase()} en la arena de combate.`;
    } else {
      modalTitle.textContent = '💀 HAS CAÍDO EN COMBATE';
      modalTitle.style.color = '#f87171';
      modalMessage.textContent = `El rival ${winnerName.toUpperCase()} ha superado a tu Pokémon en la arena esta vez. ¡Prepárate para la revancha!`;
    }

    if (modalStreakVal) modalStreakVal.textContent = streakStats.current;
    if (modalRecordVal) modalRecordVal.textContent = streakStats.record;
    if (modalNewRecordBanner) {
      if (isNewRecord) {
        modalNewRecordBanner.classList.remove('hidden');
      } else {
        modalNewRecordBanner.classList.add('hidden');
      }
    }

    nextPokemonInput.value = ''; // Vacío para que al continuar se mantenga con el mismo si no escribe nada
    battleModal.classList.remove('hidden');
    setTimeout(() => nextPokemonInput.focus(), 200);
  }

  /**
   * 8. ACCIÓN DE NUEVO DESAFÍO EN LA MODAL (RIVAL ALEATORIO + CAMBIO DE POKÉMON OPCIONAL)
   */
  btnNewChallenge.addEventListener('click', startNewChallenge);

  nextPokemonInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      startNewChallenge();
    }
  });

  function startNewChallenge() {
    const chosenPokemon = nextPokemonInput.value.trim();
    if (chosenPokemon) {
      myInput.value = chosenPokemon;
    }
    // Si se dejó en blanco, myInput.value se conserva tal como estaba

    battleModal.classList.add('hidden');
    resetBattleState();
    loadMyPokemonData(myInput.value.trim() || 'charizard');
    fetchRandomRival();
    appendSystemLog(`✨ ¡NUEVO DESAFÍO EN LA ARENA! Tu Pokémon: ${myInput.value.toUpperCase()}. ¡Rival aleatorio apareciendo!`);
  }

  function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorBanner.classList.remove('hidden');
  }

  function hideError() {
    errorBanner.classList.add('hidden');
  }

  closeErrorBtn.addEventListener('click', hideError);

  function resetBattleState() {
    battleState.myHp = undefined;
    battleState.rivalHp = undefined;
    battleState.isBattleOver = false;
    battleState.isProcessingTurn = false;
    hasUsedPotionInBattle = false;

    const btnPotion = document.getElementById('btn-use-potion');
    if (btnPotion) {
      btnPotion.disabled = false;
      btnPotion.classList.remove('disabled');
      btnPotion.innerHTML = `
        <span class="btn-title">🧪 MOCHILA: USAR POCIÓN (+30 HP)</span>
        <span class="btn-sub">1 uso por combate • PokéAPI /item</span>
      `;
    }
  }

  function setLoadingState(isLoading) {
    battleState.isProcessingTurn = isLoading;
    document.querySelectorAll('.game-btn').forEach(btn => {
      btn.disabled = isLoading;
    });
  }
});
