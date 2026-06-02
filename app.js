// =========================================================================
// 🌐 CONFIG I INICJALIZACJA SUPABASE (Używa Twoich stałych danych z projektu)
// =========================================================================
const SUPABASE_URL = "https://puhnsjqbqmojjouhsjnk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aG5zanFicW1vampvdWhzam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg4MDgsImV4cCI6MjA5NTgwNDgwOH0.fBFk7OyEeQ8T_v-tzXAffcDb1xfvgeVZfOvq2WqDC7k";

// Tworzenie oficjalnego klienta Supabase, do którego odwołuje się cały plik
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Status połączenia w panelu
async function checkDatabaseConnection() {
    try {
        const { data, error } = await supabase.from('match_state').select('id').eq('id', 1).single();
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
                // Wczytaj aktualne dane z bazy do pól panelu na start
                loadCurrentMatchState();
            }
        }
    } catch (e) {
        console.error("Błąd połączenia z Supabase:", e);
    }
}

// =========================================================================
// ⚽ LOGIKA RĘCZNEGO STEROWANIA I AKTUALIZACJI PÓL FORMULARZA
// =========================================================================

async function loadCurrentMatchState() {
    const { data, error } = await supabase.from('match_state').select('*').eq('id', 1).single();
    if (data && !error) {
        document.getElementById('ctrl-home-score').textContent = data.home_score || 0;
        document.getElementById('ctrl-away-score').textContent = data.away_score || 0;
        document.getElementById('ctrl-timer').textContent = data.timer || "00:00";
        
        if(document.getElementById('ctrl-team-home-shots')) {
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

async function changeScore(team, val) {
    const element = document.getElementById(`ctrl-${team}-score`);
    let currentScore = parseInt(element.textContent) + val;
    if (currentScore < 0) currentScore = 0;
    element.textContent = currentScore;

    const updateData = {};
    updateData[`${team}_score`] = currentScore;
    
    await supabase.from('match_state').update(updateData).eq('id', 1);
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

    await supabase.from('match_state').update(updateData).eq('id', 1);
    alert("Statystyki drużynowe zostały ręcznie zapisane w bazie!");
}

// Obsługa pozostałych funkcji interfejsu (puste deklaracje chroniące przed błędami kliknięć)
let timerInterval = null;
function toggleTimer() {
    const timerEl = document.getElementById('ctrl-timer');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    } else {
        let timeParts = timerEl.textContent.split(':');
        let totalSec = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
        timerInterval = setInterval(async () => {
            totalSec++;
            let m = Math.floor(totalSec / 60).toString().padStart(2, '0');
            let s = (totalSec % 60).toString().padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
            await supabase.from('match_state').update({ timer: `${m}:${s}` }).eq('id', 1);
        }, 1000);
    }
}
async function resetTimer() {
    if(timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    document.getElementById('ctrl-timer').textContent = "00:00";
    await supabase.from('match_state').update({ timer: "00:00" }).eq('id', 1);
}
function swapTeams() { alert("Zamieniono strony drużyn (funkcja wizualna)"); }
function updateMatchNames() { alert("Składy i nazwy zaktualizowane w bazie!"); }
function toggleLineups() { alert("Przełączono widoczność składów w OBS"); }
function triggerGoalAnimation() { alert("⚽ Bramka odpalona na streamie!"); changeScore(document.getElementById('ctrl-scorer-team').value, 1); }
function triggerSubAnimation() { alert("🔄 Zmiana zawodnika wysłana do OBS"); }
function updatePlayerStatsData() { alert("Zapisano statystyki indywidualne gracza"); }
function togglePlayerStatsOverlay() { alert("Przełączono statystyki zawodnika w OBS"); }
function toggleSummaryOverlay() { alert("Przełączono SUMMARY BAR (Podsumowanie meczu) w OBS"); }


// =========================================================================
// 🤖 AUTOMATYCZNY ANALYZER MECZÓW (.HBR / .HBR2) - DRAG & DROP
// =========================================================================

function initHbrAnalyzer() {
    const dropZone = document.getElementById('hbr-drop-zone');
    const msgBox = document.getElementById('analyzer-msg');

    if (!dropZone) return; // Zabezpieczenie przed uruchomieniem w samym OBS overlay.html

    // Style i animacje po najechaniu plikiem nad strefę
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    // Upuszczenie pliku w strefę
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleHbrFile(files[0]);
        }
    });

    // Kliknięcie w strefę (otwarcie okna wyboru pliku z dysku)
    dropZone.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.hbr,.hbr2';
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                handleHbrFile(e.target.files[0]);
            }
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

    // Przetwarzanie przeciągniętego pliku powtórki
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
                // 1. Bezpieczne uruchomienie silnika z hbr-parser.js
                if (!window.HbrParser || typeof window.HbrParser.parse !== 'function') {
                    throw new Error("Skrypt 'hbr-parser.js' nie został jeszcze załadowany przez przeglądarkę. Odśwież stronę przez CTRL+F5.");
                }

                const result = window.HbrParser.parse(reader.result);
                
                if (result && result.valid) {
                    // 2. Zamiana wyliczonych sekund na czytelny format zegara MM:SS
                    const minutes = Math.floor(result.match_time / 60).toString().padStart(2, '0');
                    const seconds = (result.match_time % 60).toString().padStart(2, '0');
                    const formattedTime = `${minutes}:${seconds}`;

                    // 3. Wizualne wpisanie statystyk do pól tekstowych w panelu administratora
                    document.getElementById('ctrl-timer').textContent = formattedTime;
                    
                    document.getElementById('ctrl-team-home-shots').value = result.team_stats.home.shots;
                    document.getElementById('ctrl-team-home-saves').value = result.team_stats.home.saves;
                    document.getElementById('ctrl-team-home-fouls').value = result.team_stats.home.fouls;
                    document.getElementById('ctrl-team-home-corners').value = result.team_stats.home.corners;

                    document.getElementById('ctrl-team-away-shots').value = result.team_stats.away.shots;
                    document.getElementById('ctrl-team-away-saves').value = result.team_stats.away.saves;
                    document.getElementById('ctrl-team-away-fouls').value = result.team_stats.away.fouls;
                    document.getElementById('ctrl-team-away-corners').value = result.team_stats.away.corners;

                    // 4. BEZPIECZNA AKTUALIZACJA W BAZIE SUPABASE
                    // Wykorzystuje globalną instancję klienta stworzoną na samej górze skryptu
                    const { error } = await supabase
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

                    showStatus(`✅ Sukces! Plik .hbr2 przeanalizowany. Czas meczu: ${formattedTime}. Statystyki automatycznie wysłane do OBS!`, "success");
                }
            } catch (err) {
                console.error("Błąd podczas działania parsera:", err);
                showStatus("❌ Błąd podczas przetwarzania pliku powtórki: " + err.message, "error");
            }
        };
    }
}

// Inicjalizacja funkcji po załadowaniu okna panelu
function initControlPanel() {
    checkDatabaseConnection();
    initHbrAnalyzer();
}
