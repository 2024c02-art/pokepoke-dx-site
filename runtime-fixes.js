/* Pokepoke DX hotfixes: supplemental evolutions, dual-energy settings, deck sync. */
(() => {
  'use strict';
  const normalize = (values) => typeof normalizeEnergyTypes === 'function'
    ? normalizeEnergyTypes(values)
    : [...new Set((Array.isArray(values) ? values : []).filter((v) => ENERGY_TYPES.includes(v)))].slice(0, 3);
  const allCards = () => {
    const map = new Map();
    for (const card of [...(Array.isArray(CARDS) ? CARDS : []), ...Object.values(CARD_MAP || {})]) {
      if (card && card.id) map.set(String(card.id), card);
    }
    return [...map.values()];
  };

  // Rare Candy: supplemental Stage 1 cards may exist in CARD_MAP but not CARDS.
  if (typeof battle !== 'undefined' && battle && !battle.__pdxRareCandyFix) {
    battle.__pdxRareCandyFix = true;
    battle.getRareCandyOptions = function (side) {
      if (!this.canEvolveNow(side)) return [];
      const board = side === 'player' ? this.p : this.o;
      if (!board) return [];
      const field = [{ z: 'active', i: 0, inst: board.active }]
        .concat(board.bench.map((inst, i) => ({ z: 'bench', i, inst })))
        .filter((slot) => slot.inst && CARD_MAP[slot.inst.cardId]?.stage === 'Basic' && slot.inst.turnPlayed < this.turn);
      const stage1 = allCards().filter((card) => card.category === 'Pokemon' && card.stage === 'Stage1');
      const stage2 = [...new Set(board.hand.filter((id) => CARD_MAP[id]?.category === 'Pokemon' && CARD_MAP[id]?.stage === 'Stage2'))];
      const result = new Map();
      for (const evoId of stage2) {
        const evo = CARD_MAP[evoId];
        for (const slot of field) {
          const base = CARD_MAP[slot.inst.cardId];
          if (!stage1.some((mid) => isEvolutionFrom(mid, base) && isEvolutionFrom(evo, mid))) continue;
          const key = evoId + '|' + slot.z + '|' + slot.i;
          if (!result.has(key)) result.set(key, { evoCardId: evoId, z: slot.z, i: slot.i, baseId: slot.inst.cardId });
        }
      }
      return [...result.values()];
    };
    if (typeof battle.evolveCard === 'function' && Array.isArray(CARDS)) {
      const original = battle.evolveCard;
      battle.evolveCard = function (...args) {
        if (args[4] !== true) return original.apply(this, args);
        const length = CARDS.length;
        const ids = new Set(CARDS.map((card) => card && card.id));
        try {
          for (const card of allCards()) {
            if (card.category === 'Pokemon' && card.stage === 'Stage1' && card.id && !ids.has(card.id)) {
              CARDS.push(card);
              ids.add(card.id);
            }
          }
          return original.apply(this, args);
        } finally { CARDS.length = length; }
      };
    }
  }

  // Home / lobby / battle all read the same active deck and complete energy pool.
  if (typeof accountMgr !== 'undefined' && accountMgr && !accountMgr.__pdxDeckSyncFix) {
    accountMgr.__pdxDeckSyncFix = true;
    const originalGet = accountMgr.getActiveDeck;
    accountMgr.getActiveDeck = function () {
      const deck = originalGet.apply(this, arguments);
      return deck ? { ...deck, cards: [...(deck.cards || [])], energies: normalize(deck.energies) } : deck;
    };
    const sync = () => {
      const decks = accountMgr.data?.decks || [];
      const rawIndex = Number(accountMgr.data?.activeDeckSlot || 0);
      const index = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < decks.length ? rawIndex : 0;
      const deck = accountMgr.getActiveDeck();
      for (const id of ['home-deck-selector', 'lobby-deck-selector']) {
        const select = document.getElementById(id);
        if (!select) continue;
        if ((select.options?.length ?? -1) !== decks.length) {
          select.innerHTML = decks.map((item, i) => '<option value="' + i + '">' + escapeHtml(item.name || ('マイデッキ ' + (i + 1))) + ' (' + (item.cards || []).length + '枚)</option>').join('');
        }
        select.value = String(index);
      }
      const home = document.getElementById('home-deck-energies');
      if (home && deck) home.innerHTML = normalize(deck.energies).map((t) => renderTypeBadgeSvg(t, 16)).join('');
      const name = document.getElementById('lobby-active-deck-name');
      if (name && deck) name.textContent = (deck.name || 'マイデッキ') + ' • ' + deck.cards.length + '枚';
      const energies = document.getElementById('lobby-active-deck-energies');
      if (energies && deck) energies.innerHTML = normalize(deck.energies).map((t) => renderTypeBadgeSvg(t, 16)).join('');
    };
    const originalRefresh = accountMgr.refreshUI;
    accountMgr.refreshUI = function () { const result = originalRefresh.apply(this, arguments); sync(); return result; };
    const originalSelect = accountMgr.selectActiveDeck;
    accountMgr.selectActiveDeck = function (slot, silent = false) {
      const result = originalSelect.call(this, slot, true);
      if (result === false) return false;
      if (typeof deckBuilder !== 'undefined') deckBuilder.currentSlot = Number(this.data.activeDeckSlot);
      sync();
      if (!silent) ui.toast('使用デッキを「' + this.getActiveDeck().name + '」に変更しました');
      return true;
    };
  }

  if (typeof deckBuilder !== 'undefined' && deckBuilder && !deckBuilder.__pdxEnergyFix) {
    deckBuilder.__pdxEnergyFix = true;
    const load = deckBuilder.loadSlot;
    deckBuilder.loadSlot = function () { const result = load.apply(this, arguments); this.tempEnergies = normalize(this.tempEnergies); return result; };
    const save = deckBuilder.saveDeck;
    deckBuilder.saveDeck = function () { this.tempEnergies = normalize(this.tempEnergies); return save.apply(this, arguments); };
    const toggle = deckBuilder.toggleEnergyType;
    deckBuilder.toggleEnergyType = function (type) {
      const before = JSON.stringify(this.tempEnergies || []);
      const result = toggle.apply(this, arguments);
      this.tempEnergies = normalize(this.tempEnergies);
      if (before !== JSON.stringify(this.tempEnergies)) {
        const slot = Number(this.currentSlot);
        const deck = accountMgr.data?.decks?.[slot];
        if (deck) {
          deck.energies = [...this.tempEnergies];
          accountMgr.data.activeDeckSlot = slot;
          accountMgr.saveCurrent();
        }
        this.render();
      }
      return result;
    };
  }

  if (typeof battle !== 'undefined' && battle && !battle.__pdxEnergyPoolFix) {
    battle.__pdxEnergyPoolFix = true;
    const init = battle.initSide;
    battle.initSide = function (cards, energies, name, autoPlace = false) {
      return init.call(this, cards, normalize(energies), name, autoPlace);
    };
    const render = battle.render;
    battle.render = function () {
      const result = render.apply(this, arguments);
      const pool = document.getElementById('battle-energy-type-pool');
      const types = normalize(this.p?.energyTypes);
      if (pool) {
        pool.innerHTML = types.map((t) => renderTypeBadgeSvg(t, 12)).join('');
        pool.title = '発生エネルギー候補: ' + types.join('、');
      }
      return result;
    };
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { accountMgr?.refreshUI?.(); } catch (error) { console.warn('[Pokepoke DX] deck sync', error); }
      try { battle?.render?.(); } catch (error) { console.warn('[Pokepoke DX] energy pool', error); }
    }, { once: true });
  } else {
    try { accountMgr?.refreshUI?.(); } catch (error) { console.warn('[Pokepoke DX] deck sync', error); }
  }
})();