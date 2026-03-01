(function () {
  'use strict';

  const DECORATIONS_BASE = 'assets/decorationImages';
  const DECORATION_IDS = [];
  for (let i = 1; i <= 21; i++) DECORATION_IDS.push('design' + i);

  const DEFAULT_COINS = 150;
  const STORAGE_KEYS = { coins: 'den_coins', owned: 'den_owned', placed: 'den_placed' };

  function getPrice(id) {
    const n = parseInt(id.replace('design', ''), 10);
    return 10 + (n % 5) * 5;
  }

  function loadCoins() {
    const raw = localStorage.getItem(STORAGE_KEYS.coins);
    if (raw === null) return DEFAULT_COINS;
    const n = parseInt(raw, 10);
    return isNaN(n) ? DEFAULT_COINS : Math.max(0, n);
  }

  function saveCoins(amount) {
    localStorage.setItem(STORAGE_KEYS.coins, String(amount));
  }

  function loadOwned() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.owned);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveOwned(owned) {
    localStorage.setItem(STORAGE_KEYS.owned, JSON.stringify(owned));
  }

  function loadPlaced() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.placed);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map(function (item) {
        return { id: item.id, row: item.row, col: item.col, layer: item.layer === 1 ? 1 : 0 };
      });
    } catch (_) {
      return [];
    }
  }

  function savePlaced(placed) {
    localStorage.setItem(STORAGE_KEYS.placed, JSON.stringify(placed));
  }

  let coins = loadCoins();
  let owned = loadOwned();
  let placed = loadPlaced();
  let placeMode = false;
  let removeMode = false;
  let selectedDecorationId = null;
  let selectedLayer = 0;

  const GRID_ROWS = 6;
  const GRID_COLS = 6;

  function updateCoinDisplay() {
    const el = document.getElementById('coin-count');
    if (el) el.textContent = coins;
  }

  function renderShop() {
    const container = document.getElementById('decoration-shop');
    if (!container) return;
    container.innerHTML = '';
    DECORATION_IDS.forEach(function (id) {
      const ownedSet = new Set(owned);
      const isOwned = ownedSet.has(id);
      const price = getPrice(id);
      const card = document.createElement('div');
      card.className = 'shop-item' + (isOwned ? ' shop-item-owned' : '');
      card.innerHTML =
        '<div class="shop-item-img-wrap">' +
          '<img src="' + DECORATIONS_BASE + '/' + id + '.png" alt="' + id + '" class="shop-item-img" />' +
        '</div>' +
        '<span class="shop-item-name">' + id + '</span>' +
        (isOwned
          ? '<span class="shop-item-owned-label">Owned</span>'
          : '<button type="button" class="den-btn den-btn-buy" data-id="' + id + '" data-price="' + price + '">' + price + ' 🪙</button>');
      container.appendChild(card);

      if (!isOwned) {
        const btn = card.querySelector('.den-btn-buy');
        if (btn) btn.addEventListener('click', function () { tryBuy(btn.dataset.id, parseInt(btn.dataset.price, 10)); });
      }
    });
  }

  function tryBuy(id, price) {
    if (owned.indexOf(id) !== -1) return;
    if (coins < price) {
      alert('Not enough coins!');
      return;
    }
    coins -= price;
    owned = owned.slice();
    owned.push(id);
    saveCoins(coins);
    saveOwned(owned);
    updateCoinDisplay();
    renderShop();
    renderMyDecorations();
  }

  function renderMyDecorations() {
    const container = document.getElementById('my-decorations');
    if (!container) return;
    container.innerHTML = '';
    owned.forEach(function (id) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'my-dec-item' + (placeMode && selectedDecorationId === id ? ' my-dec-item-selected' : '');
      card.dataset.id = id;
      card.innerHTML = '<img src="' + DECORATIONS_BASE + '/' + id + '.png" alt="' + id + '" class="my-dec-item-img" />';
      card.addEventListener('click', function () {
        if (!placeMode) return;
        selectedDecorationId = selectedDecorationId === id ? null : id;
        renderMyDecorations();
        updatePlaceModeStatus();
      });
      container.appendChild(card);
    });
  }

  function updatePlaceModeStatus() {
    const status = document.getElementById('place-mode-status');
    if (!status) return;
    if (removeMode) {
      status.textContent = 'Tap a cell to remove the top item';
      return;
    }
    if (!placeMode) {
      status.textContent = '';
      return;
    }
    var layerName = selectedLayer === 1 ? 'On top' : 'Ground';
    status.textContent = selectedDecorationId
      ? 'Selected: ' + selectedDecorationId + ' (' + layerName + ') – tap a grid cell'
      : 'Pick an item above, then tap a grid cell';
  }

  function buildGrid() {
    const grid = document.getElementById('garden-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'garden-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        grid.appendChild(cell);
      }
    }
    function handleCellAction(e) {
      const cell = e.target.closest('.garden-cell');
      if (!cell) return;
      e.preventDefault();
      e.stopPropagation();
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      if (!Number.isNaN(row) && !Number.isNaN(col) && row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        onGridCellClick(row, col);
      }
    }
    grid.addEventListener('click', handleCellAction);
    grid.addEventListener('touchend', function (e) {
      if (e.changedTouches && e.changedTouches[0]) {
        var touch = e.changedTouches[0];
        var el = document.elementFromPoint(touch.clientX, touch.clientY);
        var cell = el && el.closest ? el.closest('.garden-cell') : null;
        if (cell) {
          e.preventDefault();
          var r = parseInt(cell.dataset.row, 10);
          var c = parseInt(cell.dataset.col, 10);
          if (!Number.isNaN(r) && !Number.isNaN(c) && r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            onGridCellClick(r, c);
          }
        }
      }
    }, { passive: false });
  }

  function renderPlaced() {
    const grid = document.getElementById('garden-grid');
    if (!grid) return;
    const cells = grid.querySelectorAll('.garden-cell');
    cells.forEach(function (cell) {
      const wraps = cell.querySelectorAll('.garden-cell-decoration');
      wraps.forEach(function (w) { w.remove(); });
    });
    var sorted = placed.slice().sort(function (a, b) { return (a.layer || 0) - (b.layer || 0); });
    sorted.forEach(function (item) {
      const idx = item.row * GRID_COLS + item.col;
      const cell = grid.children[idx];
      if (!cell) return;
      const wrap = document.createElement('div');
      wrap.className = 'garden-cell-decoration garden-cell-layer-' + (item.layer || 0);
      const img = document.createElement('img');
      img.src = DECORATIONS_BASE + '/' + item.id + '.png';
      img.alt = item.id;
      img.className = 'garden-cell-decoration-img';
      wrap.appendChild(img);
      cell.appendChild(wrap);
    });
  }

  function getPlacedInCell(row, col) {
    return placed.filter(function (p) { return p.row === row && p.col === col; }).sort(function (a, b) { return (b.layer || 0) - (a.layer || 0); });
  }

  function getTopPlacedInCell(row, col) {
    var inCell = getPlacedInCell(row, col);
    return inCell.length > 0 ? inCell[0] : null;
  }

  function removeTopAt(row, col) {
    var top = getTopPlacedInCell(row, col);
    if (!top) return;
    placed = placed.filter(function (p) {
      return !(p.row === row && p.col === col && (p.layer || 0) === (top.layer || 0));
    });
    savePlaced(placed);
    renderPlaced();
  }

  function onGridCellClick(row, col) {
    if (removeMode) {
      removeTopAt(row, col);
      return;
    }
    if (!placeMode) return;
    if (!selectedDecorationId) {
      var status = document.getElementById('place-mode-status');
      if (status) {
        status.textContent = 'Select a decoration above first, then tap a cell';
        setTimeout(function () { updatePlaceModeStatus(); }, 2000);
      }
      return;
    }
    placed = placed.slice();
    placed.push({ id: selectedDecorationId, row: row, col: col, layer: selectedLayer });
    savePlaced(placed);
    renderPlaced();
  }

  function setPlaceMode(on) {
    placeMode = on;
    if (!placeMode) selectedDecorationId = null;
    var placeBtn = document.getElementById('btn-place-mode');
    if (placeBtn) {
      placeBtn.setAttribute('aria-pressed', placeMode ? 'true' : 'false');
      placeBtn.textContent = placeMode ? 'Cancel place mode' : 'Place in garden';
    }
    var layerSel = document.getElementById('layer-selector');
    if (layerSel) layerSel.style.display = placeMode ? 'flex' : 'none';
    updatePlaceModeStatus();
    renderMyDecorations();
  }

  function setRemoveMode(on) {
    removeMode = on;
    var removeBtn = document.getElementById('btn-remove-mode');
    if (removeBtn) {
      removeBtn.setAttribute('aria-pressed', removeMode ? 'true' : 'false');
      removeBtn.textContent = removeMode ? 'Cancel remove' : 'Remove from garden';
    }
    updatePlaceModeStatus();
  }

  function init() {
    updateCoinDisplay();
    renderShop();
    renderMyDecorations();
    buildGrid();
    renderPlaced();

    const placeBtn = document.getElementById('btn-place-mode');
    const hintEl = document.getElementById('placement-hint');
    const removeBtn = document.getElementById('btn-remove-mode');

    if (placeBtn) {
      placeBtn.addEventListener('click', function () {
        if (placeMode) {
          setPlaceMode(false);
          if (hintEl) hintEl.style.display = 'none';
        } else {
          setRemoveMode(false);
          setPlaceMode(true);
          if (hintEl) hintEl.style.display = 'block';
        }
      });
    }
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        if (removeMode) {
          setRemoveMode(false);
        } else {
          setPlaceMode(false);
          if (hintEl) hintEl.style.display = 'none';
          setRemoveMode(true);
        }
      });
    }

    document.querySelectorAll('.den-btn-layer').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var layer = parseInt(btn.dataset.layer, 10);
        if (layer === 0 || layer === 1) {
          selectedLayer = layer;
          document.querySelectorAll('.den-btn-layer').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          updatePlaceModeStatus();
        }
      });
    });

    if (document.getElementById('placement-hint')) {
      document.getElementById('placement-hint').style.display = 'none';
    }
    if (document.getElementById('layer-selector')) {
      document.getElementById('layer-selector').style.display = 'none';
    }
  }

  init();
})();
