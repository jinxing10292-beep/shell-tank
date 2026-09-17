const STORAGE_KEY = 'shell-tank-state';
const WEAPONS = [
  { name: 'Breaker', damage: 10, color: 'green' },
  { name: 'RapidFire', damage: 12, color: 'cyan' },
  { name: 'Shot', damage: 15, color: 'orange' },
  { name: 'Sinkhole', damage: 18, color: 'purple' },
  { name: 'Splitter', damage: 14, color: 'yellow' },
];

const appState = {
  selectedWeapon: 'Breaker',
  tankX: 18,
  fuel: 100,
  shotsLeft: 50,
  turn: 1,
  isFireActive: false,
};

let supabaseClient = null;

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
    console.warn('Supabase config missing. Using local storage fallback.');
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
    tankX: appState.tankX,
    fuel: appState.fuel,
    shotsLeft: appState.shotsLeft,
    turn: appState.turn,
  }));
}

async function syncStateToSupabase() {
  if (!supabaseClient) return;

  const currentState = {
    id: 'default-session',
    selected_weapon: appState.selectedWeapon,
    tank_x: appState.tankX,
    fuel: appState.fuel,
    shots_left: appState.shotsLeft,
    turn: appState.turn,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabaseClient.from('game_sessions').upsert(currentState, {
      onConflict: 'id',
    });

    if (error) {
      console.warn('Supabase write failed:', error.message || error);
    }
  } catch (error) {
    console.warn('Supabase sync warning:', error);
  }
}

function hydrateFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    appState.selectedWeapon = saved.selectedWeapon || appState.selectedWeapon;
    appState.tankX = saved.tankX ?? appState.tankX;
    appState.fuel = saved.fuel ?? appState.fuel;
    appState.shotsLeft = saved.shotsLeft ?? appState.shotsLeft;
    appState.turn = saved.turn ?? appState.turn;
  } catch (error) {
    console.warn('Could not restore saved state.', error);
  }
}

function updateHud() {
  const playerTank = document.getElementById('playerTank');
  const weaponButtons = document.querySelectorAll('.weapon-card');

  weaponButtons.forEach((button) => {
    const isActive = button.dataset.weapon === appState.selectedWeapon;
    button.classList.toggle('active', isActive);
  });

  if (playerTank) {
    const clampedX = Math.max(8, Math.min(82, appState.tankX));
    playerTank.style.left = `${clampedX}%`;
  }

  const shotsValue = document.querySelector('.shots-indicator .value');
  if (shotsValue) {
    shotsValue.textContent = String(appState.shotsLeft);
  }

  const statusLabel = document.querySelector('.label-row .name');
  if (statusLabel) {
    statusLabel.textContent = `0 / ${appState.fuel} Armor`;
  }
}

function selectWeapon(weaponName) {
  const availableWeapons = WEAPONS.map((weapon) => weapon.name);
  if (!availableWeapons.includes(weaponName)) return;

  appState.selectedWeapon = weaponName;
  updateHud();
  saveLocalState();
  syncStateToSupabase();
}

function moveTank(direction) {
  const delta = direction === 'left' ? -8 : 8;
  const nextFuel = Math.max(0, appState.fuel - 5);

  if (nextFuel <= 0 && delta > 0) {
    appState.fuel = 0;
    updateHud();
    return;
  }

  appState.fuel = nextFuel;
  appState.tankX = Math.max(10, Math.min(85, appState.tankX + delta));
  appState.turn += 1;
  updateHud();
  saveLocalState();
  syncStateToSupabase();
}

function triggerFire() {
  const overlay = document.getElementById('weaponOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }

  appState.isFireActive = true;
  const shot = document.createElement('div');
  shot.className = 'shot-trace';
  document.querySelector('.battlefield').appendChild(shot);

  const tank = document.getElementById('playerTank');
  const startLeft = tank.offsetLeft + tank.offsetWidth * 0.8;
  const startBottom = tank.offsetTop + tank.offsetHeight * 0.46;
  shot.style.left = `${startLeft}px`;
  shot.style.bottom = `${startBottom}px`;

  const projectile = {
    x: startLeft,
    y: startBottom,
    dx: 16,
    dy: -4,
  };

  const animate = () => {
    projectile.x += projectile.dx;
    projectile.y += projectile.dy;
    shot.style.left = `${projectile.x}px`;
    shot.style.bottom = `${projectile.y}px`;

    const battlefield = document.querySelector('.battlefield');
    const maxX = battlefield.clientWidth;
    const minY = 0;

    if (projectile.x > maxX || projectile.y <= minY) {
      shot.remove();
      appState.isFireActive = false;
      overlay?.classList.add('hidden');
      const shotValue = document.querySelector('.shots-indicator .value');
      if (shotValue) {
        appState.shotsLeft = Math.max(0, appState.shotsLeft - 1);
        shotValue.textContent = String(appState.shotsLeft);
      }
      saveLocalState();
      syncStateToSupabase();
      return;
    }

    projectile.dy -= 0.09;
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

function attachEvents() {
  document.querySelectorAll('.weapon-card').forEach((button) => {
    button.addEventListener('click', () => selectWeapon(button.dataset.weapon));
  });

  document.querySelectorAll('.move-btn').forEach((button) => {
    button.addEventListener('click', () => moveTank(button.dataset.direction));
  });

  document.getElementById('fireBtn')?.addEventListener('click', triggerFire);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') moveTank('left');
    if (event.key === 'ArrowRight') moveTank('right');
    if (event.key === ' ') {
      event.preventDefault();
      triggerFire();
    }
  });
}

function boot() {
  hydrateFromStorage();
  initializeSupabase();
  attachEvents();
  updateHud();
}

window.addEventListener('DOMContentLoaded', boot);
