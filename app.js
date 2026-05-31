// Bezpieczna komunikacja między oknami przeglądarki poprzez BroadcastChannel API
const channel = new BroadcastChannel('football_broadcast_channel');

// Globalny stan meczu (wartości domyślne)
let matchState = {
    homeName: "GOSPODARZE",
    awayName: "GOŚCIE",
    homeScore: 0,
    awayScore: 0,
    timerSeconds: 0,
    timerRunning: false,
    period: "1H",
    homePlayers: [],
    awayPlayers: [],
    homeCoach: "",
    awayCoach: ""
};

// Detekcja trybu uruchomienia aplikacji na podstawie ścieżki i parametrów URL
const urlParams = new URLSearchParams(window.location.search);
const isOverlay = window.location.pathname.includes('overlay.html') || urlParams.get('mode') === 'overlay';
const isControl = window.location.pathname.includes('control.html') || urlParams.get('mode') === 'control';

// Interwał licznika czasu (Timer)
let timerInterval = null;

// --- INICJALIZACJA SYSTEMU ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Spróbuj pobrać wcześniej zapisany stan z localStorage
    const savedState = localStorage.getItem('matchState');
    if (savedState) {
        try {
            matchState = JSON.parse(savedState);
        } catch (e) {
            console.error("Błąd parsowania stanu z localStorage", e);
        }
    }

    // 2. Odpal odpowiedni widok
    if (isOverlay) {
        initOverlay();
    } else if (isControl) {
        initControl();
    }
});

// --- OBSŁUGA KOMUNIKACJI (BroadcastChannel + LocalStorage Backup) ---
function handleIncomingData(message) {
    const { type, data } = message;
    
    if (type === 'STATE_UPDATE') {
        matchState = data;
        if (isOverlay) updateOverlayUI();
        if (isControl) updateControlUI();
    }
    
    if (type === 'TRIGGER_GOAL' && isOverlay) {
        animateGoal(data.team, data.scorer);
    }

    if (type === 'TRIGGER_LINEUPS' && isOverlay) {
        animateLineups(data.show);
    }
}

// Nasłuchiwanie BroadcastChannel (Komunikacja na żywo)
channel.onmessage = (event) => {
    handleIncomingData(event.data);
};

// Zapasowe nasłuchiwanie LocalStorage (Gdyby przeglądarka/OBS izolowały karty)
window.addEventListener('storage', (event) => {
    if (event.key === 'matchState' && event.newValue) {
        handleIncomingData({ type: 'STATE_UPDATE', data: JSON.parse(event.newValue) });
    }
    if (event.key === 'broadcast_trigger' && event.newValue) {
        handleIncomingData(JSON.parse(event.newValue));
    }
});

// Funkcja synchronizacji stanu i rozsyłania go do innych okien
function syncState() {
    localStorage.setItem('matchState', JSON.stringify(matchState));
    channel.postMessage({ type: 'STATE_UPDATE', data: matchState });
    
    // Wymuś natychmiastowe odświeżenie na karcie, na której aktualnie klikasz
    if (isOverlay) updateOverlayUI();
    if (isControl) updateControlUI();
}

// Formatowanie sekund na postać MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}


// ==========================================
// 🎛️ LOGIKA PANELU KONTROLNEGO (CONTROL)
// ==========================================
function initControl() {
    // Wypełnij formularze aktualnym stanem z pamięci
    document.getElementById('input-home-name').value = matchState.homeName;
    document.getElementById('input-away-name').value = matchState.awayName;
    
    const periodSelect = document.getElementById('select-period');
    if (periodSelect) periodSelect.value = matchState.period;
    
    // Wypełnij textarea składów jeśli już coś tam było zapisane
    if (matchState.homePlayers && matchState.homePlayers.length > 0) {
        document.getElementById('txt-home-players').value = matchState.homePlayers.join(', ');
    }
    if (matchState.awayPlayers && matchState.awayPlayers.length > 0) {
        document.getElementById('txt-away-players').value = matchState.awayPlayers.join(', ');
    }
    document.getElementById('txt-home-coach').value = matchState.homeCoach || "Trener A";
    document.getElementById('txt-away-coach').value = matchState.awayCoach || "Trener B";
    
    updateControlUI();

    // Jeśli zegar był włączony, wznów odliczanie w panelu
    if (matchState.timerRunning) {
        startTimerInterval();
    }
    
    // Na starcie wyślij aktualny stan, żeby wyrównać oba okna
    syncState();
}

function updateControlUI() {
    if (document.getElementById('control-home-score')) document.getElementById('control-home-score').innerText = matchState.homeScore;
    if (document.getElementById('control-away-score')) document.getElementById('control-away-score').innerText = matchState.awayScore;
    if (document.getElementById('control-timer')) document.getElementById('control-timer').innerText = formatTime(matchState.timerSeconds);
    
    const btnTimer = document.getElementById('btn-trigger-timer');
    if (btnTimer) {
        if (matchState.timerRunning) {
            btnTimer.innerText = "PAUZA";
            btnTimer.className = "btn btn-red";
        } else {
            btnTimer.innerText = "START";
            btnTimer.className = "btn btn-neon";
        }
    }
}

function changeScore(team, val) {
    if (team === 'home') matchState.homeScore = Math.max(0, matchState.homeScore + val);
    if (team === 'away') matchState.awayScore = Math.max(0, matchState.awayScore + val);
    syncState();
}

function updateTeams() {
    matchState.homeName = document.getElementById('input-home-name').value.toUpperCase();
    matchState.awayName = document.getElementById('input-away-name').value.toUpperCase();
    syncState();
}

function changePeriod() {
    const periodSelect = document.getElementById('select-period');
    if (periodSelect) {
        matchState.period = periodSelect.value;
        syncState();
    }
}

function toggleTimer() {
    matchState.timerRunning = !matchState.timerRunning;
    if (matchState.timerRunning) {
        startTimerInterval();
    } else {
        clearInterval(timerInterval);
    }
    syncState();
}

function startTimerInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (matchState.timerRunning) {
            matchState.timerSeconds++;
            syncState();
        }
    }, 1000);
}

function resetTimer() {
    matchState.timerRunning = false;
    clearInterval(timerInterval);
    matchState.timerSeconds = 0;
    syncState();
}

function setCustomTime() {
    const val = parseInt(document.getElementById('input-custom-time').value, 10);
    if (!isNaN(val) && val >= 0) {
        matchState.timerSeconds = val;
        syncState();
    }
}

function triggerGoalAnimation() {
    const teamKey = document.getElementById('select-goal-team').value;
    const teamName = teamKey === 'home' ? matchState.homeName : matchState.awayName;
    const scorer = document.getElementById('input-goal-scorer').value || "ZAWODNIK";
    
    const payload = { type: 'TRIGGER_GOAL', data: { team: teamName, scorer: scorer } };
    channel.postMessage(payload);
    localStorage.setItem('broadcast_trigger', JSON.stringify({ ...payload, _ts: Date.now() }));
}

function updateLineupsData() {
    const homePlayersText = document.getElementById('txt-home-players').value;
    const awayPlayersText = document.getElementById('txt-away-players').value;
    
    matchState.homePlayers = homePlayersText.split(',').map(p => p.trim()).filter(p => p.length > 0);
    matchState.awayPlayers = awayPlayersText.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    matchState.homeCoach = document.getElementById('txt-home-coach').value;
    matchState.awayCoach = document.getElementById('txt-away-coach').value;
    
    syncState();
    alert("Składy zostały zapisane i wysłane do OBS!");
}

function toggleLineups(show) {
    const payload = { type: 'TRIGGER_LINEUPS', data: { show: show } };
    channel.postMessage(payload);
    localStorage.setItem('broadcast_trigger', JSON.stringify({ ...payload, _ts: Date.now() }));
}


// ==========================================
// 📺 LOGIKA NAKŁADKI (OVERLAY - OBS VIEW)
// ==========================================
function initOverlay() {
    updateOverlayUI();
    if(typeof gsap !== 'undefined') {
        gsap.from("#scoreboard", { y: -100, opacity: 0, duration: 1.2, ease: "power4.out" });
    }
}

function updateOverlayUI() {
    if (document.getElementById('hud-home-name')) document.getElementById('hud-home-name').innerText = matchState.homeName;
    if (document.getElementById('hud-away-name')) document.getElementById('hud-away-name').innerText = matchState.awayName;
    if (document.getElementById('hud-home-score')) document.getElementById('hud-home-score').innerText = matchState.homeScore;
    if (document.getElementById('hud-away-score')) document.getElementById('hud-away-score').innerText = matchState.awayScore;
    if (document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(matchState.timerSeconds);
    if (document.getElementById('hud-period')) document.getElementById('hud-period').innerText = matchState.period;
}

// ⚽ ANIMACJA GSAP: GOOOL
function animateGoal(team, scorer) {
    if(typeof gsap === 'undefined') return;

    document.getElementById('goal-team-name').innerText = team;
    document.getElementById('goal-scorer-name').innerText = scorer;

    const overlay = document.getElementById('goal-overlay');
    const stripe = overlay.querySelector('.goal-bg-stripe');
    const content = overlay.querySelector('.goal-content');

    const tl = gsap.timeline();

    tl.set(overlay, { visibility: 'visible', opacity: 0 })
      .set(stripe, { scaleX: 0, rotation: -5 })
      .set(content, { scale: 0.5, opacity: 0 })
      .to(overlay, { opacity: 1, duration: 0.3 })
      .to(stripe, { scaleX: 1, duration: 0.5, ease: "expo.out" }, "-=0.2")
      .to(content, { scale: 1.1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" })
      .to(content, { scale: 1, duration: 0.1 })
      .to(content, { x: -10, y: 5, duration: 0.05, repeat: 5, yoyo: true })
      .to(content, { x: 0, y: 0, duration: 0.05 })
      .to({}, { duration: 4.5 }) 
      .to(content, { y: 50, opacity: 0, duration: 0.4, ease: "power4.in" })
      .to(stripe, { scaleX: 0, duration: 0.4, ease: "power4.in" }, "-=0.3")
      .to(overlay, { opacity: 0, duration: 0.3, onComplete: () => {
          gsap.set(overlay, { visibility: 'hidden' });
      }});
}

// 🧑‍🤝‍🧑 ANIMACJA GSAP: SKŁADY (LINEUPS)
function animateLineups(show) {
    if(typeof gsap === 'undefined') return;
    
    const overlay = document.getElementById('lineups-overlay');
    
    if (show) {
        buildLineupList('lineup-home-list', matchState.homePlayers);
        buildLineupList('lineup-away-list', matchState.awayPlayers);
        
        document.getElementById('lineup-home-title').innerText = matchState.homeName;
        document.getElementById('lineup-away-title').innerText = matchState.awayName;
        document.getElementById('lineup-home-coach').innerText = matchState.homeCoach || "-";
        document.getElementById('lineup-away-coach').innerText = matchState.awayCoach || "-";

        gsap.set(overlay, { visibility: 'visible', opacity: 1 });
        gsap.from("#lineup-home-col", { x: -600, opacity: 0, duration: 0.8, ease: "power4.out" });
        gsap.from("#lineup-away-col", { x: 600, opacity: 0, duration: 0.8, ease: "power4.out" });
        
        gsap.to(".lineup-list li", {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.05,
            ease: "power2.out",
            delay: 0.4
        });
    } else {
        const tl = gsap.timeline({ onComplete: () => gsap.set(overlay, { visibility: 'hidden' }) });
        tl.to("#lineup-home-col", { x: -600, opacity: 0, duration: 0.6, ease: "power4.in" })
          .to("#lineup-away-col", { x: 600, opacity: 0, duration: 0.6, ease: "power4.in" }, "-=0.6");
    }
}

function buildLineupList(elementId, playersArray) {
    const listEl = document.getElementById(elementId);
    if(!listEl) return;
    listEl.innerHTML = "";
    
    const players = playersArray && playersArray.length > 0 ? playersArray : [
        "1. ZAWODNIK", "2. ZAWODNIK", "3. ZAWODNIK", "4. ZAWODNIK", "5. ZAWODNIK", 
        "6. ZAWODNIK", "7. ZAWODNIK", "8. ZAWODNIK", "9. ZAWODNIK", "10. ZAWODNIK", "11. ZAWODNIK"
    ];
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.innerText = player;
        li.style.opacity = "0"; 
        listEl.appendChild(li);
    });
}
