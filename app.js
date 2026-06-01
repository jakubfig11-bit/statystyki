const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

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
    homeColor: "#ff0055",
    homeTextColor: "#ffffff",
    awayColor: "#ffff00",
    awayTextColor: "#000000",
    homeCoach: "",
    awayCoach: "",
    homeLogo: "",
    awayLogo: ""
};

const isOverlay = window.location.pathname.includes('overlay.html');
const isControl = window.location.pathname.includes('control.html');

let timerInterval = null;
let lastTriggerId = "";
let supabaseClient = null;
let broadcastChannel = null;

document.addEventListener("DOMContentLoaded", () => {
    initSystem();
});

function initSystem() {
    if (typeof supabase === 'undefined') {
        console.error("Supabase library not loaded!");
        return;
    }
    
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    broadcastChannel = supabaseClient.channel('scoreboard_room', {
        config: { broadcast: { ack: false, self: true } }
    });

    broadcastChannel
        .on('broadcast', { event: 'state_update' }, ({ payload }) => {
            if (payload) {
                matchState = payload;
                if (isOverlay) updateOverlayUI();
                if (isControl) updateControlUI();
            }
        })
        .on('broadcast', { event: 'trigger_action' }, ({ payload }) => {
            if (payload && payload.id !== lastTriggerId) {
                lastTriggerId = payload.id;
                if (isOverlay) {
                    if (payload.type === 'GOAL') animateGoal(payload.side, payload.team, payload.scorer, payload.time);
                    if (payload.type === 'LINEUP_HOME') animateLineupCentral('home', payload.show);
                    if (payload.type === 'LINEUP_AWAY') animateLineupCentral('away', payload.show);
                    if (payload.type === 'PLAYER_STAT') animatePlayerStat(payload.side, payload.player, payload.category, payload.value);
                }
            }
        });

    broadcastChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && isControl) {
            console.log("Połączono z Supabase Realtime (Panel Kontrolny)");
            // Pobierz aktualny stan z formularzy na start
            setTimeout(() => { updateTeams(); }, 500);
        }
    });

    if (isControl) initControl();
}

function sendToOBS(eventName, data) {
    if (!broadcastChannel) return;
    broadcastChannel.send({
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
    // Podpinanie zdarzeń pod przyciski z control.html
    document.getElementById('home-plus').addEventListener('click', () => changeScore('home', 1));
    document.getElementById('home-minus').addEventListener('click', () => changeScore('home', -1));
    document.getElementById('away-plus').addEventListener('click', () => changeScore('away', 1));
    document.getElementById('away-minus').addEventListener('click', () => changeScore('away', -1));
    
    document.getElementById('btn-timer-start').addEventListener('click', toggleTimer);
    document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);
    document.getElementById('period-select').addEventListener('change', changePeriod);
    
    document.getElementById('btn-swap').addEventListener('click', swapTeams);
    document.getElementById('btn-force-update').addEventListener('click', updateTeams);
    
    // Zapisywanie składów
    document.getElementById('btn-save-lineups').addEventListener('click', updateTeams);
    
    // Wyzwalacze akcji i animacji
    document.getElementById('btn-goal-home').addEventListener('click', () => triggerGoalAnimation('home'));
    document.getElementById('btn-goal-away').addEventListener('click', () => triggerGoalAnimation('away'));
    document.getElementById('btn-show-stat').addEventListener('click', triggerPlayerStat);
    
    document.getElementById('btn-show-lineup-home').addEventListener('click', () => triggerLineupVisual('home', true));
    document.getElementById('btn-show-lineup-away').addEventListener('click', () => triggerLineupVisual('away', true));
    document.getElementById('btn-hide-lineup').addEventListener('click', () => triggerLineupVisual('home', false));

    // Nasłuchiwanie zmian w inputach tekstowych na żywo
    const liveInputs = [
        'home-name-input', 'away-name-input', 
        'home-color-input', 'home-textcolor-input', 
        'away-color-input', 'away-textcolor-input',
        'home-logo-input', 'away-logo-input'
    ];
    liveInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateTeams);
    });

    updateControlUI();
}

function updateControlUI() {
    if (document.getElementById('home-score-display')) document.getElementById('home-score-display').innerText = matchState.homeScore;
    if (document.getElementById('away-score-display')) document.getElementById('away-score-display').innerText = matchState.awayScore;
    if (document.getElementById('control-timer-display')) document.getElementById('control-timer-display').innerText = formatTime(matchState.timerSeconds);
    
    const btnTimer = document.getElementById('btn-timer-start');
    if (btnTimer) btnTimer.innerText = matchState.timerRunning ? "PAUZA" : "START";
}

function changeScore(team, val) {
    if (team === 'home') matchState.homeScore = Math.max(0, matchState.homeScore + val);
    if (team === 'away') matchState.awayScore = Math.max(0, matchState.awayScore + val);
    updateControlUI();
    sendToOBS('state_update', matchState);
}

function updateTeams() {
    if (!isControl) return;
    
    matchState.homeName = document.getElementById('home-name-input').value.toUpperCase();
    matchState.awayName = document.getElementById('away-name-input').value.toUpperCase();
    matchState.homeColor = document.getElementById('home-color-input').value;
    matchState.homeTextColor = document.getElementById('home-textcolor-input').value;
    matchState.awayColor = document.getElementById('away-color-input').value;
    matchState.awayTextColor = document.getElementById('away-textcolor-input').value;
    matchState.homeLogo = document.getElementById('home-logo-input').value.trim();
    matchState.awayLogo = document.getElementById('away-logo-input').value.trim();
    
    // Przetwarzanie textarea ze składami ze względu na strukturę linii (Entery)
    const mainPlayers = document.getElementById('lineup-main-input').value.split('\n').map(p => p.trim()).filter(p => p !== "");
    const benchPlayers = document.getElementById('lineup-bench-input').value.split('\n').map(p => p.trim()).filter(p => p !== "");
    
    // Łączymy je w jedną tablicę zawodników (pierwsze 5 to skład główny, reszta to rezerwa)
    matchState.homePlayers = [...mainPlayers, ...benchPlayers];
    // Dla uproszczenia (gdyż control ma jeden zestaw pól składu), traktujemy go jako skład aktualnie wybranej drużyny
    // Aby obsłużyć obie drużyny, system zachowa przesłaną listę.
    
    matchState.homeCoach = document.getElementById('lineup-coach-input').value;
    
    // Sprawdzamy, dla kogo aktualnie edytujemy skład na podstawie wybranego widoku lub domyślnie przypisujemy do gospodarza
    sendToOBS('state_update', matchState);
}

function swapTeams() {
    if (!isControl) return;
    
    const hName = document.getElementById('home-name-input').value;
    const aName = document.getElementById('away-name-input').value;
    const hColor = document.getElementById('home-color-input').value;
    const aColor = document.getElementById('away-color-input').value;
    const hText = document.getElementById('home-textcolor-input').value;
    const aText = document.getElementById('away-textcolor-input').value;
    const hLogo = document.getElementById('home-logo-input').value;
    const aLogo = document.getElementById('away-logo-input').value;

    document.getElementById('home-name-input').value = aName;
    document.getElementById('away-name-input').value = hName;
    document.getElementById('home-color-input').value = aColor;
    document.getElementById('away-color-input').value = hColor;
    document.getElementById('home-textcolor-input').value = aText;
    document.getElementById('away-textcolor-input').value = hText;
    document.getElementById('home-logo-input').value = aLogo;
    document.getElementById('away-logo-input').value = hLogo;

    const tempScore = matchState.homeScore;
    matchState.homeScore = matchState.awayScore;
    matchState.awayScore = tempScore;

    updateTeams();
    updateControlUI();
}

function changePeriod() {
    const periodSelect = document.getElementById('period-select');
    if (periodSelect) {
        matchState.period = periodSelect.value;
        sendToOBS('state_update', matchState);
    }
}

function toggleTimer() {
    matchState.timerRunning = !matchState.timerRunning;
    if (matchState.timerRunning) startTimerInterval();
    else clearInterval(timerInterval);
    updateControlUI();
    sendToOBS('state_update', matchState);
}

function startTimerInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (matchState.timerRunning) {
            matchState.timerSeconds++;
            if (document.getElementById('control-timer-display')) {
                document.getElementById('control-timer-display').innerText = formatTime(matchState.timerSeconds);
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

function triggerGoalAnimation(side) {
    const teamName = side === 'home' ? matchState.homeName : matchState.awayName;
    const currentTimeString = formatTime(matchState.timerSeconds);
    
    // Zwiększamy też automatycznie wynik przy animacji gola!
    changeScore(side, 1);
    
    sendToOBS('trigger_action', { 
        id: "goal_" + Date.now(), 
        type: 'GOAL', 
        side: side, 
        team: teamName, 
        scorer: "ZAWODNIK",
        time: currentTimeString
    });
}

function triggerPlayerStat() {
    const side = document.getElementById('stat-team-select').value;
    const player = document.getElementById('stat-player-input').value || "ZAWODNIK";
    const category = document.getElementById('stat-category-select').value;
    const value = document.getElementById('stat-value-input').value || "0";

    sendToOBS('trigger_action', {
        id: "stat_" + Date.now(),
        type: 'PLAYER_STAT',
        side: side,
        player: player.toUpperCase(),
        category: category.toUpperCase(),
        value: value
    });
}

function triggerLineupVisual(side, show) {
    // Przed pokazaniem składu upewniamy się, że zaciągnęliśmy najnowsze teksty z pól formularza
    if(show) updateTeams(); 
    sendToOBS('trigger_action', { 
        id: `lineup_${side}_` + Date.now(), 
        type: side === 'home' ? 'LINEUP_HOME' : 'LINEUP_AWAY', 
        show: show 
    });
}

function updateOverlayUI() {
    if (document.getElementById('hud-home-name')) document.getElementById('hud-home-name').innerText = matchState.homeName;
    if (document.getElementById('hud-away-name')) document.getElementById('hud-away-name').innerText = matchState.awayName;
    if (document.getElementById('hud-home-score')) document.getElementById('hud-home-score').innerText = matchState.homeScore;
    if (document.getElementById('hud-away-score')) document.getElementById('hud-away-score').innerText = matchState.awayScore;
    if (document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(matchState.timerSeconds);
    if (document.getElementById('hud-period')) document.getElementById('hud-period').innerText = matchState.period;

    const homeHudImg = document.getElementById('hud-home-logo');
    const awayHudImg = document.getElementById('hud-away-logo');
    
    if (homeHudImg) {
        if (matchState.homeLogo && matchState.homeLogo.length > 5) {
            homeHudImg.src = matchState.homeLogo;
            homeHudImg.style.display = "block";
        } else {
            homeHudImg.style.display = "none";
            homeHudImg.src = "";
        }
    }
    if (awayHudImg) {
        if (matchState.awayLogo && matchState.awayLogo.length > 5) {
            awayHudImg.src = matchState.awayLogo;
            awayHudImg.style.display = "block";
        } else {
            awayHudImg.style.display = "none";
            awayHudImg.src = "";
        }
    }
}

function animatePlayerStat(side, player, category, value) {
    if (typeof gsap === 'undefined') return;
    
    const container = document.getElementById('stat-badge-container');
    const accentStripe = document.getElementById('stat-badge-accent');
    const mainColor = side === 'home' ? matchState.homeColor : matchState.awayColor;

    document.getElementById('stat-badge-player-name').innerText = player;
    document.getElementById('stat-badge-category').innerText = category;
    document.getElementById('stat-badge-value').innerText = value;

    accentStripe.style.setProperty('background-color', mainColor, 'important');
    document.getElementById('stat-badge-value').style.setProperty('color', mainColor, 'important');

    gsap.killTweensOf(container);

    const tl = gsap.timeline();
    tl.set(container, { visibility: 'visible', y: 250, opacity: 0 })
      .to(container, { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.2)" })
      .to({}, { duration: 8.5 })
      .to(container, { y: 250, opacity: 0, duration: 0.5, ease: "power2.in", onComplete: () => {
          gsap.set(container, { visibility: 'hidden' });
      }});
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
        const playersList = matchState.homePlayers; // Uproszczone pobieranie listy
        const coachName = matchState.homeCoach;
        const teamLogoUrl = side === 'home' ? matchState.homeLogo : matchState.awayLogo;

        const lineupLogoImg = document.getElementById('lineup-team-logo');
        if (lineupLogoImg) {
            if (teamLogoUrl && teamLogoUrl.length > 5) {
                lineupLogoImg.src = teamLogoUrl;
                lineupLogoImg.style.display = "block";
            } else {
                lineupLogoImg.style.display = "none";
                lineupLogoImg.src = "";
            }
        }

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
        if (coachDiv) {
            coachDiv.innerText = coachName || "BRAK";
            coachDiv.style.borderLeft = `4px solid ${mainColor}`;
        }

        gsap.killTweensOf([overlay, centerBlock]);
        gsap.set(overlay, { visibility: 'visible' });
        
        const tl = gsap.timeline();
        tl.to(overlay, { opacity: 1, duration: 0.4 })
          .fromTo(centerBlock, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.1)" }, "-=0.2");
    } else {
        const tl = gsap.timeline();
        tl.to(centerBlock, { scale: 0.8, opacity: 0, duration: 0.4, ease: "power2.in" })
          .to(overlay, { opacity: 0, duration: 0.3, onComplete: () => {
              gsap.set(overlay, { visibility: 'hidden' });
          }}, "-=0.2");
    }
}
