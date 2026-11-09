/* ---------- start-up (loaded last) ---------- */
try { const t = localStorage.getItem('patchrack.theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* storage unavailable */ }
load();
render();
renderGh();
