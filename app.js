const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

let supabaseClient = null;
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

let currentMatchState = {
    home_name: "HOME", away_name: "AWAY", home_score: 0, away_score: 0, match_time: 0, is_running: false,
    scorer_name: "", scorer_team: "home", show_goal_trigger: false, show_lineups: false,
    home_logo: "", away_logo: "", home_color: "#0052cc", away_color: "#ff0044",
    lineups_team: "home",
    home_coach: "", home_subs: "", home_p1: "", home_p2: "", home_p3: "", home_p4: "", home_p5: "",
    away_coach: "", away_subs: "", away_p1: "", away_p2: "", away_p3: "", away_p4: "", away_p5: "",
    stat_player_name: "ZAWODNIK", stat_player_team: "home", show_player_stats: false,
    stat_shots: 0, stat_passes: 0, stat_goals: 0, stat_assists: 0,
    sub_out: "", sub_in: "", sub_team: "home", show_sub_trigger: false,
    summary_name: "HALFTIME", show_summary: false, goals_history: []
};

let timerInterval = null; let realtimeChannel = null; let isAnimationPlaying = false; let isSubAnimationPlaying = false;

// ==========================================
// INICJALIZACJA SYSTEMU
// ==========================================

async function initOverlayView() {
    await fetchInitialState(); updateHUDUI(); updateTacticalLineupsUI(); updatePlayerStatsUI(); updateSummaryUI();
    if (currentMatchState.is_running) startLocalTimer();
    realtimeChannel = supabaseClient.channel('match-broadcast', { config: { broadcast: { ack: false, self: false } } });
    realtimeChannel.on('broadcast', { event: 'state-change' }, ({ payload }) => handleStateUpdate(payload)).subscribe();
}

async function initControlPanel() {
    await fetchInitialState(); updateControlPanelUI();
    if (currentMatchState.is_running) startLocalTimer();
    
    realtimeChannel = supabaseClient.channel('match-broadcast', { config: { broadcast: { ack: false, self: false } } }); 
    realtimeChannel.on('broadcast', { event: 'state-change' }, ({ payload }) => {
        if (payload.is_running !== currentMatchState.is_running) {
            if (payload.is_running) startLocalTimer(); else clearInterval(timerInterval);
        }
        if (!payload.is_running && payload.match_time !== currentMatchState.match_time) {
            if(document.getElementById('ctrl-timer')) document.getElementById('ctrl-timer').innerText = formatTime(payload.match_time);
        }
        currentMatchState = payload; updateControlPanelUI();
    }).subscribe();
}

function handleStateUpdate(data) {
    if (data.show_goal_trigger === true && currentMatchState.show_goal_trigger === false && !isAnimationPlaying) {
        const teamColor = data.scorer_team === 'home' ? data.home_color : data.away_color;
        const teamName = data.scorer_team === 'home' ? data.home_name : data.away_name;
        const teamLogo = data.scorer_team === 'home' ? data.home_logo : data.away_logo;
        runGSAPGoalAnimation(data.scorer_name, teamName, teamColor, teamLogo);
    }
    if (data.show_sub_trigger === true && currentMatchState.show_sub_trigger === false && !isSubAnimationPlaying) {
        const teamColor = data.sub_team === 'home' ? data.home_color : data.away_color;
        const teamName = data.sub_team === 'home' ? data.home_name : data.away_name;
        runGSAPSubAnimation(data.sub_out, data.sub_in, teamName, teamColor);
    }
    if (data.show_lineups !== currentMatchState.show_lineups) toggleGSAPTacticalLineups(data.show_lineups);
    if (data.show_player_stats !== currentMatchState.show_player_stats) toggleGSAPPlayerStats(data.show_player_stats);
    if (data.show_summary !== currentMatchState.show_summary) toggleGSAPSummary(data.show_summary);
    if (data.is_running !== currentMatchState.is_running) { if (data.is_running) startLocalTimer(); else clearInterval(timerInterval); }
    
    currentMatchState = data; updateHUDUI(); updateTacticalLineupsUI(); updatePlayerStatsUI(); updateSummaryUI();
}

// ==========================================
// KONTROLA CZASU
// ==========================================

function startLocalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { 
        currentMatchState.match_time++; 
        
        if(document.getElementById('hud-timer')) {
            document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);
        }
        if(document.getElementById('ctrl-timer')) {
            document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
        }
    }, 1000);
}

function toggleTimer() { 
    currentMatchState.is_running = !currentMatchState.is_running; 
    if (!currentMatchState.is_running) {
        clearInterval(timerInterval);
    } else {
        startLocalTimer();
    }
    saveStateToSupabase(); 
}

function resetTimer() { 
    clearInterval(timerInterval);
    currentMatchState.is_running = false; 
    currentMatchState.match_time = 0; 
    if(document.getElementById('ctrl-timer')) document.getElementById('ctrl-timer').innerText = "00:00"; 
    if(document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = "00:00"; 
    saveStateToSupabase(); 
}

// ==========================================
// AKTUALIZACJA INTERFEJSU (UI)
// ==========================================

function updateHUDUI() {
    if(document.getElementById('hud-home-name')) document.getElementById('hud-home-name').innerText = currentMatchState.home_name;
    if(document.getElementById('hud-away-name')) document.getElementById('hud-away-name').innerText = currentMatchState.away_name;
    if(document.getElementById('hud-home-score')) document.getElementById('hud-home-score').innerText = currentMatchState.home_score;
    if(document.getElementById('hud-away-score')) document.getElementById('hud-away-score').innerText = currentMatchState.away_score;
    if(document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);
    if(document.getElementById('hud-home-accent')) document.getElementById('hud-home-accent').style.backgroundColor = currentMatchState.home_color;
    if(document.getElementById('hud-away-accent')) document.getElementById('hud-away-accent').style.backgroundColor = currentMatchState.away_color;
    setupCrest('hud-home-logo', currentMatchState.home_logo); setupCrest('hud-away-logo', currentMatchState.away_logo);
}

function updateTacticalLineupsUI() {
    const activeTeam = currentMatchState.lineups_team || "home";
    const titleEl = document.getElementById('tactical-team-name');
    const coachEl = document.getElementById('tactical-coach-name');
    const subsEl = document.getElementById('tactical-subs-list');
    const topLogo = document.getElementById('tactical-top-logo');
    const bgLogo = document.getElementById('tactical-bg-logo');
    const prefix = activeTeam === "home" ? "home" : "away";

    if (titleEl) titleEl.innerText = currentMatchState[`${prefix}_name`].toUpperCase();
    if (coachEl) coachEl.innerText = `TRENER: ${currentMatchState[`${prefix}_coach`].toUpperCase()}`;
    if (subsEl) subsEl.innerText = currentMatchState[`${prefix}_subs`] || "Brak rezerwowych";

    const logoUrl = currentMatchState[`${prefix}_logo`];
    if (logoUrl && logoUrl.trim() !== "") {
        if (topLogo) { topLogo.src = logoUrl; topLogo.classList.remove('hidden'); }
        if (bgLogo) { bgLogo.src = logoUrl; bgLogo.classList.remove('hidden'); }
    } else {
        if (topLogo) topLogo.classList.add('hidden'); if (bgLogo) bgLogo.classList.add('hidden');
    }
    for (let i = 1; i <= 5; i++) { parseAndSetPlayer(`tactical-p${i}`, currentMatchState[`${prefix}_p${i}`]); }
}

function updatePlayerStatsUI() {
    if(document.getElementById('stats-player-name')) document.getElementById('stats-player-name').innerText = (currentMatchState.stat_player_name || "ZAWODNIK").toUpperCase();
    if(document.getElementById('stat-val-shots')) document.getElementById('stat-val-shots').innerText = currentMatchState.stat_shots ?? 0;
    if(document.getElementById('stat-val-passes')) document.getElementById('stat-val-passes').innerText = currentMatchState.stat_passes ?? 0;
    if(document.getElementById('stat-val-goals')) document.getElementById('stat-val-goals').innerText = currentMatchState.stat_goals ?? 0;
    if(document.getElementById('stat-val-assists')) document.getElementById('stat-val-assists').innerText = currentMatchState.stat_assists ?? 0;
    const accent = document.getElementById('stats-player-accent');
    if(accent) { accent.style.backgroundColor = currentMatchState.stat_player_team === 'home' ? currentMatchState.home_color : currentMatchState.away_color; }
}

// PRZEROBIONA FUNKCJA GENEROWANIA PODSUMOWANIA ZE STRZELCAMI (UEFA STYLE)
function updateSummaryUI() {
    const titleBox = document.getElementById('summary-txt-title');
    if (titleBox) titleBox.innerText = currentMatchState.summary_name === "FULLTIME" ? "FULLTIME MATCH SUMMARY" : "HALFTIME MATCH SUMMARY";

    if(document.getElementById('summary-board-name-home')) document.getElementById('summary-board-name-home').innerText = currentMatchState.home_name;
    if(document.getElementById('summary-board-name-away')) document.getElementById('summary-board-name-away').innerText = currentMatchState.away_name;
    if(document.getElementById('summary-board-score-home')) document.getElementById('summary-board-score-home').innerText = currentMatchState.home_score;
    if(document.getElementById('summary-board-score-away')) document.getElementById('summary-board-score-away').innerText = currentMatchState.away_score;

    setupCrest('summary-board-logo-home', currentMatchState.home_logo);
    setupCrest('summary-board-logo-away', currentMatchState.away_logo);

    if(document.getElementById('summary-footer-accent-home')) document.getElementById('summary-footer-accent-home').style.backgroundColor = currentMatchState.home_color || "#0052cc";
    if(document.getElementById('summary-footer-accent-away')) document.getElementById('summary-footer-accent-away').style.backgroundColor = currentMatchState.away_color || "#ff0044";

    const homeList = document.getElementById('summary-scorers-list-home');
    const awayList = document.getElementById('summary-scorers-list-away');
    
    if (homeList && awayList) {
        homeList.innerHTML = "";
        awayList.innerHTML = "";
        
        const history = currentMatchState.goals_history || [];
        
        history.forEach(goal => {
            // Jeśli wybrano tryb HALFTIME, filtrujemy tylko bramki do 45 minuty włącznie
            if (currentMatchState.summary_name === "HALFTIME" && goal.minute > 45) {
                return;
            }

            const row = document.createElement('div');
            row.className = "summary-scorer-row";
            
            if (goal.team === 'home') {
                row.innerHTML = `<span>${goal.name}</span> <span class="minute">${goal.minute}'</span>`;
                homeList.appendChild(row);
            } else {
                row.innerHTML = `<span class="minute">${goal.minute}'</span> <span>${goal.name}</span>`;
                awayList.appendChild(row);
            }
        });
    }
}

// ==========================================
// PERSYSTENCJA SUPABASE REALTIME
// ==========================================

async function fetchInitialState() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('broadcast_state').select('state_json').eq('id', 1).single();
    if (data && data.state_json) {
        currentMatchState = { ...currentMatchState, ...data.state_json };
        const statusEl = document.getElementById('db-status');
        if (statusEl) { statusEl.innerText = "POŁĄCZONO"; statusEl.classList.add('connected'); }
    } else if (error) {
        console.error("Błąd ładowania stanu początkowego:", error);
    }
}

async function saveStateToSupabase() {
    if (!supabaseClient) return;
    await supabaseClient.from('broadcast_state').upsert({ id: 1, state_json: currentMatchState, updated_at: new Date() });
    if (realtimeChannel) { await realtimeChannel.send({ type: 'broadcast', event: 'state-change', payload: currentMatchState }); }
}

// ==========================================
// GSAP SILNIK ANIMACJI (OVERLAY VIEW ENGINE)
// ==========================================

function runGSAPGoalAnimation(player, team, color, logo) {
    const container = document.getElementById('goal-overlay'); if (!container) return;
    const txtPlayer = document.getElementById('goal-scorer'); const txtTeam = document.getElementById('goal-team');
    const txtTime = document.getElementById('goal-time'); const accent = document.getElementById('goal-card-accent');
    const bgLogo = document.getElementById('goal-bg-logo');

    if (txtPlayer) txtPlayer.innerText = player.toUpperCase();
    if (txtTeam) txtTeam.innerText = team.toUpperCase();
    if (txtTime) txtTime.innerText = `${formatTime(currentMatchState.match_time)} - BRAMKA`;
    if (accent) accent.style.borderColor = color;
    
    if (logo && logo.trim() !== "") {
        if (bgLogo) { bgLogo.src = logo; bgLogo.classList.remove('hidden'); }
    } else {
        if (bgLogo) bgLogo.classList.add('hidden');
    }

    isAnimationPlaying = true;
    gsap.set(container, { visibility: 'visible', y: 200, opacity: 0, scale: 0.8 });
    
    let tl = gsap.timeline({ onComplete: () => {
        setTimeout(() => {
            gsap.to(container, { y: 200, opacity: 0, scale: 0.8, duration: 0.6, ease: "power3.in", onComplete: () => {
                gsap.set(container, { visibility: 'hidden' }); isAnimationPlaying = false;
            }});
        }, 5000);
    }});
    
    tl.to(container, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "elastic.out(1, 0.75)" });
}

function runGSAPSubAnimation(pOut, pIn, teamName, color) {
    const container = document.getElementById('sub-overlay'); if (!container) return;
    const txtOut = document.getElementById('sub-txt-out'); const txtIn = document.getElementById('sub-txt-in');
    const txtTeam = document.getElementById('sub-team-name'); const accent = document.getElementById('sub-card-accent');

    if (txtOut) txtOut.innerText = pOut.toUpperCase();
    if (txtIn) txtIn.innerText = pIn.toUpperCase();
    if (txtTeam) txtTeam.innerText = teamName.toUpperCase();
    if (accent) accent.style.backgroundColor = color;

    isSubAnimationPlaying = true;
    gsap.set(container, { visibility: 'visible', x: 400, opacity: 0 });

    let tl = gsap.timeline({ onComplete: () => {
        setTimeout(() => {
            gsap.to(container, { x: 400, opacity: 0, duration: 0.5, ease: "power3.in", onComplete: () => {
                gsap.set(container, { visibility: 'hidden' }); isSubAnimationPlaying = false;
            }});
        }, 6000);
    }});

    tl.to(container, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
}

function toggleGSAPTacticalLineups(show) {
    const container = document.getElementById('tactical-lineups-overlay'); if (!container) return;
    if (show) {
        gsap.set(container, { visibility: 'visible', y: -600, opacity: 0, scale: 0.95 });
        gsap.to(container, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "power4.out" });
    } else {
        gsap.to(container, { y: -600, opacity: 0, scale: 0.95, duration: 0.6, ease: "power4.in", onComplete: () => { gsap.set(container, { visibility: 'hidden' }); }});
    }
}

function toggleGSAPPlayerStats(show) {
    const container = document.getElementById('player-stats-overlay'); if (!container) return;
    if (show) {
        gsap.set(container, { visibility: 'visible', x: -400, opacity: 0 });
        gsap.to(container, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
    } else {
        gsap.to(container, { x: -400, opacity: 0, duration: 0.5, ease: "power3.in", onComplete: () => { gsap.set(container, { visibility: 'hidden' }); }});
    }
}

function toggleGSAPSummary(show) {
    const container = document.getElementById('summary-overlay'); if (!container) return;
    if (show) {
        gsap.set(container, { visibility: 'visible', yPercent: 50, xPercent: -50, opacity: 0, scale: 0.9 });
        gsap.to(container, { yPercent: -50, xPercent: -50, opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" });
    } else {
        gsap.to(container, { yPercent: 50, xPercent: -50, opacity: 0, scale: 0.9, duration: 0.5, ease: "power3.in", onComplete: () => { gsap.set(container, { visibility: 'hidden' }); }});
    }
}

// ==========================================
// POMOCNIKI
// ==========================================

function parseAndSetPlayer(elementId, playerString) {
    const container = document.getElementById(elementId); if (!container) return;
    let number = "0", name = "ZAWODNIK";
    if (playerString && playerString.includes('.')) {
        const parts = playerString.split('.'); number = parts[0].trim(); name = parts.slice(1).join('.').trim();
    } else if (playerString) { name = playerString.trim(); }
    const numEl = container.querySelector('.player-number'); const nameEl = container.querySelector('.player-name');
    if (numEl) numEl.innerText = number; if (nameEl) nameEl.innerText = name.toUpperCase();
}

function setupCrest(elementId, url) {
    const img = document.getElementById(elementId); if (!img) return;
    if (url && url.trim() !== "") { img.src = url; img.classList.remove('hidden'); } else { img.classList.add('hidden'); }
}

function formatTime(sec) {
    const m = Math.floor(sec / 60); const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
