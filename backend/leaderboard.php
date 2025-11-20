<?php
/**
 * Simple PHP Backend for Quiz Leaderboard
 * Stores scores in JSON file (no database needed)
 *
 * Usage:
 * GET  /leaderboard.php           - Get top scores
 * POST /leaderboard.php           - Submit new score
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allow CORS
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
$SCORES_FILE = __DIR__ . '/scores.json';
$MAX_SCORES = 100; // Keep top 100 scores
$RATE_LIMIT_FILE = __DIR__ . '/rate_limits.json';
$RATE_LIMIT_SECONDS = 60; // Min 60 seconds between submissions from same IP

// Helper: Read scores from file
function readScores($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = file_get_contents($file);
    return json_decode($content, true) ?: [];
}

// Helper: Write scores to file
function writeScores($file, $scores) {
    file_put_contents($file, json_encode($scores, JSON_PRETTY_PRINT));
}

// Helper: Check rate limit
function checkRateLimit($file, $ip, $limitSeconds) {
    $limits = readScores($file);
    $now = time();

    // Clean old entries
    $limits = array_filter($limits, function($timestamp) use ($now, $limitSeconds) {
        return ($now - $timestamp) < $limitSeconds;
    });

    if (isset($limits[$ip])) {
        $secondsLeft = $limitSeconds - ($now - $limits[$ip]);
        return ['allowed' => false, 'secondsLeft' => $secondsLeft];
    }

    $limits[$ip] = $now;
    writeScores($file, $limits);
    return ['allowed' => true];
}

// Helper: Validate score data
function validateScore($data) {
    if (!isset($data['name']) || !isset($data['score']) || !isset($data['time'])) {
        return false;
    }

    // Sanitize name (max 30 chars, alphanumeric + spaces)
    $name = trim($data['name']);
    if (strlen($name) < 1 || strlen($name) > 30) {
        return false;
    }
    if (!preg_match('/^[a-zA-Z0-9\s\.\-]+$/', $name)) {
        return false;
    }

    // Validate score (0-42, based on quiz)
    $score = intval($data['score']);
    if ($score < 0 || $score > 42) {
        return false;
    }

    // Validate time (format MM:SS)
    if (!preg_match('/^\d{2}:\d{2}$/', $data['time'])) {
        return false;
    }

    return true;
}

// GET: Return leaderboard
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $scores = readScores($SCORES_FILE);

    // Sort by score DESC, then time ASC
    usort($scores, function($a, $b) {
        if ($b['score'] !== $a['score']) {
            return $b['score'] - $a['score'];
        }
        // Compare times (MM:SS format)
        list($aMin, $aSec) = explode(':', $a['time']);
        list($bMin, $bSec) = explode(':', $b['time']);
        $aTotal = intval($aMin) * 60 + intval($aSec);
        $bTotal = intval($bMin) * 60 + intval($bSec);
        return $aTotal - $bTotal;
    });

    // Return top scores
    $topScores = array_slice($scores, 0, 20);

    echo json_encode([
        'success' => true,
        'scores' => $topScores,
        'total' => count($scores)
    ]);
    exit();
}

// POST: Submit new score
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate input
    if (!validateScore($input)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid score data'
        ]);
        exit();
    }

    // Check rate limit
    $clientIP = $_SERVER['REMOTE_ADDR'];
    $rateLimitCheck = checkRateLimit($RATE_LIMIT_FILE, $clientIP, $RATE_LIMIT_SECONDS);

    if (!$rateLimitCheck['allowed']) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error' => 'Too many submissions. Please wait ' . $rateLimitCheck['secondsLeft'] . ' seconds.'
        ]);
        exit();
    }

    // Add score
    $scores = readScores($SCORES_FILE);
    $scores[] = [
        'name' => htmlspecialchars($input['name'], ENT_QUOTES, 'UTF-8'),
        'score' => intval($input['score']),
        'time' => $input['time'],
        'timestamp' => time(),
        'date' => date('Y-m-d H:i:s')
    ];

    // Sort and keep top N
    usort($scores, function($a, $b) {
        if ($b['score'] !== $a['score']) {
            return $b['score'] - $a['score'];
        }
        list($aMin, $aSec) = explode(':', $a['time']);
        list($bMin, $bSec) = explode(':', $b['time']);
        $aTotal = intval($aMin) * 60 + intval($aSec);
        $bTotal = intval($bMin) * 60 + intval($bSec);
        return $aTotal - $bTotal;
    });

    $scores = array_slice($scores, 0, $MAX_SCORES);
    writeScores($SCORES_FILE, $scores);

    echo json_encode([
        'success' => true,
        'message' => 'Score submitted successfully',
        'rank' => array_search($input['name'], array_column($scores, 'name')) + 1
    ]);
    exit();
}

// Method not allowed
http_response_code(405);
echo json_encode([
    'success' => false,
    'error' => 'Method not allowed'
]);
