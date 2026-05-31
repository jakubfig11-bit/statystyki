// === KONFIGURACJA SUPABASE (Twoje poprawne dane) ===
const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

// Globalny stan meczu
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
let lastTriggerId = "";

document.addEventListener("DOMContentLoaded", async () => {
    // Dynamiczne ładowanie biblioteki Supabase, aby nie rozsypał się HTML
    if (typeof supabase === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        document.head.appendChild(script);
        script.onload = () => initSystem();
    } else {
        initSystem();
    }
});

let supabaseClient = null;

function initSystem() {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Konfiguracja dedykowanego kanału rozgłoszeniowego (Broadcast)
    const myChannel = supabaseClient.channel('obs_broadcast', {
        config: {
            broadcast: { self: true }
        }
    });

    if (isOverlay) {
        updateOverlayUI();
        
        // Słuchanie zmian na żywo przesyłanych z Panelu do OBS
        myChannel
            .on('broadcast', { event: 'state_update' }, ({ payload }) => {
                matchState = payload;
                updateOverlayUI();
            })
            .on('broadcast', { event: 'trigger_action' }, ({ payload }) => {
                if (payload.id !== lastTriggerId) {
                    lastTriggerId = payload.id;
                    if (payload.type === 'GOAL') animateGoal(payload.team, payload.scorer);
                    if (payload.type === 'LINEUP_HOME') animateLineupSide('home', payload.show);
                    if (payload.type === 'LINEUP_AWAY') animateLineupSide('away', payload.show);
                }
            })
            .subscribe((status) => {
                console.log("Status połączenia NAKŁADKI z Supabase:", status);
            });
            
    } else if (isControl) {
        initControl();
        
        // Aktywacja nasłuchu w panelu kontrolnym (wymagana do stabilnej wysyłki)
        myChannel.subscribe((status) => {
            console.log("Status połączenia PANELU z Supabase:", status);
        });
    }
}

// Funkcja wysyłająca dane do chmury Supabase
function sendToOBS(eventName, data) {
    if (!supabaseClient) return;
    supabaseClient.channel('obs_broadcast').send({
        type: 'broadcast',
        event: eventName,
        payload: data
    });
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// ==========================================
// 🎛️ LOGIKA PANELU KONTROLNEGO (CONTROL)
// ==========================================
function initControl() {
    updateControlUI();
}

function updateControlUI() {
    if (document.getElementById('control-home-score')) document.getElementById('control-home-score').innerText = matchState.homeScore;
    if (document.getElementById('control-away-score')) document.getElementById('control-away-score').innerText = matchState.awayScore;
    if (document.getElementById('control-timer')) document.getElementById('control-timer').innerText = formatTime(matchState.timerSeconds);
    
    const btnTimer = document.getElementById('btn-trigger-timer');
    if (btnTimer) {
        btnTimer.innerText = matchState.timerRunning ? "PAUZA" : "START";
        btnTimer.className = matchState.timerRunning ? "btn btn-red" : "btn btn-neon";
    }
}

function changeScore(team, val) {
    if (team === 'home') matchState.homeScore = Math.max(0, matchState.homeScore + val);
    if (team === 'away') matchState.awayScore = Math.max(0, matchState.awayScore + val);
    updateControlUI();
    sendToOBS('state_update', matchState);
}

function updateTeams() {
    matchState.homeName = document.getElementById('input-home-name').value.toUpperCase();
    matchState.awayName = document.getElementById('input-away-name').value.toUpperCase();
    sendToOBS('state_update', matchState);
}

function changePeriod() {
    const periodSelect = document.getElementById('select-period');
    if (periodSelect) {
        matchState.period = periodSelect.value;
        sendToOBS('state_update', matchState);
    }
}

function toggleTimer() {
    matchState.timerRunning = !matchState.timerRunning;
    if (matchState.timerRunning) {
        startTimerInterval();
    } else {
        clearInterval(timerInterval);
    }
    updateControlUI();
    sendToOBS('state_update', matchState);
}

function startTimerInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (matchState.timerRunning) {
            matchState.timerSeconds++;
            if (document.getElementById('control-timer')) {
                document.getElementById('control-timer').innerText = formatTime(matchState.timerSeconds);
            }
            sendToOBS('state_update', matchState);
        } else {
            clearInterval(timerInterval);
        }
    }, 1000);
}

function resetTimer() {
    matchState.timerRunning = false;
    clearInterval(timerInterval);
    matchState.timerSeconds = 0;
    updateControlUI();
    sendToOBS('state_update', matchState);
}

function setCustomTime() {
    const val = parseInt(document.getElementById('input-custom-time').value, 10);
    if (!isNaN(val) && val >= 0) {
        matchState.timerSeconds = val;
        updateControlUI();
        sendToOBS('state_update', matchState);
    }
}

function triggerGoalAnimation() {
    const teamKey = document.getElementById('select-goal-team').value;
    const teamName = teamKey === 'home' ? matchState.homeName : matchState.awayName;
    const scorer = document.getElementById('input-goal-scorer').value || "ZAWODNIK";
    
    sendToOBS('trigger_action', {
        id: "goal_" + Date.now(),
        type: 'GOAL',
        team: teamName,
        scorer: scorer
    });
}

function updateLineupsData() {
    matchState.homePlayers = document.getElementById('txt-home-players').value.split(',').map(p => p.trim()).filter(p => p.length > 0);
    matchState.awayPlayers = document.getElementById('txt-away-players').value.split(',').map(p => p.trim()).filter(p => p.length > 0);
    matchState.homeCoach = document.getElementById('txt-home-coach').value;
    matchState.awayCoach = document.getElementById('txt-away-coach').value;
    sendToOBS('state_update', matchState);
    alert("Składy zostały zaktualizowane globalnie!");
}

function triggerLineupVisual(side, show) {
    sendToOBS('trigger_action', {
        id: `lineup_${side}_` + Date.now(),
        type: side === 'home' ? 'LINEUP_HOME' : 'LINEUP_AWAY',
        show: show
    });
}

// ==========================================
// 📺 LOGIKA NAKŁADKI (OVERLAY - OBS VIEW)
// ==========================================
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

// 🧑‍🤝‍🧑 ANIMACJA GSAP: OSOBNE SKRZYDŁA SKŁADÓW
function animateLineupSide(side, show) {
    if (typeof gsap === 'undefined') return;
    
    const overlay = document.getElementById('lineups-overlay');
    const colId = side === 'home' ? '#lineup-home-col' : '#lineup-away-col';
    const listId = side === 'home' ? 'lineup-home-list' : 'lineup-away-list';
    
    if (show) {
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
        gsap.to(colId, { 
            x: side === 'home' ? -600 : 600, 
            opacity: 0, 
            duration: 0.6, 
            ease: "power4.in",
            onComplete: () => {
                const homeCol = document.getElementById('lineup-home-col');
                const awayCol = document.getElementById('lineup-away-col');
                // Jeśli oba panele są schowane, wyłącz widoczność całego tła nakładki
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
