const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

let matchState = {
    homeName: "ATLETICO",
    awayName: "BODO",
    homeScore: 0,
    awayScore: 0,
    timerSeconds: 0,
    timerRunning: false,
    period: "1H",
    homePlayers: [],
    awayPlayers: [],
    homeColor: "#ff0055",
    homeTextColor: "#ffffff",
    awayColor: "#ffff00",
    awayTextColor: "#000000"
};

const urlParams = new URLSearchParams(window.location.search);
const isOverlay = window.location.pathname.includes('overlay.html') || urlParams.get('mode') === 'overlay';
const isControl = window.location.pathname.includes('control.html') || urlParams.get('mode') === 'control';

let timerInterval = null;
let lastTriggerId = "";
let supabaseClient = null;

document.addEventListener("DOMContentLoaded", () => {
    initSystem();
});

function initSystem() {
    if (typeof supabase === 'undefined') return;
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    const myChannel = supabaseClient.channel('obs_broadcast', {
        config: { broadcast: { self: true } }
    });

    if (isOverlay) {
        updateOverlayUI();
        myChannel
            .on('broadcast', { event: 'state_update' }, ({ payload }) => {
                matchState = payload;
                updateOverlayUI();
            })
            .on('broadcast', { event: 'trigger_action' }, ({ payload }) => {
                if (payload.id !== lastTriggerId) {
                    lastTriggerId = payload.id;
                    if (payload.type === 'GOAL') animateGoal(payload.side, payload.team, payload.scorer, payload.time);
                    if (payload.type === 'LINEUP_HOME') animateLineupSide('home', payload.show);
                    if (payload.type === 'LINEUP_AWAY') animateLineupSide('away', payload.show);
                }
            })
            .subscribe();
    } else if (isControl) {
        initControl();
        myChannel.subscribe();
    }
}

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
    matchState.homeColor = document.getElementById('input-home-color').value;
    matchState.homeTextColor = document.getElementById('input-home-text').value;
    matchState.awayColor = document.getElementById('input-away-color').value;
    matchState.awayTextColor = document.getElementById('input-away-text').value;
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

// Zmodyfikowana funkcja - automatycznie przechwytuje czas z licznika
function triggerGoalAnimation() {
    const side = document.getElementById('select-goal-team').value;
    const teamName = side === 'home' ? matchState.homeName : matchState.awayName;
    const scorer = document.getElementById('input-goal-scorer').value || "ZAWODNIK";
    const currentTimeString = formatTime(matchState.timerSeconds); // Pobranie automatycznej minuty/sekundy
    
    sendToOBS('trigger_action', { 
        id: "goal_" + Date.now(), 
        type: 'GOAL', 
        side: side, 
        team: teamName, 
        scorer: scorer,
        time: currentTimeString
    });
}

function updateLineupsData() {
    matchState.homePlayers = document.getElementById('txt-home-players').value.split(',').map(p => p.trim());
    matchState.awayPlayers = document.getElementById('txt-away-players').value.split(',').map(p => p.trim());
    sendToOBS('state_update', matchState);
}

function triggerLineupVisual(side, show) {
    sendToOBS('trigger_action', { id: `lineup_${side}_` + Date.now(), type: side === 'home' ? 'LINEUP_HOME' : 'LINEUP_AWAY', show: show });
}

function updateOverlayUI() {
    if (document.getElementById('hud-home-name')) document.getElementById('hud-home-name').innerText = matchState.homeName;
    if (document.getElementById('hud-away-name')) document.getElementById('hud-away-name').innerText = matchState.awayName;
    if (document.getElementById('hud-home-score')) document.getElementById('hud-home-score').innerText = matchState.homeScore;
    if (document.getElementById('hud-away-score')) document.getElementById('hud-away-score').innerText = matchState.awayScore;
    if (document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(matchState.timerSeconds);
    if (document.getElementById('hud-period')) document.getElementById('hud-period').innerText = matchState.period;
}

// NOWA EMISYJNA ANIMACJA WYSUWANIA Z DOŁU (Z AUTOMATYCZNYM CZASEM I DYNAMICZNYMI BARWAMI)
function animateGoal(side, team, scorer, timeString) {
    if (typeof gsap === 'undefined') return;

    const mainColor = side === 'home' ? matchState.homeColor : matchState.awayColor;
    const textColor = side === 'home' ? matchState.homeTextColor : matchState.awayTextColor;

    const container = document.getElementById('goal-badge-container');
    const accentStripe = document.getElementById('goal-badge-accent');
    
    // Wstrzyknięcie tekstów
    document.getElementById('goal-badge-team').innerText = team;
    document.getElementById('goal-badge-scorer').innerText = scorer;
    document.getElementById('goal-badge-time').innerText = timeString;

    // Stylizowanie paska barwą klubową
    accentStripe.style.setProperty('background-color', mainColor, 'important');
    document.getElementById('goal-badge-team').style.setProperty('color', mainColor, 'important');

    const tl = gsap.timeline();

    // Ruch: startuje ukryty poniżej 1080px, wysuwa się gładko w górę, czeka 4 sekundy, wraca na dół
    tl.set(container, { visibility: 'visible', y: 150, opacity: 0 })
      .to(container, { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.0)" })
      .to({}, { duration: 5.0 }) // Czas wyświetlania grafiki na ekranie
      .to(container, { y: 150, opacity: 0, duration: 0.5, ease: "power2.in", onComplete: () => {
          gsap.set(container, { visibility: 'hidden' });
      }});
}

function animateLineupSide(side, show) {
    if (typeof gsap === 'undefined') return;
    const overlay = document.getElementById('lineups-overlay');
    const col = document.getElementById(side === 'home' ? 'lineup-home-col' : 'lineup-away-col');
    const listId = side === 'home' ? 'lineup-home-list' : 'lineup-away-list';
    
    if (show) {
        const bgColor = side === 'home' ? matchState.homeColor : matchState.awayColor;
        const txtColor = side === 'home' ? matchState.homeTextColor : matchState.awayTextColor;

        col.style.backgroundColor = 'rgba(10,10,10,0.95)';
        col.style.borderColor = bgColor;
        document.getElementById(side === 'home' ? 'lineup-home-title' : 'lineup-away-title').style.color = txtColor;

        buildLineupList(listId, side === 'home' ? matchState.homePlayers : matchState.awayPlayers, txtColor);
        document.getElementById(side === 'home' ? 'lineup-home-title' : 'lineup-away-title').innerText = side === 'home' ? matchState.homeName : matchState.awayName;
        
        gsap.set(overlay, { visibility: 'visible', opacity: 1 });
        gsap.fromTo(col, { x: side === 'home' ? -600 : 600, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8 });
        gsap.to(`#${listId} li`, { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, delay: 0.3 });
    } else {
        gsap.to(col, { x: side === 'home' ? -600 : 600, opacity: 0, duration: 0.6, onComplete: () => {
            const h = document.getElementById('lineup-home-col'), a = document.getElementById('lineup-away-col');
            if (window.getComputedStyle(h).opacity === "0" && window.getComputedStyle(a).opacity === "0") gsap.set(overlay, { visibility: 'hidden' });
        }});
    }
}

function buildLineupList(elementId, playersArray, fontColor) {
    const listEl = document.getElementById(elementId);
    if (!listEl) return;
    listEl.innerHTML = "";
    const players = playersArray && playersArray.length > 0 ? playersArray : ["1. ZAWODNIK", "2. ZAWODNIK", "3. ZAWODNIK"];
    players.forEach(player => {
        const li = document.createElement('li');
        li.innerText = player;
        li.style.color = fontColor;
        li.style.opacity = "0";
        li.style.transform = `translateX(${elementId.includes('home') ? '-20px' : '20px'})`;
        listEl.appendChild(li);
    });
}
