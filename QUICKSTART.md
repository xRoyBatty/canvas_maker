# 🚀 Quick Start - Quiz Generator

## Dla niecierpliwych (2 minuty)

1. **Otwórz `quiz_generator_ALL_IN_ONE.html` w Gemini Canvas**

2. **Kliknij "Generate All Assets"** (poczekaj 2-3 min)

3. **Kliknij "Pobierz Assety"** → dostaniesz `interactive_quiz_READY.html`

4. **Wgraj na VPS:**
   ```bash
   scp interactive_quiz_READY.html user@vps:~/quiz.html
   ```

5. **Uruchom prosty serwer:**
   ```bash
   ssh user@vps
   python3 -m http.server 8080
   ```

6. **Gotowe!** Otwórz `http://twój-vps-ip:8080/quiz.html`

---

## Co dostaniesz?

✅ **33 pytania** o jedzeniu i gramatyce angielskiej
✅ **12 obrazków AI** (jedzenie)
✅ **Teoria gramatyczna** z wymuszonym czasem czytania
✅ **System alarmów** (15s blokada za zbyt szybkie klikanie)
✅ **Live leaderboard** z rankingiem
✅ **5 typów pytań** (fill-blank, multiple-choice, drag-drop, reorder, reading)
✅ **Timer** dla całego quizu i każdego pytania
✅ **Auto-grading** z natychmiastowym feedback

## System anty-oszustwo

Jeśli uczeń kliknie "Zrozumiałem" w teorii:
- **< 30 sekund** (normalne czytanie) → 🚨 **ALARM 15 sekund**
- **< 60 sekund** (przepisywanie do zeszytu) → 🚨 **ALARM 15 sekund**

Po alarmie wraca do teorii z obowiązkiem przepisania!

## Potrzebujesz pomocy?

Przeczytaj pełny [README_QUIZ.md](README_QUIZ.md) dla:
- Szczegółów wdrożenia Nginx/Apache
- Dostosowywania pytań i teorii
- Konfiguracji backend dla leaderboard (opcjonalnie)
- Rozwiązywania problemów

## Co dalej?

📝 **Dostosuj pytania:** Edytuj `QUESTIONS` array w `interactive_quiz.html`
📚 **Dodaj teorię:** Edytuj `GRAMMAR_THEORIES` w `interactive_quiz.html`
🎨 **Zmień obrazki:** Modyfikuj prompty w `build_merged.py` i przebuduj
🏆 **Backend leaderboard:** Zobacz sekcję "Backend for leaderboard" w README

---

**Autor:** Claude Code
**Repo:** [xRoyBatty/canvas_maker](https://github.com/xRoyBatty/canvas_maker)
**Licencja:** Free for educational use
