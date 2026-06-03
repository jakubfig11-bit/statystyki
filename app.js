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
    summary_bar_text: "", show_summary_bar: false
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
    if (data.show_summary_bar !== currentMatchState.show_summary_bar) toggleGSAPSummaryBar(data.show_summary_bar);
    
    // Live przeładowanie samego tekstu bez chowania całego paska
    if (data.summary_bar_text !== currentMatchState.summary_bar_text) {
        const txtField = document.getElementById('summary-text-field');
        if(txtField) {
            txtField.innerText = data.summary_bar_text || "";
        }
    }

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
        if(document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);
        if(document.getElementById('ctrl-timer')) document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
    }, 1000);
}

function toggleTimer() { 
    currentMatchState.is_running = !currentMatchState.is_running; 
    if (!currentMatchState.is_running) clearInterval(timerInterval); else startLocalTimer();
    saveStateToSupabase(); 
}

function resetTimer() { 
    clearInterval(timerInterval); currentMatchState.is_running = false; currentMatchState.match_time = 0; 
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
    if(accent) accent.style.backgroundColor = currentMatchState.stat_player_team === 'home' ? currentMatchState.home_color : currentMatchState.away_color;
}

function updateSummaryUI() {
    if(document.getElementById('summary-text-field')) {
        document.getElementById('summary-text-field').innerText = currentMatchState.summary_bar_text || "";
    }
    const barAccent = document.getElementById('summary-bar-accent');
    if(barAccent && currentMatchState.home_color) {
        barAccent.style.backgroundColor = currentMatchState.home_color;
    }
}

function updateControlPanelUI() {
    const fields = [
        'ctrl-home-name', 'ctrl-away-name', 'ctrl-home-logo', 'ctrl-away-logo', 'ctrl-home-color', 'ctrl-away-color', 'ctrl-lineups-team',
        'ctrl-home-coach', 'ctrl-home-subs', 'ctrl-home-p1', 'ctrl-home-p2', 'ctrl-home-p3', 'ctrl-home-p4', 'ctrl-home-p5',
        'ctrl-away-coach', 'ctrl-away-subs', 'ctrl-away-p1', 'ctrl-away-p2', 'ctrl-away-p3', 'ctrl-away-p4', 'ctrl-away-p5',
        'ctrl-stat-player-name', 'ctrl-stat-player-team', 'ctrl-stat-shots', 'ctrl-stat-passes', 'ctrl-stat-goals', 'ctrl-stat-assists',
        'ctrl-sub-out', 'ctrl-sub-in', 'ctrl-sub-team', 'ctrl-summary-text'
    ];
    fields.forEach(f => {
        const el = document.getElementById(f);
        if(!el) return;
        const key = f.replace('ctrl-', '').replace('-', '_');
        if(currentMatchState[key] !== undefined) el.value = currentMatchState[key];
    });
    if(document.getElementById('ctrl-home-score')) document.getElementById('ctrl-home-score').innerText = currentMatchState.home_score;
    if(document.getElementById('ctrl-away-score')) document.getElementById('ctrl-away-score').innerText = currentMatchState.away_score;
    if(document.getElementById('ctrl-timer')) document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
    
    const statusEl = document.getElementById('db-status');
    if (statusEl) { statusEl.innerText = "POŁĄCZONO"; statusEl.className = "status-badge connected"; }
}

// ==========================================
// SUPABASE REALTIME & ZAPIS stanu
// ==========================================

function sendBroadcastState() {
    if (realtimeChannel) realtimeChannel.send({ type: 'broadcast', event: 'state-change', payload: currentMatchState });
}

async function saveStateToSupabase() {
    sendBroadcastState();
    await supabaseClient.from('match_state').update(currentMatchState).eq('id', 'live_match');
}

async function fetchInitialState() {
    let { data } = await supabaseClient.from('match_state').select('*').eq('id', 'live_match').single();
    if (data) {
        currentMatchState = data;
        if(document.getElementById('summary-overlay')) {
            if(currentMatchState.show_summary_bar) {
                gsap.set(document.getElementById('summary-overlay'), { autoAlpha: 1, y: 0 });
            } else {
                gsap.set(document.getElementById('summary-overlay'), { autoAlpha: 0, y: 120 });
            }
        }
    }
}

// ==========================================
// FUNKCJE ZAPISUJĄCE Z PANELU
// ==========================================

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
    saveStateToSupabase();
}

function swapTeams() {
    const temp = {
        name: currentMatchState.home_name, score: currentMatchState.home_score, logo: currentMatchState.home_logo, color: currentMatchState.home_color,
        coach: currentMatchState.home_coach, subs: currentMatchState.home_subs, p1: currentMatchState.home_p1, p2: currentMatchState.home_p2, p3: currentMatchState.home_p3, p4: currentMatchState.home_p4, p5: currentMatchState.home_p5
    };
    currentMatchState.home_name = currentMatchState.away_name; currentMatchState.home_score = currentMatchState.away_score; currentMatchState.home_logo = currentMatchState.away_logo; currentMatchState.home_color = currentMatchState.away_color; currentMatchState.home_coach = currentMatchState.away_coach; currentMatchState.home_subs = currentMatchState.away_subs; currentMatchState.home_p1 = currentMatchState.away_p1; currentMatchState.home_p2 = currentMatchState.away_p2; currentMatchState.home_p3 = currentMatchState.away_p3; currentMatchState.home_p4 = currentMatchState.away_p4; currentMatchState.home_p5 = currentMatchState.away_p5;
    
    currentMatchState.away_name = temp.name; currentMatchState.away_score = temp.score; currentMatchState.away_logo = temp.logo; currentMatchState.away_color = temp.color; currentMatchState.away_coach = temp.coach; currentMatchState.away_subs = temp.subs; currentMatchState.away_p1 = temp.p1; currentMatchState.away_p2 = temp.p2; currentMatchState.away_p3 = temp.p3; currentMatchState.away_p4 = temp.p4; currentMatchState.away_p5 = temp.p5;
    
    updateControlPanelUI(); saveStateToSupabase();
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

function updateLineupsData() {
    const activeTeam = document.getElementById('ctrl-lineups-team').value;
    currentMatchState.lineups_team = activeTeam;
    ['home', 'away'].forEach(p => {
        currentMatchState[`${p}_coach`] = document.getElementById(`ctrl-${p}-coach`).value;
        currentMatchState[`${p}_subs`] = document.getElementById(`ctrl-${p}-subs`).value;
        for(let i=1; i<=5; i++) { currentMatchState[`${p}_p${i}`] = document.getElementById(`ctrl-${p}_p${i}`).value; }
    });
    saveStateToSupabase();
}

function updateSummaryText() {
    currentMatchState.summary_bar_text = document.getElementById('ctrl-summary-text').value;
    saveStateToSupabase();
}

function toggleSummaryOverlay() {
    currentMatchState.show_summary_bar = !currentMatchState.show_summary_bar;
    saveStateToSupabase();
}

function toggleLineups() { currentMatchState.show_lineups = !currentMatchState.show_lineups; saveStateToSupabase(); }
function togglePlayerStatsOverlay() { currentMatchState.show_player_stats = !currentMatchState.show_player_stats; saveStateToSupabase(); }

async function triggerGoalAnimation() {
    if (currentMatchState.show_goal_trigger || isAnimationPlaying) return;
    currentMatchState.scorer_name = document.getElementById('ctrl-scorer-name').value;
    currentMatchState.scorer_team = document.getElementById('ctrl-scorer-team').value;
    currentMatchState.show_goal_trigger = true;
    sendBroadcastState();
    let dbState = { ...currentMatchState, show_goal_trigger: false };
    await supabaseClient.from('match_state').update(dbState).eq('id', 'live_match');
    setTimeout(() => { currentMatchState.show_goal_trigger = false; }, 1000);
}

async function triggerSubAnimation() {
    if (currentMatchState.show_sub_trigger || isSubAnimationPlaying) return;
    currentMatchState.sub_out = document.getElementById('ctrl-sub-out').value;
    currentMatchState.sub_in = document.getElementById('ctrl-sub-in').value;
    currentMatchState.sub_team = document.getElementById('ctrl-sub-team').value;
    currentMatchState.show_sub_trigger = true;
    sendBroadcastState();
    let dbState = { ...currentMatchState, show_sub_trigger: false };
    await supabaseClient.from('match_state').update(dbState).eq('id', 'live_match');
    setTimeout(() => { currentMatchState.show_sub_trigger = false; }, 1000);
}

// ==========================================
// LOGIKA ANIMACJI GSAP (POPRAWIONE AUTOALPHA)
// ==========================================

function toggleGSAPSummaryBar(show) {
    const container = document.getElementById('summary-overlay');
    if (!container) return;
    
    const barAccent = document.getElementById('summary-bar-accent');
    if (barAccent && currentMatchState.home_color) {
        barAccent.style.backgroundColor = currentMatchState.home_color;
    }

    if (show) {
        gsap.to(container, { 
            y: 0, 
            autoAlpha: 1, 
            duration: 0.6, 
            ease: "power4.out" 
        });
    } else {
        gsap.to(container, { 
            y: 120, 
            autoAlpha: 0, 
            duration: 0.5, 
            ease: "power4.in"
        });
    }
}

function runGSAPGoalAnimation(scorer, teamName, teamColor, teamLogo) {
    isAnimationPlaying = true;
    const exactGoalTime = formatTime(currentMatchState.match_time);
    
    if (document.getElementById('goal-scorer')) document.getElementById('goal-scorer').innerText = (scorer && scorer.trim() !== "") ? scorer.toUpperCase() : "ZAWODNIK";
    if (document.getElementById('goal-team')) document.getElementById('goal-team').innerText = teamName;
    if (document.getElementById('goal-time')) document.getElementById('goal-time').innerText = exactGoalTime;
    if (document.getElementById('goal-card-accent')) document.getElementById('goal-card-accent').style.borderBottom = `6px solid ${teamColor}`;
    
    const bgLogoImg = document.getElementById('goal-bg-logo');
    if (bgLogoImg) {
        if (teamLogo && teamLogo.trim() !== "") { bgLogoImg.src = teamLogo; bgLogoImg.classList.remove('hidden'); }
        else bgLogoImg.classList.add('hidden');
    }
    const overlay = document.getElementById('goal-overlay');
    if (overlay) {
        gsap.set(overlay, { visibility: 'visible', y: 150, opacity: 0 });
        let tl = gsap.timeline();
        tl.to(overlay, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" })
          .to(overlay, { y: 150, opacity: 0, duration: 0.5, ease: "power3.in", delay: 7.0, onComplete: () => {
              gsap.set(overlay, { visibility: 'hidden' }); isAnimationPlaying = false;
          }});
    }
}

function runGSAPSubAnimation(outPlayer, inPlayer, teamName, teamColor) {
    isSubAnimationPlaying = true;
    if (document.getElementById('sub-team-name')) document.getElementById('sub-team-name').innerText = teamName.toUpperCase();
    if (document.getElementById('sub-txt-out')) document.getElementById('sub-txt-out').innerText = outPlayer.toUpperCase();
    if (document.getElementById('sub-txt-in')) document.getElementById('sub-txt-in').innerText = inPlayer.toUpperCase();
    if (document.getElementById('sub-card-accent')) document.getElementById('sub-card-accent').style.backgroundColor = teamColor;
    
    const overlay = document.getElementById('sub-overlay');
    if (overlay) {
        gsap.set(overlay, { visibility: 'visible', y: 150, opacity: 0 });
        let tl = gsap.timeline();
        tl.to(overlay, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" })
          .to(overlay, { y: 150, opacity: 0, duration: 0.5, ease: "power3.in", delay: 6.0, onComplete: () => {
              gsap.set(overlay, { visibility: 'hidden' }); isSubAnimationPlaying = false;
          }});
    }
}

function toggleGSAPTacticalLineups(show) {
    const container = document.getElementById('tactical-lineups-overlay');
    if (!container) return;
    if (show) {
        gsap.set(container, { visibility: 'visible', scale: 0.85, opacity: 0 });
        gsap.to(container, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.2)" });
    } else {
        gsap.to(container, { scale: 0.85, opacity: 0, duration: 0.4, ease: "power3.in", onComplete: () => {
            gsap.set(container, { visibility: 'hidden' });
        }});
    }
}

// ==========================================
// POMOCNIKI
// ==========================================

function parseAndSetPlayer(elementId, playerString) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const nameSpan = container.querySelector('.player-name');
    const numSpan = container.querySelector('.player-number');
    
    if (!playerString || playerString.trim() === "") {
        if(nameSpan) nameSpan.innerText = "WAKAT"; if(numSpan) numSpan.innerText = "-"; return;
    }
    const dotIndex = playerString.indexOf('.');
    if (dotIndex !== -1) {
        const num = playerString.substring(0, dotIndex).trim();
        const name = playerString.substring(dotIndex + 1).trim();
        if(numSpan) numSpan.innerText = num; if(nameSpan) nameSpan.innerText = name.toUpperCase();
    } else {
        if(numSpan) numSpan.innerText = "?"; if(nameSpan) nameSpan.innerText = playerString.toUpperCase();
    }
}

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function setupCrest(imgId, url) {
    const img = document.getElementById(imgId); if (!img) return;
    if (url && url.trim() !== "") { img.src = url; img.classList.remove('hidden'); } else { img.classList.add('hidden'); }
}
