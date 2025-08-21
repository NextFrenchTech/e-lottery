/***********************
 *  CONFIG & DONNÉES
 ***********************/
const ROWS = 3, REELS = 3;
const SPIN_BASE_MS = 1800, SPIN_DELTA_MS = 180; // timings des rouleaux
const START_BALANCE = 6;
const PASS_DEFAULT = "test"; // mot de passe par défaut

// Redirection quand le solde arrive à 0 (bouton principal)
const EXIT_URL = "https://nextfrenchtech.github.io/e-scratch/";

// Symboles (4,5,6,10,13,15 exclus volontairement → commentés)
const SYMBOLS = [
  { icon: "img/image1.png",  name: "Symbole 1",  prize: "Lot 1"  },
  { icon: "img/image2.png",  name: "Symbole 2",  prize: "Lot 2"  },
  { icon: "img/image3.png",  name: "Symbole 3",  prize: "Lot 3"  },
  // { icon: "img/image4.png",  name: "Symbole 4",  prize: "Lot 4"  },
  // { icon: "img/image5.png",  name: "Symbole 5",  prize: "Lot 5"  },
  // { icon: "img/image6.png",  name: "Symbole 6",  prize: "Lot 6"  },
  { icon: "img/image7.png",  name: "Symbole 7",  prize: "Lot 7"  },
  { icon: "img/image8.png",  name: "Symbole 8",  prize: "Lot 8"  },
  { icon: "img/image9.png",  name: "Symbole 9",  prize: "Lot 9"  },
  // { icon: "img/image10.png", name: "Symbole 10", prize: "Lot 10" },
  { icon: "img/image11.png", name: "Symbole 11", prize: "Lot 11" },
  { icon: "img/image12.png", name: "Symbole 12", prize: "Lot 12" },
  // { icon: "img/image13.png", name: "Symbole 13", prize: "Lot 13" },
  { icon: "img/image14.png", name: "Symbole 14", prize: "Lot 14" },
  // { icon: "img/image15.png", name: "Symbole 15", prize: "Lot 15" },
  { icon: "img/image16.png", name: "Symbole 16", prize: "Lot 16" },
  { icon: "img/image17.png", name: "Symbole 17", prize: "Lot 17" },
  { icon: "img/image18.png", name: "Symbole 18", prize: "Lot 18" }
];

// Probabilités en %, alignées sur SYMBOLS (somme = 100)
// Catégories : Exclus (0), Récurrent (16), Fréquents (14/12), Diverses (10/8), Rares (4/2)
const WEIGHTS = [
   4, // Symbole 1   — 4%  (Rares)
  12, // Symbole 2   — 12% (Fréquents)
  10, // Symbole 3   — 10% (Diverses)
  // 0, // Symbole 4   — 0%  (Exclus)
  // 0, // Symbole 5   — 0%  (Exclus)
  // 0, // Symbole 6   — 0%  (Exclus)
   8, // Symbole 7   — 8%  (Diverses)
  16, // Symbole 8   — 16% (Récurrent)
  16, // Symbole 9   — 16% (Récurrent)
  // 0, // Symbole 10  — 0%  (Exclus)
  14, // Symbole 11  — 14% (Fréquents)
   2, // Symbole 12  — 2%  (Rares)
  // 0, // Symbole 13  — 0%  (Exclus)
   2, // Symbole 14  — 2%  (Rares)
  // 0, // Symbole 15  — 0%  (Exclus)
   8, // Symbole 16  — 8%  (Diverses)
   4, // Symbole 17  — 4%  (Rares)
   4  // Symbole 18  — 4%  (Rares)
];

/***********************
 *  PERSISTENCE (LS)
 ***********************/
const NS = "slotMachine.";
const STORAGE = {
  INIT:   NS + "init",
  BAL:    NS + "balance",
  LOCKED: NS + "locked",
  PASS:   NS + "pass",
  WON:    NS + "won",       // Set d’indices gagnés (persistant)
  DATE:   NS + "date",      // yyyy-mm-dd (réinit quotidienne)
  WINS:   NS + "wonCount"   // compteur de gains du jour
};

/***********************
 *  UTILITAIRES
 ***********************/
const toIntOrNull = s => { const n=parseInt(s,10); return Number.isFinite(n)?n:null; };
const easeInOutCubic = t => t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
const todayStr = () => new Date().toISOString().slice(0,10);
function isReload(){
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    return nav && (nav.type === "reload" || nav.type === "back_forward");
  } catch {
    return performance && performance.navigation && performance.navigation.type === 1;
  }
}

/***********************
 *  TIRAGE
 ***********************/
function weightedPick(){
  const total = WEIGHTS.reduce((a,b)=>a+b,0); // =100
  let r = Math.random()*total, acc=0;
  for (let i=0;i<WEIGHTS.length;i++){
    const w = WEIGHTS[i] ?? 0;
    acc += w;
    if (r < acc) return i;
  }
  return WEIGHTS.length-1; // fallback
}

function generateGrid(){
  const g = Array.from({length:ROWS},()=>Array(REELS).fill(0));
  for(let c=0;c<REELS;c++) for(let r=0;r<ROWS;r++) g[r][c]=weightedPick();
  return g;
}

function evaluatePrize(grid){
  const [a,b,c] = [grid[1][0], grid[1][1], grid[1][2]]; // payline milieu uniquement
  return (a===b && b===c) ? { index:a, prize: SYMBOLS[a].prize } : null;
}

/***********************
 *  DOM
 ***********************/
const balanceEl = document.getElementById("balance");
const spinBtn   = document.getElementById("spin");
const autoplayChk = document.getElementById("autoplay"); // optionnel
const statusEl  = document.getElementById("status");
const reels     = [...document.querySelectorAll(".reel")];
const paytableBody = document.getElementById("paytable-body");
const middlePaylineEl = document.querySelector(".payline-2");

// Modale reset (affichée au reload si solde=0)
const resetModal  = document.getElementById("reset-modal");
const resetForm   = document.getElementById("reset-form");
const resetPass   = document.getElementById("reset-pass");
const resetCancel = document.getElementById("reset-cancel");
const resetError  = document.getElementById("reset-error");

/***********************
 *  ÉTAT
 ***********************/
let balance=START_BALANCE, busy=false, autoplay=false, locked=false;
let wonSet = new Set();

/***********************
 *  GAINS PERSISTANTS
 ***********************/
function loadWonSet(){
  try {
    const raw = localStorage.getItem(STORAGE.WON);
    if (!raw) { wonSet = new Set(); return; }
    const arr = JSON.parse(raw);
    wonSet = new Set((Array.isArray(arr)?arr:[]).map(x=>parseInt(x,10)).filter(Number.isFinite));
  } catch { wonSet = new Set(); }
}
function saveWonSet(){ try { localStorage.setItem(STORAGE.WON, JSON.stringify([...wonSet])); } catch{} }
function clearWonSet(){ wonSet.clear(); localStorage.removeItem(STORAGE.WON); }

/***********************
 *  COMPTEUR "1 GAIN/JOUR"
 ***********************/
function winsToday() {
  return parseInt(localStorage.getItem(STORAGE.WINS) || "0", 10);
}
function incWinsToday() {
  localStorage.setItem(STORAGE.WINS, String(winsToday() + 1));
}
function canWinToday() {
  return winsToday() < 1; // max 1 gain / jour
}

/***********************
 *  SAUVEGARDE D'ÉTAT
 ***********************/
function saveState(){
  localStorage.setItem(STORAGE.BAL, String(balance));
  localStorage.setItem(STORAGE.LOCKED, locked ? "1" : "0");
  if (!localStorage.getItem(STORAGE.DATE)) localStorage.setItem(STORAGE.DATE, todayStr());
  saveWonSet();
}

// ⬇️ MODIFIÉ : réinit quotidienne = crédits 3 + quota 0 + effacer lots gagnés
function resetDailyCreditsKeepPrizes(){
  balance = START_BALANCE;
  locked = false;
  clearWonSet(); // efface les lots gagnés (✔)
  localStorage.setItem(STORAGE.DATE, todayStr());
  localStorage.setItem(STORAGE.WINS, "0"); // nouveau quota quotidien
  saveState();
  renderPaytable(); // met l'UI en phase
}

// ⬇️ Inchangé de principe mais aligne le même comportement
function hardResetAllWithPassword(){
  balance = START_BALANCE;
  locked = false;
  clearWonSet(); // efface les lots gagnés
  localStorage.setItem(STORAGE.DATE, todayStr());
  localStorage.setItem(STORAGE.WINS, "0");
  saveState();
  renderPaytable();
}

/***********************
 *  INIT/LOAD
 ***********************/
function loadStateOrInit(){
  if (!localStorage.getItem(STORAGE.PASS)) localStorage.setItem(STORAGE.PASS, PASS_DEFAULT);
  loadWonSet();

  const inited = localStorage.getItem(STORAGE.INIT) === "1";
  const lastDate = localStorage.getItem(STORAGE.DATE);
  const today = todayStr();

  if (!inited){
    localStorage.setItem(STORAGE.INIT,"1");
    resetDailyCreditsKeepPrizes(); // première init
    return;
  }

  // Changement de date → réinit (crédits + quota + efface lots)
  if (lastDate && lastDate !== today){
    resetDailyCreditsKeepPrizes();
    setStatus("Nouvelle journée : crédits réinitialisés !");
    return;
  }

  // Charger solde/lock
  const sBal = localStorage.getItem(STORAGE.BAL);
  const sLocked = localStorage.getItem(STORAGE.LOCKED);
  balance = Math.max(0, toIntOrNull(sBal) ?? START_BALANCE);
  locked  = (balance===0) && (sLocked==="1");

  if (localStorage.getItem(STORAGE.WINS) === null) {
    localStorage.setItem(STORAGE.WINS, "0");
  }
}

/***********************
 *  TABLEAU DES LOTS
 ***********************/
function renderPaytable(){
  if (!paytableBody) return;
  paytableBody.innerHTML = SYMBOLS.map((s, idx)=>`
    <tr data-row="${idx}">
      <td><img src="${s.icon}" alt="${s.name}" style="height:24px;vertical-align:middle" /> ${s.name}</td>
      <td>${s.prize}</td>
      <td style="text-align:center">
        <span class="prize-check${wonSet.has(idx)?' on':''}" aria-label="${wonSet.has(idx)?'Gagné':'Non gagné'}">✓</span>
      </td>
    </tr>
  `).join("");
}
function updatePrizeChecks(){
  if (!paytableBody) return;
  [...paytableBody.querySelectorAll("tr")].forEach(tr=>{
    const idx = parseInt(tr.getAttribute("data-row"),10);
    const dot = tr.querySelector(".prize-check");
    if (!dot) return;
    if (wonSet.has(idx)){ dot.classList.add("on"); dot.setAttribute("aria-label","Gagné"); }
    else { dot.classList.remove("on"); dot.setAttribute("aria-label","Non gagné"); }
  });
}

/***********************
 *  UI
 ***********************/
function updateSpinButtonVisual(){
  if (!spinBtn) return;
  if (locked){
    // Bouton rouge + "À bientôt" + intention de sortie
    spinBtn.classList.add("danger");
    spinBtn.textContent = "À bientôt";
    spinBtn.title = "Cliquez pour quitter";
  } else {
    spinBtn.classList.remove("danger");
    spinBtn.textContent = "Lancer";
    spinBtn.removeAttribute("title");
  }
}
function updateBank(){
  if (!balanceEl) return;
  balanceEl.textContent = `${balance} crédits`;
  if (balance === 0) balanceEl.classList.add("zero"); else balanceEl.classList.remove("zero");
  if (spinBtn){
    spinBtn.disabled = busy || (!locked && balance<1);
    updateSpinButtonVisual();
  }
  if (autoplayChk){
    autoplayChk.disabled = locked;
    if (locked){ autoplay=false; autoplayChk.checked=false; }
  }
}
function setStatus(msg, tone="info"){
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = tone==="win"?"var(--win)":tone==="error"?"var(--danger)":"var(--muted)";
}

/***********************
 *  LAYOUT (reels & payline)
 ***********************/
function setReelCellVar(reelEl){
  const cell = Math.max(1, Math.round(reelEl.clientHeight / ROWS));
  reelEl.style.setProperty("--cell", `${cell}px`);
}
function setAllReelsCellVar(){ reels.forEach(setReelCellVar); }
function positionPayline(){
  const slot = document.querySelector(".slot");
  const reel = document.querySelector(".reel");
  const line = document.querySelector(".payline-2");
  if (!slot || !reel || !line) return;
  const slotRect = slot.getBoundingClientRect();
  const reelRect = reel.getBoundingClientRect();
  const centerY = Math.round(reelRect.top + reelRect.height/2 - slotRect.top);
  line.style.top = `${centerY}px`;
}

/***********************
 *  ANIMATION DES ROULEAUX
 ***********************/
function appendCells(ribbon, indices){
  for (const i of indices){
    const cell = document.createElement("div");
    cell.className = "symbol";
    const img = document.createElement("img");
    img.src = SYMBOLS[i].icon;
    img.alt = SYMBOLS[i].name;
    cell.appendChild(img);
    ribbon.appendChild(cell);
  }
}
function buildTail(targetCol, extrasCount){
  const tail = [];
  for (let i=0;i<extrasCount;i++) tail.push(weightedPick());
  for (let r=0;r<ROWS;r++) tail.push(targetCol[r]); // termine sur la colonne cible
  return tail;
}
function animateTranslateY(el, from, to, duration, easing){
  return new Promise(resolve=>{
    const t0 = performance.now();
    function frame(now){
      const t = Math.min(1, (now - t0) / duration);
      const y = from + (to-from) * (easing?easing(t):t);
      el.style.transform = `translate3d(0, ${y}px, 0)`;
      if (t<1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}
async function spinReelSmooth(reelEl, targetCol, durationMs){
  setReelCellVar(reelEl);
  positionPayline();
  const cellH = Math.round(parseFloat(getComputedStyle(reelEl).getPropertyValue("--cell"))) || 80;

  let ribbon = reelEl.querySelector(".ribbon");
  if (!ribbon){
    ribbon = document.createElement("div");
    ribbon.className = "ribbon";
    reelEl.appendChild(ribbon);
    // 3 cellules visibles de départ
    appendCells(ribbon, [weightedPick(), weightedPick(), weightedPick()]);
  }

  ribbon.style.transition = "none";
  ribbon.getBoundingClientRect();
  const startY = -(ribbon.scrollHeight - reelEl.clientHeight);
  ribbon.style.transform = `translate3d(0, ${startY}px, 0)`;

  const EXTRAS = 18;
  appendCells(ribbon, buildTail(targetCol, EXTRAS));

  ribbon.getBoundingClientRect();
  const distanceRaw = ribbon.scrollHeight - reelEl.clientHeight;
  const steps = Math.round(distanceRaw / cellH);
  const endY = -Math.max(0, steps * cellH);

  await animateTranslateY(ribbon, startY, endY, durationMs, easeInOutCubic);

  const cells = Array.from(ribbon.children);
  const keep = cells.slice(-ROWS); // ne garder que les 3 dernières (col cible)
  ribbon.innerHTML = "";
  keep.forEach(el => ribbon.appendChild(el));
  ribbon.style.transform = "translate3d(0, 0, 0)";
  ribbon.style.transition = "none";
}

/***********************
 *  JEU
 ***********************/
async function doSpin(){
  // Si verrouillé (solde=0) → le bouton sert à QUITTER
  if (locked){
    window.location.href = EXIT_URL;
    return;
  }
  if (busy) return;
  if (balance<1){ setStatus("Mise supérieure au solde.","error"); return; }

  middlePaylineEl && middlePaylineEl.classList.remove("win-flash");
  busy = true; updateBank();
  setStatus("Rien ne va plus...");

  // débit de la mise
  balance -= 1; saveState(); updateBank();

  // tirage
  const g = generateGrid();

  // Si quota atteint (déjà gagné aujourd'hui), casser discrètement un triple
  if (!canWinToday()) {
    if (g[1][0] === g[1][1] && g[1][1] === g[1][2]) {
      let newIdx = g[1][1], tries=0;
      do { newIdx = weightedPick(); tries++; } while (newIdx === g[1][1] && tries < 10);
      g[1][1] = newIdx;
    }
  }

  // colonnes cibles pour l’animation
  const col0 = [g[0][0], g[1][0], g[2][0]];
  const col1 = [g[0][1], g[1][1], g[2][1]];
  const col2 = [g[0][2], g[1][2], g[2][2]];

  // animer
  await Promise.all([
    spinReelSmooth(reels[0], col0, SPIN_BASE_MS + 0),
    spinReelSmooth(reels[1], col1, SPIN_BASE_MS + SPIN_DELTA_MS),
    spinReelSmooth(reels[2], col2, SPIN_BASE_MS + SPIN_DELTA_MS*2),
  ]);

  // évaluer
  const win = evaluatePrize(g);
  if (win && canWinToday()){
    middlePaylineEl && middlePaylineEl.classList.add("win-flash");
    wonSet.add(win.index);
    incWinsToday();
    saveState();
    updatePrizeChecks();
    setStatus(`🎉 Lot gagné : ${win.prize}`, "win");
  } else {
    setStatus("Pas de lot pour cette fois !");
  }

  // fin de crédits → verrouillage (bouton devient "À bientôt")
  if (balance<=0){
    balance=0; locked=true; autoplay=false; if (autoplayChk) autoplayChk.checked=false;
    saveState(); updateBank(); setStatus("Retente ta chance la prochaine fois !","error");
  }

  busy=false; updateBank();
  if (!locked && autoplay && balance>=1){
    setTimeout(()=>{ if(!locked && autoplay && balance>=1) doSpin(); }, 450);
  }
}

/***********************
 *  MODALE RESET (au reload ou via bouton admin si tu en ajoutes un)
 ***********************/
function showResetModal(){
  if (!resetModal) return;
  if (resetError) resetError.hidden = true;
  if (resetPass){ resetPass.value = ""; setTimeout(()=>resetPass.focus(), 50); }
  resetModal.hidden = false;
}
function hideResetModal(){ if (resetModal) resetModal.hidden = true; }

function tryResetWithPassword(pass){
  const ok = (pass||"") === (localStorage.getItem(STORAGE.PASS) || PASS_DEFAULT);
  if (!ok){ if(resetError) resetError.hidden=false; return false; }
  hardResetAllWithPassword();
  updateBank(); setStatus("Crédits et lots réinitialisés.");
  renderPaytable();
  hideResetModal();
  return true;
}

/***********************
 *  INITIALISATION
 ***********************/
(async () => {
  if (resetModal) resetModal.hidden = true;

  // placeholder visuel : 3 cellules visibles par rouleau
  reels.forEach(r=>{
    const rb=document.createElement("div"); rb.className="ribbon";
    for(let i=0;i<ROWS;i++){
      const cell=document.createElement("div"); cell.className="symbol";
      const img=document.createElement("img"); img.src=SYMBOLS[0].icon; img.alt="…";
      cell.appendChild(img); rb.appendChild(cell);
    }
    r.appendChild(rb);
  });

  // préchargement images & layout
  if (spinBtn) spinBtn.disabled=true;
  await Promise.all(SYMBOLS.map(s=>new Promise(res=>{ const img=new Image(); img.onload=img.onerror=res; img.src=s.icon; })));
  setAllReelsCellVar();
  positionPayline();

  // état
  loadStateOrInit();
  renderPaytable();
  updateBank();
  setStatus(locked ? "Retente ta chance la prochaine fois !" : "Bonne chance !", locked ? "error" : "info");
  if (spinBtn) spinBtn.disabled = busy || (!locked && balance<1);

  // Afficher la modale au rechargement si jeu verrouillé (solde=0)
  if (isReload() && balance === 0 && localStorage.getItem(STORAGE.LOCKED) === "1") {
    showResetModal();
  }

  // resize / orientation
  window.addEventListener("resize", ()=>{ setAllReelsCellVar(); positionPayline(); }, { passive:true });
})();

/***********************
 *  ÉVÈNEMENTS
 ***********************/
if (spinBtn) spinBtn.addEventListener("click", doSpin);
document.addEventListener("keydown", e=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); }});
if (autoplayChk){
  autoplayChk.addEventListener("change", e=>{
    if (locked){ e.target.checked=false; return; }
    autoplay = e.target.checked && balance>=1;
    if (autoplay && !busy) doSpin();
  });
}
if (resetForm){
  // La modale est utilisée au reload (ci-dessus) ou depuis un éventuel bouton admin
  resetForm.addEventListener("submit", e=>{ e.preventDefault(); tryResetWithPassword(resetPass.value); });
}
if (resetCancel){
  resetCancel.addEventListener("click", hideResetModal);
}
