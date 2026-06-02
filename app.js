// =========================================================================
// 🌐 CONFIG I INICJALIZACJA SUPABASE (NAPRAWIONA NAZWA ZMIENNEJ)
// =========================================================================
const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCIpxjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

// Zmieniono nazwę na 'db', aby uniknąć konfliktu z globalnym obiektem window.supabase
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Status połączenia w panelu
async function checkDatabaseConnection() {
    try {
        const { data, error } = await db.from('match_state').select('id').eq('id', 1).single();
        const badge = document.getElementById('db-status');
        if (badge) {
            if (error) {
                badge.textContent = "BŁĄD TABELI";
                badge.className = "status-badge";
                badge.style.background = "#ff4757";
            } else {
                badge.textContent = "POŁĄCZONO";
                badge.className = "status-badge connected";
                badge.style.background = "#2ed573";
                loadCurrentMatchState();
            }
        }
    } catch (e) {
        console.error("Błąd połączenia z Supabase:", e);
    }
}

// Pobieranie aktualnego stanu do okienek panelu na start
async function loadCurrentMatchState() {
    const { data, error } = await db.from('match_state').select('*').eq('id', 1).single();
    if (data && !error) {
        document.getElementById('ctrl-home-score').textContent = data.home_score || 0;
        document.getElementById('ctrl-away-score').textContent = data.away_score || 0;
        document.getElementById('ctrl-timer').textContent = data.timer || "00:00";
        
        if (document.getElementById('ctrl-team-home-shots')) {
            document.getElementById('ctrl-team-home-shots').value = data.home_shots || 0;
            document.getElementById('ctrl-team-home-saves').value = data.home_saves || 0;
            document.getElementById('ctrl-team-home-fouls').value = data.home_fouls || 0;
            document.getElementById('ctrl-team-home-corners').value = data.home_corners || 0;
            
            document.getElementById('ctrl-team-away-shots').value = data.away_shots || 0;
            document.getElementById('ctrl-team-away-saves').value = data.away_saves || 0;
            document.getElementById('ctrl-team-away-fouls').value = data.away_fouls || 0;
            document.getElementById('ctrl-team-away-corners').value = data.away_corners || 0;
        }
    }
}

// =========================================================================
// ⚽ FUNKCJE STEROWANIA (ZABEZPIECZONE PRZED DUBLOWANIEM ZAPYTAŃ)
// =========================================================================

async function changeScore(team, val) {
    const element = document.getElementById(`ctrl-${team}-score`);
    let currentScore = parseInt(element.textContent) + val;
    if (isNaN(currentScore) || currentScore < 0) currentScore = 0;
    element.textContent = currentScore;

    const updateData = {};
    updateData[`${team}_score`] = currentScore;
    
    await db.from('match_state').update(updateData).eq('id', 1);
}

let timerInterval = null;
function toggleTimer() {
    const timerEl = document.getElementById('ctrl-timer');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    } else {
        let totalSec = 0;
        if (timerEl && timerEl.textContent && timerEl.textContent.includes(':')) {
            let timeParts = timerEl.textContent.split(':');
            let mins = parseInt(timeParts[0]) || 0;
            let secs = parseInt(timeParts[1]) || 0;
            totalSec = (mins * 60) + secs;
        }
        
        timerInterval = setInterval(async () => {
            totalSec++;
            let m = Math.floor(totalSec / 60).toString().padStart(2, '0');
            let s = (totalSec % 60).toString().padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
            await db.from('match_state').update({ timer: `${m}:${s}` }).eq('id', 1);
        }, 1000);
    }
}

async function resetTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    document.getElementById('ctrl-timer').textContent = "00:00";
    await db.from('match_state').update({ timer: "00:00" }).eq('id', 1);
}

async function swapTeams() {
    await db.from('match_state').update({ trigger_swap: true }).eq('id', 1);
    setTimeout(async () => {
        await db.from('match_state').update({ trigger_swap: false }).eq('id', 1);
    }, 2000);
}

async function updateMatchNames() {
    const data = {
        home_name: document.getElementById('ctrl-home-name').value,
        home_logo: document.getElementById('ctrl-home-logo').value,
        home_color: document.getElementById('ctrl-home-color').value,
        home_coach: document.getElementById('ctrl-home-coach').value,
        home_subs: document.getElementById('ctrl-home-subs').value,
        home_p1: document.getElementById('ctrl-home-p1').value,
        home_p2: document.getElementById('ctrl-home-p2').value,
        home_p3: document.getElementById('ctrl-home-p3').value,
        home_p4: document.getElementById('ctrl-home-p4').value,
        home_p5: document.getElementById('ctrl-home-p5').value,
        
        away_name: document.getElementById('ctrl-away-name').value,
        away_logo: document.getElementById('ctrl-away-logo').value,
        away_color: document.getElementById('ctrl-away-color').value,
        away_coach: document.getElementById('ctrl-away-coach').value,
        away_subs: document.getElementById('ctrl-away-subs').value,
        away_p1: document.getElementById('ctrl-away-p1').value,
        away_p2: document.getElementById('ctrl-away-p2').value,
        away_p3: document.getElementById('ctrl-away-p3').value,
        away_p4: document.getElementById('ctrl-away-p4').value,
        away_p5: document.getElementById('ctrl-away-p5').value,
        
        lineups_display_team: document.getElementById('ctrl-lineups-team').value
    };
    await db.from('match_state').update(data).eq('id', 1);
}

async function toggleLineups() {
    const { data } = await db.from('match_state').select('show_lineups').eq('id', 1).single();
    await db.from('match_state').update({ show_lineups: !data.show_lineups }).eq('id', 1);
}

let isGoalAnimating = false;
async function triggerGoalAnimation() {
    if (isGoalAnimating) return;
    isGoalAnimating = true;

    const scorer = document.getElementById('ctrl-scorer-name').value;
    const team = document.getElementById('ctrl-scorer-team').value;
    
    const element = document.getElementById(`ctrl-${team}-score`);
    let currentScore = parseInt(element.textContent) + 1;
    if (isNaN(currentScore)) currentScore = 1;
    element.textContent = currentScore;
    
    const updateData = {
        goal_trigger: true,
        last_scorer: scorer,
        last_score_team: team
    };
    updateData[`${team}_score`] = currentScore;
    
    await db.from('match_state').update(updateData).eq('id', 1);
    
    setTimeout(async () => {
        await db.from('match_state').update({ goal_trigger: false }).eq('id', 1);
        isGoalAnimating = false;
    }, 5000);
}

let isSubAnimating = false;
async function triggerSubAnimation() {
    if (isSubAnimating) return;
    isSubAnimating = true;

    const subOut = document.getElementById('ctrl-sub-out').value;
    const subIn = document.getElementById('ctrl-sub-in').value;
    const team = document.getElementById('ctrl-sub-team').value;
    
    await db.from('match_state').update({
        sub_trigger: true,
        sub_out: subOut,
        sub_in: subIn,
        sub_team: team
    }).eq('id', 1);
    
    setTimeout(async () => {
        await db.from('match_state').update({ sub_trigger: false }).eq('id', 1);
        isSubAnimating = false;
    }, 6000);
}

async function updatePlayerStatsData() {
    const data = {
        stat_player_name: document.getElementById('ctrl-stat-player-name').value,
        stat_player_team: document.getElementById('ctrl-stat-player-team').value,
        stat_shots: parseInt(document.getElementById('ctrl-stat-shots').value) || 0,
        stat_passes: parseInt(document.getElementById('ctrl-stat-passes').value) || 0,
        stat_goals: parseInt(document.getElementById('ctrl-stat-goals').value) || 0,
        stat_assists: parseInt(document.getElementById('ctrl-stat-assists').value) || 0
    };
    await db.from('match_state').update(data).eq('id', 1);
}

async function togglePlayerStatsOverlay() {
    const { data } = await db.from('match_state').select('show_player_stats').eq('id', 1).single();
    await db.from('match_state').update({ show_player_stats: !data.show_player_stats }).eq('id', 1);
}

async function toggleSummaryOverlay() {
    const { data } = await db.from('match_state').select('show_summary').eq('id', 1).single();
    await db.from('match_state').update({ show_summary: !data.show_summary }).eq('id', 1);
}

async function updateTeamStatsData() {
    const updateData = {
        home_shots: parseInt(document.getElementById('ctrl-team-home-shots').value) || 0,
        home_saves: parseInt(document.getElementById('ctrl-team-home-saves').value) || 0,
        home_fouls: parseInt(document.getElementById('ctrl-team-home-fouls').value) || 0,
        home_corners: parseInt(document.getElementById('ctrl-team-home-corners').value) || 0,
        away_shots: parseInt(document.getElementById('ctrl-team-away-shots').value) || 0,
        away_saves: parseInt(document.getElementById('ctrl-team-away-saves').value) || 0,
        away_fouls: parseInt(document.getElementById('ctrl-team-away-fouls').value) || 0,
        away_corners: parseInt(document.getElementById('ctrl-team-away-corners').value) || 0
    };
    await db.from('match_state').update(updateData).eq('id', 1);
}


// =========================================================================
// 🤖 AUTOMATYCZNY ANALYZER MECZÓW (.HBR / .HBR2)
// =========================================================================

function initHbrAnalyzer() {
    const dropZone = document.getElementById('hbr-drop-zone');
    const msgBox = document.getElementById('analyzer-msg');

    if (!dropZone) return; 

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) handleHbrFile(files[0]);
    });

    dropZone.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.hbr,.hbr2';
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) handleHbrFile(e.target.files[0]);
        };
        fileInput.click();
    });

    function showStatus(text, type) {
        msgBox.textContent = text;
        msgBox.className = `analyzer-status ${type}`;
        msgBox.style.display = 'block';
        if (type === 'success' && !text.includes('⏳')) {
            setTimeout(() => { msgBox.style.display = 'none'; }, 6000);
        }
    }

    function handleHbrFile(file) {
        if (!file.name.endsWith('.hbr') && !file.name.endsWith('.hbr2')) {
            showStatus("❌ Błąd: To nie jest prawidłowy plik powtórki Haxball (.hbr / .hbr2)!", "error");
            return;
        }

        showStatus("⏳ Analizowanie powtórki i przeliczanie fizyki meczu...", "success");

        const reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onloadend = async function() {
            try {
                if (!window.HbrParser || typeof window.HbrParser.parse !== 'function') {
                    throw new Error("Skrypt 'hbr-parser.js' nie został jeszcze w pełni załadowany. Odśwież stronę przez CTRL+F5.");
                }

                const result = window.HbrParser.parse(reader.result);
                
                if (result && result.valid) {
                    const minutes = Math.floor(result.match_time / 60).toString().padStart(2, '0');
                    const seconds = (result.match_time % 60).toString().padStart(2, '0');
                    const formattedTime = `${minutes}:${seconds}`;

                    document.getElementById('ctrl-timer').textContent = formattedTime;
                    
                    document.getElementById('ctrl-team-home-shots').value = result.team_stats.home.shots;
                    document.getElementById('ctrl-team-home-saves').value = result.team_stats.home.saves;
                    document.getElementById('ctrl-team-home-fouls').value = result.team_stats.home.fouls;
                    document.getElementById('ctrl-team-home-corners').value = result.team_stats.home.corners;

                    document.getElementById('ctrl-team-away-shots').value = result.team_stats.away.shots;
                    document.getElementById('ctrl-team-away-saves').value = result.team_stats.away.saves;
                    document.getElementById('ctrl-team-away-fouls').value = result.team_stats.away.fouls;
                    document.getElementById('ctrl-team-away-corners').value = result.team_stats.away.corners;

                    const { error } = await db
                        .from('match_state') 
                        .update({
                            timer: formattedTime,
                            home_shots: result.team_stats.home.shots,
                            home_saves: result.team_stats.home.saves,
                            home_fouls: result.team_stats.home.fouls,
                            home_corners: result.team_stats.home.corners,
                            away_shots: result.team_stats.away.shots,
                            away_saves: result.team_stats.away.saves,
                            away_fouls: result.team_stats.away.fouls,
                            away_corners: result.team_stats.away.corners
                        })
                        .eq('id', 1);

                    if (error) throw error;

                    showStatus(`✅ Sukces! Plik .hbr2 przeanalizowany. Czas meczu: ${formattedTime}. Statystyki wysłane do OBS!`, "success");
                }
            } catch (err) {
                console.error("Błąd podczas działania parsera:", err);
                showStatus("❌ Błąd podczas przetwarzania pliku powtórki: " + err.message, "error");
            }
        };
    }
}

// Globalne wystawienie funkcji sterujących dla systemu HTML (onclick)
window.changeScore = changeScore;
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;
window.swapTeams = swapTeams;
window.updateMatchNames = updateMatchNames;
window.toggleLineups = toggleLineups;
window.triggerGoalAnimation = triggerGoalAnimation;
window.triggerSubAnimation = triggerSubAnimation;
window.updatePlayerStatsData = updatePlayerStatsData;
window.togglePlayerStatsOverlay = togglePlayerStatsOverlay;
window.toggleSummaryOverlay = toggleSummaryOverlay;
window.updateTeamStatsData = updateTeamStatsData;

// Inicjalizacja bazy i analyzera po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    checkDatabaseConnection();
    initHbrAnalyzer();
});
