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
    // NOWE POLA DLA STATYSTYK INDYWIDUALNYCH
    stat_player_name: "ZAWODNIK", stat_player_team: "home", show_player_stats: false,
    stat_shots: 0, stat_passes: 0, stat_goals: 0, stat_assists: 0
};

let timerInterval = null; let realtimeChannel = null; let isAnimationPlaying = false; 

async function initOverlayView() {
    await fetchInitialState(); updateHUDUI(); updateTacticalLineupsUI(); updatePlayerStatsUI();
    if (currentMatchState.is_running) startLocalTimer();
    realtimeChannel = supabaseClient.channel('match-broadcast', { config: { broadcast: { ack: false, self: false } } });
    realtimeChannel.on('broadcast', { event: 'state-change' }, ({ payload }) => handleStateUpdate(payload)).subscribe();
}

function handleStateUpdate(data) {
    if (data.show_goal_trigger === true && currentMatchState.show_goal_trigger === false && !isAnimationPlaying) {
        const teamColor = data.scorer_team === 'home' ? data.home_color : data.away_color;
        const teamName = data.scorer_team === 'home' ? data.home_name : data.away_name;
        const teamLogo = data.scorer_team === 'home' ? data.home_logo : data.away_logo;
        runGSAPGoalAnimation(data.scorer_name, teamName, teamColor, teamLogo);
    }
    if (data.show_lineups !== currentMatchState.show_lineups) toggleGSAPTacticalLineups(data.show_lineups);
    if (data.show_player_stats !== currentMatchState.show_player_stats) toggleGSAPPlayerStats(data.show_player_stats);
    if (data.is_running !== currentMatchState.is_running) { if (data.is_running) startLocalTimer(); else clearInterval(timerInterval); }
    currentMatchState = data; updateHUDUI(); updateTacticalLineupsUI(); updatePlayerStatsUI();
}

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
    if(accent) {
        accent.style.backgroundColor = currentMatchState.stat_player_team === 'home' ? currentMatchState.home_color : currentMatchState.away_color;
    }
}

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

function startLocalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { currentMatchState.match_time++; if(document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time); sendBroadcastState(); }, 1000);
}

function runGSAPGoalAnimation(scorer, teamName, teamColor, teamLogo) {
    isAnimationPlaying = true; const exactGoalTime = formatTime(currentMatchState.match_time);
    const scorerEl = document.getElementById('goal-scorer');
    if (scorerEl) scorerEl.innerText = (scorer && scorer.trim() !== "") ? scorer.toUpperCase() : "ZAWODNIK";
    if (document.getElementById('goal-team')) document.getElementById('goal-team').innerText = teamName;
    if (document.getElementById('goal-time')) document.getElementById('goal-time').innerText = exactGoalTime;
    if (document.getElementById('goal-card-accent')) document.getElementById('goal-card-accent').style.borderBottom = `6px solid ${teamColor}`;
    const bgLogoImg = document.getElementById('goal-bg-logo');
    if (bgLogoImg) { if (teamLogo && teamLogo.trim() !== "") { bgLogoImg.src = teamLogo; bgLogoImg.classList.remove('hidden'); } else { bgLogoImg.classList.add('hidden'); } }
    const overlay = document.getElementById('goal-overlay'); if (!overlay) return; const card = overlay.querySelector('.goal-tv-card');
    let tl = gsap.timeline({ onStart: () => { gsap.set(overlay, { visibility: 'visible', opacity: 1 }); } });
    tl.fromTo(card, { y: 150, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "power4.out" })
      .to({}, { duration: 8.0 }) 
      .to(card, { y: 150, opacity: 0, scale: 0.95, duration: 0.5, ease: "power4.in", onComplete: () => { gsap.set(overlay, { visibility: 'hidden' }); isAnimationPlaying = false; currentMatchState.show_goal_trigger = false; }});
}

function toggleGSAPTacticalLineups(show) {
    const container = document.getElementById('tactical-lineups-overlay'); if (!container) return;
    if (show) { gsap.set(container, { visibility: 'visible', opacity: 0 }); gsap.to(container, { opacity: 1, duration: 0.5, ease: "power2.out" }); }
    else { gsap.to(container, { opacity: 0, duration: 0.4, ease: "power2.in", onComplete: () => { gsap.set(container, { visibility: 'hidden' }); }}); }
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

// PANEL LOGIC
async function initControlPanel() {
    await fetchInitialState(); updateControlPanelUI();
    const statusBadge = document.getElementById('db-status'); if (statusBadge) { statusBadge.innerText = "POŁĄCZONO"; statusBadge.classList.add('connected'); }
    realtimeChannel = supabaseClient.channel('match-broadcast', { config: { broadcast: { ack: false, self: false } } }); realtimeChannel.subscribe();
}

function updateControlPanelUI() {
    const fields = [
        'ctrl-home-name', 'ctrl-away-name', 'ctrl-home-logo', 'ctrl-away-logo', 'ctrl-home-color', 'ctrl-away-color', 'ctrl-lineups-team',
        'ctrl-home-coach', 'ctrl-home-subs', 'ctrl-home-p1', 'ctrl-home-p2', 'ctrl-home-p3', 'ctrl-home-p4', 'ctrl-home-p5',
        'ctrl-away-coach', 'ctrl-away-subs', 'ctrl-away-p1', 'ctrl-away-p2', 'ctrl-away-p3', 'ctrl-away-p4', 'ctrl-away-p5',
        'ctrl-stat-player-name', 'ctrl-stat-player-team', 'ctrl-stat-shots', 'ctrl-stat-passes', 'ctrl-stat-goals', 'ctrl-stat-assists'
    ];
    fields.forEach(field => {
        const el = document.getElementById(field); if (el) { const key = field.replace('ctrl-', '').replace(/-/g, '_'); el.value = currentMatchState[key] || (el.type === 'number' ? 0 : ""); }
    });
    if(document.getElementById('ctrl-home-score')) document.getElementById('ctrl-home-score').innerText = currentMatchState.home_score;
    if(document.getElementById('ctrl-away-score')) document.getElementById('ctrl-away-score').innerText = currentMatchState.away_score;
    if(document.getElementById('ctrl-timer')) document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
}

function sendBroadcastState() { if (realtimeChannel) realtimeChannel.send({ type: 'broadcast', event: 'state-change', payload: currentMatchState }); }
async function saveStateToSupabase() { sendBroadcastState(); await supabaseClient.from('match_state').update(currentMatchState).eq('id', 'live_match'); }
async function fetchInitialState() { let { data } = await supabaseClient.from('match_state').select('*').eq('id', 'live_match').single(); if (data) currentMatchState = data; }

function changeScore(team, val) {
    if (team === 'home') currentMatchState.home_score = Math.max(0, currentMatchState.home_score + val);
    else currentMatchState.away_score = Math.max(0, currentMatchState.away_score + val);
    if (document.getElementById(`ctrl-${team}-score`)) document.getElementById(`ctrl-${team}-score`).innerText = currentMatchState[`${team}_score`];
    saveStateToSupabase();
}

function updateMatchNames() {
    currentMatchState.home_name = document.getElementById('ctrl-home-name').value;
    currentMatchState.away_name = document.getElementById('ctrl-away-name').value;
    currentMatchState.home_logo = document.getElementById('ctrl-home-logo').value;
    currentMatchState.away_logo = document.getElementById('ctrl-away-logo').value;
    currentMatchState.home_color = document.getElementById('ctrl-home-color').value;
    currentMatchState.away_color = document.getElementById('ctrl-away-color').value;
    currentMatchState.lineups_team = document.getElementById('ctrl-lineups-team').value;

    const fields = ['home_coach', 'home_subs', 'home_p1', 'home_p2', 'home_p3', 'home_p4', 'home_p5', 'away_coach', 'away_subs', 'away_p1', 'away_p2', 'away_p3', 'away_p4', 'away_p5'];
    fields.forEach(f => { const el = document.getElementById(`ctrl-${f.replace(/_/g, '-')}`); if(el) currentMatchState[f] = el.value; });
    saveStateToSupabase();
}

function updatePlayerStatsData() {
    currentMatchState.stat_player_name = document.getElementById('ctrl-stat-player-name').value;
    currentMatchState.stat_player_team = document.getElementById('ctrl-stat-player-team').value;
    currentMatchState.stat_shots = parseInt(document.getElementById('ctrl-stat-shots').value) || 0;
    currentMatchState.stat_passes = parseInt(document.getElementById('ctrl-stat-passes').value) || 0;
    currentMatchState.stat_goals = parseInt(document.getElementById('ctrl-stat-goals').value) || 0;
    currentMatchState.stat_assists = parseInt(document.getElementById('ctrl-stat-assists').value) || 0;
    saveStateToSupabase();
}

function toggleTimer() { currentMatchState.is_running = !currentMatchState.is_running; saveStateToSupabase(); }
function resetTimer() { currentMatchState.is_running = false; currentMatchState.match_time = 0; if(document.getElementById('ctrl-timer')) document.getElementById('ctrl-timer').innerText = "00:00"; saveStateToSupabase(); }
function toggleLineups() { currentMatchState.show_lineups = !currentMatchState.show_lineups; saveStateToSupabase(); }
function togglePlayerStatsOverlay() { currentMatchState.show_player_stats = !currentMatchState.show_player_stats; saveStateToSupabase(); }

async function triggerGoalAnimation() {
    if (currentMatchState.show_goal_trigger || isAnimationPlaying) return;
    currentMatchState.scorer_name = document.getElementById('ctrl-scorer-name').value;
    currentMatchState.scorer_team = document.getElementById('ctrl-scorer-team').value;
    currentMatchState.show_goal_trigger = true;
    if (currentMatchState.scorer_team === 'home') currentMatchState.home_score++; else currentMatchState.away_score++;
    updateControlPanelUI(); sendBroadcastState();
    let dbState = { ...currentMatchState, show_goal_trigger: false };
    await supabaseClient.from('match_state').update(dbState).eq('id', 'live_match');
    setTimeout(() => { currentMatchState.show_goal_trigger = false; }, 1000);
}

function formatTime(totalSeconds) { const mins = Math.floor(totalSeconds / 60); const secs = totalSeconds % 60; return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; }
