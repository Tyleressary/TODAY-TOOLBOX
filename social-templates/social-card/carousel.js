/* The Carousel Builder workspace: the cards, the style selector, the
   thumbnail rail and the toolbar slot. The card itself is not in here --
   app.js renders it exactly as it always has, and this file only decides
   which card's state is in the engine at any moment.

   One engine, many cards. The card binds element ids, so a page can hold
   exactly one live instance of it; a second card is not a second renderer
   but a second state object. Selecting a card snapshots the outgoing one
   and restores the incoming one, which is why every card keeps its own
   content, colours, images and logo without any of them being able to
   touch each other. The visible consequence: the centre canvas is the only
   live card, and a thumbnail is the last frame its card rendered. */
(() => {
  'use strict';

  const card = window.__card;
  if (!card) return;

  // Every style the carousel will have. Only Headline has a layout and a
  // toolbar today; the rest are listed from the start so the workspace is
  // never rearranged to make room for them, and each says what it is
  // waiting for rather than pretending to work.
  const STYLES = [
    { key: 'headline', name: 'Headline', ready: true },
    { key: 'quote', name: 'Quote', ready: false, phase: 'Phase 3' },
    { key: 'text', name: 'Text', ready: false, phase: 'Phase 3' },
    { key: 'listicle', name: 'Listicle', ready: false, phase: 'Phase 3' },
    { key: 'meme', name: 'Meme', ready: false, phase: 'Phase 3' },
  ];

  const styleBar = document.getElementById('styleBar');
  const rail = document.getElementById('cardRail');
  const addBtn = document.getElementById('addCard');
  const toolsTitle = document.getElementById('toolsTitle');
  const panels = [...document.querySelectorAll('.tool-panel')];
  const stubNote = document.getElementById('stubNote');

  const THUMB_W = 116;
  const THUMB_H = Math.round(THUMB_W * 1500 / 1200);

  // A card is its style and its state. The state is whatever the engine
  // says a card is -- this file never reaches inside it, so a field added
  // to the card later rides along without a change here.
  let cards = [];
  let current = 0;
  let nextId = 1;

  function newCard() {
    return { id: nextId++, style: 'headline', state: null, thumb: null };
  }

  /* ---------- the style selector ---------- */

  function buildStyleBar() {
    styleBar.textContent = '';
    STYLES.forEach((st) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'style-btn';
      b.dataset.style = st.key;
      b.textContent = st.name;
      b.disabled = !st.ready;
      b.title = st.ready
        ? `${st.name} card`
        : `${st.name} cards arrive in ${st.phase}`;
      b.setAttribute('aria-pressed', 'false');
      if (st.ready) b.addEventListener('click', () => setStyle(st.key));
      styleBar.appendChild(b);
    });
  }

  // The selector reflects the selected card, so moving between cards shows
  // what each one is rather than what was last clicked.
  function syncStyleBar() {
    const key = cards[current].style;
    [...styleBar.children].forEach((b) => {
      const on = b.dataset.style === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const st = STYLES.find((x) => x.key === key) || STYLES[0];
    toolsTitle.textContent = `${st.name} controls`;
    panels.forEach((p) => { p.hidden = p.dataset.style !== (st.ready ? st.key : 'stub'); });
    if (!st.ready) {
      stubNote.textContent = `${st.name} cards and their controls arrive in ${st.phase}. `
        + 'The workspace is built around all five styles, so nothing here moves when they land.';
    }
  }

  function setStyle(key) {
    const st = STYLES.find((x) => x.key === key);
    if (!st || !st.ready || cards[current].style === key) return;
    cards[current].style = key;
    syncStyleBar();
    renderRail();
  }

  /* ---------- the rail ---------- */

  function renderRail() {
    rail.textContent = '';
    cards.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card-thumb' + (i === current ? ' active' : '');
      b.dataset.card = String(c.id);
      b.title = `Card ${i + 1}`;
      b.setAttribute('aria-pressed', String(i === current));
      const cv = document.createElement('canvas');
      cv.width = THUMB_W; cv.height = THUMB_H;
      const g = cv.getContext('2d');
      g.fillStyle = '#c9edfa';
      g.fillRect(0, 0, THUMB_W, THUMB_H);
      if (c.thumb) g.drawImage(c.thumb, 0, 0, THUMB_W, THUMB_H);
      b.appendChild(cv);
      const no = document.createElement('span');
      no.className = 'card-thumb-no';
      no.textContent = String(i + 1);
      b.appendChild(no);
      b.addEventListener('click', () => select(i));
      rail.appendChild(b);
    });
  }

  // The live card's thumbnail, taken from the canvas the engine just drew.
  // Debounced, because render() runs on every keystroke and a thumbnail does
  // not need to.
  let thumbTimer = null;
  function scheduleThumb() {
    if (thumbTimer) return;
    thumbTimer = setTimeout(() => {
      thumbTimer = null;
      captureThumb();
    }, 180);
  }

  function captureThumb() {
    const src = document.getElementById('canvas');
    // The engine paints as soon as it loads, which is before this file has
    // any cards to attach a thumbnail to.
    if (!src || !src.width || !cards[current]) return;
    const c = cards[current];
    if (!c.thumb) {
      c.thumb = document.createElement('canvas');
      c.thumb.width = THUMB_W; c.thumb.height = THUMB_H;
    }
    const g = c.thumb.getContext('2d');
    g.clearRect(0, 0, THUMB_W, THUMB_H);
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, THUMB_W, THUMB_H);
    const live = rail.children[current];
    if (live) {
      const lg = live.querySelector('canvas').getContext('2d');
      lg.clearRect(0, 0, THUMB_W, THUMB_H);
      lg.drawImage(c.thumb, 0, 0);
    }
  }

  window.__cardRendered = scheduleThumb;

  /* ---------- selection ---------- */

  function select(i) {
    if (i === current || !cards[i]) return;
    // Snapshot before anything else: the outgoing card's state has to be
    // taken from the engine while it is still the engine's state.
    captureThumb();
    cards[current].state = card.getState();
    current = i;
    card.setState(cards[current].state || blank());
    cards[current].state = card.getState();
    renderRail();
    syncStyleBar();
    captureThumb();
  }

  // A new card starts from the card the engine starts from, not from a copy
  // of the one being edited: adding a card must not inherit someone else's
  // photo or headline.
  let pristine = null;
  function blank() {
    const p = pristine;
    return {
      text: { ...p.text }, headPristine: p.headPristine, headKey: p.headKey,
      align: { ...p.align }, typeset: p.typeset, ink: p.ink, eyebrowInk: p.eyebrowInk,
      logoKey: p.logoKey, shown: { ...p.shown }, grad: { ...p.grad },
      pickedColour: null, photo: null, bubbles: [null, null], filename: '',
    };
  }

  function addCard() {
    cards[current].state = card.getState();
    captureThumb();
    cards.push(newCard());
    current = cards.length - 1;
    card.setState(blank());
    cards[current].state = card.getState();
    renderRail();
    syncStyleBar();
    captureThumb();
  }

  /* ---------- start ---------- */

  function start() {
    pristine = card.getState();
    cards = [newCard()];
    cards[0].state = card.getState();
    current = 0;
    buildStyleBar();
    renderRail();
    syncStyleBar();
    captureThumb();
    addBtn.addEventListener('click', addCard);
  }

  // The first render needs the fonts; until then the canvas is empty and a
  // thumbnail of it would be blank. The engine repaints when they land.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  else start();

  // What the suite drives. Deliberately the workspace's own surface, kept
  // apart from window.__card so the card's API stays what it was.
  window.__carousel = {
    STYLES: STYLES.map((s) => ({ ...s })),
    cards: () => cards.map((c, i) => ({ id: c.id, style: c.style, selected: i === current,
                                        hasState: !!c.state, hasThumb: !!c.thumb })),
    count: () => cards.length,
    current: () => current,
    select,
    addCard,
    setStyle,
    stateOf: (i) => (cards[i] ? cards[i].state : null),
    thumbOf: (i) => (cards[i] && cards[i].thumb ? cards[i].thumb.toDataURL('image/png') : null),
    capture: captureThumb,
  };
})();
