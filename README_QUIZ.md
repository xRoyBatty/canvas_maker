# Interactive Food & Grammar Quiz

## Przegląd

**ULTRA-PROSTY WORKFLOW:**
1. Otwórz **quiz_generator_ALL_IN_ONE.html** w Gemini Canvas
2. Kliknij "Generate All Assets"
3. Pobierz gotowy quiz
4. Wgraj na VPS

**To wszystko!** Zero kopiowania, wklejania czy edytowania plików!

---

Dostępne pliki w repo:
- **quiz_generator_ALL_IN_ONE.html** - ⭐ JEDYNY PLIK którego potrzebujesz
- `asset_generator.html` - stary generator (używaj ALL_IN_ONE zamiast tego)
- `interactive_quiz.html` - stary quiz template (używaj ALL_IN_ONE)
- `build_merged.py` - skrypt łączący (do development'u)

## Krok 1: Generuj quiz z obrazkami (w Gemini Canvas)

1. Otwórz plik **`quiz_generator_ALL_IN_ONE.html`** w Gemini Canvas
2. Kliknij **"Generate All Assets"** (wygeneruje 12 obrazków AI)
3. Poczekaj ~2-3 minuty
4. Kliknij **"Pobierz Assety (Kopiuj + Plik)"**
5. Otrzymasz **`interactive_quiz_READY.html`** - gotowy do wgrania!

✅ Wszystkie obrazki już wbudowane
✅ Żadnego kopiowania/wklejania
✅ Jeden plik HTML ready to deploy

## Krok 2: Wdrożenie na VPS

**WAŻNE:** Wybierz JEDNĄ z poniższych opcji. To są ALTERNATYWY, nie zależności!

### Opcja A: Python Server (najprostsze - do testów)

✅ Nie wymaga instalacji
✅ Działa natychmiast
❌ Tylko do testów (nie dla produkcji)

```bash
# Wgraj plik na serwer
scp interactive_quiz.html user@your-vps:~/

# Zaloguj się na VPS
ssh user@your-vps

# Uruchom serwer
python3 -m http.server 8080
```

Quiz dostępny: `http://your-vps-ip:8080/interactive_quiz.html`

### Opcja B: Nginx (PRODUKCJA - polecane)

1. Zainstaluj Nginx:
```bash
sudo apt update
sudo apt install nginx
```

2. Skopiuj plik quiz:
```bash
sudo cp interactive_quiz.html /var/www/html/quiz.html
```

3. Skonfiguruj Nginx (`/etc/nginx/sites-available/quiz`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/html;
    index quiz.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

4. Aktywuj konfigurację:
```bash
sudo ln -s /etc/nginx/sites-available/quiz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Quiz będzie dostępny pod: `http://your-domain.com/`

### Opcja C: Apache (alternatywa dla Nginx)

✅ Dobry dla produkcji
✅ Łatwy w konfiguracji
⚠️  Cięższy niż Nginx

1. Zainstaluj Apache:
```bash
sudo apt update
sudo apt install apache2
```

2. Skopiuj plik:
```bash
sudo cp interactive_quiz.html /var/www/html/quiz.html
```

3. Restart Apache:
```bash
sudo systemctl restart apache2
```

Quiz dostępny: `http://your-vps-ip/quiz.html`

---

**Podsumowanie opcji serwerów:**
- **Python** - do testów lokalnych, natychmiastowe uruchomienie
- **Nginx** - najlepsza wydajność, najmniej zasobów, produkcja
- **Apache** - łatwiejsza konfiguracja, więcej zasobów, produkcja
- **PHP** - NIE POTRZEBUJESZ! (chyba że chcesz backend dla leaderboard - patrz sekcja niżej)

## Funkcje quizu

### 1. Teoria gramatyczna
- Przed pytaniami wymagającymi znajomości gramatyki wyświetla się teoria
- Uczniowie muszą kliknąć "Zrozumiałem" aby kontynuować
- Minimalne czasy: 30s (normalna teoria), 60s (przepisywanie do zeszytu)

### 2. System alarmów
- Jeśli uczeń kliknie "Zrozumiałem" zbyt szybko (< 1 minuty przy przepisywaniu)
- Wyświetli się alarm na 15 sekund blokujący ekran
- Po alarmie powrót do teorii z obowiązkiem przepisania

### 3. Live Leaderboard
- W prawym górnym rogu wyświetla się ranking
- Sortowanie według punktów i czasu
- Automatyczna aktualizacja po zakończeniu quizu

### 4. Typy pytań
- **Fill in the blank** - wypełnianie luk z obrazkami
- **Multiple choice** - wybór jednej odpowiedzi
- **Drag & Drop** - przeciąganie słów do luk
- **Reorder** - układanie zdań w kolejności
- **Reading comprehension** - zrozumienie tekstu

### 5. Timer
- Timer główny quizu
- Timer dla każdego pytania osobno
- Automatyczne przejście po upływie czasu

## Dostosowywanie quizu

### Zmiana pytań

Edytuj array `QUESTIONS` w pliku `interactive_quiz.html`:

```javascript
const QUESTIONS = [
    {
        id: 1,
        type: 'fill-blank', // lub 'multiple-choice', 'drag-drop', 'reorder', 'reading'
        time: 60, // sekundy
        points: 1,
        theory: 'containers', // opcjonalne: 'containers', 'articles', 'quantifiers'
        question: 'Treść pytania',
        answer: 'poprawna odpowiedź',
        alternatives: ['alternatywna odpowiedź'] // opcjonalne
    },
    // ... więcej pytań
];
```

### Zmiana teorii

Edytuj obiekt `GRAMMAR_THEORIES`:

```javascript
const GRAMMAR_THEORIES = {
    'nazwa_teorii': {
        title: 'Tytuł teorii',
        content: `
            <h3>Treść teorii w HTML</h3>
            <p>Możesz używać HTML do formatowania</p>
        `
    }
};
```

### Dostosowanie timera

Zmień minimalne czasy w funkcji `handleTheoryUnderstand()`:

```javascript
const minTime = wrongAfterTheory[currentTheoryType] ? 60 : 30;
// Zmień 60 na inną wartość dla przepisywania
// Zmień 30 na inną wartość dla normalnej teorii
```

### Zmiana czasu alarmu

Zmień wartość w funkcji `showAlarm()`:

```javascript
let secondsLeft = 15; // Zmień na inną wartość
```

## Backend dla leaderboard (opcjonalnie)

Aktualnie leaderboard jest symulowany w JavaScript. Aby zapisywać wyniki:

### Opcja 1: LocalStorage (najprostsze)

Dodaj do funkcji `finishQuiz()`:

```javascript
// Zapisz
localStorage.setItem('quizResults', JSON.stringify(leaderboard));

// Odczytaj przy starcie
const savedResults = localStorage.getItem('quizResults');
if (savedResults) {
    leaderboard = JSON.parse(savedResults);
}
```

### Opcja 2: Prosty backend PHP

Utwórz `save_score.php`:

```php
<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);

$scores = json_decode(file_get_contents('scores.json'), true) ?? [];
$scores[] = $data;

file_put_contents('scores.json', json_encode($scores));
echo json_encode(['success' => true]);
?>
```

I zmień w quizie:

```javascript
fetch('/save_score.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: studentName, score, time: timeStr })
});
```

### Opcja 3: Firebase (zaawansowane)

Możesz użyć Firebase Realtime Database lub Firestore - dokumentacja: https://firebase.google.com/docs

## Testowanie lokalnie

Przed wdrożeniem na VPS, przetestuj lokalnie:

```bash
# Otwórz terminal w folderze z plikiem
python3 -m http.server 8000

# Otwórz w przeglądarce:
# http://localhost:8000/interactive_quiz.html
```

## Wsparcie i rozwiązywanie problemów

### Problem: Obrazki nie wyświetlają się
- Upewnij się, że skopiowałeś zawartość `quiz_assets.js` do `QUIZ_ASSETS`
- Sprawdź czy base64 zaczyna się od `data:image/png;base64,`

### Problem: Teoria nie działa
- Sprawdź konsolę przeglądarki (F12) czy nie ma błędów JavaScript
- Upewnij się, że pytanie ma pole `theory` z poprawną nazwą teorii

### Problem: Leaderboard nie zapisuje wyników
- Domyślnie leaderboard jest resetowany przy odświeżeniu strony
- Zaimplementuj backend lub LocalStorage (patrz wyżej)

### Problem: Quiz nie działa na starszych przeglądarkach
- Quiz wymaga nowoczesnej przeglądarki (Chrome 90+, Firefox 88+, Safari 14+)
- Używa ES6+ JavaScript

## Licencja

Ten quiz jest darmowy do użytku edukacyjnego. Możesz go modyfikować i dostosowywać do swoich potrzeb.

## Changelog

### v1.0 (2025-01-20)
- Pierwsza wersja
- 33 pytania o jedzeniu i gramatyce angielskiej
- System teorii z timerem
- Alarm dla zbyt szybkich kliknięć
- Live leaderboard
- 5 typów pytań

---

**Powodzenia z nauczaniem! 🎓📚**
