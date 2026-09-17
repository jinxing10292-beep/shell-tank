const STORAGE_KEY = 'shell-tank-state';
const WEAPON_STATS = {
  Breaker: { damage: 18, blast: 38, speed: 11, ammo: 10 },
  RapidFire: { damage: 12, blast: 28, speed: 14, ammo: 8 },
  Shot: { damage: 24, blast: 44, speed: 10, ammo: 7 },
  Sinkhole: { damage: 16, blast: 55, speed: 8, ammo: 6 },
  Splitter: { damage: 20, blast: 46, speed: 9, ammo: 6 },
};

const appState = {
  selectedWeapon: 'Breaker',
  turn: 1,
  turnOwner: 'player',
  player: { x: 22, hp: 100, fuel: 100, ammo: 10 },
  enemy: { x: 78, hp: 100, fuel: 100, ammo: 10 },
  shotsLeft: 50,
  wind: 0.1,
  fireCharge: 40,
  charging: false,
  projectile: null,
  gameOver: false,
  lastTimestamp: 0,
};

let supabaseClient = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSupabaseConfig() {
  const config = window.__SUPABASE_CONFIG__ || {};
  return {
    url: (config.url || '').trim(),
    key: (config.key || '').trim(),
  };
}

function initializeSupabase() {
  const { url, key } = getSupabaseConfig();

  if (!url || !key || url.includes('your-project')) {
    console.warn('Supabase config missing. Using local fallback mode.');
    return null;
  }

  try {
    supabaseClient = window.supabase.createClient(url, key);
    console.log('Supabase connected.');
    return supabaseClient;
  } catch (error) {
    console.warn('Supabase initialization failed:', error);
    return null;
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedWeapon: appState.selectedWeapon,
    turn: appState.turn,
    turnOwner: appState.turnOwner,
    player: appState.player,
    enemy: appState.enemy,
    shotsLeft: appState.shotsLeft,
    wind: appState.wind,
  }));
}

async function syncStateToSupabase() {
  if (!supabaseClient) return;

  const currentState = {
    id: 'default-session',
    selected_weapon: appState.selectedWeapon,
    turn: appState.turn,
    tank_x: appState.player.x,
    fuel: appState.player.fuel,
    shots_left: appState.shotsLeft,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabaseClient.from('game_sessions').upsert(currentState, { onConflict: 'id' });
    if (error) console.warn('Supabase write failed:', error.message || error);
  } catch (error) {
    console.warn('Supabase sync warning:', error);
  }
}

function hydrateFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    if (saved.selectedWeapon) appState.selectedWeapon = saved.selectedWeapon;
    if (saved.turn) appState.turn = saved.turn;
    if (saved.turnOwner) appState.turnOwner = saved.turnOwner;
    if (saved.player) appState.player = { ...appState.player, ...saved.player };
    if (saved.enemy) appState.enemy = { ...appState.enemy, ...saved.enemy };
    if (saved.shotsLeft) appState.shotsLeft = saved.shotsLeft;
    if (saved.wind) appState.wind = saved.wind;
  } catch (error) {
    console.warn('Could not restore state:', error);
  }
}

function getBattlefield() {
  return document.getElementById('battlefield');
}

function getGroundHeightAtPercent(xPercent) {
  const battlefield = getBattlefield();
  const width = battlefield.clientWidth || 800;
  const x = (xPercent / 100) * width;
  const waves = Math.sin((x / width) * 6.2) * 20 + Math.sin((x / width) * 10.1) * 16;
  return 75 + waves;
}

function renderTanks() {
  const playerTank = document.getElementById('playerTank');
  const enemyTank = document.getElementById('enemyTank');
  const battlefield = getBattlefield();

  if (!battlefield || !playerTank || !enemyTank) return;

  const playerGround = getGroundHeightAtPercent(appState.player.x);
  const enemyGround = getGroundHeightAtPercent(appState.enemy.x);

  playerTank.style.left = `${appState.player.x}%`;
  playerTank.style.bottom = `${playerGround + 8}px`;

  enemyTank.style.left = `${appState.enemy.x}%`;
  enemyTank.style.bottom = `${enemyGround + 8}px`;

  const playerBarrel = playerTank.querySelector('.barrel');
  const enemyBarrel = enemyTank.querySelector('.barrel');

  if (playerBarrel) {
    const angle = appState.player.x < appState.enemy.x ? 18 : -165;
    playerBarrel.style.transform = `rotate(${angle}deg)`;
  }

  if (enemyBarrel) {
    const angle = appState.enemy.x > appState.player.x ? -18 : 165;
    enemyBarrel.style.transform = `rotate(${angle}deg)`;
  }

  const playerHpFill = document.getElementById('playerHpFill');
  const enemyHpFill = document.getElementById('enemyHpFill');
  if (playerHpFill) playerHpFill.style.width = `${appState.player.hp}%`;
  if (enemyHpFill) enemyHpFill.style.width = `${appState.enemy.hp}%`;
}

function updatePowerMeter() {
  const fill = document.getElementById('powerFill');
  const value = document.getElementById('powerValue');

  if (fill) {
    fill.style.width = `${appState.fireCharge}%`;
  }

  if (value) {
    value.textContent = `${Math.round(appState.fireCharge)}%`;
  }
}

function updateWeaponUi() {
  document.querySelectorAll('.weapon-card').forEach((button) => {
    button.classList.toggle('active', button.dataset.weapon === appState.selectedWeapon);
  });

  const selectedName = document.getElementById('selectedWeaponName');
  const selectedCount = document.getElementById('selectedWeaponCount');

  if (selectedName) selectedName.textContent = appState.selectedWeapon;
  if (selectedCount) selectedCount.textContent = String(WEAPON_STATS[appState.selectedWeapon].ammo);

  const shotsValue = document.getElementById('shotsLeftValue');
  if (shotsValue) shotsValue.textContent = String(appState.shotsLeft);

  const turnLabel = document.getElementById('turnLabel');
  const enemyTurnLabel = document.getElementById('enemyTurnLabel');
  if (turnLabel) turnLabel.textContent = String(appState.turn);
  if (enemyTurnLabel) enemyTurnLabel.textContent = String(Math.max(0, appState.turn - 1));
}

function setStatus(message) {
  const statusEl = document.getElementById('battleStatus');
  if (statusEl) statusEl.textContent = message;
}

function selectWeapon(weaponName) {
  if (appState.gameOver) return;
  appState.selectedWeapon = weaponName;
  updateWeaponUi();
  saveLocalState();
  syncStateToSupabase();
}

function moveTank(direction) {
  if (appState.gameOver || appState.turnOwner !== 'player') return;

  const step = direction === 'left' ? -7 : 7;
  const nextX = clamp(appState.player.x + step, 12, 86);
  appState.player.x = nextX;
  appState.player.fuel = Math.max(0, appState.player.fuel - 6);
  appState.turn += 1;
  setStatus('Enemy turn');
  renderTanks();
  updateWeaponUi();
  saveLocalState();
  syncStateToSupabase();

  setTimeout(() => {
    appState.turnOwner = 'enemy';
    enemyTurn();
  }, 500);
}

function beginFireCharge() {
  if (appState.gameOver || appState.turnOwner !== 'player') return;
  appState.charging = true;
  let stage = 0;

  const tick = () => {
    if (!appState.charging) return;
    stage += 1;
    appState.fireCharge = clamp(40 + stage * 1.8, 20, 100);
    updatePowerMeter();
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function endFireCharge() {
  if (!appState.charging) return;
  appState.charging = false;
  fireProjectile();
}

function fireProjectile() {
  if (appState.gameOver || appState.turnOwner !== 'player') return;

  const battlefield = getBattlefield();
  const playerTank = document.getElementById('playerTank');
  const projectileEl = document.createElement('div');
  projectileEl.className = 'projectile';
  battlefield.appendChild(projectileEl);

  const launcherX = appState.player.x;
  const launcherY = getGroundHeightAtPercent(launcherX) + 42;
  const elementX = (launcherX / 100) * battlefield.clientWidth;
  const elementY = battlefield.clientHeight - launcherY;

  const weapon = WEAPON_STATS[appState.selectedWeapon];
  const power = appState.fireCharge / 100;
  const vx = (weapon.speed + power * 10) * 1.2;
  const vy = 11.5 + power * 10;

  const projectile = {
    element: projectileEl,
    x: elementX + 36,
    y: elementY,
    vx: vx,
    vy: -vy,
    radius: 6,
    owner: 'player',
    damage: weapon.damage,
    blast: weapon.blast,
  };

  appState.projectile = projectile;
  appState.shotsLeft = Math.max(0, appState.shotsLeft - 1);
  appState.fireCharge = 40;
  updatePowerMeter();
  updateWeaponUi();
  saveLocalState();
  syncStateToSupabase();

  const loop = () => {
    if (!appState.projectile) return;

    const projectileState = appState.projectile;
    projectileState.x += projectileState.vx;
    projectileState.y += projectileState.vy;
    projectileState.vy += 0.18 + appState.wind;

    projectileState.element.style.left = `${projectileState.x}px`;
    projectileState.element.style.bottom = `${projectileState.y}px`;

    const groundLevel = getGroundHeightAtPercent((projectileState.x / battlefield.clientWidth) * 100);
    if (projectileState.y <= groundLevel) {
      explode(projectileState.x, projectileState.y, projectileState.blast, projectileState.owner, projectileState.damage);
      return;
    }

    if (projectileState.x < -20 || projectileState.x > battlefield.clientWidth + 20 || projectileState.y < -30) {
      explode(projectileState.x, projectileState.y, projectileState.blast, projectileState.owner, projectileState.damage);
      return;
    }

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

function explode(x, y, blastRadius, owner, damage) {
  if (!appState.projectile) return;

  const battlefield = getBattlefield();
  const flash = document.createElement('div');
  flash.className = 'impact-flash';
  flash.style.left = `${x}px`;
  flash.style.top = `${battlefield.clientHeight - y}px`;
  flash.style.width = `${blastRadius}px`;
  flash.style.height = `${blastRadius}px`;
  battlefield.appendChild(flash);

  setTimeout(() => flash.remove(), 180);

  const enemyHit = Math.abs(x - (appState.enemy.x / 100) * battlefield.clientWidth) < blastRadius * 1.2;
  const playerHit = Math.abs(x - (appState.player.x / 100) * battlefield.clientWidth) < blastRadius * 1.2;

  if (owner === 'player' && enemyHit) {
    appState.enemy.hp = clamp(appState.enemy.hp - damage, 0, 100);
  }

  if (owner === 'enemy' && playerHit) {
    appState.player.hp = clamp(appState.player.hp - damage, 0, 100);
  }

  appState.projectile.element.remove();
  appState.projectile = null;
  renderTanks();

  if (appState.enemy.hp <= 0 || appState.player.hp <= 0) {
    endGame();
    return;
  }

  if (owner === 'player') {
    appState.turnOwner = 'enemy';
    setStatus('Enemy turn');
    setTimeout(() => enemyTurn(), 500);
  } else {
    appState.turnOwner = 'player';
    setStatus('Player turn');
  }
}

function enemyTurn() {
  if (appState.gameOver) return;

  const moveChance = Math.random();
  if (moveChance > 0.4) {
    const direction = appState.enemy.x > appState.player.x ? -1 : 1;
    appState.enemy.x = clamp(appState.enemy.x + direction * 7, 18, 86);
  }

  renderTanks();

  const enemyWeapon = Object.keys(WEAPON_STATS)[Math.floor(Math.random() * Object.keys(WEAPON_STATS).length)];
  const projectileDamage = WEAPON_STATS[enemyWeapon].damage;

  setTimeout(() => {
    if (appState.gameOver) return;
    launchEnemyShot(enemyWeapon, projectileDamage);
  }, 500);
}

function launchEnemyShot(weaponName, damage) {
  const battlefield = getBattlefield();
  const enemyTank = document.getElementById('enemyTank');
  const projectileEl = document.createElement('div');
  projectileEl.className = 'projectile';
  battlefield.appendChild(projectileEl);

  const enemyX = appState.enemy.x;
  const enemyGround = getGroundHeightAtPercent(enemyX) + 42;
  const startX = (enemyX / 100) * battlefield.clientWidth;
  const startY = battlefield.clientHeight - enemyGround;
  const dx = appState.player.x - appState.enemy.x;
  const power = clamp(Math.abs(dx) * 0.65 + 35, 32, 75);

  const projectile = {
    element: projectileEl,
    x: startX,
    y: startY,
    vx: (dx < 0 ? -1 : 1) * (power / 9),
    vy: -(power / 3.5),
    radius: 6,
    owner: 'enemy',
    damage: damage,
    blast: WEAPON_STATS[weaponName].blast,
  };

  appState.projectile = projectile;

  const loop = () => {
    if (!appState.projectile) return;

    const current = appState.projectile;
    current.x += current.vx + appState.wind * 4;
    current.y += current.vy;
    current.vy += 0.2;

    current.element.style.left = `${current.x}px`;
    current.element.style.bottom = `${current.y}px`;

    const groundLevel = getGroundHeightAtPercent((current.x / battlefield.clientWidth) * 100);
    if (current.y <= groundLevel) {
      explode(current.x, current.y, current.blast, current.owner, current.damage);
      return;
    }

    if (current.x < -20 || current.x > battlefield.clientWidth + 20 || current.y < -30) {
      explode(current.x, current.y, current.blast, current.owner, current.damage);
      return;
    }

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

function endGame() {
  appState.gameOver = true;
  const winner = appState.player.hp > 0 ? 'Player Wins' : 'Enemy Wins';
  setStatus(winner);
  document.getElementById('weaponOverlay')?.classList.remove('hidden');
  const box = document.querySelector('.weapon-box h2');
  if (box) box.textContent = winner;
}

function attachEvents() {
  document.querySelectorAll('.weapon-card').forEach((button) => {
    button.addEventListener('click', () => selectWeapon(button.dataset.weapon));
  });

  document.querySelectorAll('.move-btn').forEach((button) => {
    button.addEventListener('click', () => moveTank(button.dataset.direction));
  });

  const fireBtn = document.getElementById('fireBtn');
  fireBtn?.addEventListener('pointerdown', beginFireCharge);
  fireBtn?.addEventListener('pointerup', endFireCharge);
  fireBtn?.addEventListener('pointerleave', endFireCharge);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') moveTank('left');
    if (event.key === 'ArrowRight') moveTank('right');
    if (event.key === ' ' && appState.turnOwner === 'player') {
      event.preventDefault();
      beginFireCharge();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (appState.charging) endFireCharge();
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === ' ') {
      event.preventDefault();
      if (appState.charging) endFireCharge();
    }
  });
}

function boot() {
  hydrateFromStorage();
  initializeSupabase();
  attachEvents();
  updatePowerMeter();
  updateWeaponUi();
  renderTanks();
  setStatus('Player turn');
}

window.addEventListener('DOMContentLoaded', boot);
