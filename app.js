// Główny stan meczu
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

// Detekcja trybu uruchomienia aplikacji
const urlParams = new URLSearchParams(window.location.search);
const isOverlay = window.location.pathname.includes('overlay.html') || urlParams.get('mode') === 'overlay';
const isControl = window.location.pathname.includes('control.html') || urlParams.get('mode') === 'control';

let timerInterval = null;
let lastTriggerId = ""; // Zapobiega zapętlaniu animacji w trybie Polling

// --- INICJALIZACJA SYSTEMU ---
document.addEventListener("DOMContentLoaded", () => {
    loadStateFromStorage();

    if (isOverlay) {
        updateOverlayUI();
        // Gwarancja płynnego wejścia tablicy przy starcie źródła w OBS
        if (typeof gsap !== 'undefined') {
            gsap.from("#scoreboard", { y: -100, opacity: 0, duration: 1.2, ease: "power4.out" });
        }
        
        // 🚀 PANCERNE ROZWIĄZANIE DLA OBS: Sprawdzaj stan w pamięci co 250ms
        setInterval(() => {
            loadStateFromStorage();
            updateOverlayUI();
            checkDirectTriggers();
        }, 250);

    } else if (isControl) {
        initControl();
        // Panel kontrolny też co sekundę sprawdza zegar (jeśli działa w tle)
        setInterval(() => {
            if (matchState.timerRunning) {
                loadStateFromStorage();
                updateControlUI();
            }
        }, 1000);
    }
});

function loadStateFromStorage() {
    const savedState = localStorage.getItem('matchState');
    if (savedState) {
        try {
            matchState = JSON.parse(savedState);
        } catch (e) {
            console.error(e);
        }
    }
}

// Sprawdzanie jednorazowych akcji (gol, składy) zapisanych bezpośrednio w pamięci
function checkDirectTriggers() {
    const savedTrigger = localStorage.getItem('obs_active_trigger');
    if (savedTrigger) {
        try {
            const trigger = JSON.parse(savedTrigger);
            if (trigger.id !== lastTriggerId) {
                lastTriggerId = trigger.id; // zapamiętaj, by wykonać tylko raz
                
                if (trigger.type === 'GOAL') {
                    animateGoal(trigger.team, trigger.scorer);
                }
                if (trigger.type === 'LINEUP_HOME') {
                    animateLineupSide('home', trigger.show);
                }
                if (trigger.type === 'LINEUP_AWAY') {
                    animateLineupSide('away', trigger.show);
                }
            }
        } catch (e) { console.error(e); }
    }
}

function saveAndBroadcast() {
    localStorage.setItem('matchState', JSON.stringify(matchState));
    if (isControl) updateControlUI();
    if (isOverlay) updateOverlayUI();
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// ==========================================
// 🎛️ LOGIKA PANELU KONTROLNEGO
// ==========================================
function initControl() {
    document.getElementById('input-home-name').value = matchState.homeName;
    document.getElementById('input-away-name').value = matchState.awayName;
    if (document.getElementById('select-period')) document.getElementById('select-period').value = matchState.period;
    
    if (matchState.homePlayers && matchState.homePlayers.length > 0) {
        document.getElementById('txt-home-players').value = matchState.homePlayers.join(', ');
    }
    if (matchState.awayPlayers && matchState.awayPlayers.length > 0) {
        document.getElementById('txt-away-players').value = matchState.awayPlayers.join(', ');
    }
    document.getElementById('txt-home-coach').value = matchState.homeCoach || "Trener A";
    document.getElementById('txt-away-coach').value = matchState.awayCoach || "Trener B";
    
    updateControlUI();
    if (matchState.timerRunning) startTimerInterval();
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
    saveAndBroadcast();
}

function updateTeams() {
    matchState.homeName = document.getElementById('input-home-name').value.toUpperCase();
    matchState.awayName = document.getElementById('input-away-name').value.toUpperCase();
    saveAndBroadcast();
}

function changePeriod() {
    const periodSelect = document.getElementById('select-period');
    if (periodSelect) {
        matchState.period = periodSelect.value;
        saveAndBroadcast();
    }
}

function toggleTimer() {
    matchState.timerRunning = !matchState.timerRunning;
    if (matchState.timerRunning) {
        startTimerInterval();
    } else {
        clearInterval(timerInterval);
    }
    saveAndBroadcast();
}

function startTimerInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        loadStateFromStorage(); // pobierz aktualny stan przed inkrementacją
        if (matchState.timerRunning) {
            matchState.timerSeconds++;
            localStorage.setItem('matchState', JSON.stringify(matchState));
        } else {
            clearInterval(timerInterval);
        }
    }, 1000);
}

function resetTimer() {
    matchState.timerRunning = false;
    clearInterval(timerInterval);
    matchState.timerSeconds = 0;
    saveAndBroadcast();
}

function setCustomTime() {
    const val = parseInt(document.getElementById('input-custom-time').value, 10);
    if (!isNaN(val) && val >= 0) {
        matchState.timerSeconds = val;
        saveAndBroadcast();
    }
}

function triggerGoalAnimation() {
    const teamKey = document.getElementById('select-goal-team').value;
    const teamName = teamKey === 'home' ? matchState.homeName : matchState.awayName;
    const scorer = document.getElementById('input-goal-scorer').value || "ZAWODNIK";
    
    localStorage.setItem('obs_active_trigger', JSON.stringify({
        id: "goal_" + Date.now(),
        type: 'GOAL',
        team: teamName,
        scorer: scorer
    }));
}

function updateLineupsData() {
    matchState.homePlayers = document.getElementById('txt-home-players').value.split(',').map(p => p.trim()).filter(p => p.length > 0);
    matchState.awayPlayers = document.getElementById('txt-away-players').value.split(',').map(p => p.trim()).filter(p => p.length > 0);
    matchState.homeCoach = document.getElementById('txt-home-coach').value;
    matchState.awayCoach = document.getElementById('txt-away-coach').value;
    saveAndBroadcast();
    alert("Składy zostały zsynchronizowane w bazie OBS!");
}

function triggerLineupVisual(side, show) {
    localStorage.setItem('obs_active_trigger', JSON.stringify({
        id: `lineup_${side}_` + Date.now(),
        type: side === 'home' ? 'LINEUP_HOME' : 'LINEUP_AWAY',
        show: show
    }));
}

// ==========================================
// 📺 LOGIKA NAKŁADKI (OVERLAY - OBS)
// ==========================================
function updateOverlayUI() {
    if (document.getElementById('hud-home-name')) document.getElementById('hud-home-name').innerText = matchState.homeName;
    if (document.getElementById('hud-away-name')) document.getElementById('hud-away-name').innerText = matchState.awayName;
    if (document.getElementById('hud-home-score')) document.getElementById('hud-home-score').innerText = matchState.homeScore;
    if (document.getElementById('hud-away-score')) document.getElementById('hud-away-score').innerText = matchState.awayScore;
    if (document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(matchState.timerSeconds);
    if (document.getElementById('hud-period')) document.getElementById('hud-period').innerText = matchState.period;
}

function animateGoal(team, scorer) {
    if (typeof gsap === 'undefined') return;

    document.getElementById('goal-team-name').innerText = team;
    document.getElementById('goal-scorer-name').innerText = scorer;

    const overlay = document.getElementById('goal-overlay');
    const stripe = overlay.querySelector('.goal-bg-stripe');
    const content = overlay.querySelector('.goal-content');

    const tl = gsap.timeline();
    tl.set(overlay, { visibility: 'visible', opacity: 0 })
      .set(stripe, { scaleX: 0 })
      .set(content, { scale: 0.5, opacity: 0 })
      .to(overlay, { opacity: 1, duration: 0.3 })
      .to(stripe, { scaleX: 1, duration: 0.5, ease: "expo.out" }, "-=0.1")
      .to(content, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.5)" })
      .to(content, { x: -10, duration: 0.05, repeat: 4, yoyo: true })
      .to(content, { x: 0, duration: 0.05 })
      .to({}, { duration: 4.0 }) 
      .to(content, { y: 30, opacity: 0, duration: 0.4, ease: "power4.in" })
      .to(stripe, { scaleX: 0, duration: 0.4, ease: "power4.in" }, "-=0.2")
      .to(overlay, { opacity: 0, duration: 0.2, onComplete: () => {
          gsap.set(overlay, { visibility: 'hidden' });
      }});
}

function animateLineupSide(side, show) {
    if (typeof gsap === 'undefined') return;
    
    const overlay = document.getElementById('lineups-overlay');
    const colId = side === 'home' ? '#lineup-home-col' : '#lineup-away-col';
    const listId = side === 'home' ? 'lineup-home-list' : 'lineup-away-list';
    
    if (show) {
        // Zbuduj tylko wybraną listę
        if (side === 'home') {
            buildLineupList(listId, matchState.homePlayers);
            document.getElementById('lineup-home-title').innerText = matchState.homeName;
            document.getElementById('lineup-home-coach').innerText = matchState.homeCoach || "-";
        } else {
            buildLineupList(listId, matchState.awayPlayers);
            document.getElementById('lineup-away-title').innerText = matchState.awayName;
            document.getElementById('lineup-away-coach').innerText = matchState.awayCoach || "-";
        }

        gsap.set(overlay, { visibility: 'visible', opacity: 1 });
        gsap.fromTo(colId, { x: side === 'home' ? -600 : 600, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "power4.out" });
        
        gsap.to(`${colId} .lineup-list li`, {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.05,
            ease: "power2.out",
            delay: 0.3
        });
    } else {
        // Schowaj wybraną stronę
        gsap.to(colId, { 
            x: side === 'home' ? -600 : 600, 
            opacity: 0, 
            duration: 0.6, 
            ease: "power4.in",
            onComplete: () => {
                // Jeśli drugi panel też jest niewidoczny, ukryj cały kontener glówny
                const homeCol = document.getElementById('lineup-home-col');
                const awayCol = document.getElementById('lineup-away-col');
                if (window.getComputedStyle(homeCol).opacity === "0" && window.getComputedStyle(awayCol).opacity === "0") {
                    gsap.set(overlay, { visibility: 'hidden' });
                }
            }
        });
    }
}

function buildLineupList(elementId, playersArray) {
    const listEl = document.getElementById(elementId);
    if (!listEl) return;
    listEl.innerHTML = "";
    
    const players = playersArray && playersArray.length > 0 ? playersArray : Array(11).fill("").map((_, i) => `${i+1}. ZAWODNIK`);
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.innerText = player;
        li.style.opacity = "0"; 
        li.style.transform = `translateX(${elementId.includes('home') ? '-20px' : '20px'})`;
        listEl.appendChild(li);
    });
}
