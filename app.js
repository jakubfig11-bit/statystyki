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
    sub_out: "", sub_in: "", sub_team: "home", show_sub_trigger: false,
    show_summary_ht: false, show_summary_ft: false,
    home_scorers_list: "", away_scorers_list: ""
};

let timerInterval = null;
let updateCallback = null;

async function initLiveSync(onUpdateFn) {
    updateCallback = onUpdateFn;
    if (!supabaseClient) {
        console.error("Supabase Client nie został zainicjalizowany!");
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('match_state').select('*').eq('id', 1).single();
        if (!error && data) {
            currentMatchState = data;
            if (updateCallback) updateCallback(currentMatchState);
            handleTimerInterval();
        } else if (error) {
            console.error("Błąd pobierania stanu początkowego:", error);
        }
    } catch (err) {
        console.error("Wyjątek podczas pobierania stanu:", err);
    }

    supabaseClient.channel('public:match_state')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_state', filter: 'id=eq.1' }, payload => {
            if (payload && payload.new) {
                currentMatchState = payload.new;
                if (updateCallback) updateCallback(currentMatchState);
                handleTimerInterval();
            }
        })
        .subscribe((status) => {
            console.log("Status subskrypcji kanału:", status);
            if (status === 'SUBSCRIBED') {
                if (updateCallback) updateCallback(currentMatchState);
            }
        });
}

function handleTimerInterval() {
    if (currentMatchState.is_running) {
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                currentMatchState.match_time++;
                if (updateCallback) updateCallback(currentMatchState);
            }, 1000);
        }
    } else {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }
}

async function saveState() {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('match_state').update(currentMatchState).eq('id', 1);
    } catch (err) {
        console.error("Błąd podczas zapisywania stanu do Supabase:", err);
    }
}

// Funkcje pomocnicze z wymuszonym odświeżeniem UI
function updateField(field, value) {
    currentMatchState[field] = value;
    if (updateCallback) updateCallback(currentMatchState); // UI odświeża się natychmiast
    saveState();
}

function updateLineupField(fieldKey, value) {
    const currentTeam = currentMatchState.lineups_team || 'home';
    const finalKey = `${currentTeam}_${fieldKey}`;
    currentMatchState[finalKey] = value;
    if (updateCallback) updateCallback(currentMatchState); // UI odświeża się natychmiast
    saveState();
}

function modifyScore(team, amount) {
    if (team === 'home') {
        currentMatchState.home_score = Math.max(0, currentMatchState.home_score + amount);
    } else {
        currentMatchState.away_score = Math.max(0, currentMatchState.away_score + amount);
    }
    if (updateCallback) updateCallback(currentMatchState); // UI odświeża się natychmiast
    saveState();
}

function toggleTimer() {
    currentMatchState.is_running = !currentMatchState.is_running;
    if (updateCallback) updateCallback(currentMatchState); // UI odświeża się natychmiast
    saveState();
}

function resetTimer() {
    currentMatchState.match_time = 0;
    currentMatchState.is_running = false;
    if (updateCallback) updateCallback(currentMatchState); // UI odświeża się natychmiast
    saveState();
}

function setMatchTime(seconds) {
    currentMatchState.match_time = seconds;
    if (updateCallback) updateCallback(currentMatchState);
    saveState();
}

function triggerGoalAnimation() {
    const nameInput = document.getElementById('ctrl-scorer-name');
    const teamSelect = document.getElementById('ctrl-scorer-team');
    if (!nameInput) return;

    const scorerName = nameInput.value.trim() || "ZAWODNIK";
    const scorerTeam = teamSelect ? teamSelect.value : "home";
    const currentMin = Math.floor(currentMatchState.match_time / 60);

    currentMatchState.scorer_name = scorerName;
    currentMatchState.scorer_team = scorerTeam;
    currentMatchState.show_goal_trigger = true;

    if (scorerTeam === 'home') {
        currentMatchState.home_score++;
        let currentScorers = currentMatchState.home_scorers_list ? currentMatchState.home_scorers_list.split(', ') : [];
        currentScorers.push(`${scorerName} ${currentMin}'`);
        currentMatchState.home_scorers_list = currentScorers.filter(x => x).join(', ');
    } else {
        currentMatchState.away_score++;
        let currentScorers = currentMatchState.away_scorers_list ? currentMatchState.away_scorers_list.split(', ') : [];
        currentScorers.push(`${scorerName} ${currentMin}'`);
        currentMatchState.away_scorers_list = currentScorers.filter(x => x).join(', ');
    }
    
    if (updateCallback) updateCallback(currentMatchState); // UI odświeża się natychmiast
    saveState();
    nameInput.value = "";

    setTimeout(async () => {
        try {
            const { data } = await supabaseClient.from('match_state').select('show_goal_trigger').eq('id', 1).single();
            if (data && data.show_goal_trigger) {
                currentMatchState.show_goal_trigger = false;
                if (updateCallback) updateCallback(currentMatchState);
                saveState();
            }
        } catch (e) {
            console.error(e);
        }
    }, 7000);
}

function triggerSubstitutionAnimation() {
    currentMatchState.show_sub_trigger = true;
    if (updateCallback) updateCallback(currentMatchState);
    saveState();

    setTimeout(async () => {
        try {
            const { data } = await supabaseClient.from('match_state').select('show_sub_trigger').eq('id', 1).single();
            if (data && data.show_sub_trigger) {
                currentMatchState.show_sub_trigger = false;
                if (updateCallback) updateCallback(currentMatchState);
                saveState();
            }
        } catch (e) {
            console.error(e);
        }
    }, 7000);
}

function toggleLineupsAnimation() {
    currentMatchState.show_lineups = !currentMatchState.show_lineups;
    if (updateCallback) updateCallback(currentMatchState);
    saveState();
}

function toggleSummaryBoard(type) {
    if (type === 'ht') {
        currentMatchState.show_summary_ht = !currentMatchState.show_summary_ht;
        if (currentMatchState.show_summary_ht) currentMatchState.show_summary_ft = false;
    } else if (type === 'ft') {
        currentMatchState.show_summary_ft = !currentMatchState.show_summary_ft;
        if (currentMatchState.show_summary_ft) currentMatchState.show_summary_ht = false;
    }
    if (updateCallback) updateCallback(currentMatchState);
    saveState();
}

function clearMatchData() {
    if (confirm("Czy na pewno chcesz wyczyścić historię goli, strzelców i minut?")) {
        currentMatchState.home_scorers_list = "";
        currentMatchState.away_scorers_list = "";
        currentMatchState.scorer_name = "";
        currentMatchState.show_goal_trigger = false;
        currentMatchState.show_sub_trigger = false;
        currentMatchState.show_summary_ht = false;
        currentMatchState.show_summary_ft = false;
        if (updateCallback) updateCallback(currentMatchState);
        saveState();
    }
}

function swapTeams() {
    if (!confirm("Czy chcesz zamienić drużyny stronami (SWAP)?")) return;

    const tempState = { ...currentMatchState };

    currentMatchState.home_name = tempState.away_name;
    currentMatchState.away_name = tempState.home_name;
    currentMatchState.home_score = tempState.away_score;
    currentMatchState.away_score = tempState.home_score;
    currentMatchState.home_logo = tempState.away_logo;
    currentMatchState.away_logo = tempState.home_logo;
    currentMatchState.home_color = tempState.away_color;
    currentMatchState.away_color = tempState.home_color;
    currentMatchState.home_scorers_list = tempState.away_scorers_list;
    currentMatchState.away_scorers_list = tempState.home_scorers_list;
    currentMatchState.home_coach = tempState.away_coach;
    currentMatchState.away_coach = tempState.home_coach;
    currentMatchState.home_subs = tempState.away_subs;
    currentMatchState.away_subs = tempState.home_subs;

    for (let i = 1; i <= 5; i++) {
        currentMatchState[`home_p${i}`] = tempState[`away_p${i}`];
        currentMatchState[`away_p${i}`] = tempState[`home_p${i}`];
    }

    if (tempState.sub_team === 'home') currentMatchState.sub_team = 'away';
    if (tempState.sub_team === 'away') currentMatchState.sub_team = 'home';
    if (tempState.lineups_team === 'home') currentMatchState.lineups_team = 'away';
    if (tempState.lineups_team === 'away') currentMatchState.lineups_team = 'home';

    if (updateCallback) updateCallback(currentMatchState);
    saveState();
}

function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
