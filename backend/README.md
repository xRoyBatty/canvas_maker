# PHP Backend dla Leaderboard

Prosty backend bez bazy danych - zapisuje wyniki do JSON.

## ✅ Funkcje

- Zapisywanie wyników do `scores.json`
- Ranking top 20 uczniów
- Rate limiting (1 submission na 60s na IP)
- Walidacja danych
- CORS enabled (działa z dowolnej domeny)
- Bez bazy danych - tylko pliki JSON

## 📦 Instalacja

### Opcja 1: Apache z PHP

```bash
# 1. Zainstaluj Apache i PHP
sudo apt update
sudo apt install apache2 php libapache2-mod-php

# 2. Skopiuj backend do /var/www/html/api/
sudo mkdir -p /var/www/html/api
sudo cp backend/* /var/www/html/api/

# 3. Ustaw uprawnienia
sudo chown -R www-data:www-data /var/www/html/api
sudo chmod 664 /var/www/html/api/*.json 2>/dev/null || true

# 4. Restart Apache
sudo systemctl restart apache2
```

Backend dostępny: `http://twój-vps/api/leaderboard.php`

### Opcja 2: Nginx z PHP-FPM

```bash
# 1. Zainstaluj Nginx i PHP-FPM
sudo apt update
sudo apt install nginx php-fpm

# 2. Skopiuj backend
sudo mkdir -p /var/www/html/api
sudo cp backend/* /var/www/html/api/

# 3. Konfiguracja Nginx (/etc/nginx/sites-available/quiz)
server {
    listen 80;
    server_name twoja-domena.com;

    root /var/www/html;
    index quiz.html;

    # Quiz HTML
    location / {
        try_files $uri $uri/ =404;
    }

    # PHP Backend
    location /api/ {
        try_files $uri $uri/ =404;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/var/run/php/php8.1-fpm.sock; # Sprawdź wersję PHP
        }
    }

    # Zabezpieczenie JSON
    location ~ /api/.*\.json$ {
        deny all;
    }
}

# 4. Aktywuj konfigurację
sudo ln -s /etc/nginx/sites-available/quiz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 5. Ustaw uprawnienia
sudo chown -R www-data:www-data /var/www/html/api
```

Backend dostępny: `http://twoja-domena.com/api/leaderboard.php`

## 🔧 Konfiguracja Quizu

Edytuj `interactive_quiz.html` i zmień:

```javascript
// Na początku pliku, dodaj konfigurację API
const LEADERBOARD_API = 'http://twój-vps/api/leaderboard.php'; // ZMIEŃ NA SWÓJ URL
const USE_BACKEND = true; // Ustaw na true aby włączyć backend
```

Następnie znajdź funkcję `updateLeaderboard()` i zamień na:

```javascript
async function updateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<p class="text-gray-400 text-sm">Ładowanie...</p>';

    if (!USE_BACKEND) {
        // Użyj lokalnego leaderboard (jak dotychczas)
        renderLeaderboard(leaderboard);
        return;
    }

    try {
        const response = await fetch(LEADERBOARD_API);
        const data = await response.json();

        if (data.success) {
            renderLeaderboard(data.scores);
        } else {
            throw new Error('Failed to load leaderboard');
        }
    } catch (error) {
        console.error('Leaderboard error:', error);
        list.innerHTML = '<p class="text-red-400 text-sm">Błąd wczytywania rankingu</p>';
    }
}

function renderLeaderboard(scores) {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    const sorted = [...scores].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time.localeCompare(b.time);
    });

    sorted.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 bg-slate-900/50 rounded-lg p-2';
        div.innerHTML = `
            <span class="text-lg">${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'}</span>
            <span class="flex-1">${entry.name}</span>
            <span class="font-bold text-green-400">${entry.score}</span>
        `;
        list.appendChild(div);
    });
}
```

I zaktualizuj `finishQuiz()`:

```javascript
async function finishQuiz() {
    const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
    const timeStr = formatTime(elapsed);

    // Submit to backend
    if (USE_BACKEND && studentName) {
        try {
            const response = await fetch(LEADERBOARD_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: studentName,
                    score: score,
                    time: timeStr
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log('Score submitted! Rank:', data.rank);
                updateLeaderboard(); // Refresh leaderboard
            }
        } catch (error) {
            console.error('Failed to submit score:', error);
        }
    }

    // ... reszta kodu finishQuiz() ...
}
```

## 📊 API Endpoints

### GET /leaderboard.php
Pobierz top 20 wyników

**Response:**
```json
{
  "success": true,
  "scores": [
    {
      "name": "Anna K.",
      "score": 28,
      "time": "15:23",
      "date": "2025-01-20 14:30:00"
    }
  ],
  "total": 45
}
```

### POST /leaderboard.php
Wyślij nowy wynik

**Request:**
```json
{
  "name": "Jan K.",
  "score": 30,
  "time": "12:45"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Score submitted successfully",
  "rank": 3
}
```

## 🔒 Bezpieczeństwo

✅ Rate limiting (60s między submissjami z tego samego IP)
✅ Walidacja danych (nazwa, score, czas)
✅ Sanityzacja HTML (XSS protection)
✅ JSON pliki chronione przez .htaccess
✅ CORS enabled ale z walidacją
✅ Max 100 wyników w bazie (auto-cleanup)

## 🧪 Testowanie

```bash
# Test GET
curl http://twój-vps/api/leaderboard.php

# Test POST
curl -X POST http://twój-vps/api/leaderboard.php \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","score":25,"time":"10:30"}'
```

## 📝 Logi

Backend nie tworzy logów - wszystkie operacje są w pamięci/JSON.

Aby monitorować:
```bash
# Apache logs
sudo tail -f /var/log/apache2/access.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log

# Zobacz aktualny leaderboard
cat /var/www/html/api/scores.json
```

## 🗑️ Czyszczenie danych

```bash
# Usuń wszystkie wyniki
sudo rm /var/www/html/api/scores.json

# Usuń rate limits
sudo rm /var/www/html/api/rate_limits.json
```

## ⚙️ Konfiguracja

Edytuj `leaderboard.php` aby zmienić:

```php
$MAX_SCORES = 100;           // Max wyników w bazie
$RATE_LIMIT_SECONDS = 60;    // Sekundy między submissjami
```

## 🚨 Troubleshooting

**Problem: 403 Forbidden**
```bash
sudo chown -R www-data:www-data /var/www/html/api
sudo chmod 755 /var/www/html/api
```

**Problem: Nie zapisuje wyników**
```bash
sudo chmod 666 /var/www/html/api/scores.json
```

**Problem: CORS errors**
- Sprawdź czy .htaccess działa (Apache)
- Dla Nginx dodaj headers w konfiguracji (patrz wyżej)

**Problem: Rate limit za szybki**
- Zmień `$RATE_LIMIT_SECONDS` w leaderboard.php
- Lub usuń rate_limits.json
