/**
 * ============================================================================
 * SERVIDOR BACKEND - SIMULADOR DE BATALLA POKÉMON (NODE.JS + EXPRESS)
 * ============================================================================
 * 
 * ARQUITECTURA CLIENTE-SERVIDOR & ESTILO VIDEOJUEGO CLÁSICO POKÉMON:
 * 1. Consuma los 5 endpoints obligatorios de PokéAPI:
 *    - /pokemon/{name}         -> Stats base (hp, attack), sprites (front/back).
 *    - /pokemon-species/{name} -> Información de especie y descripción en español.
 *    - /move/{name}            -> Potencia, precisión y tipo elemental del ataque.
 *    - /type/{name}            -> Efectividad elemental (Súper Efectivo, etc.).
 *    - /item/{name}            -> Valor de curación de pociones/objetos.
 * 2. GET /api/random-rival     -> Genera un oponente aleatorio desde el servidor.
 * 3. POST /api/battle          -> Calcula el turno clásico (Tu orden + Contraataque).
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Función auxiliar para consultar la PokéAPI con manejo de errores (404, etc.)
 */
async function fetchPokeApi(endpoint, entityName, label) {
  const url = `${POKEAPI_BASE_URL}/${endpoint}/${String(entityName).toLowerCase().trim()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`El ${label} '${entityName}' no existe en el mundo Pokémon.`);
      }
      throw new Error(`Error en PokéAPI (${response.status}) al consultar ${label} '${entityName}'.`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * ENDPOINT 1: /pokemon/{name}
 * Obtiene stats base, tipos y sprites animados (Frontal para rival, Trasero para tu Pokémon).
 */
async function getPokemonData(nameOrId) {
  const data = await fetchPokeApi('pokemon', nameOrId, 'Pokémon');
  
  const hpStat = data.stats.find(s => s.stat.name === 'hp')?.base_stat || 100;
  const attackStat = data.stats.find(s => s.stat.name === 'attack')?.base_stat || 50;
  
  // Sprite frontal (para el rival que está en frente)
  const spriteFront = data.sprites.other?.showdown?.front_default ||
                      data.sprites.other?.['official-artwork']?.front_default ||
                      data.sprites.front_default;

  // Sprite de espalda (estilo auténtico videojuego Pokémon para tu propio Pokémon)
  const spriteBack = data.sprites.other?.showdown?.back_default ||
                     data.sprites.back_default ||
                     spriteFront;

  const types = data.types.map(t => t.type.name);

  const knownDamagingMoves = [
    'flamethrower', 'thunderbolt', 'ice-beam', 'surf', 'earthquake',
    'psychic', 'shadow-ball', 'dragon-claw', 'quick-attack', 'tackle',
    'fire-punch', 'thunder-punch', 'ice-punch', 'water-pulse', 'aerial-ace'
  ];
  const matchedMoves = data.moves
    ? data.moves.map(m => m.move.name).filter(name => knownDamagingMoves.includes(name))
    : [];
  const defaultMoves = ['flamethrower', 'thunderbolt', 'tackle', 'dragon-claw'];
  const availableMoves = Array.from(new Set([...matchedMoves, ...defaultMoves])).slice(0, 4);

  const maxHpValue = hpStat * 2;
  return {
    id: data.id,
    name: data.name,
    maxHp: maxHpValue, // Escalado de HP para una batalla con turnos duraderos
    currentHp: maxHpValue, // Inicializar siempre el HP actual al 100%
    baseAttack: attackStat,
    spriteFront: spriteFront,
    spriteBack: spriteBack,
    types: types,
    availableMoves: availableMoves
  };
}

/**
 * ENDPOINT 2: /pokemon-species/{name}
 * Consulta metadatos biológicos y categoría en español.
 */
async function getPokemonSpeciesData(nameOrId) {
  const data = await fetchPokeApi('pokemon-species', nameOrId, 'Especie del Pokémon');
  
  const entry = data.flavor_text_entries.find(e => e.language.name === 'es') ||
                data.flavor_text_entries.find(e => e.language.name === 'en');
                
  const genusEntry = data.genera.find(g => g.language.name === 'es') ||
                     data.genera.find(g => g.language.name === 'en');

  return {
    category: genusEntry ? genusEntry.genus : 'Pokémon',
    description: entry ? entry.flavor_text.replace(/\s+/g, ' ') : 'Sin descripción disponible.'
  };
}

/**
 * ENDPOINT 3: /move/{name}
 * Obtiene la potencia base (power), tipo y precisión del movimiento.
 */
async function getMoveData(moveName) {
  const spanishToEnglishMoves = {
    'lanzallamas': 'flamethrower',
    'rayo': 'thunderbolt',
    'placaje': 'tackle',
    'garra dragón': 'dragon-claw',
    'garra-dragon': 'dragon-claw',
    'rayo hielo': 'ice-beam',
    'rayo-hielo': 'ice-beam',
    'rayohielo': 'ice-beam',
    'surf': 'surf',
    'terremoto': 'earthquake',
    'psíquico': 'psychic',
    'psiquico': 'psychic',
    'bola sombra': 'shadow-ball',
    'bola-sombra': 'shadow-ball',
    'at. rápido': 'quick-attack',
    'ataque rápido': 'quick-attack',
    'ataque-rapido': 'quick-attack',
    'puño fuego': 'fire-punch',
    'puño trueno': 'thunder-punch',
    'puño hielo': 'ice-punch',
    'pulso agua': 'water-pulse',
    'golpe aéreo': 'aerial-ace'
  };

  const normalized = moveName.trim().toLowerCase();
  const apiMoveName = spanishToEnglishMoves[normalized] || normalized;
  const data = await fetchPokeApi('move', apiMoveName, 'Movimiento');
  return {
    name: data.names.find(n => n.language.name === 'es')?.name || data.name,
    power: data.power || 45,
    type: data.type.name,
    accuracy: data.accuracy || 100
  };
}

/**
 * ENDPOINT 4: /type/{name}
 * Consulta las relaciones de daño para calcular si es Súper Efectivo (x2), etc.
 */
async function getTypeEffectiveness(moveType, targetTypes) {
  const data = await fetchPokeApi('type', moveType, 'Tipo Pokémon');
  const relations = data.damage_relations;

  let multiplier = 1.0;
  let effectivenessLabel = '';

  targetTypes.forEach(targetType => {
    if (relations.double_damage_to.some(t => t.name === targetType)) {
      multiplier *= 2.0;
      effectivenessLabel = '¡Es SÚPER EFECTIVO! 🔥 (Daño x2)';
    } else if (relations.half_damage_to.some(t => t.name === targetType)) {
      multiplier *= 0.5;
      effectivenessLabel = 'No es muy efectivo... 🛡️ (Daño x0.5)';
    } else if (relations.no_damage_to.some(t => t.name === targetType)) {
      multiplier *= 0.0;
      effectivenessLabel = '¡No tuvo efecto alguno! 🚫 (Daño x0)';
    }
  });

  return { multiplier, effectivenessLabel };
}

/**
 * ENDPOINT 5: /item/{name}
 * Obtiene el valor de curación del objeto/poción seleccionado.
 */
async function getItemData(itemName) {
  const data = await fetchPokeApi('item', itemName, 'Objeto / Poción');
  
  let healAmount = 30;
  const nameLower = data.name.toLowerCase();
  
  if (nameLower.includes('super-potion')) healAmount = 50;
  else if (nameLower.includes('hyper-potion')) healAmount = 120;
  else if (nameLower.includes('max-potion') || nameLower.includes('full-restore')) healAmount = 999;
  else if (nameLower.includes('potion')) healAmount = 30;

  return {
    name: data.names.find(n => n.language.name === 'es')?.name || data.name,
    healAmount: healAmount
  };
}

/**
 * GET /api/random-rival
 * Genera un oponente aleatorio de los primeros 151 Pokémon.
 */
app.get('/api/random-rival', async (req, res) => {
  try {
    const randomId = Math.floor(Math.random() * 151) + 1;
    const [pokemon, species] = await Promise.all([
      getPokemonData(randomId),
      getPokemonSpeciesData(randomId)
    ]);
    pokemon.speciesInfo = species;

    return res.status(200).json({
      success: true,
      pokemon: pokemon
    });
  } catch (error) {
    console.error('Error generando rival aleatorio:', error.message);
    return res.status(500).json({
      success: false,
      error: 'No se pudo generar el rival aleatorio desde la PokéAPI.'
    });
  }
});

/**
 * GET /api/pokemon-info/:name
 * Permite al frontend cargar la información y movimientos de tu Pokémon elegido
 */
app.get('/api/pokemon-info/:name', async (req, res) => {
  try {
    const [pokemon, species] = await Promise.all([
      getPokemonData(req.params.name),
      getPokemonSpeciesData(req.params.name)
    ]);
    pokemon.speciesInfo = species;
    return res.status(200).json({ success: true, pokemon });
  } catch (error) {
    return res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * Pool de movimientos ofensivos del rival
 */
const RIVAL_OFFENSIVE_MOVES = [
  'flamethrower', 'thunderbolt', 'ice-beam', 'surf', 'earthquake',
  'psychic', 'shadow-ball', 'dragon-claw', 'sludge-bomb', 'energy-ball',
  'rock-slide', 'aerial-ace', 'dark-pulse', 'flash-cannon', 'quick-attack'
];

/**
 * RUTA PRINCIPAL (POST /api/battle)
 * Simula 1 turno de combate: Tu Acción + Contraataque del Rival.
 */
app.post('/api/battle', async (req, res) => {
  try {
    const {
      myPokemon: myPokemonName,
      rivalPokemon: rivalPokemonName,
      actionType,
      moveName,
      itemName,
      myCurrentHp,
      rivalCurrentHp
    } = req.body;

    if (!myPokemonName || !rivalPokemonName) {
      return res.status(400).json({
        success: false,
        error: 'Debes indicar el nombre de tu Pokémon y el del rival.'
      });
    }

    if (actionType !== 'attack' && actionType !== 'heal') {
      return res.status(400).json({
        success: false,
        error: 'La acción debe ser "attack" (Atacar) o "heal" (Curar).'
      });
    }

    // Consulta en paralelo
    const [myPokemon, mySpecies, rivalPokemon, rivalSpecies] = await Promise.all([
      getPokemonData(myPokemonName),
      getPokemonSpeciesData(myPokemonName),
      getPokemonData(rivalPokemonName),
      getPokemonSpeciesData(rivalPokemonName)
    ]);

    myPokemon.speciesInfo = mySpecies;
    rivalPokemon.speciesInfo = rivalSpecies;

    myPokemon.currentHp = myCurrentHp !== undefined ? Number(myCurrentHp) : myPokemon.maxHp;
    rivalPokemon.currentHp = rivalCurrentHp !== undefined ? Number(rivalCurrentHp) : rivalPokemon.maxHp;

    let playerLogMessage = '';
    let rivalLogMessage = null;
    let winner = null;

    // ========================================================================
    // TURNO 1: ACCIÓN DEL JUGADOR
    // ========================================================================
    if (actionType === 'attack') {
      if (!moveName) {
        return res.status(400).json({
          success: false,
          error: 'Debes escribir o seleccionar un movimiento de ataque (ej. flamethrower).'
        });
      }

      const moveData = await getMoveData(moveName);
      const effectiveness = await getTypeEffectiveness(moveData.type, rivalPokemon.types);

      const baseDamage = Math.round((moveData.power * 0.45) * effectiveness.multiplier);
      const randomBonus = Math.floor(Math.random() * 6);
      const totalDamage = Math.max(1, baseDamage + randomBonus);

      rivalPokemon.currentHp = Math.max(0, rivalPokemon.currentHp - totalDamage);
      playerLogMessage = `⚔️ ¡${myPokemon.name.toUpperCase()} usó [${moveData.name.toUpperCase()}]! ${effectiveness.effectivenessLabel} Causó ${totalDamage} de daño a ${rivalPokemon.name.toUpperCase()}.`;
    } 
    else if (actionType === 'heal') {
      if (!itemName) {
        return res.status(400).json({
          success: false,
          error: 'Debes escribir o seleccionar una poción/objeto curativo.'
        });
      }

      const itemData = await getItemData(itemName);
      const hpBefore = myPokemon.currentHp;
      myPokemon.currentHp = Math.min(myPokemon.maxHp, myPokemon.currentHp + itemData.healAmount);
      const recovered = myPokemon.currentHp - hpBefore;

      playerLogMessage = `🧪 ¡Utilizaste [${itemData.name.toUpperCase()}]! ${myPokemon.name.toUpperCase()} recuperó ${recovered} HP (${myPokemon.currentHp}/${myPokemon.maxHp}).`;
    }

    if (rivalPokemon.currentHp === 0) {
      winner = myPokemon.name;
    }

    // ========================================================================
    // TURNO 2: CONTRAATAQUE AUTOMÁTICO DEL RIVAL
    // ========================================================================
    if (rivalPokemon.currentHp > 0) {
      const rivalMovePool = RIVAL_OFFENSIVE_MOVES;
      const randomMoveName = rivalMovePool[Math.floor(Math.random() * rivalMovePool.length)];

      try {
        const rivalMoveData = await getMoveData(randomMoveName);
        const rivalEffectiveness = await getTypeEffectiveness(rivalMoveData.type, myPokemon.types);

        const baseRivalDamage = Math.round((rivalMoveData.power * 0.45) * rivalEffectiveness.multiplier);
        const rivalRandomBonus = Math.floor(Math.random() * 5);
        const totalRivalDamage = Math.max(1, baseRivalDamage + rivalRandomBonus);

        myPokemon.currentHp = Math.max(0, myPokemon.currentHp - totalRivalDamage);
        rivalLogMessage = `🤖 ¡El rival ${rivalPokemon.name.toUpperCase()} contraataca con [${rivalMoveData.name.toUpperCase()}]! ${rivalEffectiveness.effectivenessLabel} Causó ${totalRivalDamage} de daño a ${myPokemon.name.toUpperCase()}.`;

        if (myPokemon.currentHp === 0) {
          winner = rivalPokemon.name;
        }
      } catch (err) {
        rivalLogMessage = `🤖 ¡El rival ${rivalPokemon.name.toUpperCase()} se prepara para atacar en el siguiente turno!`;
      }
    }

    return res.status(200).json({
      success: true,
      turnResult: {
        playerAction: {
          action: actionType,
          logMessage: playerLogMessage
        },
        rivalAction: rivalLogMessage ? {
          action: 'counterattack',
          logMessage: rivalLogMessage
        } : null,
        winner: winner
      },
      myPokemon: myPokemon,
      rivalPokemon: rivalPokemon
    });

  } catch (error) {
    console.error('Error en simulación de batalla:', error.message);
    return res.status(404).json({
      success: false,
      error: error.message || 'Ocurrió un error inesperado al consultar la PokéAPI.',
      type: 'API_ERROR'
    });
  }
});

app.listen(PORT, () => {
  console.log('======================================================');
  console.log(`🎮 Servidor Pokémon Battle Simulator en marcha!`);
  console.log(`🚀 Accede a la aplicación en: http://localhost:${PORT}`);
  console.log('======================================================');
});
