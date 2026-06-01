const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

let supabaseClient = null;

// Bezpieczna inicjalizacja klienta Supabase
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Błąd: Nie załadowano skryptu Supabase!");
}

const defaultHomePlayers = ["1. NOWAK (GK)", "2. KOWALSKI", "3. ZIELIŃSKI", "4. WIŚNIEWSKI", "5. WÓJCIK", "6. KOWALCZYK", "7. KAMIŃSKI", "8. LEWANDOWSKI", "9. MILIK", "10. SZYMAŃSKI", "11. PIĄTEK", "TRENER: PROBIERZ"];
const defaultAwayPlayers = ["12. BORUC (GK)", "13. BEDNAREK", "14. KWIATKOWSKI", "15. MAJEWSKI", "16. PIOTROWSKI", "17. KRÓL", "18. JAWORSKI", "19. DUDA", "20. CHMIEL", "21. WRÓBEL", "22. SIKORA", "TRENER: SANTOS"];

let currentMatchState = {
    home_name: "HOME", away_name: "AWAY",
    home_score: 0, away_score: 0,
    match_time: 0, is_running: false,
    scorer_name: "", scorer_team: "home",
    show_goal_trigger: false, show_lineups: false
};

let timerInterval = null;

// ==========================================
// LOGIKA DLA OVERLAY.HTML (OBS)
// ==========================================
async function initOverlayView() {
    await fetchInitialState();
    updateHUDUI();
    if (currentMatchState.is_running) startLocalTimer();

    supabaseClient
        .channel('hud-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_state' }, payload => {
            const data = payload.new;
            
            if (data.show_goal_trigger && !currentMatchState.show_goal_trigger) {
                runGSAPGoalAnimation(data.scorer_name, data.scorer_team === 'home' ? data.home_name : data.away_name);
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
        })
        .subscribe();
}

function updateHUDUI() {
    document.getElementById('hud-home-name').innerText = currentMatchState.home_name;
    document.getElementById('hud-away-name').innerText = currentMatchState.away_name;
    document.getElementById('hud-home-score').innerText = currentMatchState.home_score;
    document.getElementById('hud-away-score').innerText = currentMatchState.away_score;
    document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);
}

function startLocalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        currentMatchState.match_time++;
        document.getElementById('hud-timer').innerText = formatTime(currentMatchState.match_time);
    }, 1000);
}

function renderLineupsStructures() {
    document.getElementById('home-players-list').innerHTML = defaultHomePlayers.map(p => `<li><span>✦</span>${p}</li>`).join('');
    document.getElementById('away-players-list').innerHTML = defaultAwayPlayers.map(p => `<li><span>✦</span>${p}</li>`).join('');
}

// GSAP ANIMACJE (60FPS FEEL)
function runGSAPGoalAnimation(scorer, teamName) {
    document.getElementById('goal-scorer').innerText = scorer || "ZAWODNIK";
    document.getElementById('goal-team').innerText = teamName;

    const overlay = document.getElementById('goal-overlay');
    const flash = overlay.querySelector('.goal-bg-flash');
    const ribbon = overlay.querySelector('.goal-ribbon');
    const title = overlay.querySelector('.goal-title');
    const details = overlay.querySelector('.goal-details');

    let tl = gsap.timeline({ onStart: () => { gsap.set(overlay, { visibility: 'visible', opacity: 1 }); } });

    tl.to(flash, { opacity: 1, duration: 0.1, yoyo: true, repeat: 3 })
      .to(ribbon, { scaleX: 1, duration: 0.4, ease: "power4.out" }, "-=0.2")
      .fromTo(title, { scale: 0, rotation: -5 }, { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(1.7)" }, "-=0.1")
      .fromTo(details, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.2")
      .to(ribbon, { x: 4, yoyo: true, repeat: 10, duration: 0.05 }, "-=0.3")
      .to({}, { duration: 4.5 })
      .to(details, { opacity: 0, y: -20, duration: 0.3 })
      .to(title, { opacity: 0, scale: 0.8, duration: 0.3 }, "-=0.2")
      .to(ribbon, { scaleX: 0, duration: 0.4, ease: "power4.in" }, "-=0.1")
      .to(overlay, { opacity: 0, duration: 0.3, onComplete: () => {
          gsap.set(overlay, { visibility: 'hidden' });
          resetGoalTriggerInDB();
      }});
}

function toggleGSAPLineups(show) {
    const container = document.getElementById('lineups-overlay');
    const leftCol = container.querySelector('.left-team');
    const rightCol = container.querySelector('.right-team');
    
    if (show) {
        gsap.set(container, { visibility: 'visible', opacity: 1 });
        gsap.fromTo(leftCol, { x: -200, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
        gsap.fromTo(rightCol, { x: 200, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.6");
    } else {
        gsap.to([leftCol, rightCol], { y: 100, opacity: 0, duration: 0.5, ease: "power3.in", onComplete: () => {
            gsap.set(container, { visibility: 'hidden', opacity: 0 });
        }});
    }
}

// ==========================================
// LOGIKA DLA CONTROL.HTML (PANEL)
// ==========================================
async function initControlPanel() {
    await fetchInitialState();
    updateControlPanelUI();
    
    const statusBadge = document.getElementById('db-status');
    statusBadge.innerText = "POŁĄCZONO";
    statusBadge.classList.add('connected');

    setInterval(() => {
        if (currentMatchState.is_running) {
            currentMatchState.match_time++;
            document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
        }
    }, 1000);

    supabaseClient
        .channel('panel-sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_state' }, payload => {
            currentMatchState = payload.new;
            updateControlPanelUI();
        })
        .subscribe();
}

function updateControlPanelUI() {
    document.getElementById('ctrl-home-name').value = currentMatchState.home_name;
    document.getElementById('ctrl-away-name').value = currentMatchState.away_name;
    document.getElementById('ctrl-home-score').innerText = currentMatchState.home_score;
    document.getElementById('ctrl-away-score').innerText = currentMatchState.away_score;
    document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
    
    const lineupBtn = document.getElementById('btn-lineup-toggle');
    if (lineupBtn) {
        lineupBtn.innerText = currentMatchState.show_lineups ? "UKRYJ SKŁADY" : "POKAŻ SKŁADY";
        lineupBtn.style.background = currentMatchState.show_lineups ? "#ff003c" : "#8a2be2";
    }
}

async function saveStateToSupabase() {
    await supabaseClient.from('match_state').update(currentMatchState).eq('id', 'live_match');
}

async function fetchInitialState() {
    let { data } = await supabaseClient.from('match_state').select('*').eq('id', 'live_match').single();
    if (data) currentMatchState = data;
}

function changeScore(team, val) {
    if (team === 'home') currentMatchState.home_score = Math.max(0, currentMatchState.home_score + val);
    else currentMatchState.away_score = Math.max(0, currentMatchState.away_score + val);
    saveStateToSupabase();
}

function updateMatchNames() {
    currentMatchState.home_name = document.getElementById('ctrl-home-name').value;
    currentMatchState.away_name = document.getElementById('ctrl-away-name').value;
    saveStateToSupabase();
}

function toggleTimer() {
    currentMatchState.is_running = !currentMatchState.is_running;
    saveStateToSupabase();
}

function resetTimer() {
    currentMatchState.is_running = false;
    currentMatchState.match_time = 0;
    saveStateToSupabase();
}

function toggleLineups() {
    currentMatchState.show_lineups = !currentMatchState.show_lineups;
    saveStateToSupabase();
}

function triggerGoalAnimation() {
    currentMatchState.scorer_name = document.getElementById('ctrl-scorer-name').value;
    currentMatchState.scorer_team = document.getElementById('ctrl-scorer-team').value;
    currentMatchState.show_goal_trigger = true;
    
    if (currentMatchState.scorer_team === 'home') currentMatchState.home_score++;
    else currentMatchState.away_score++;

    saveStateToSupabase();
}

async function resetGoalTriggerInDB() {
    await supabaseClient.from('match_state').update({ show_goal_trigger: false }).eq('id', 'live_match');
}

function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
