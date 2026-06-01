const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

let supabaseClient = null;
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
    });
}

const defaultHomePlayers = ["1. NOWAK (GK)", "2. KOWALSKI", "3. ZIELIŃSKI", "4. WIŚNIEWSKI", "5. WÓJCIK", "6. KOWALCZYK", "7. KAMIŃSKI", "8. LEWANDOWSKI", "9. MILIK", "10. SZYMAŃSKI", "11. PIĄTEK"];
const defaultAwayPlayers = ["12. BORUC (GK)", "13. BEDNAREK", "14. KWIATKOWSKI", "15. MAJEWSKI", "16. PIOTROWSKI", "17. KRÓL", "18. JAWORSKI", "19. DUDA", "20. CHMIEL", "21. WRÓBEL", "22. SIKORA"];

let currentMatchState = {
    home_name: "HOME", away_name: "AWAY",
    home_score: 0, away_score: 0,
    match_time: 0, is_running: false,
    scorer_name: "", scorer_team: "home",
    show_goal_trigger: false, show_lineups: false,
    home_logo: "", away_logo: "",
    home_color: "#0052cc", away_color: "#ff0044"
};

let timerInterval = null;
let realtimeChannel = null;

// ==========================================
// LOGIKA OVERLAY (OBS)
// ==========================================
async function initOverlayView() {
    await fetchInitialState();
    updateHUDUI();
    if (currentMatchState.is_running) startLocalTimer();

    realtimeChannel = supabaseClient.channel('match-broadcast', {
        config: { broadcast: { ack: false, self: false } }
    });

    realtimeChannel
        .on('broadcast', { event: 'state-change' }, ({ payload }) => {
            handleStateUpdate(payload);
        })
        .subscribe();
}

function handleStateUpdate(data) {
    if (data.show_goal_trigger === true && currentMatchState.show_goal_trigger === false) {
        runGSAPGoalAnimation(data.scorer_name, data.scorer_team === 'home' ? data.home_name : data.away_name, data.scorer_team === 'home' ? data.home_color : data.away_color);
    }
    
    if (data.show_lineups !== currentMatchState.show_lineups) {
        toggleGSAPLineups(data.show_lineups);
    }
    
    if (data.is_running !== currentMatchState.is_running) {
        if (data.is_running) startLocalTimer();
        else clearInterval(timerInterval);
    }
    
    currentMatchState = data;
    updateHUDUI();
}

function updateHUDUI() {
    document.getElementById('hud-home-name').innerText = currentMatchState.home_name;
    document.getElementById('hud-away-name').innerText = currentMatchState.away_name;
    document.getElementById('hud-home-score').innerText = currentMatchState.home_score;
    document.getElementById('hud-away-score').innerText = currentMatchState.away_score;
    document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);

    document.getElementById('hud-home-accent').style.backgroundColor = currentMatchState.home_color || "#0052cc";
    document.getElementById('hud-away-accent').style.backgroundColor = currentMatchState.away_color || "#ff0044";

    setupCrest('hud-home-logo', currentMatchState.home_logo);
    setupCrest('hud-away-logo', currentMatchState.away_logo);
}

function setupCrest(elementId, url) {
    const img = document.getElementById(elementId);
    if (url && url.trim() !== "") {
        img.src = url;
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
}

function startLocalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        currentMatchState.match_time++;
        document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);
    }, 1000);
}

function renderLineupsStructures() {
    document.getElementById('home-players-list').innerHTML = defaultHomePlayers.map(p => `<li><span>―</span>${p}</li>`).join('');
    document.getElementById('away-players-list').innerHTML = defaultAwayPlayers.map(p => `<li><span>―</span>${p}</li>`).join('');
}

// ZMODYFIKOWANA ANIMACJA GOLA (DÓŁ EKRANU, 8 SEKUND, AUTOMATYCZNY CZAS)
function runGSAPGoalAnimation(scorer, teamName, teamColor) {
    // Pobranie i sformatowanie dokładnego czasu z licznika w momencie strzału
    const exactGoalTime = formatTime(currentMatchState.match_time);
    
    document.getElementById('goal-scorer').innerText = scorer || "ZAWODNIK";
    document.getElementById('goal-team').innerText = teamName;
    document.getElementById('goal-time').innerText = exactGoalTime;
    document.getElementById('goal-card-accent').style.borderBottom = `6px solid ${teamColor}`;

    const overlay = document.getElementById('goal-overlay');
    const card = overlay.querySelector('.goal-tv-card');

    let tl = gsap.timeline({ onStart: () => { gsap.set(overlay, { visibility: 'visible', opacity: 1 }); } });

    // Animacja wysunięcia od dołu (y: 150 -> y: 0)
    tl.fromTo(card, { y: 150, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "power4.out" })
      .to({}, { duration: 8.0 }) // Trzymanie grafiki na ekranie przez równe 8 sekund
      .to(card, { y: 150, opacity: 0, scale: 0.95, duration: 0.5, ease: "power4.in", onComplete: () => {
          gsap.set(overlay, { visibility: 'hidden' });
          resetGoalTrigger();
      }});
}

function toggleGSAPLineups(show) {
    const container = document.getElementById('lineups-overlay');
    if (show) {
        gsap.set(container, { visibility: 'visible', opacity: 1 });
        gsap.fromTo(".lineup-col", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: "power3.out" });
    } else {
        gsap.to(".lineup-col", { y: 50, opacity: 0, duration: 0.4, stagger: 0.05, ease: "power3.in", onComplete: () => {
            gsap.set(container, { visibility: 'hidden', opacity: 0 });
        }});
    }
}

// ==========================================
// LOGIKA CONTROL PANEL
// ==========================================
async function initControlPanel() {
    await fetchInitialState();
    updateControlPanelUI();
    
    const statusBadge = document.getElementById('db-status');
    statusBadge.innerText = "POŁĄCZONO";
    statusBadge.classList.add('connected');

    realtimeChannel = supabaseClient.channel('match-broadcast', { config: { broadcast: { ack: false, self: false } } });
    realtimeChannel.subscribe();

    setInterval(() => {
        if (currentMatchState.is_running) {
            currentMatchState.match_time++;
            document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
            sendBroadcastState();
        }
    }, 1000);
}

function updateControlPanelUI() {
    document.getElementById('ctrl-home-name').value = currentMatchState.home_name;
    document.getElementById('ctrl-away-name').value = currentMatchState.away_name;
    document.getElementById('ctrl-home-logo').value = currentMatchState.home_logo || "";
    document.getElementById('ctrl-away-logo').value = currentMatchState.away_logo || "";
    document.getElementById('ctrl-home-color').value = currentMatchState.home_color || "#0052cc";
    document.getElementById('ctrl-away-color').value = currentMatchState.away_color || "#ff0044";
    document.getElementById('ctrl-home-score').innerText = currentMatchState.home_score;
    document.getElementById('ctrl-away-score').innerText = currentMatchState.away_score;
    document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
}

function sendBroadcastState() {
    if (realtimeChannel) {
        realtimeChannel.send({ type: 'broadcast', event: 'state-change', payload: currentMatchState });
    }
}

async function saveStateToSupabase() {
    sendBroadcastState();
    await supabaseClient.from('match_state').update(currentMatchState).eq('id', 'live_match');
}

async function fetchInitialState() {
    let { data } = await supabaseClient.from('match_state').select('*').eq('id', 'live_match').single();
    if (data) currentMatchState = data;
}

function changeScore(team, val) {
    if (team === 'home') currentMatchState.home_score = Math.max(0, currentMatchState.home_score + val);
    else currentMatchState.away_score = Math.max(0, currentMatchState.away_score + val);
    document.getElementById(`ctrl-${team}-score`).innerText = currentMatchState[`${team}_score`];
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

function toggleTimer() { currentMatchState.is_running = !currentMatchState.is_running; saveStateToSupabase(); }
function resetTimer() { currentMatchState.is_running = false; currentMatchState.match_time = 0; document.getElementById('ctrl-timer').innerText = "00:00"; saveStateToSupabase(); }
function toggleLineups() { currentMatchState.show_lineups = !currentMatchState.show_lineups; saveStateToSupabase(); }

function triggerGoalAnimation() {
    currentMatchState.scorer_name = document.getElementById('ctrl-scorer-name').value;
    currentMatchState.scorer_team = document.getElementById('ctrl-scorer-team').value;
    currentMatchState.show_goal_trigger = true;
    if (currentMatchState.scorer_team === 'home') currentMatchState.home_score++;
    else currentMatchState.away_score++;
    document.getElementById('ctrl-home-score').innerText = currentMatchState.home_score;
    document.getElementById('ctrl-away-score').innerText = currentMatchState.away_score;
    saveStateToSupabase();
}

function resetGoalTrigger() {
    currentMatchState.show_goal_trigger = false;
    sendBroadcastState();
    supabaseClient.from('match_state').update({ show_goal_trigger: false }).eq('id', 'live_match');
}

function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
