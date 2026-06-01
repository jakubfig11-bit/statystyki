// ==========================================
// KONFIGURACJA SUPABASE (Zgodnie z wymogiem)
// ==========================================
const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

const supabase = {
    client: null,
    init: function() {
        if (typeof window.supabase !== 'undefined') {
            this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            console.error("Błąd: Nie załadowano biblioteki Supabase Client SDK!");
        }
    }
};
supabase.init();

// Statyczna lista graczy do prezentacji składu (Lineups)
const defaultHomePlayers = ["1. NOWAK (GK)", "2. KOWALSKI", "3. ZIELIŃSKI", "4. WIŚNIEWSKI", "5. WÓJCIK", "6. KOWALCZYK", "7. KAMIŃSKI", "8. LEWANDOWSKI", "9. ZIELIŃSKI", "10. SZYMAŃSKI", "11. PIĄTEK", "TRENER: PROBIERZ"];
const defaultAwayPlayers = ["12. BORUC (GK)", "13. BEDNAREK", "14. KWIATKOWSKI", "15. MAJEWSKI", "16. PIOTROWSKI", "17. KRÓL", "18. JAWORSKI", "19. DUDA", "20. CHMIEL", "21. WRÓBEL", "22. SIKORA", "TRENER: SANTOS"];

// Stan lokalny aplikacji (Synchronizowany z bazą)
let currentMatchState = {
    home_name: "HOME", away_name: "AWAY",
    home_score: 0, away_score: 0,
    match_time: 0, is_running: false,
    scorer_name: "", scorer_team: "home",
    show_goal_trigger: false, show_lineups: false
};

let timerInterval = null;

// ==========================================
// SYSTEM INICJALIZACJI TRYBU (OBS vs CONTROL)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'control') {
        document.getElementById('control-view').classList.remove('hidden');
        initControlPanel();
    } else {
        // Domyślnie działa jako overlay w OBS (?mode=overlay lub brak parametru)
        document.getElementById('overlay-view').classList.remove('hidden');
        renderLineupsStructures();
        initOverlayView();
    }
});

// ==========================================
// SEKCJA: OVERLAY VIEW (Logika OBS)
// ==========================================
function initOverlayView() {
    // Pobranie stanu początkowego z Supabase
    fetchInitialState().then(() => {
        updateHUDUI();
        if (currentMatchState.is_running) startLocalTimer();
    });

    // Subskrypcja zmian w bazie w czasie rzeczywistym (Realtime)
    supabase.client
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_state' }, payload => {
            const data = payload.new;
            
            // Sprawdzenie wyzwalacza animacji gola
            if (data.show_goal_trigger && !currentMatchState.show_goal_trigger) {
                runGSAPGoalAnimation(data.scorer_name, data.scorer_team === 'home' ? data.home_name : data.away_name);
            }
            
            // Sprawdzenie przełącznika składów
            if (data.show_lineups !== currentMatchState.show_lineups) {
                toggleGSAPLineups(data.show_lineups);
            }

            // Aktualizacja timera
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
    const homeList = document.getElementById('home-players-list');
    const awayList = document.getElementById('away-players-list');
    
    homeList.innerHTML = defaultHomePlayers.map(p => `<li><span>✦</span>${p}</li>`).join('');
    awayList.innerHTML = defaultAwayPlayers.map(p => `<li><span>✦</span>${p}</li>`).join('');
}

// ==========================================
// MOTION DESIGN: ANIMACJE GSAP (60FPS FEEL)
// ==========================================
function runGSAPGoalAnimation(scorer, teamName) {
    document.getElementById('goal-scorer').innerText = scorer || "Niezidentyfikowany zawodnik";
    document.getElementById('goal-team').innerText = teamName;

    const overlay = document.getElementById('goal-overlay');
    const flash = overlay.querySelector('.goal-bg-flash');
    const ribbon = overlay.querySelector('.goal-ribbon');
    const title = overlay.querySelector('.goal-title');
    const details = overlay.querySelector('.goal-details');

    let tl = gsap.timeline({
        onStart: () => { gsap.set(overlay, { visibility: 'visible', opacity: 1 }); }
    });

    // Sekwencja wejścia (Dynamiczne uderzenie i rozbłysk)
    tl.to(flash, { opacity: 1, duration: 0.1, yoyo: true, repeat: 3 })
      .to(ribbon, { scaleX: 1, duration: 0.4, ease: "power4.out" }, "-=0.2")
      .fromTo(title, { scale: 0, rotation: -5 }, { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(1.7)" }, "-=0.1")
      .fromTo(details, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.2")
      // Efekt potrząsania ekranem (Camera Shake)
      .to(ribbon, { x: 4, yoyo: true, repeat: 10, duration: 0.05 }, "-=0.3")
      // Czas trwania planszy gola
      .to({}, { duration: 4.5 })
      // Piękne wyjście kinowe
      .to(details, { opacity: 0, y: -20, duration: 0.3 })
      .to(title, { opacity: 0, scale: 0.8, duration: 0.3 }, "-=0.2")
      .to(ribbon, { scaleX: 0, duration: 0.4, ease: "power4.in" }, "-=0.1")
      .to(overlay, { opacity: 0, duration: 0.3, onComplete: () => {
          gsap.set(overlay, { visibility: 'hidden' });
          // Reset flagi w bazie za pomocą panelu, żeby móc wyzwolić ponownie
          resetGoalTriggerInDB();
      }});
}

function toggleGSAPLineups(show) {
    const container = document.getElementById('lineups-overlay');
    const leftCol = container.querySelector('.left-team');
    const rightCol = container.querySelector('.right-team');
    const leftItems = leftCol.querySelectorAll('li');
    const rightItems = rightCol.querySelectorAll('li');

    if (show) {
        gsap.set(container, { visibility: 'visible', opacity: 1 });
        
        // Wejście lewej kolumny ze Staggerem elementów
        gsap.fromTo(leftCol, { x: -200, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
        gsap.fromTo(leftItems, { x: -50, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.04, duration: 0.4, ease: "power2.out" }, "-=0.3");

        // Wejście prawej kolumny ze Staggerem elementów
        gsap.fromTo(rightCol, { x: 200, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.6");
        gsap.fromTo(rightItems, { x: 50, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.04, duration: 0.4, ease: "power2.out" }, "-=0.3");
    } else {
        // Szybkie kinowe zebranie ekranu
        gsap.to([leftCol, rightCol], { y: 100, opacity: 0, duration: 0.5, ease: "power3.in", onComplete: () => {
            gsap.set(container, { visibility: 'hidden', opacity: 0 });
        }});
    }
}


// ==========================================
// SEKCJA: CONTROL PANEL (Panel Sterowania)
// ==========================================
async function initControlPanel() {
    await fetchInitialState();
    updateControlPanelUI();
    document.getElementById('db-status').innerText = "POŁĄCZONO";
    document.getElementById('db-status').classList.add('connected');

    // Aktualizacja UI panelu co sekundę, jeśli czas leci
    setInterval(() => {
        if (currentMatchState.is_running) {
            currentMatchState.match_time++;
            document.getElementById('ctrl-timer').innerText = formatTime(currentMatchState.match_time);
        }
    }, 1000);

    // Nasłuchiwanie zmian z zewnątrz na wypadek pracy na dwa ekrany
    supabase.client
        .channel('control-db-sync')
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
    if (currentMatchState.show_lineups) {
        lineupBtn.innerText = "UKRYJ SKŁADY";
        lineupBtn.style.background = "#ff003c";
    } else {
        lineupBtn.innerText = "POKAŻ SKŁADY";
        lineupBtn.style.background = "#8a2be2";
    }
}

// Interakcja z bazą danych (Zapisywanie stanu)
async function saveStateToSupabase() {
    await supabase.client
        .from('match_state')
        .update({
            home_name: currentMatchState.home_name,
            away_name: currentMatchState.away_name,
            home_score: currentMatchState.home_score,
            away_score: currentMatchState.away_score,
            match_time: currentMatchState.match_time,
            is_running: currentMatchState.is_running,
            show_goal_trigger: currentMatchState.show_goal_trigger,
            show_lineups: currentMatchState.show_lineups,
            scorer_name: currentMatchState.scorer_name,
            scorer_team: currentMatchState.scorer_team
        })
        .eq('id', 'live_match');
}

async function fetchInitialState() {
    let { data } = await supabase.client.from('match_state').select('*').eq('id', 'live_match').single();
    if (data) currentMatchState = data;
}

// Metody modyfikujące wywoływane z przycisków HTML HTML
function changeScore(team, val) {
    if (team === 'home') {
        currentMatchState.home_score = Math.max(0, currentMatchState.home_score + val);
    } else {
        currentMatchState.away_score = Math.max(0, currentMatchState.away_score + val);
    }
    document.getElementById(`ctrl-${team}-score`).innerText = currentMatchState[`${team}_score`];
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
    document.getElementById('ctrl-timer').innerText = "00:00";
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
    
    // Automatycznie zwiększ wynik w panelu dla wybranej drużyny
    if (currentMatchState.scorer_team === 'home') currentMatchState.home_score++;
    else currentMatchState.away_score++;

    saveStateToSupabase();
}

async function resetGoalTriggerInDB() {
    // Bezpieczne zerowanie flagi triggera, by można było strzelić kolejnego gola
    await supabase.client.from('match_state').update({ show_goal_trigger: false }).eq('id', 'live_match');
}

// Helper: Formatowanie sekund do formatu MM:SS
function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
