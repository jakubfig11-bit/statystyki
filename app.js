// ==========================================================================
// CONFIGURACJA SUPABASE (WPISZ SWOJE DANE!)
// ==========================================================================
const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentMatchState = {
    home_name: "HOME", away_name: "AWAY", home_score: 0, away_score: 0, match_time: 0, is_running: false,
    scorer_name: "", scorer_team: "home", show_goal_trigger: false, show_lineups: false,
    home_logo: "", away_logo: "", home_color: "#0052cc", away_color: "#ff0044",
    lineups_team: "home", goals_history: [], current_half: 1, summary_name: "HALFTIME", show_summary: false,
    home_coach: "", home_subs: "", home_p1: "", home_p2: "", home_p3: "", home_p4: "", home_p5: "",
    away_coach: "", away_subs: "", away_p1: "", away_p2: "", away_p3: "", away_p4: "", away_p5: "",
    stat_player_name: "ZAWODNIK", stat_player_team: "home", show_player_stats: false,
    stat_shots: 0, stat_passes: 0, stat_goals: 0, stat_assists: 0,
    sub_out: "", sub_in: "", sub_team: "home", show_sub_trigger: false
};

let localTimerInterval = null;

async function initOverlayView() {
    try {
        const { data, error } = await supabase
            .from('broadcast_state')
            .select('state_json')
            .eq('id', 1)
            .maybeSingle();
            
        if (error) throw error;
            
        if (data && data.state_json) {
            currentMatchState = data.state_json;
            renderAllUI();
            manageLocalTimer();
        }
    } catch (err) {
        console.error("Overlay nie pobrał danych startowych:", err);
    }

    // Subskrypcja zmian na żywo
    supabase
        .channel('public:broadcast_state')
        .on('postgres_changes', { event: 'UPDATE', filter: 'id=eq.1', schema: 'public', table: 'broadcast_state' }, payload => {
            if (payload.new && payload.new.state_json) {
                currentMatchState = payload.new.state_json;
                renderAllUI();
                manageLocalTimer();
            }
        })
        .subscribe();
}

function manageLocalTimer() {
    if (currentMatchState.is_running) {
        if (!localTimerInterval) {
            localTimerInterval = setInterval(() => {
                currentMatchState.match_time++;
                const timerEl = document.getElementById('hud-timer');
                if (timerEl) timerEl.innerText = formatTime(currentMatchState.match_time);
            }, 1000);
        }
    } else {
        clearInterval(localTimerInterval);
        localTimerInterval = null;
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function setupCrest(elementId, url) {
    const img = document.getElementById(elementId);
    if (!img) return;
    if (url && url.trim() !== "") {
        img.src = url;
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
    }
}

function renderAllUI() {
    if(!currentMatchState) return;
    
    if(document.getElementById('hud-home-name')) document.getElementById('hud-home-name').innerText = currentMatchState.home_name;
    if(document.getElementById('hud-away-name')) document.getElementById('hud-away-name').innerText = currentMatchState.away_name;
    if(document.getElementById('hud-home-score')) document.getElementById('hud-home-score').innerText = currentMatchState.home_score;
    if(document.getElementById('hud-away-score')) document.getElementById('hud-away-score').innerText = currentMatchState.away_score;
    if(document.getElementById('hud-timer')) document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);

    setupCrest('hud-home-logo', currentMatchState.home_logo);
    setupCrest('hud-away-logo', currentMatchState.away_logo);
    
    if(document.getElementById('hud-home-accent')) document.getElementById('hud-home-accent').style.backgroundColor = currentMatchState.home_color;
    if(document.getElementById('hud-away-accent')) document.getElementById('hud-away-accent').style.backgroundColor = currentMatchState.away_color;

    toggleOverlayElement('#goal-overlay', currentMatchState.show_goal_trigger, 'bottom');
    if (currentMatchState.show_goal_trigger) updateGoalCardUI();

    toggleOverlayElement('#sub-overlay', currentMatchState.show_sub_trigger, 'bottom-right');
    if (currentMatchState.show_sub_trigger) updateSubCardUI();

    toggleOverlayElement('#tactical-lineups-overlay', currentMatchState.show_lineups, 'center');
    if (currentMatchState.show_lineups) updateLineupsUI();

    toggleOverlayElement('#player-stats-overlay', currentMatchState.show_player_stats, 'bottom-left');
    if (currentMatchState.show_player_stats) updatePlayerStatsUI();

    toggleOverlayElement('#summary-overlay', currentMatchState.show_summary, 'center-scale');
    if (currentMatchState.show_summary) updateSummaryUI();
}

function updateGoalCardUI() {
    if(document.getElementById('goal-scorer')) document.getElementById('goal-scorer').innerText = currentMatchState.scorer_name;
    const teamName = currentMatchState.scorer_team === 'home' ? currentMatchState.home_name : currentMatchState.away_name;
    if(document.getElementById('goal-team')) document.getElementById('goal-team').innerText = teamName;
    if(document.getElementById('goal-time')) document.getElementById('goal-time').innerText = `${Math.floor(currentMatchState.match_time / 60)}' MINUTA`;
    
    const teamColor = currentMatchState.scorer_team === 'home' ? currentMatchState.home_color : currentMatchState.away_color;
    if(document.getElementById('goal-card-accent')) document.getElementById('goal-card-accent').style.borderColor = teamColor;
    
    const bgLogoUrl = currentMatchState.scorer_team === 'home' ? currentMatchState.home_logo : currentMatchState.away_logo;
    setupCrest('goal-bg-logo', bgLogoUrl);
}

function updateSubCardUI() {
    const teamName = currentMatchState.sub_team === 'home' ? currentMatchState.home_name : currentMatchState.away_name;
    const teamColor = currentMatchState.sub_team === 'home' ? currentMatchState.home_color : currentMatchState.away_color;
    
    if(document.getElementById('sub-team-name')) document.getElementById('sub-team-name').innerText = teamName;
    if(document.getElementById('sub-txt-out')) document.getElementById('sub-txt-out').innerText = currentMatchState.sub_out;
    if(document.getElementById('sub-txt-in')) document.getElementById('sub-txt-in').innerText = currentMatchState.sub_in;
    if(document.getElementById('sub-card-accent')) document.getElementById('sub-card-accent').style.backgroundColor = teamColor;
}

function updateLineupsUI() {
    const prefix = currentMatchState.lineups_team;
    if(document.getElementById('tactical-team-name')) document.getElementById('tactical-team-name').innerText = currentMatchState[prefix + "_name"];
    setupCrest('tactical-top-logo', currentMatchState[prefix + "_logo"]);
    setupCrest('tactical-bg-logo', currentMatchState[prefix + "_logo"]);
    
    const color = currentMatchState[prefix + "_color"] || "#1c2130";
    document.querySelectorAll('.player-shirt').forEach(s => s.style.backgroundColor = color);

    for (let i = 1; i <= 5; i++) {
        const rawVal = currentMatchState[prefix + "_p" + i] || "";
        const parts = rawVal.split('.');
        const nr = parts.length > 1 ? parts[0] : i;
        const name = parts.length > 1 ? parts.slice(1).join('.') : rawVal || "ZAWODNIK";
        
        const row = document.getElementById('tactical-p' + i);
        if (row) {
            row.querySelector('.player-number').innerText = nr;
            row.querySelector('.player-name').innerText = name;
        }
    }
    if(document.getElementById('tactical-coach-name')) document.getElementById('tactical-coach-name').innerText = `TRENER: ${currentMatchState[prefix + "_coach"] || '-'}`;
    if(document.getElementById('tactical-subs-list')) document.getElementById('tactical-subs-list').innerText = currentMatchState[prefix + "_subs"] || '-';
}

function updatePlayerStatsUI() {
    if(document.getElementById('stats-player-name')) document.getElementById('stats-player-name').innerText = currentMatchState.stat_player_name;
    const color = currentMatchState.stat_player_team === 'home' ? currentMatchState.home_color : currentMatchState.away_color;
    if(document.getElementById('stats-player-accent')) document.getElementById('stats-player-accent').style.backgroundColor = color;
    
    if(document.getElementById('stat-val-shots')) document.getElementById('stat-val-shots').innerText = currentMatchState.stat_shots;
    if(document.getElementById('stat-val-passes')) document.getElementById('stat-val-passes').innerText = currentMatchState.stat_passes;
    if(document.getElementById('stat-val-goals')) document.getElementById('stat-val-goals').innerText = currentMatchState.stat_goals;
    if(document.getElementById('stat-val-assists')) document.getElementById('stat-val-assists').innerText = currentMatchState.stat_assists;
}

function updateSummaryUI() {
    const isFull = currentMatchState.summary_name === "FULLTIME";
    if(document.getElementById('summary-txt-title')) {
        document.getElementById('summary-txt-title').innerText = isFull ? "FULLTIME MATCH SUMMARY" : "HALFTIME SUMMARY";
    }

    if(document.getElementById('summary-board-name-home')) document.getElementById('summary-board-name-home').innerText = currentMatchState.home_name;
    if(document.getElementById('summary-board-name-away')) document.getElementById('summary-board-name-away').innerText = currentMatchState.away_name;
    if(document.getElementById('summary-board-score-home')) document.getElementById('summary-board-score-home').innerText = currentMatchState.home_score;
    if(document.getElementById('summary-board-score-away')) document.getElementById('summary-board-score-away').innerText = currentMatchState.away_score;

    setupCrest('summary-board-logo-home', currentMatchState.home_logo);
    setupCrest('summary-board-logo-away', currentMatchState.away_logo);

    const homeList = document.getElementById('summary-scorers-list-home');
    const awayList = document.getElementById('summary-scorers-list-away');

    if (homeList && awayList) {
        homeList.innerHTML = "";
        awayList.innerHTML = "";
        const history = currentMatchState.goals_history || [];

        function generateRow(g) {
            const div = document.createElement('div');
            div.className = "summary-scorer-row";
            if (g.team === 'home') {
                div.innerHTML = `<span>${g.name}</span> <span class="minute">${g.minute}'</span>`;
            } else {
                div.innerHTML = `<span class="minute">${g.minute}'</span> <span>${g.name}</span>`;
            }
            return div;
        }

        function generateDivider() {
            const div = document.createElement('div');
            div.className = "summary-half-divider";
            div.innerText = "2. POŁOWA";
            return div;
        }

        if (!isFull) {
            history.forEach(g => {
                if (g.half === 1 || !g.half) {
                    if (g.team === 'home') homeList.appendChild(generateRow(g));
                    else awayList.appendChild(generateRow(g));
                }
            });
        } else {
            const homeH1 = history.filter(g => g.team === 'home' && (g.half === 1 || !g.half));
            const homeH2 = history.filter(g => g.team === 'home' && g.half === 2);
            homeH1.forEach(g => homeList.appendChild(generateRow(g)));
            if (homeH1.length > 0 || homeH2.length > 0) homeList.appendChild(generateDivider());
            homeH2.forEach(g => homeList.appendChild(generateRow(g)));

            const awayH1 = history.filter(g => g.team === 'away' && (g.half === 1 || !g.half));
            const awayH2 = history.filter(g => g.team === 'away' && g.half === 2);
            awayH1.forEach(g => awayList.appendChild(generateRow(g)));
            if (awayH1.length > 0 || awayH2.length > 0) awayList.appendChild(generateDivider());
            awayH2.forEach(g => awayList.appendChild(generateRow(g)));
        }
    }
}

function toggleOverlayElement(selector, show, anchor) {
    const el = document.querySelector(selector);
    if (!el) return;

    if (show) {
        if (el.style.visibility === 'visible' && el.style.opacity !== '0') return;
        gsap.killTweensOf(el);
        el.style.visibility = 'visible';

        if (anchor === 'bottom') {
            gsap.fromTo(el, { y: 150, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.2)" });
        } else if (anchor === 'bottom-right' || anchor === 'bottom-left') {
            gsap.fromTo(el, { x: anchor.includes('right') ? 150 : -150, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power2.out" });
        } else if (anchor === 'center') {
            gsap.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
        } else if (anchor === 'center-scale') {
            gsap.fromTo(el, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(1.1)" });
        }
    } else {
        if (el.style.visibility === 'hidden' || el.style.opacity === '0') {
            el.style.visibility = 'hidden';
            return;
        }
        gsap.killTweensOf(el);
        if (anchor === 'center-scale') {
            gsap.to(el, { scale: 0.85, opacity: 0, duration: 0.4, ease: "power2.in", onComplete: () => el.style.visibility = 'hidden' });
        } else {
            gsap.to(el, { opacity: 0, y: anchor === 'bottom' ? 40 : 0, duration: 0.4, ease: "power2.in", onComplete: () => el.style.visibility = 'hidden' });
        }
    }
}
