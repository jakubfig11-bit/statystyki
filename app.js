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
    awayTextColor: "#000000",
    homeCoach: "Trener Gospodarzy",
    awayCoach: "Trener Gości",
    homeLogo: "",
    awayLogo: ""
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
                    if (payload.type === 'LINEUP_HOME') animateLineupCentral('home', payload.show);
                    if (payload.type === 'LINEUP_AWAY') animateLineupCentral('away', payload.show);
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
    if (btnTimer) btnTimer.innerText = matchState.timerRunning ? "PAUZA" : "START";
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
    
    // Pobieranie linków logotypów z panelu sterowania
    matchState.homeLogo = document.getElementById('input-home-logo').value.trim();
    matchState.awayLogo = document.getElementById('input-away-logo').value.trim();
    
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

function triggerGoalAnimation() {
    const side = document.getElementById('select-goal-team').value;
    const teamName = side === 'home' ? matchState.homeName : matchState.awayName;
    const scorer = document.getElementById('input-goal-scorer').value || "ZAWODNIK";
    const currentTimeString = formatTime(matchState.timerSeconds);
    
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
    matchState.homePlayers = document.getElementById('txt-home-players').value.split(',').map(p => p.trim()).filter(p => p !== "");
    matchState.awayPlayers = document.getElementById('txt-away-players').value.split(',').map(p => p.trim()).filter(p => p !== "");
    
    const homeCoachInput = document.getElementById('input-home-coach');
    const awayCoachInput = document.getElementById('input-away-coach');
    matchState.homeCoach = homeCoachInput ? homeCoachInput.value : "Trener Gospodarzy";
    matchState.awayCoach = awayCoachInput ? awayCoachInput.value : "Trener Gości";

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

    // Aktualizacja grafik herbów w belce HUD na górze
    const homeHudImg = document.getElementById('hud-home-logo');
    const awayHudImg = document.getElementById('hud-away-logo');
    if (homeHudImg) homeHudImg.src = matchState.homeLogo || "";
    if (awayHudImg) awayHudImg.src = matchState.awayLogo || "";
}

function animateGoal(side, team, scorer, timeString) {
    if (typeof gsap === 'undefined') return;
    const mainColor = side === 'home' ? matchState.homeColor : matchState.awayColor;
    const container = document.getElementById('goal-badge-container');
    const accentStripe = document.getElementById('goal-badge-accent');
    
    document.getElementById('goal-badge-team').innerText = team;
    document.getElementById('goal-badge-scorer').innerText = scorer;
    document.getElementById('goal-badge-time').innerText = timeString;

    accentStripe.style.setProperty('background-color', mainColor, 'important');
    document.getElementById('goal-badge-team').style.setProperty('color', mainColor, 'important');

    const tl = gsap.timeline();
    tl.set(container, { visibility: 'visible', y: 250, opacity: 0 })
      .to(container, { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.2)" })
      .to({}, { duration: 8.0 })
      .to(container, { y: 250, opacity: 0, duration: 0.5, ease: "power2.in", onComplete: () => {
          gsap.set(container, { visibility: 'hidden' });
      }});
}

function animateLineupCentral(side, show) {
    if (typeof gsap === 'undefined') return;
    
    const overlay = document.getElementById('lineups-overlay');
    const centerBlock = overlay.querySelector('.lineup-tv-center-block');
    
    if (show) {
        const teamName = side === 'home' ? matchState.homeName : matchState.awayName;
        const mainColor = side === 'home' ? matchState.homeColor : matchState.awayColor;
        const textColor = side === 'home' ? matchState.homeTextColor : matchState.awayTextColor;
        const playersList = side === 'home' ? matchState.homePlayers : matchState.awayPlayers;
        const coachName = side === 'home' ? matchState.homeCoach : matchState.awayCoach;
        const teamLogoUrl = side === 'home' ? matchState.homeLogo : matchState.awayLogo;

        // Przypisanie logo do nagłówka składów
        const lineupLogoImg = document.getElementById('lineup-team-logo');
        if (lineupLogoImg) lineupLogoImg.src = teamLogoUrl || "";

        document.getElementById('lineup-team-title').innerText = teamName;
        document.getElementById('lineup-team-title').style.color = mainColor;
        document.getElementById('pitch-border-line').style.borderColor = mainColor;

        const positions = ['.pos-gk', '.pos-df-l', '.pos-df-r', '.pos-fw-l', '.pos-fw-r'];
        
        positions.forEach((selector, idx) => {
            const node = overlay.querySelector(selector);
            const shirt = node.querySelector('.player-shirt');
            const numEl = node.querySelector('.p-num');
            const nameEl = node.querySelector('.p-name');
            
            if (playersList[idx]) {
                const parts = playersList[idx].split('.');
                let pNum = idx + 1;
                let pName = playersList[idx];
                
                if (parts.length > 1 && !isNaN(parseInt(parts[0]))) {
                    pNum = parts[0].trim();
                    pName = parts.slice(1).join('.').trim();
                }

                numEl.innerText = pNum;
                nameEl.innerText = pName;
                
                shirt.style.setProperty('background-color', mainColor, 'important');
                shirt.style.setProperty('border-color', textColor, 'important');
                numEl.style.setProperty('color', textColor, 'important');
                node.style.display = 'flex';
            } else {
                node.style.display = 'none';
            }
        });

        const benchUl = document.getElementById('lineup-bench-list');
        benchUl.innerHTML = "";
        const benchPlayers = playersList.slice(5);
        
        if (benchPlayers.length > 0) {
            benchPlayers.forEach(player => {
                const li = document.createElement('li');
                li.innerText = player;
                li.style.borderLeftColor = mainColor;
                benchUl.appendChild(li);
            });
        } else {
            benchUl.innerHTML = "<li style='opacity:0.5; border-left:none;'>BRAK REZERWOWYCH</li>";
        }

        const coachDiv = document.getElementById('lineup-coach-display');
        coachDiv.innerText = coachName;
        coachDiv.style.borderLeft = `4px solid ${mainColor}`;

        gsap.killTweensOf([overlay, centerBlock]);
        gsap.set(overlay, { visibility: 'visible' });
        
        const tl = gsap.timeline();
        tl.to(overlay, { opacity: 1, duration: 0.4 })
          .fromTo(centerBlock, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.1)" }, "-=0.2")
          .fromTo(".player-node", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.08, ease: "back.out(1.5)" }, "-=0.3")
          .fromTo("#lineup-bench-list li", { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, stagger: 0.05 }, "-=0.2");

    } else {
        const tl = gsap.timeline();
        tl.to(centerBlock, { scale: 0.8, opacity: 0, duration: 0.4, ease: "power2.in" })
          .to(overlay, { opacity: 0, duration: 0.3, onComplete: () => {
              gsap.set(overlay, { visibility: 'hidden' });
          }}, "-=0.2");
    }
}
