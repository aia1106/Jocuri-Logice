/* Concurs – Cod Secret + Sudoku – Cercul de Jocuri Logice
   Ordinea: 1) Codul Secret (până deschide seiful)  2) Sudoku (4 niveluri).
   Cronometrul total pornește când începe Codul Secret. */
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycby-Ky5XJKH8NP69lex25aINe2DXWvN6XxbNbG5WdAEUipkxZUnXJAZZhLU9Ck9z48oH/exec";
// ⚠ Dacă ai un deployment NOU în Apps Script, înlocuiește linkul de mai sus.

/* ---------- setări ---------- */
const COD_COLORS = [
    { name: "Roșu", sym: "▲", cls: "cs-c0" },
    { name: "Albastru", sym: "■", cls: "cs-c1" },
    { name: "Verde", sym: "◆", cls: "cs-c2" },
    { name: "Galben", sym: "★", cls: "cs-c3" }
];
const COD_LEN = 3;      // câte culori are codul
const COD_MAX = 10;     // încercări pe seif
const COD_HINTS = 2;    // indicii pe seif (0 = fără indicii)

const levelSequence = [3, 3, 4, 5];
const levelTime = { 3: 30, 4: 60, 5: 120 };

/* ---------- stare ---------- */
let solution = [], size = 3, timerInterval = null, timeLeft = 0;
let currentLevelIndex = 0, started = false, busy = false;
let elapsedMs = 0, phaseStart = 0, running = false, totalInterval = null;
let csSecret = [], csGuess = [], csTries = [], csOver = false, csHints = 0, csRevealed = [];
let csRound = 0, codIncercari = 0;

const $ = (id) => document.getElementById(id);
const val = (id) => { const e = $(id); return e ? e.value.trim() : ""; };
function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}

/* ---------- cronometru total (se oprește între faze) ---------- */
function phaseBegin() { phaseStart = Date.now(); running = true; }
function phaseEnd() { if (running) { elapsedMs += Date.now() - phaseStart; running = false; } }
function totalSeconds() { return Math.floor((elapsedMs + (running ? Date.now() - phaseStart : 0)) / 1000); }
function tickTotal() { $("total-timer").textContent = formatTime(totalSeconds()); }

function formatTime(sec) {
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function setMessage(text, kind) {
    const m = $("message");
    m.textContent = text;
    m.className = "contest-message" + (kind ? " " + kind : "");
}

/* =====================================================================
   PASUL 1 – CODUL SECRET
   ===================================================================== */
function csPeg(i, tag) {
    return el(tag || "span", "cs-peg " + (i == null ? "empty" : COD_COLORS[i].cls), i == null ? "" : COD_COLORS[i].sym);
}

function csMakeSecret() {                       // amestec Fisher-Yates
    const a = COD_COLORS.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, COD_LEN);
}

function csScore(g, s) {                        // culorile sunt unice, deci scorul e simplu
    const black = g.filter((c, i) => c === s[i]).length;
    const white = g.filter(c => s.includes(c)).length - black;
    return { black, white };
}

function csRender() {
    const board = $("cs-board");
    board.replaceChildren();
    for (let r = 0; r < COD_MAX; r++) {
        const t = csTries[r];
        const now = !t && r === csTries.length && !csOver;
        const li = el("li", "cs-row" + (now ? " now" : ""));
        const pegs = el("span", "cs-pegs");
        const fb = el("span", "cs-fb");
        fb.setAttribute("aria-hidden", "true");
        for (let k = 0; k < COD_LEN; k++) {
            if (t) {
                pegs.appendChild(csPeg(t.guess[k]));
            } else if (now && csGuess[k] != null) {
                const b = csPeg(csGuess[k], "button");
                b.type = "button";
                b.setAttribute("aria-label", "Scoate " + COD_COLORS[csGuess[k]].name);
                b.onclick = () => { csGuess.splice(k, 1); csRender(); };
                pegs.appendChild(b);
            } else {
                pegs.appendChild(csPeg(null));
            }
            fb.appendChild(el("i", t ? (k < t.black ? "ok" : k < t.black + t.white ? "near" : "") : ""));
        }
        const n = el("span", "cs-n", r + 1);
        n.setAttribute("aria-hidden", "true");
        li.append(n, pegs, fb);
        if (t) {
            pegs.setAttribute("aria-hidden", "true");
            li.appendChild(el("span", "sr-only",
                `Încercarea ${r + 1}: ${t.guess.map(i => COD_COLORS[i].name).join(", ")}. ${t.black} la loc corect, ${t.white} la loc greșit.`));
        }
        board.appendChild(li);
    }

    $("cs-code").replaceChildren(...csSecret.map((c, k) =>
        csRevealed.includes(k) || csOver ? csPeg(c) : el("span", "cs-peg empty", "?")));

    [...$("cs-palette").children].forEach((b, i) => {
        b.disabled = csOver || csGuess.includes(i) || csGuess.length >= COD_LEN;
    });
    $("cs-undo").disabled = csOver || !csGuess.length;
    $("cs-check").disabled = csOver || csGuess.length !== COD_LEN;
    $("cs-hint").disabled = csOver || csHints < 1;
    $("cs-hint").textContent = `Indiciu (${csHints})`;
    $("cs-counter").textContent = csOver
        ? `${csTries.length} din ${COD_MAX} încercări`
        : `Încercarea ${csTries.length + 1} din ${COD_MAX}`;
    $("cs-round").textContent = `Seiful ${csRound}`;
}

function csPick(i) {
    if (csOver || csGuess.length >= COD_LEN || csGuess.includes(i)) return;
    csGuess.push(i);
    $("cs-status").textContent = csGuess.length === COD_LEN ? "Apasă Verifică." : "";
    csRender();
}

function csCheck() {
    if (csOver || csGuess.length !== COD_LEN) return;
    const g = [...csGuess], res = csScore(g, csSecret);
    csTries.push({ guess: g, ...res });
    csGuess = [];
    $("cs-dial").style.transform = `rotate(${csTries.length * 55}deg)`;
    const st = $("cs-status"), safe = $("cs-safe");

    if (res.black === COD_LEN) {
        csOver = true;
        phaseEnd();                              // timpul se oprește la deschiderea seifului
        codIncercari = csTries.length;
        safe.classList.add("won");
        st.textContent = "Seif deschis! Urmează Sudoku…";
        setTimeout(startSudoku, 1500);
    } else if (csTries.length >= COD_MAX) {
        csOver = true;                           // timpul NU se oprește: urmează un seif nou
        safe.classList.add("lost");
        st.textContent = "Seiful a rămas închis. Încearcă un seif nou…";
        setTimeout(csStart, 2500);
    } else {
        st.textContent = `${res.black} la loc corect, ${res.white} la loc greșit.`;
    }
    csRender();
}

function csHint() {
    const free = [...Array(COD_LEN).keys()].filter(k => !csRevealed.includes(k));
    if (csOver || csHints < 1 || !free.length) return;
    const k = free[Math.floor(Math.random() * free.length)];
    csRevealed.push(k);
    csHints--;
    $("cs-status").textContent = `Poziția ${k + 1} este ${COD_COLORS[csSecret[k]].name}.`;
    csRender();
}

function csStart() {
    csRound++;
    csSecret = csMakeSecret();
    csGuess = []; csTries = []; csOver = false;
    csHints = COD_HINTS; csRevealed = [];
    $("cs-safe").classList.remove("won", "lost");
    $("cs-dial").style.transform = "";
    $("cs-status").textContent = `Alege ${COD_LEN} culori diferite.`;
    csRender();
}

/* =====================================================================
   PASUL 2 – SUDOKU
   ===================================================================== */
function generateLatinSquare(n) {
    const grid = Array.from({ length: n }, () => Array(n).fill(0));
    function canPlace(r, c, num) {
        for (let i = 0; i < n; i++) if (grid[r][i] === num || grid[i][c] === num) return false;
        return true;
    }
    function solve(cell = 0) {
        if (cell === n * n) return true;
        const r = Math.floor(cell / n), c = cell % n;
        const nums = [...Array(n).keys()].map(x => x + 1).sort(() => Math.random() - 0.5);
        for (const num of nums) {
            if (canPlace(r, c, num)) {
                grid[r][c] = num;
                if (solve(cell + 1)) return true;
                grid[r][c] = 0;
            }
        }
        return false;
    }
    solve();
    return grid;
}

/* numără soluțiile (maxim 2) ca problema să aibă un singur răspuns */
function countSolutions(puzzle, limit = 2) {
    const n = puzzle.length;
    const g = puzzle.map(r => [...r]);
    let count = 0;
    function ok(r, c, v) {
        for (let i = 0; i < n; i++) if (g[r][i] === v || g[i][c] === v) return false;
        return true;
    }
    function go(cell) {
        if (count >= limit) return;
        if (cell === n * n) { count++; return; }
        const r = Math.floor(cell / n), c = cell % n;
        if (g[r][c] !== 0) { go(cell + 1); return; }
        for (let v = 1; v <= n; v++) {
            if (ok(r, c, v)) { g[r][c] = v; go(cell + 1); g[r][c] = 0; }
        }
    }
    go(0);
    return count;
}

function generatePuzzle(n) {
    const grid = generateLatinSquare(n);
    solution = grid.map(r => [...r]);
    const puzzle = grid.map(r => [...r]);
    const target = Math.floor(n * n * 0.4);
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push([r, c]);
    cells.sort(() => Math.random() - 0.5);
    let removed = 0;
    for (const [r, c] of cells) {
        if (removed >= target) break;
        const keep = puzzle[r][c];
        puzzle[r][c] = 0;
        if (countSolutions(puzzle) === 1) removed++;
        else puzzle[r][c] = keep;
    }
    return puzzle;
}

function renderBoard(puzzle) {
    const board = $("board");
    board.innerHTML = "";
    board.style.setProperty("--n", puzzle.length);
    puzzle.forEach((row, r) => {
        row.forEach((v, c) => {
            const input = document.createElement("input");
            input.type = "text";
            input.maxLength = 1;
            input.className = "cell";
            input.dataset.row = r;
            input.dataset.col = c;
            input.inputMode = "numeric";
            input.autocomplete = "off";
            input.setAttribute("aria-label", `Rândul ${r + 1}, coloana ${c + 1}`);
            if (v !== 0) { input.value = v; input.disabled = true; input.classList.add("given"); }
            board.appendChild(input);
        });
    });
    const first = board.querySelector(".cell:not(:disabled)");
    if (first) first.focus();
}

function updateProgress() {
    document.querySelectorAll("#progress li").forEach((li, i) => {
        li.classList.toggle("done", i < currentLevelIndex);
        li.classList.toggle("current", i === currentLevelIndex && started);
    });
    $("level-info").textContent = currentLevelIndex < levelSequence.length
        ? `Pasul 2 din 2 · Sudoku · nivelul ${currentLevelIndex + 1} din ${levelSequence.length} · tabel ${size}×${size} · cifre de la 1 la ${size}`
        : "";
}

function startTimer() {                          // numărătoarea inversă a nivelului
    clearInterval(timerInterval);
    timeLeft = levelTime[size];
    updateTimer();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            setMessage("Timp expirat! Poți continua, dar timpul total rulează.", "warn");
        }
    }, 1000);
}
function updateTimer() {
    const t = Math.max(timeLeft, 0);
    const e = $("timer");
    e.textContent = formatTime(t);
    e.classList.toggle("low", t <= 10);
}

function startSudoku() {
    $("code-area").hidden = true;
    $("play-area").hidden = false;
    currentLevelIndex = 0;
    nextLevel();
}

function nextLevel() {
    if (currentLevelIndex >= levelSequence.length) { finishContest(); return; }
    size = levelSequence[currentLevelIndex];
    renderBoard(generatePuzzle(size));
    setMessage("");
    updateProgress();
    startTimer();
    phaseBegin();
    busy = false;
}

function readGrid() {
    const g = Array.from({ length: size }, () => Array(size).fill(0));
    document.querySelectorAll(".cell").forEach(inp => {
        g[inp.dataset.row][inp.dataset.col] = parseInt(inp.value) || 0;
    });
    return g;
}

function checkSolution() {
    if (busy || !started || $("play-area").hidden) return;
    const g = readGrid();
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
        if (g[r][c] !== solution[r][c]) {
            setMessage("Mai încearcă! Verifică rândurile și coloanele.", "warn");
            return;
        }
    }
    busy = true;
    phaseEnd();                                  // doar timpul de rezolvare, fără pauzele dintre niveluri
    clearInterval(timerInterval);
    setMessage(`Bravo! Ai rezolvat nivelul ${currentLevelIndex + 1}.`, "ok");
    currentLevelIndex++;
    updateProgress();
    setTimeout(nextLevel, 1600);
}

function clearMistakes() {
    document.querySelectorAll(".cell").forEach(inp => {
        if (!inp.disabled && inp.value && parseInt(inp.value) !== solution[inp.dataset.row][inp.dataset.col]) {
            inp.value = "";
            inp.classList.remove("wrong");
        }
    });
    setMessage("Am șters cifrele greșite.");
}

/* =====================================================================
   DESFĂȘURARE GENERALĂ
   ===================================================================== */
function startContest() {
    const name = $("username").value.trim();
    if (!name) {
        setMessage("Scrie numele concurentului înainte de start.", "warn");
        $("username").focus();
        return;
    }
    if ($("clasa") && !val("clasa")) {
        setMessage("Scrie clasa înainte de start.", "warn");
        $("clasa").focus();
        return;
    }
    started = true;
    elapsedMs = 0; csRound = 0; codIncercari = 0;
    $("username").disabled = true;
    ["clasa", "scoala"].forEach(id => { if ($(id)) $(id).disabled = true; });
    $("start-area").hidden = true;
    $("code-area").hidden = false;
    $("total-wrap").hidden = false;
    setMessage("");
    phaseBegin();                                // timpul începe cu Codul Secret
    tickTotal();
    totalInterval = setInterval(tickTotal, 500);
    csStart();
}

function finishContest() {
    clearInterval(timerInterval);
    clearInterval(totalInterval);
    phaseEnd();
    const seconds = Math.round(elapsedMs / 1000);
    const total = formatTime(seconds);
    $("play-area").hidden = true;
    $("total-wrap").hidden = true;
    $("end-area").hidden = false;
    setMessage("");
    $("final-time").textContent = total;
    $("final-name").textContent = $("username").value.trim();
    updateProgress();
    sendFinalTime({
        name: $("username").value.trim(),
        clasa: val("clasa"),
        scoala: val("scoala"),
        seconds: seconds,
        time: total,
        codRunde: csRound,
        codIncercari: codIncercari,
        attemptId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
                   : Date.now() + "-" + Math.random().toString(36).slice(2)
    });
}

/* ---------- trimitere rezultat către Google Sheet ---------- */
const PENDING_KEY = "concurs_rezultate_netrimise";

function getPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (e) { return []; }
}
function setPending(list) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) {}
}
function sendPending() {
    getPending().forEach(r => postResult(r).catch(() => {}));
}

function postResult(result) {
    return fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },   // cerere „simplă": răspunsul se poate citi
        body: JSON.stringify(result)
    }).then(r => r.json()).then(j => {
        if (!j.ok) throw new Error(j.error || "eroare");
        setPending(getPending().filter(p => p.attemptId !== result.attemptId));
        return j;
    });
}

function sendFinalTime(result, attempt = 1) {
    const status = $("send-status");
    if (!getPending().some(p => p.attemptId === result.attemptId)) setPending(getPending().concat(result));
    status.textContent = "Se trimite rezultatul…";
    postResult(result).then(() => {
        status.textContent = "Rezultatul a fost salvat. ✔";
        const old = $("retry-btn");
        if (old) old.remove();
    }).catch(() => {
        if (attempt < 3) {
            setTimeout(() => sendFinalTime(result, attempt + 1), 2000 * attempt);
            return;
        }
        status.textContent = `Nu s-a putut salva rezultatul. Notează timpul (${result.time}) și apasă „Retrimite”.`;
        if (!$("retry-btn")) {
            const b = el("button", "btn btn-ghost", "Retrimite");
            b.id = "retry-btn";
            b.type = "button";
            b.addEventListener("click", () => sendFinalTime(result, 1));
            status.after(b);
        }
    });
}

/* ---------- evenimente ---------- */
document.addEventListener("DOMContentLoaded", () => {
    sendPending();                               // retrimite rezultatele rămase netrimise

    // Cod Secret
    COD_COLORS.forEach((c, i) => {
        const b = el("button", "cs-pick " + c.cls, c.sym);
        b.type = "button";
        b.title = c.name;
        b.setAttribute("aria-label", c.name);
        b.onclick = () => csPick(i);
        $("cs-palette").appendChild(b);
    });
    $("cs-board").style.setProperty("--rows", COD_MAX);
    $("cs-undo").onclick = () => { if (!csOver) { csGuess.pop(); $("cs-status").textContent = ""; csRender(); } };
    $("cs-hint").onclick = csHint;
    $("cs-check").onclick = csCheck;

    // Concurs + Sudoku
    $("start-btn").addEventListener("click", startContest);
    $("check-btn").addEventListener("click", checkSolution);
    $("clear-btn").addEventListener("click", clearMistakes);
    $("new-btn").addEventListener("click", () => location.reload());
    $("username").addEventListener("keydown", (e) => { if (e.key === "Enter") startContest(); });

    $("board").addEventListener("input", (e) => {
        const inp = e.target;
        if (!inp.classList.contains("cell")) return;
        const v = inp.value.replace(/[^0-9]/g, "");
        inp.value = (v && parseInt(v) >= 1 && parseInt(v) <= size) ? v : "";
        if (inp.value) {
            const cells = [...document.querySelectorAll(".cell:not(:disabled)")];
            const next = cells[cells.indexOf(inp) + 1];
            if (next) next.focus();
        }
    });
    $("board").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { checkSolution(); return; }
        const inp = e.target;
        if (!inp.classList.contains("cell")) return;
        const r = +inp.dataset.row, c = +inp.dataset.col;
        const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        if (!move) return;
        e.preventDefault();
        const t = document.querySelector(`.cell[data-row="${r + move[0]}"][data-col="${c + move[1]}"]`);
        if (t && !t.disabled) t.focus();
    });
});
