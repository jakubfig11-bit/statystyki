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
    goals_history: [], show_summary: false, summary_name: ""
};

let timerInterval = null; let realtimeChannel = null; let isAnimationPlaying = false; let isSubAnimationPlaying = false;

// ==========================================
// INICJALIZACJA SYSTEMU
// ==========================================

async function initOverlayView() {
    await fetchInitialState(); updateHUDUI(); updateTacticalLineupsUI(); updatePlayerStatsUI(); updateSummaryUI();
    if (currentMatchState.is_running) startLocalTimer();
    
    // Kluczowa poprawka: self: true pozwala na odbieranie eventów z tego samego połączenia na wypadek testów na 1 karcie
    realtimeChannel = supabaseClient.channel('match-broadcast', { config: { broadcast: { ack: false, self: true } } });
    realtimeChannel.on('broadcast', { event: 'state-change' }, ({ payload }) => handleStateUpdate(payload)).subscribe();
}

async function initControlPanel() {
    await fetchInitialState(); 
    const badge = document.getElementById('db-status');
    if(badge) { badge.innerText = "POŁĄCZONO"; badge.classList.add('connected'); }
    
    updateControlPanelUI(); switchLineupsControlTeam();
    if (currentMatchState.is_running) startLocalTimer();
    
    realtimeChannel = supabaseClient.channel('match-broadcast', { config: { broadcast: { ack: false, self: true } } }); 
    realtimeChannel.on('broadcast', { event: 'state-change' }, ({ payload }) => {
        if (payload.is_running !== currentMatchState.is_running) {
            if (payload.is_running) startLocalTimer(); else clearInterval(timerInterval);
        }
        if (!payload.is_running && payload.match_time !== currentMatchState.match_time) {
            if(document.getElementById('ctrl-timer')) document.getElementById('ctrl-timer').innerText = formatTime(payload.match_time);
        }
        currentMatchState = payload; 
        updateControlPanelUI();
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
    currentMatchState = data;
    updateHUDUI();
    updateTacticalLineupsUI();
    updatePlayerStatsUI();
    updateSummaryUI();
}

// ==========================================
// OPERACJE NA SYSTEMIE PODSUMOWANIA (SUMMARY BOARD)
// ==========================================

function updateSummaryUI() {
    const summaryOverlay = document.getElementById('summary-overlay');
    if (!summaryOverlay) return;

    if (currentMatchState.show_summary) {
        const titleEl = document.getElementById('summary-board-title');
        const homeNameEl = document.getElementById('summary-board-name-home');
        const awayNameEl = document.getElementById('summary-board-name-away');
        const homeScoreEl = document.getElementById('summary-board-score-home');
        const awayScoreEl = document.getElementById('summary-board-score-away');
        const homeList = document.getElementById('summary-scorers-list-home');
        const awayList = document.getElementById('summary-scorers-list-away');
        const accentHome = document.getElementById('summary-footer-accent-home');
        const accentAway = document.getElementById('summary-footer-accent-away');

        if (titleEl) {
            titleEl.innerText = currentMatchState.summary_name === "HALFTIME" ? "PODSUMOWANIE PIERWSZEJ POŁOWY" : "PODSUMOWANIE MECZU";
        }

        if (homeNameEl) homeNameEl.innerText = (currentMatchState.home_name || "GOSPODARZE").toUpperCase();
        if (awayNameEl) awayNameEl.innerText = (currentMatchState.away_name || "GOŚCIE").toUpperCase();
        if (homeScoreEl) homeScoreEl.innerText = currentMatchState.home_score ?? 0;
        if (awayScoreEl) awayScoreEl.innerText = currentMatchState.away_score ?? 0;

        setupCrest('summary-board-logo-home', currentMatchState.home_logo);
        setupCrest('summary-board-logo-away', currentMatchState.away_logo);

        if (accentHome) accentHome.style.backgroundColor = currentMatchState.home_color || "#0052cc";
        if (accentAway) accentAway.style.backgroundColor = currentMatchState.away_color || "#ff0044";

        if (homeList) homeList.innerHTML = "";
        if (awayList) awayList.innerHTML = "";

        const history = currentMatchState.goals_history || [];
        
        if (history.length === 0) {
            if (homeList) homeList.innerHTML = `<div class="summary-scorer-row" style="visibility:hidden;"><span>-</span></div>`;
            if (awayList) awayList.innerHTML = `<div class="summary-scorer-row" style="visibility:hidden;"><span>-</span></div>`;
        } else {
            history.forEach(goal => {
                if (currentMatchState.summary_name === "HALFTIME" && parseInt(goal.minute) > 45) {
                    return;
                }

                const row = document.createElement('div');
                row.className = "summary-scorer-row";

                if (goal.team === 'home') {
                    row.innerHTML = `<span>${goal.name.toUpperCase()}</span> <span class="minute">${goal.minute}'</span>`;
                    if (homeList) homeList.appendChild(row);
                } else {
                    row.innerHTML = `<span class="minute">${goal.minute}'</span> <span>${goal.name.toUpperCase()}</span>`;
                    if (awayList) awayList.appendChild(row);
                }
            });
            
            if (homeList && homeList.innerHTML === "") homeList.innerHTML = `<div class="summary-scorer-row" style="visibility:hidden;"><span>-</span></div>`;
            if (awayList && awayList.innerHTML === "") awayList.innerHTML = `<div class="summary-scorer-row" style="visibility:hidden;"><span>-</span></div>`;
        }

        gsap.set(summaryOverlay, { visibility: 'visible' });
        gsap.to(summaryOverlay, { opacity: 1, duration: 0.5 });
    } else {
        gsap.to(summaryOverlay, { opacity: 0, duration: 0.4, onComplete: () => gsap.set(summaryOverlay, { visibility: 'hidden' }) });
    }
}

// ==========================================
// PODSTAWOWE OPERACJE BAZODANOWE & POMOCNICZE
// ==========================================

async function fetchInitialState() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('broadcast_state').select('*').eq('id', 1).single();
    if (data && !error) currentMatchState = data;
}

async function saveStateToSupabase() {
    if (!supabaseClient || !realtimeChannel) return;
    // Aktualizacja w bazie tabeli realnej
    await supabaseClient.from('broadcast_state').update(currentMatchState).eq('id', 1);
    // Natychmiastowa transmisja eventu przez Realtime Channel do podłączonego overlay'u
    await realtimeChannel.send({ type: 'broadcast', event: 'state-change', payload: currentMatchState });
}

function startLocalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
        if (currentMatchState.is_running) {
            currentMatchState.match_time++;
            if (document.getElementById('ctrl-timer')) {
                document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
            }
        }
    }, 1000);
}

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateHUDUI() {
    if(document.getElementById('hud-home-name')) document.getElementById('hud-home-name').innerText = currentMatchState.home_name;
    if(document.getElementById('hud-away-name')) document.getElementById('hud-away-name').innerText = currentMatchState.away_name;
    if(document.getElementById('hud-home-score')) document.getElementById('hud-home-score').innerText = currentMatchState.home_score;
    if(document.getElementById('hud-away-score')) document.getElementById('hud-away-score').innerText = currentMatchState.away_score;
    if(document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);
    setupCrest('hud-home-logo', currentMatchState.home_logo);
    setupCrest('hud-away-logo', currentMatchState.away_logo);
    const hAcc = document.getElementById('hud-home-accent'); if(hAcc) hAcc.style.backgroundColor = currentMatchState.home_color;
    const aAcc = document.getElementById('hud-away-accent'); if(aAcc) aAcc.style.backgroundColor = currentMatchState.away_color;
}

function updateTacticalLineupsUI() {
    const container = document.getElementById('tactical-lineups-overlay'); if (!container) return;
    if (currentMatchState.show_lineups) {
        const team = currentMatchState.lineups_team;
        if(document.getElementById('tactical-team-name')) document.getElementById('tactical-team-name').innerText = team === 'home' ? currentMatchState.home_name : currentMatchState.away_name;
        const coach = currentMatchState[team + '_coach'] || "BRAK";
        const subs = currentMatchState[team + '_subs'] || "BRAK REZERWOWYCH";
        const topLogo = team === 'home' ? currentMatchState.home_logo : currentMatchState.away_logo;
        setupCrest('tactical-top-logo', topLogo); setupCrest('tactical-bg-logo', topLogo);
        const cardEl = container.querySelector('.tactical-card'); if(cardEl) cardEl.style.borderTop = `6px solid ${team === 'home' ? currentMatchState.home_color : currentMatchState.away_color}`;
        const sList = document.getElementById('tactical-subs-list'); if(sList) sList.innerText = subs.toUpperCase();
        const coachEl = document.getElementById('tactical-coach-name'); if(coachEl) coachEl.innerText = coach.toUpperCase();
        
        for (let i = 1; i <= 5; i++) {
            parseAndSetPlayer(`tactical-p${i}`, currentMatchState[team + '_p' + i]);
            const shirt = document.querySelector(`#tactical-p${i} .player-shirt`);
            if (shirt) shirt.style.backgroundColor = team === 'home' ? currentMatchState.home_color : currentMatchState.away_color;
        }
        gsap.set(container, { visibility: 'visible', yPercent: -50, xPercent: -50, opacity: 0, scale: 0.9 });
        gsap.to(container, { yPercent: -50, xPercent: -50, opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" });
    } else {
        gsap.to(container, { yPercent: 50, xPercent: -50, opacity: 0, scale: 0.9, duration: 0.5, ease: "power3.in", onComplete: () => { gsap.set(container, { visibility: 'hidden' }); }});
    }
}

function updatePlayerStatsUI() {
    const container = document.getElementById('player-stats-overlay'); if (!container) return;
    if (currentMatchState.show_player_stats) {
        if(document.getElementById('stat-name')) document.getElementById('stat-name').innerText = currentMatchState.stat_player_name.toUpperCase();
        if(document.getElementById('stat-val-shots')) document.getElementById('stat-val-shots').innerText = currentMatchState.stat_shots;
        if(document.getElementById('stat-val-passes')) document.getElementById('stat-val-passes').innerText = currentMatchState.stat_passes;
        if(document.getElementById('stat-val-goals')) document.getElementById('stat-val-goals').innerText = currentMatchState.stat_goals;
        if(document.getElementById('stat-val-assists')) document.getElementById('stat-val-assists').innerText = currentMatchState.stat_assists;
        const activeColor = currentMatchState.stat_player_team === 'home' ? currentMatchState.home_color : currentMatchState.away_color;
        const bar = document.getElementById('stat-player-accent'); if (bar) bar.style.backgroundColor = activeColor;
        gsap.set(container, { visibility: 'visible', x: -400, opacity: 0 });
        gsap.to(container, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
    } else {
        gsap.to(container, { x: -400, opacity: 0, duration: 0.5, ease: "power3.in", onComplete: () => { gsap.set(container, { visibility: 'hidden' }); }});
    }
}

function runGSAPGoalAnimation(scorer, team, color, logo) {
    isAnimationPlaying = true; const overlay = document.getElementById('goal-overlay'); if (!overlay) return;
    if(document.getElementById('goal-scorer')) document.getElementById('goal-scorer').innerText = scorer.toUpperCase();
    if(document.getElementById('goal-team')) document.getElementById('goal-team').innerText = team.toUpperCase();
    const currentMin = Math.floor(currentMatchState.match_time / 60);
    if(document.getElementById('goal-time')) document.getElementById('goal-time').innerText = `${currentMin} MINUTA MECZU`;
    const acc = document.getElementById('goal-card-accent'); if (acc) acc.style.backgroundColor = color;
    setupCrest('goal-bg-logo', logo);
    gsap.set(overlay, { visibility: 'visible', opacity: 0, scale: 0.8 });
    gsap.to(overlay, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)" });
    setTimeout(() => {
        gsap.to(overlay, { opacity: 0, scale: 0.8, duration: 0.4, onComplete: () => { gsap.set(overlay, { visibility: 'hidden' }); isAnimationPlaying = false; }});
    }, 4000);
}

function runGSAPSubAnimation(outPlayer, inPlayer, teamName, color) {
    isSubAnimationPlaying = true; const overlay = document.getElementById('sub-overlay'); if(!overlay) return;
    if(document.getElementById('sub-team-name')) document.getElementById('sub-team-name').innerText = teamName.toUpperCase();
    if(document.getElementById('sub-txt-out')) document.getElementById('sub-txt-out').innerText = outPlayer.toUpperCase();
    if(document.getElementById('sub-txt-in')) document.getElementById('sub-txt-in').innerText = inPlayer.toUpperCase();
    const acc = document.getElementById('sub-card-accent'); if(acc) acc.style.backgroundColor = color;
    gsap.set(overlay, { visibility: 'visible', y: 150, opacity: 0 });
    gsap.to(overlay, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
    setTimeout(() => {
        gsap.to(overlay, { y: 150, opacity: 0, duration: 0.5, ease: "power3.in", onComplete: () => { gsap.set(overlay, { visibility: 'hidden' }); isSubAnimationPlaying = false; }});
    }, 4500);
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
