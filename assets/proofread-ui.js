/* The proofreading interface: squiggles, the suggestion popup, the counter
   and the review list. One implementation for every tool.

   A tool hands it an adapter -- "here is a field, here is its text, here is
   how to measure a character range in it, here is how to replace one" -- and
   this file does the rest. Nothing here touches the edited node's contents,
   so it cannot disturb a caret, a selection or a copy.

   Exposed as window.proofreadUI. */
(function (global) {
  'use strict';

  const DELAY = 400;          // idle before a re-check, so typing is not nagged
  const LABEL = { spelling: 'spelling', grammar: 'grammar', punctuation: 'punctuation' };

  let popup = null;
  let panel = null;
  let openFor = null;         // the mark the popup belongs to
  const fields = [];

  /* ---------- small helpers ---------- */

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /* ---------- a field ---------- */

  // adapter: {
  //   el, register, read(), replace(start, end, text),
  //   rects(start, end) -> [{x,y,w,h}] in CSS pixels relative to the viewport,
  //   host -> the element the marks are drawn into (position: relative),
  //   onAfter() -> optional, called after a replacement is committed
  // }
  function attach(adapter) {
    const f = {
      adapter,
      issues: [],
      marks: [],
      layer: null,
      timer: 0,
      dismissed: new Set(),    // "rule:text" the user has waved away this session
    };
    fields.push(f);

    f.layer = el('div', 'pr-layer');
    adapter.host.appendChild(f.layer);

    // Our marks replace the browser's own underline; two systems at once
    // would be unreadable.
    adapter.el.setAttribute('spellcheck', 'false');

    const kick = () => {
      // The moment the text changes every offset we hold is stale, so the
      // marks come off at once rather than sitting under the wrong words
      // until the debounce fires.
      if (f.issues.length) { f.issues = []; f.marks = []; f.layer.textContent = ''; }
      closePopup();
      clearTimeout(f.timer);
      f.timer = setTimeout(() => recheck(f), DELAY);
    };
    adapter.el.addEventListener('input', kick);
    adapter.el.addEventListener('blur', () => { clearTimeout(f.timer); recheck(f); });
    adapter.el.addEventListener('focus', () => {
      global.proofreader.load().then(() => recheck(f));
    });
    adapter.el.addEventListener('paste', () => setTimeout(() => recheck(f), 0));

    f.repaint = () => paint(f);
    f.recheck = () => recheck(f);
    return f;
  }

  function dismissKey(issue) { return issue.rule + ':' + issue.text; }

  function recheck(f) {
    const text = f.adapter.read();
    const found = global.proofreader.check(text, { register: f.adapter.register })
      .filter((i) => !f.dismissed.has(dismissKey(i)));
    f.issues = found;
    paint(f);
    syncCounter();
  }

  /* ---------- painting the squiggles ---------- */

  function paint(f) {
    f.layer.textContent = '';
    f.marks = [];
    if (f.adapter.hidden && f.adapter.hidden()) return;
    const hostBox = f.adapter.host.getBoundingClientRect();
    for (const issue of f.issues) {
      let rects;
      try { rects = f.adapter.rects(issue.start, issue.end); } catch (err) { rects = null; }
      if (!rects || !rects.length) continue;
      for (const r of rects) {
        if (!r.w || r.w < 1) continue;
        const m = el('i', 'pr-mark pr-' + issue.type);
        m.style.left = (r.x - hostBox.left) + 'px';
        m.style.top = (r.y - hostBox.top + r.h) + 'px';
        m.style.width = r.w + 'px';
        m.title = issue.message;
        m.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          openPopup(f, issue, m);
        });
        m.addEventListener('contextmenu', (e) => {
          e.preventDefault(); e.stopPropagation();
          openPopup(f, issue, m);
        });
        f.layer.appendChild(m);
        f.marks.push({ issue, node: m });
      }
    }
  }

  // Everything that moves the type has to move the marks with it.
  function repaintAll() { for (const f of fields) paint(f); }

  /* ---------- the popup ---------- */

  function closePopup() {
    if (popup) { popup.remove(); popup = null; }
    openFor = null;
  }

  function openPopup(f, issue, markNode) {
    closePopup();
    openFor = issue;

    popup = el('div', 'pr-popup');
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Proofreading suggestion');

    const head = el('div', 'pr-head');
    head.appendChild(el('span', 'pr-dot pr-' + issue.type));
    head.appendChild(el('span', 'pr-kind', LABEL[issue.type]));
    const close = el('button', 'pr-x', '×');
    close.type = 'button';
    close.title = 'Close';
    close.addEventListener('click', closePopup);
    head.appendChild(close);
    popup.appendChild(head);

    popup.appendChild(el('p', 'pr-msg', issue.message));

    const list = el('div', 'pr-suggestions');
    let options = [];
    if (issue.replacement) options = [issue.replacement];
    else if (issue.lazySuggest) options = global.proofreader.suggest(issue.text, 5);

    if (options.length) {
      for (const opt of options) {
        const b = el('button', 'pr-sug', opt);
        b.type = 'button';
        b.addEventListener('click', () => { accept(f, issue, opt); });
        list.appendChild(b);
      }
    } else {
      list.appendChild(el('p', 'pr-none', 'No suggestion — this one needs a human.'));
    }
    popup.appendChild(list);

    const foot = el('div', 'pr-foot');
    const ignore = el('button', 'pr-act', 'Ignore');
    ignore.type = 'button';
    ignore.addEventListener('click', () => {
      f.dismissed.add(dismissKey(issue));
      closePopup();
      recheck(f);
    });
    foot.appendChild(ignore);

    if (issue.type === 'spelling') {
      const add = el('button', 'pr-act', 'Add to dictionary');
      add.type = 'button';
      add.title = 'Saved in this browser, so it is never flagged again';
      add.addEventListener('click', () => {
        global.proofreader.addTerm(issue.text);
        closePopup();
        for (const g of fields) recheck(g);
      });
      foot.appendChild(add);
    }
    popup.appendChild(foot);

    // Fixed to the viewport: .card-stage is overflow:hidden and would clip a
    // popup anchored inside it.
    document.body.appendChild(popup);
    place(popup, markNode.getBoundingClientRect());
  }

  function place(node, anchor) {
    const pad = 8;
    const box = node.getBoundingClientRect();
    let left = anchor.left + anchor.width / 2 - box.width / 2;
    let top = anchor.bottom + 6;
    left = Math.max(pad, Math.min(left, window.innerWidth - box.width - pad));
    if (top + box.height > window.innerHeight - pad) top = anchor.top - box.height - 6;
    node.style.left = Math.round(left) + 'px';
    node.style.top = Math.round(Math.max(pad, top)) + 'px';
  }

  function accept(f, issue, replacement) {
    closePopup();
    f.adapter.replace(issue.start, issue.end, replacement);
    if (f.adapter.onAfter) f.adapter.onAfter();
    recheck(f);
  }

  /* ---------- the counter and the review list ---------- */

  let note = null;
  let clearTimer = 0;

  function counts() {
    const c = { spelling: 0, grammar: 0, punctuation: 0, total: 0 };
    for (const f of fields) {
      for (const i of f.issues) { c[i.type]++; c.total++; }
    }
    return c;
  }

  function syncCounter() {
    if (!note) return;
    const c = counts();
    clearTimeout(clearTimer);
    note.textContent = '';
    if (!c.total) {
      if (note.dataset.had === '1') {
        note.dataset.had = '0';
        note.textContent = 'No issues found.';
        clearTimer = setTimeout(() => { note.textContent = ''; closePanel(); }, 2600);
      }
      closePanel();
      return;
    }
    note.dataset.had = '1';
    const parts = [];
    if (c.spelling) parts.push(plural(c.spelling, 'spelling error'));
    if (c.grammar) parts.push(plural(c.grammar, 'grammar issue'));
    if (c.punctuation) parts.push(plural(c.punctuation, 'punctuation issue'));
    const btn = el('button', 'pr-count');
    btn.type = 'button';
    btn.textContent = parts.join(' · ') + ' — review';
    btn.addEventListener('click', () => (panel ? closePanel() : openPanel(btn)));
    note.appendChild(btn);
  }

  function closePanel() { if (panel) { panel.remove(); panel = null; } }

  function openPanel(anchor) {
    closePanel();
    panel = el('div', 'pr-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'All proofreading issues');
    const head = el('div', 'pr-head');
    head.appendChild(el('span', 'pr-kind', 'Issues'));
    const x = el('button', 'pr-x', '×');
    x.type = 'button';
    x.addEventListener('click', closePanel);
    head.appendChild(x);
    panel.appendChild(head);

    const list = el('div', 'pr-list');
    for (const f of fields) {
      for (const issue of f.issues) {
        const row = el('button', 'pr-row');
        row.type = 'button';
        row.appendChild(el('span', 'pr-dot pr-' + issue.type));
        row.appendChild(el('span', 'pr-row-text', issue.text));
        row.appendChild(el('span', 'pr-row-msg', issue.message));
        row.addEventListener('click', () => {
          closePanel();
          const mark = f.marks.find((m) => m.issue === issue);
          if (mark) {
            mark.node.scrollIntoView({ block: 'center', behavior: 'smooth' });
            openPopup(f, issue, mark.node);
          }
        });
        list.appendChild(row);
      }
    }
    panel.appendChild(list);
    document.body.appendChild(panel);
    place(panel, anchor.getBoundingClientRect());
  }

  /* ---------- a plain <input> ---------- */

  // An input's value has no DOM to measure, so a mirror does it: a hidden
  // element wearing the input's own font and padding, holding the same text
  // with the flagged span wrapped. The mirror is never shown and never
  // receives events, so the input itself is untouched.
  function inputAdapter(input, opts) {
    const o = opts || {};
    const mirror = el('div', 'pr-mirror');
    document.body.appendChild(mirror);

    const sync = () => {
      const cs = getComputedStyle(input);
      for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
        'wordSpacing', 'textTransform', 'paddingLeft', 'paddingTop', 'paddingRight',
        'paddingBottom', 'borderLeftWidth', 'borderTopWidth', 'textIndent']) {
        mirror.style[prop] = cs[prop];
      }
      mirror.style.width = input.clientWidth + 'px';
    };

    return {
      name: o.name || input.id,
      el: input,
      register: o.register || 'display',
      host: o.host || input.parentNode,
      read: () => input.value,
      hidden: () => input.offsetParent === null,
      rects: (start, end) => {
        sync();
        const v = input.value;
        mirror.textContent = '';
        mirror.appendChild(document.createTextNode(v.slice(0, start)));
        const span = el('span');
        span.textContent = v.slice(start, end);
        mirror.appendChild(span);
        mirror.appendChild(document.createTextNode(v.slice(end)));
        const box = input.getBoundingClientRect();
        const base = mirror.getBoundingClientRect();
        return [...span.getClientRects()].filter((q) => q.width > 0).map((q) => ({
          x: box.left + (q.left - base.left) - input.scrollLeft,
          y: box.top + (q.top - base.top),
          w: q.width,
          h: q.height,
        }));
      },
      replace: (start, end, text) => {
        const v = input.value;
        const caret = start + text.length;
        input.value = v.slice(0, start) + text + v.slice(end);
        try { input.setSelectionRange(caret, caret); } catch (err) { /* noop */ }
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    };
  }

  /* ---------- wiring ---------- */

  function setNote(node) { note = node; syncCounter(); }

  document.addEventListener('pointerdown', (e) => {
    if (popup && !popup.contains(e.target)) closePopup();
    if (panel && !panel.contains(e.target) && !e.target.closest('.pr-count')) closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (popup || panel)) { closePopup(); closePanel(); }
  });
  window.addEventListener('resize', () => { repaintAll(); closePopup(); closePanel(); });
  window.addEventListener('scroll', () => { closePopup(); closePanel(); }, true);

  global.proofreadUI = {
    attach, setNote, repaintAll, inputAdapter,
    recheckAll: () => { for (const f of fields) recheck(f); },
    counts,
    issues: () => fields.reduce((a, f) => a.concat(f.issues.map((i) => ({ ...i, field: f.adapter.name }))), []),
    marks: () => fields.reduce((a, f) => a.concat(f.marks.map((m) => ({
      field: f.adapter.name, type: m.issue.type, text: m.issue.text,
      rect: m.node.getBoundingClientRect(),
    }))), []),
    openFirst: () => {
      for (const f of fields) {
        if (f.marks.length) { openPopup(f, f.marks[0].issue, f.marks[0].node); return true; }
      }
      return false;
    },
    popupOpen: () => !!popup,
    accept: (n) => {
      let k = 0;
      for (const f of fields) {
        for (const m of f.marks) {
          if (k++ !== (n || 0)) continue;
          const opt = m.issue.replacement || global.proofreader.suggest(m.issue.text, 1)[0];
          if (!opt) return false;
          accept(f, m.issue, opt);
          return true;
        }
      }
      return false;
    },
    closeAll: () => { closePopup(); closePanel(); },
  };
})(window);
