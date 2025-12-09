// script.js - automatic repeating Morse playback (fixed unit = 250ms)
// Loads dictionary from dict.csv (preferred) or dict.json (fallback), otherwise uses embedded DICT.
document.addEventListener('DOMContentLoaded', () => {
  const controlsEl = document.getElementById('controls');
  const NUM = 5;

  // DICT is provided by dict.js (must define window.DICT)
  const DICT = window.DICT;
  // ========================================================================================

  // Fixed unit duration (ms)
  const UNIT_MS = 250;

  // create inputs
  for (let i = 1; i <= NUM; i++) {
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('div');
    label.className = 'label';
    // label.textContent = i;

    const inputWrap = document.createElement('div');
    inputWrap.className = 'input-wrap';

    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.value = 0;
    numInput.step = 1;
    numInput.setAttribute('aria-label', 'Number ' + i);
    numInput.dataset.index = i;

    inputWrap.appendChild(numInput);
    row.appendChild(label);
    row.appendChild(inputWrap);
    controlsEl.appendChild(row);

    // Keyboard arrow handling
    numInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowUp') { ev.preventDefault(); changeValue(numInput, +1); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); changeValue(numInput, -1); }
    });
  }

  function changeValue(input, delta) {
    const step = parseFloat(input.step) || 1;
    const cur = parseFloat(input.value) || 0;
    input.value = (cur + delta * step);
    input.dispatchEvent(new Event('change'));
  }

  // UI elements
  const statusEl = document.getElementById('status');
  const hashOut = document.getElementById('hashOut');
  const resetBtn = document.getElementById('reset');
  const flasher = document.getElementById('flasher');

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.querySelectorAll('input[type="number"]').forEach((el) => el.value = 0);
      statusEl.textContent = 'reset';
      updateHashOut();
    });
  }

  // Morse table
  const MORSE = {
    'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.',
    'f': '..-.', 'g': '--.', 'h': '....', 'i': '..', 'j': '.---',
    'k': '-.-', 'l': '.-..', 'm': '--', 'n': '-.', 'o': '---',
    'p': '.--.', 'q': '--.-', 'r': '.-.', 's': '...', 't': '-',
    'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-', 'y': '-.--',
    'z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
  };

  function readValues() {
    return Array.from(document.querySelectorAll('input[type="number"]')).map(i => {
      const n = Number(i.value);
      return Number.isFinite(n) ? n : 0;
    });
  }

  // FNV-1a 32-bit hash (order-sensitive)
  function fnv1a32(str) {
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  // Index selection using FNV-1a on the ordered key "v1,v2,v3,v4,v5"
  function simpleHashIndex(valuesArray) {
    const key = valuesArray.map(v => String(Math.trunc(Number(v) || 0))).join(',');
    const hash = fnv1a32(key);
    if (!DICT || DICT.length === 0) return { hash, index: -1 };
    const idx = hash % DICT.length;
    return { hash, index: idx };
  }

  function updateHashOut() {
    const vals = readValues();
    const { hash, index } = simpleHashIndex(vals);
    // hashOut.textContent = `hash=0x${hash.toString(16).padStart(8,'0')} (${hash})  index=${index}`;
  }

  // update displayed hash when numbers change
  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.addEventListener('change', () => {
      updateHashOut();
    });
  });
  updateHashOut();

  // clicking the flasher toggles a tooltip flag (no idle animation)
  if (flasher) {
    flasher.addEventListener('click', () => {
      const paused = flasher.getAttribute('data-paused') === '1';
      flasher.setAttribute('data-paused', paused ? '0' : '1');
    });
  }

    // Build and play Morse sequence once (returns when single sequence completes)
    async function playWordMorse(word, unitMs = UNIT_MS) {
        if (!flasher) return;
        const seq = [];
        const words = word.split(/\s+/);
        for (let wi = 0; wi < words.length; wi++) {
            const w = words[wi];
            for (let li = 0; li < w.length; li++) {
            const ch = w[li].toLowerCase();      // <-- normalize to lowercase for lookup
            const code = MORSE[ch];
            if (!code) { seq.push({ on: false, duration: unitMs * 3 }); continue; }
            for (let si = 0; si < code.length; si++) {
                const sym = code[si];
                if (sym === '.') seq.push({ on: true, duration: unitMs * 1 });
                else seq.push({ on: true, duration: unitMs * 3 });
                seq.push({ on: false, duration: unitMs * 1 });
            }
            seq.push({ on: false, duration: unitMs * 3 }); // space between letters
            }
            if (wi < words.length - 1) seq.push({ on: false, duration: unitMs * 7 }); // space between words
        }

        try {
            for (let i = 0; i < seq.length; i++) {
            const step = seq[i];
            if (step.on) flasher.classList.add('on');
            else flasher.classList.remove('on');
            await sleep(step.duration);
            }
        } finally {
            if (flasher) flasher.classList.remove('on');
        }
    }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  // Automatic continuous repeat loop (recomputes index each repeat)
  (async function repeatLoop() {
    await sleep(200);
    while (true) {
      const vals = readValues();
      const { hash, index } = simpleHashIndex(vals);
      updateHashOut();
      if (index < 0) {
        statusEl.textContent = 'Dictionary empty (provide dict.csv / dict.json or edit DICT).';
        await sleep(1000);
        continue;
      }
      const word = DICT[index] || '';
      if (!word) {
        statusEl.textContent = `No word at index ${index}`;
        await sleep(1000);
        continue;
      }
    //   statusEl.textContent = `Playing "${word}" (index ${index})`;
      await playWordMorse(String(word).toUpperCase(), UNIT_MS);
      await sleep(UNIT_MS * 7); // pause between repeats
    }
  })();
});