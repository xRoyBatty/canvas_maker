You are supposed to help improve gemini Canvas apps, which operate in a really specific and restrictive environment.

Gemini Canvas is Google's interactive workspace feature (similar to Claude's Artifacts or ChatGPT Canvas) where you can create HTML/React apps and they preview live. When you create code in Gemini Canvas, it runs in a sandboxed environment that Google controls.

If used correctly it allows access to multiple llms which you normally have to pay for, as well as persistance of data in firebase, there are only restrictions in how many requests you can make per minute and the maximum size of firebase document (only base64 or text) and also how many calls to firebase you can make per minute, apart from that there are no daily limits.

In this Gemini Canvas environment, API calls to Google services like Imagen work without needing an explicit API key because Google's backend handles the authentication automatically - it's proxied through their infrastructure.

example of the api call to a model in this environment:
const systemPrompt = "Act as a world-class financial analyst. Provide a concise, single-paragraph summary of the key findings.";
const userQuery = "Find the latest quarterly earnings report for Google and summarize its performance.";
const apiKey = "" // If you want to use models other than gemini-2.5-flash-preview-09-2025 or imagen-4.0-generate-001, provide an API key here. Otherwise, leave this as-is.
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// Construct the payload
const payload = {
    contents: [{ parts: [{ text: userQuery }] }],

    // To enable Google Search grounding, include the tools property.
    // Omit this property for standard, non-grounded generation.
    tools: [{ "google_search": {} }],

    // System instructions are optional but recommended for guiding the model's persona and response format.
    systemInstruction: {
        parts: [{ text: systemPrompt }]
    },
};

const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});
// ... process the response

example of processing response:
const result = await response.json();
const candidate = result.candidates?.[0];

if (candidate && candidate.content?.parts?.[0]?.text) {
  // 1. Extract the generated text (applies to all responses)
  const text = candidate.content.parts[0].text;

  // 2. Extract grounding sources (only applies if grounding was used)
  let sources = [];
  const groundingMetadata = candidate.groundingMetadata;
  if (groundingMetadata && groundingMetadata.groundingAttributions) {
      sources = groundingMetadata.groundingAttributions
          .map(attribution => ({
              uri: attribution.web?.uri,
              title: attribution.web?.title,
          }))
          .filter(source => source.uri && source.title); // Ensure sources are valid
  }

  // Use the 'text' and 'sources' array in your application.
  // For non-grounded calls, the 'sources' array will be empty.
  // Example: return { text, sources };

} else {
  // Handle cases where the response structure is unexpected or content is missing
}

** Firestore Database Security Rules Summary **

The firestore database security rules are defined to allow authenticated users to read and write data.

Public data (for sharing with other users or collaborative apps): ** Collection path: ** MUST store in /artifacts/{appId}/public/data/{your_collection_name}. ** Document path: ** MUST store in /artifacts/{appId}/public/data/{your_collection_name}/{documentId}.

Private data (default): ** Collection path: ** MUST store in /artifacts/{appId}/users/{userId}/{your_collection_name}. ** Document path: ** MUST store in /artifacts/{appId}/users/{userId}/{your_collection_name}/{documentId}.

** Global Variables already provided for Firestore (MUST BE USED) **

__app_id: MANDATORY: the current app ID provided in the canvas environment as a string. DO NOT prompt the user for this. You MUST ALWAYS use this variable like this: const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

__firebase_config: MANDATORY: firebase config provided in the canvas environment as a string. DO NOT prompt the user for this. You MUST ALWAYS use this variable like this: const firebaseConfig = JSON.parse(__firebase_config);

__initial_auth_token: MANDATORY: This is a Firebase custom auth token string automatically provided within the Canvas environment. DO NOT prompt the user for this. You MUST ALWAYS use this token by calling signInWithCustomToken() with it like this: const auth = getAuth(db); if (typeof __initial_auth_token !== 'undefined') { await signInWithCustomToken(auth, __initial_auth_token); } else { await signInAnonymously(auth); } NOTE: If the __initial_auth_token is not defined, you should sign in anonymously using the signInAnonymously() method instead.`

** userId for Firestore **

userId: the current user ID (string). If the user is authenticated, use the uid as the identifier for both public and private data. If the user is not authenticated, use a random string as the identifier. const userId = auth.currentUser?.uid || crypto.randomUUID(); 
IMPORTANT: YOU CAN EDIT THIS VALUE TO A SPECIFIC STRING WHICH WILL ALLOW THE CONTENT SAVED TO FIREBASE REMAIN INTACT EVEN AFTER REGENERATIONS OF THE CANVAS FILES. YOU CAN ALSO COMMUNICATE BETWEEN CANVASES IN THIS WAY - YOU JUST HAVE TO GIVE THE SAME appId to multiple canvases AND MAKE THEM COMMUNICATE VIA FIRESTORE.

RESTRICTIONS: A single firestore document data limit is around 1MB of Base64 or String, so in case of data persistance, in case of larger files than that, you have to either use compression (jpg, mp3) or use chunking (1 chunk goes to a single document) or both.

Below you can find a fragment of official instructions for canvas generation written for google gemini 2.5, so don't treat them as an obligation to use, however keep in mind what you have at your disposal :
<INSTRUCTIONS>
Generating Structured Responses with LLMs via the Gemini API

If you want any sort of structured response (think: list of ingredients, etc.), add a generationConfig to the payload with a JSON schema and set Content-Type to 'application/json': const payload = { contents: chatHistory, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "OBJECT", properties: { "recipeName": { "type": "STRING" }, "ingredients": { "type": "ARRAY", "items": { "type: "STRING" } } }, "propertyOrdering": ["recipeName", "ingredients"] } } } }; const apiKey = "" const apiUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}; const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = response.json(); if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) { const json = result.candidates[0].content.parts[0].text; const parsedJson = JSON.parse(json); // Use the response JSON in the application. } else { // Handle cases where the response structure is unexpected or content is missing }

For structured responses, you need to really THINK in advance about the JSON schema and about how you'll render it in the application.

Image Understanding with LLMs via the Gemini API

For image understanding, use gemini-2.5-flash-preview-09-2025 with images as inline data. let chatHistory = []; chatHistory.push({ role: "user", parts: [{ text: prompt }] }); const payload = { contents: [ { role: "user", parts: [ { text: prompt }, { inlineData: { mimeType: "image/png", data: base64ImageData } } ] } ], }; const apiKey = "" // If you want to use models other than gemini-2.5-flash-preview-09-2025 or imagen-4.0-generate-001, provide an API key here. Otherwise, leave this as-is. const apiUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}; const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

Unless EXPLICITLY told otherwise, use gemini-2.5-flash-preview-09-2025 for image understanding.

Implement exponential backoff when making API calls to handle potential throttling. Retry requests with increasing delays (e.g., 1s, 2s, 4s, ...). Do not log these retries as errors in the console.

Generating Images with LLMs via the Gemini API

For image generation you can use the model gemini-2.5-flash-image-preview or imagen-4.0-generate-001 to generate images.

Use gemini-2.5-flash-image-preview for image generation with the generateContent method like this: const payload = { contents: [{ parts: [{ text: userPrompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }, }; const apiKey = "" // If you want to use models other than gemini-2.5-flash-image-preview or imagen-4.0-generate-001, provide an API key here. Otherwise, leave this as-is. const apiUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}; const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data; if (!base64Data) { // Handle cases where the response structure is unexpected or content is missing return; } else { const imageUrl = data:image/png;base64,${base64Data}; // Use the image URL in the application. }

Use imagen-4.0-generate-001 for image generation with the predict method like this: const payload = { instances: { prompt: "prompt goes here" }, parameters: { "sampleCount": 1} }; const apiKey = "" // If you want to use models other than imagen-4.0-generate-001, provide an API key here. Otherwise, leave this as-is. const apiUrl = https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}; const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) { const imageUrl = data:image/png;base64,${result.predictions[0].bytesBase64Encoded}; // Use the image URL in the application. } else { // Handle cases where the response structure is unexpected or content is missing }

You will find the bytes for a given image at index i in response.json().predictions[i].bytesBase64Encoded. You can use the data:image/png;base64, prefix to display the image in the browser.

Remember to leave the API key as an empty string. Ex: const apiKey = "". When API key is an empty string, Canvas will automatically provide it in runtime in the fetch call. DO NOT ADD any API key validation.

Add a loading indicator while the image is being generated. DO NOT use placeholder images.

Either create a React App or an Angular App or an HTML App. Do not use dynamic React inside HTML. This will cause problems with imports.

ALWAYS prefer imagen-4.0-generate-001 over gemini-2.5-flash-image-preview for simple image generation tasks.

Use gemini-2.5-flash-image-preview directly in the following cases: * It is a Image editing App. * The request involves image editing or image-to-image generation, where an input image is provided to generate a new image. * The user explicitly asks to generate images with gemini-2.5-flash-image-preview or flash or nano-banana model. * The user wants to create an Image to Image App. * Use wants to do conversational image editing.

Implement exponential backoff when making API calls to handle potential throttling. Retry requests with increasing delays (e.g., 1s, 2s, 4s, ...). Do not log these retries as errors in the console.

NOTE: The user may refer to gemini-2.5-flash-image-preview as the nano-banana model.

Generating TTS with LLMs via the Gemini API

For TTS generation, use gemini-2.5-flash-preview-tts with the generateContent method. The response will contain base64-encoded PCM audio data.

Single-speaker TTS: const payload = { contents: [{ parts: [{ text: "Say cheerfully: Have a wonderful day!" }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } }, model: "gemini-2.5-flash-preview-tts" }; const apiKey = ""; // Leave as-is const apiUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}; const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); const part = result?.candidates?.[0]?.content?.parts?.[0]; const audioData = part?.inlineData?.data; const mimeType = part?.inlineData?.mimeType;

  if (audioData && mimeType && mimeType.startsWith("audio/")) {) {
      const sampleRate = parseInt(apiResponse.mimeType.match(/rate=(\d+)/)[1], 10);
      const pcmData = base64ToArrayBuffer(apiResponse.audioData);
      // API returns signed PCM16 audio data.
      const pcm16 = new Int16Array(pcmData);
      const wavBlob = pcmToWav(pcm16, sampleRate);
      const audioUrl = URL.createObjectURL(wavBlob);
      // Use the audio URL to play the audio.
  } else {
      // Handle cases where the response structure is unexpected or content is missing
  }
Multi-speaker TTS: For conversations, use multiSpeakerVoiceConfig and define each speaker's voice. The text prompt should contain the full conversation script with speaker names. const payload = { contents: [{ parts: [{ text: "TTS the following conversation between Joe and Jane:\nJoe: Hows it going today Jane?\nJane: Not too bad, how about you?" }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [ { speaker: "Joe", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }, { speaker: "Jane", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } ] } } }, model: "gemini-2.5-flash-preview-tts" }; // The fetch call is the same as the single-speaker example.

IMPORTANT: Remember the API returns raw signed PCM 16 bit audio data. You need to convert it to a WAV container and then use it to play the audio. Mimetype is audio/L16.

Speech Control: Control style, tone, accent, and pace using natural language in the text prompt (e.g., "Say in a spooky whisper: ..."). For multi-speaker, you can provide guidance for each speaker individually (e.g., "Make Speaker1 sound tired and bored, and Speaker2 sound excited and happy: ...").

Voices: You can choose from various prebuilt voices. While gender is not specified, each voice has a distinct characteristic: Zephyr (Bright), Puck (Upbeat), Charon (Informative), Kore (Firm), Fenrir (Excitable), Leda (Youthful), Orus (Firm), Aoede (Breezy), Callirrhoe (Easy-going), Autonoe (Bright), Enceladus (Breathy), Iapetus (Clear), Umbriel (Easy-going), Algieba (Smooth), Despina (Smooth), Erinome (Clear), Algenib (Gravelly), Rasalgethi (Informative), Laomedeia (Upbeat), Achernar (Soft), Alnilam (Firm), Schedar (Even), Gacrux (Mature), Pulcherrima (Forward), Achird (Friendly), Zubenelgenubi (Casual), Vindemiatrix (Gentle), Sadachbia (Lively), Sadaltager (Knowledgeable), Sulafat (Warm).

Languages: The model supports multiple languages and the language is typically auto-detected from the text. Supported language codes: ar-EG, de-DE, en-US, es-US, fr-FR, hi-IN, id-ID, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, nl-NL, pl-PL, th-TH, tr-TR, vi-VN, ro-RO, uk-UA, bn-BD, en-IN, mr-IN, ta-IN, te-IN.
</INSTRUCTIONS>

<FULL APP WORKING EXAMPLE>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Technical English - Production Machinery Worksheet</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        
        .section {
            display: none;
            animation: fadeIn 0.4s ease-in;
        }
        .section.active { display: block; }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .nav-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #4b5563;
            transition: all 0.3s;
        }
        .nav-dot.active {
            background: #3b82f6;
            transform: scale(1.3);
        }
        .nav-dot.completed {
            background: #10b981;
        }
        
        .vocab-card {
            transition: all 0.3s;
            cursor: pointer;
        }
        .vocab-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
        }
        .vocab-card.correct {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.1);
        }
        .vocab-card.incorrect {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
        }
        
        .draggable-label {
            cursor: move;
            transition: all 0.2s;
        }
        .draggable-label:hover {
            transform: scale(1.05);
        }
        .draggable-label.dragging {
            opacity: 0.5;
        }
        
        .drop-zone {
            min-height: 40px;
            border: 2px dashed #6b7280;
            transition: all 0.3s;
        }
        .drop-zone.drag-over {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
        }
        .drop-zone.filled {
            border-color: #10b981;
            border-style: solid;
        }
        
        .audio-visualizer {
            display: flex;
            align-items: center;
            gap: 3px;
            height: 40px;
        }
        .audio-bar {
            width: 4px;
            background: #3b82f6;
            border-radius: 2px;
            animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { height: 20%; }
            50% { height: 100%; }
        }
        
        .question-input {
            transition: all 0.3s;
        }
        .question-input:focus {
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .loading-spinner {
            border: 3px solid #f3f4f6;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .timer {
            font-variant-numeric: tabular-nums;
        }
        
        .progress-bar-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: #1f2937;
            z-index: 100;
        }
        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            transition: width 0.5s ease;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 min-h-screen text-white">

<!-- Progress Bar -->
<div class="progress-bar-container">
    <div id="progress-bar-fill" class="progress-bar-fill" style="width: 0%"></div>
</div>

<!-- Loading Screen -->
<div id="loading-screen" class="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
    <div class="text-center">
        <div class="loading-spinner mx-auto mb-6"></div>
        <h2 class="text-2xl font-bold mb-4">Preparing Your Worksheet</h2>
        <div id="loading-log" class="bg-slate-800 rounded-lg p-4 max-w-2xl mx-auto text-left text-sm font-mono text-green-400 h-64 overflow-y-auto mb-4">
            <div>→ Initializing Firebase...</div>
        </div>
        <div class="bg-slate-700 rounded-full h-3 overflow-hidden max-w-md mx-auto">
            <div id="loading-progress-bar" class="bg-blue-500 h-full transition-all duration-500" style="width: 0%"></div>
        </div>
        <p id="loading-text" class="text-gray-400 text-sm mt-3">Connecting to cloud storage...</p>
    </div>
</div>

<!-- Main Container -->
<div id="main-container" class="hidden max-w-6xl mx-auto p-6">
    
    <!-- Header -->
    <header class="mb-8">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <div class="flex justify-between items-start">
                <div>
                    <h1 class="text-3xl font-bold mb-2">Production Machinery & Equipment</h1>
                    <p class="text-gray-300">Technical English for Film Production Technologists | Level B1-B2</p>
                    <p class="text-sm text-gray-400 mt-1">Duration: 45-90 minutes flexible</p>
                </div>
                <div class="text-right">
                    <div class="timer text-3xl font-bold text-blue-400" id="timer">00:00</div>
                    <p class="text-sm text-gray-400">Time Elapsed</p>
                    <div class="flex gap-2 mt-2">
                        <button id="save-progress-btn" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition">
                            💾 Save Progress
                        </button>
                        <button id="download-offline-btn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition">
                            ⬇ Download Offline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- Navigation Dots -->
    <div class="flex justify-center gap-3 mb-8">
        <div class="nav-dot" data-section="0" title="Part A: Warm-up"></div>
        <div class="nav-dot" data-section="1" title="Part B: Vocabulary"></div>
        <div class="nav-dot" data-section="2" title="Part C: Components"></div>
        <div class="nav-dot" data-section="3" title="Part D: Listening"></div>
        <div class="nav-dot" data-section="4" title="Part E: Speaking"></div>
        <div class="nav-dot" data-section="5" title="Part F: Writing"></div>
        <div class="nav-dot" data-section="6" title="Part G: Extension"></div>
        <div class="nav-dot" data-section="7" title="Homework"></div>
    </div>

    <!-- Section A: Warm-up Discussion -->
    <section id="section-0" class="section active">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-4 text-blue-400">Part A: Warm-Up Discussion (10 minutes)</h2>
            <p class="text-gray-300 mb-6">Work in pairs. Discuss these questions about your work:</p>
            
            <div class="space-y-4">
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <p class="font-semibold mb-2">1. What machines do you work with in your daily job?</p>
                    <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-20 resize-none focus:border-blue-500 focus:outline-none" placeholder="Write your answer here..."></textarea>
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <p class="font-semibold mb-2">2. Which machine is the most complex to operate? Why?</p>
                    <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-20 resize-none focus:border-blue-500 focus:outline-none" placeholder="Write your answer here..."></textarea>
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <p class="font-semibold mb-2">3. Have you ever had to explain a machine problem to a colleague in English? What was difficult?</p>
                    <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-20 resize-none focus:border-blue-500 focus:outline-none" placeholder="Write your answer here..."></textarea>
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <p class="font-semibold mb-2">4. Why is it important to know technical English terms for your equipment?</p>
                    <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-20 resize-none focus:border-blue-500 focus:outline-none" placeholder="Write your answer here..."></textarea>
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <p class="font-semibold mb-2">5. What do you think is the most important part of an extruder? Why?</p>
                    <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-20 resize-none focus:border-blue-500 focus:outline-none" placeholder="Write your answer here..."></textarea>
                </div>
            </div>
        </div>
    </section>

    <!-- Section B: Vocabulary Matching -->
    <section id="section-1" class="section">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-4 text-blue-400">Part B: Vocabulary Matching (10 minutes)</h2>
            <p class="text-gray-300 mb-6">Match the English terms with their Polish equivalents. Click on an English term, then click on the matching Polish term.</p>
            
            <div class="mb-4 flex gap-4">
                <button id="check-vocab-btn" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition">
                    ✓ Check Answers
                </button>
                <button id="reset-vocab-btn" class="px-6 py-3 bg-slate-600 hover:bg-slate-700 rounded-lg font-semibold transition">
                    ↺ Reset
                </button>
                <div id="vocab-score" class="ml-auto flex items-center gap-2 text-lg font-semibold hidden">
                    <span class="text-green-400">Score:</span>
                    <span id="vocab-score-value">0/15</span>
                </div>
            </div>
            
            <div class="grid md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-lg font-semibold mb-4 text-gray-300">English Terms</h3>
                    <div id="english-terms" class="space-y-2"></div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold mb-4 text-gray-300">Polish Equivalents</h3>
                    <div id="polish-terms" class="space-y-2"></div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section C: Blown Film Extrusion -->
    <section id="section-2" class="section">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-6 text-blue-400">Part C: Blown Film Extrusion - Components & Process (20 minutes)</h2>
            
            <!-- C1: Equipment Recognition -->
            <div class="mb-8">
                <h3 class="text-xl font-semibold mb-4">C1. Equipment Recognition - Which Machine is Which?</h3>
                <p class="text-gray-300 mb-4">Look at these three images of industrial equipment. Answer the questions by selecting the correct picture number.</p>
                
                <div class="grid md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-slate-900 rounded-lg p-4">
                        <div class="text-center font-bold mb-2">Picture 1</div>
                        <img id="equipment-img-1" src="" alt="Equipment 1" class="w-full rounded-lg mb-2">
                        <p class="text-sm text-gray-400 text-center">Extruder with hopper</p>
                    </div>
                    <div class="bg-slate-900 rounded-lg p-4">
                        <div class="text-center font-bold mb-2">Picture 2</div>
                        <img id="equipment-img-2" src="" alt="Equipment 2" class="w-full rounded-lg mb-2">
                        <p class="text-sm text-gray-400 text-center">Calender with rollers</p>
                    </div>
                    <div class="bg-slate-900 rounded-lg p-4">
                        <div class="text-center font-bold mb-2">Picture 3</div>
                        <img id="equipment-img-3" src="" alt="Equipment 3" class="w-full rounded-lg mb-2">
                        <p class="text-sm text-gray-400 text-center">Winder with film roll</p>
                    </div>
                </div>
                
                <div id="equipment-questions" class="space-y-3"></div>
                
                <button id="check-equipment-btn" class="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition">
                    ✓ Check Equipment Answers
                </button>
            </div>

            <!-- C2: Label the Diagram -->
            <div class="mb-8">
                <h3 class="text-xl font-semibold mb-4">C2. Label the Blown Film Extrusion Diagram</h3>
                
                <div class="bg-purple-900/20 border border-purple-500 rounded-lg p-4 mb-4">
                    <p class="font-semibold mb-2">🎨 Diagram Editor (Teacher Tool)</p>
                    <p class="text-sm text-gray-300 mb-3">If the diagram has unwanted labels, edit it with a custom prompt:</p>
                    <textarea id="diagram-edit-prompt" class="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-20 resize-none text-sm mb-2" placeholder="Example: Remove all text labels and replace them with numbered circles 1 through 11 pointing to: hopper, pellets, extruder, die, air ring, bubble, collapsing frame, nip rolls, layflat, idler roll, final roll"></textarea>
                    <button id="edit-diagram-btn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition">
                        ✏️ Edit Diagram with AI
                    </button>
                    <span id="diagram-edit-status" class="ml-3 text-sm text-gray-400"></span>
                </div>
                
                <div class="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
                    <p class="font-semibold mb-2">📖 PROCESS DESCRIPTION (Read before labeling):</p>
                    <p class="text-sm text-gray-300">
                        The blown film extrusion process begins when resin pellets (plastic granules) are fed into a funnel-shaped container called the <strong>hopper</strong>. 
                        From there, the pellets enter the <strong>extruder</strong>, a horizontal machine where they are melted and mixed by a rotating screw. 
                        At the end of the extruder, the molten plastic passes through the <strong>die</strong> - a circular opening that shapes the plastic into a tube. 
                        An <strong>air ring</strong> surrounding the die blows air into the center, inflating the plastic into a <strong>bubble</strong> (like blowing up a balloon). 
                        As the bubble rises vertically through the machine, it is guided by a triangular metal frame called the <strong>collapsing frame</strong>. 
                        At the top, two <strong>nip rolls</strong> (rollers) press the bubble flat, transforming it from a tube into a double-layer flat film called <strong>layflat</strong>. 
                        This flattened film then passes over several <strong>idler rolls</strong> (guide rollers) before being wound onto a large spool, creating a <strong>roll of film</strong> ready for further processing.
                    </p>
                </div>
                
                <div class="bg-slate-900 rounded-lg p-6 mb-4">
                    <h4 class="font-semibold mb-3">Word Bank:</h4>
                    <div id="label-word-bank" class="flex flex-wrap gap-2"></div>
                </div>
                
                <div class="bg-slate-900 rounded-lg p-4">
                    <img id="diagram-img" src="" alt="Blown Film Extrusion Diagram" class="w-full rounded-lg">
                    <div id="diagram-drop-zones" class="mt-4 space-y-2"></div>
                </div>
                
                <button id="check-labels-btn" class="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition">
                    ✓ Check Label Answers
                </button>
            </div>

            <!-- C3: Process Flow Questions -->
            <div>
                <h3 class="text-xl font-semibold mb-4">C3. Process Flow Questions</h3>
                <div id="process-questions" class="space-y-4"></div>
            </div>
        </div>
    </section>

    <!-- Section D: Listening Activities -->
    <section id="section-3" class="section">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-6 text-blue-400">Part D: Listening Activities (20 minutes)</h2>
            
            <!-- D1: Video Listening -->
            <div class="mb-8">
                <h3 class="text-xl font-semibold mb-4">D1. Video Listening - Basic Process Recognition (8 minutes)</h3>
                
                <div class="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
                    <p class="font-semibold mb-2">🎥 VIDEO: How Does Blown Film Extrusion Work?</p>
                    <p class="text-sm text-gray-300">POLYSTAR - One Minute to Know EP19</p>
                    <a href="https://www.youtube.com/watch?v=-0fgnyW9xpM" target="_blank" class="text-blue-400 hover:text-blue-300 text-sm">
                        Watch on YouTube (Duration: 1:11) →
                    </a>
                </div>
                
                <p class="text-gray-300 mb-4">Watch the video twice. First viewing: just watch. Second viewing: complete the sentences below.</p>
                
                <div id="video-questions" class="space-y-4"></div>
            </div>

            <!-- D2: Dialogue Listening -->
            <div>
                <h3 class="text-xl font-semibold mb-4">D2. Dialogue Listening - On the Production Floor (12 minutes)</h3>
                
                <div class="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
                    <p class="font-semibold mb-2">🎧 AUDIO FILE: Conversation between Rookie and Chief Technologist</p>
                    <p class="text-sm text-gray-300">Context: This is the rookie's first day observing the production line at Line 2. Listen for specific technical details.</p>
                </div>
                
                <div class="bg-slate-900 rounded-lg p-6 mb-6">
                    <div class="flex items-center gap-4 mb-4">
                        <button id="play-audio-btn" class="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition flex items-center gap-2">
                            <span id="play-icon">▶</span>
                            <span id="play-text">Play Audio</span>
                        </button>
                        <div class="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div id="audio-progress" class="bg-green-500 h-full transition-all" style="width: 0%"></div>
                        </div>
                        <span id="audio-time" class="text-sm text-gray-400">0:00 / 0:00</span>
                    </div>
                    <div id="audio-visualizer" class="audio-visualizer justify-center hidden">
                        <div class="audio-bar" style="animation-delay: 0s"></div>
                        <div class="audio-bar" style="animation-delay: 0.1s"></div>
                        <div class="audio-bar" style="animation-delay: 0.2s"></div>
                        <div class="audio-bar" style="animation-delay: 0.3s"></div>
                        <div class="audio-bar" style="animation-delay: 0.4s"></div>
                    </div>
                    <audio id="dialogue-audio" src=""></audio>
                </div>
                
                <h4 class="font-semibold mb-3">Task 1: True or False</h4>
                <div id="dialogue-tf-questions" class="space-y-2 mb-6"></div>
                
                <h4 class="font-semibold mb-3">Task 2: Answer the Questions</h4>
                <div id="dialogue-questions" class="space-y-4 mb-6"></div>
                
                <h4 class="font-semibold mb-3">Task 3: Reflection & Discussion</h4>
                <div id="reflection-questions" class="space-y-4"></div>
            </div>
        </div>
    </section>

    <!-- Section E: Speaking -->
    <section id="section-4" class="section">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-6 text-blue-400">Part E: Speaking - Machine Description (15 minutes)</h2>
            
            <div class="mb-6">
                <h3 class="text-xl font-semibold mb-4">Task 1: Individual Preparation (3 minutes)</h3>
                <p class="text-gray-300 mb-4">Choose ONE machine you work with. Prepare to describe it:</p>
                
                <div class="space-y-4">
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <label class="block font-semibold mb-2">Machine:</label>
                        <input type="text" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="e.g., Extruder, Calender, Winder...">
                    </div>
                    
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <label class="block font-semibold mb-2">Main function:</label>
                        <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-20 resize-none focus:border-blue-500 focus:outline-none" placeholder="Describe what this machine does..."></textarea>
                    </div>
                    
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <label class="block font-semibold mb-2">Key components (at least 5 parts):</label>
                        <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-32 resize-none focus:border-blue-500 focus:outline-none" placeholder="1. &#10;2. &#10;3. &#10;4. &#10;5."></textarea>
                    </div>
                    
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <label class="block font-semibold mb-2">Common problem and solution:</label>
                        <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-24 resize-none focus:border-blue-500 focus:outline-none" placeholder="Problem: &#10;Solution:"></textarea>
                    </div>
                </div>
            </div>
            
            <div>
                <h3 class="text-xl font-semibold mb-4">Task 2: Pair Work (12 minutes)</h3>
                <div class="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
                    <p class="font-semibold mb-2">Instructions:</p>
                    <ul class="text-sm text-gray-300 space-y-1">
                        <li>• <strong>Speaker:</strong> Present your machine description (3-4 minutes)</li>
                        <li>• <strong>Listener:</strong> Ask at least 3 questions, take notes, suggest clarifications</li>
                    </ul>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <h4 class="font-semibold mb-2">Useful Phrases - Describing:</h4>
                        <ul class="text-sm text-gray-300 space-y-1">
                            <li>• "This machine is responsible for..."</li>
                            <li>• "The main purpose is to..."</li>
                            <li>• "First, the material enters... then..."</li>
                            <li>• "If the... stops working, we..."</li>
                        </ul>
                    </div>
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <h4 class="font-semibold mb-2">Useful Phrases - Asking:</h4>
                        <ul class="text-sm text-gray-300 space-y-1">
                            <li>• "Could you explain what the... does?"</li>
                            <li>• "What happens if the... fails?"</li>
                            <li>• "How often do you need to...?"</li>
                            <li>• "What safety measures are required?"</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section F: Technical Writing -->
    <section id="section-5" class="section">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-6 text-blue-400">Part F: Technical Writing - Equipment Problem Report (10 minutes)</h2>
            
            <p class="text-gray-300 mb-4">Imagine you discovered a problem with a machine. Write a short problem report (80-100 words) including all required sections.</p>
            
            <div class="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-6">
                <p class="font-semibold mb-2">Required Information:</p>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• Machine name and location</li>
                    <li>• Problem description (what is wrong?)</li>
                    <li>• When you noticed it (date/time)</li>
                    <li>• Components affected</li>
                    <li>• Immediate action taken</li>
                    <li>• Recommendation for repair</li>
                </ul>
            </div>
            
            <div class="space-y-4">
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <label class="block font-semibold mb-2">Date:</label>
                        <input type="date" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none">
                    </div>
                    <div class="bg-slate-900/50 p-4 rounded-lg">
                        <label class="block font-semibold mb-2">Time:</label>
                        <input type="time" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none">
                    </div>
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <label class="block font-semibold mb-2">Reported by:</label>
                    <input type="text" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="Your name">
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <label class="block font-semibold mb-2">Machine/Location:</label>
                    <input type="text" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="e.g., Extruder - Line 3">
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-lg">
                    <label class="block font-semibold mb-2">Problem Report (80-100 words):</label>
                    <textarea id="problem-report-text" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-48 resize-none focus:border-blue-500 focus:outline-none" placeholder="On [date], at [time], I noticed unusual vibration in the extruder screw of Line 3. The barrel temperature was fluctuating between 185°C and 195°C (setpoint: 190°C)..."></textarea>
                    <div class="flex justify-between mt-2 text-sm">
                        <span id="word-count" class="text-gray-400">0 words</span>
                        <span id="word-count-status" class="text-gray-400"></span>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section G: Vocabulary Extension -->
    <section id="section-6" class="section">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-6 text-blue-400">Part G: Vocabulary Extension - Word Building (5 minutes)</h2>
            
            <p class="text-gray-300 mb-6">Complete the table with different word forms. Try to fill in all the missing forms.</p>
            
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-900">
                        <tr>
                            <th class="p-3 text-left border border-slate-700">Verb</th>
                            <th class="p-3 text-left border border-slate-700">Noun (thing)</th>
                            <th class="p-3 text-left border border-slate-700">Noun (person)</th>
                            <th class="p-3 text-left border border-slate-700">Adjective</th>
                        </tr>
                    </thead>
                    <tbody id="word-building-table">
                        <!-- Will be populated by JavaScript -->
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- Section H: Homework -->
    <section id="section-7" class="section">
        <div class="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 class="text-2xl font-bold mb-6 text-blue-400">📚 Homework</h2>
            
            <div class="space-y-6">
                <div class="bg-slate-900/50 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-3">1. Vocabulary Practice</h3>
                    <p class="text-gray-300 mb-3">Create flashcards for 20 machine-related terms from today's lesson. Include:</p>
                    <ul class="text-gray-300 space-y-1 mb-3">
                        <li>• English term</li>
                        <li>• Polish translation</li>
                        <li>• Example sentence</li>
                        <li>• Small drawing or photo (optional)</li>
                    </ul>
                    <p class="text-sm text-blue-400">💡 Tip: Use Quizlet.com to create digital flashcards with pronunciation.</p>
                </div>
                
                <div class="bg-slate-900/50 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-3">2. Video Watching - Advanced Process Understanding</h3>
                    <p class="text-gray-300 mb-3">Watch this video about polymer processing aids in blown film extrusion:</p>
                    <a href="https://www.youtube.com/watch?v=qFW5Y2C0T4s" target="_blank" class="text-blue-400 hover:text-blue-300 block mb-3">
                        "The Mechanics of Blown Film Extrusion" (1:23) →
                    </a>
                    <p class="text-gray-300 mb-3">Write 5-7 sentences explaining:</p>
                    <ul class="text-gray-300 space-y-1 mb-3">
                        <li>• What problem does the left side of the comparison show?</li>
                        <li>• What solution does the right side demonstrate?</li>
                        <li>• Why is this important for film quality?</li>
                    </ul>
                    <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-32 resize-none focus:border-blue-500 focus:outline-none" placeholder="My Video Notes:"></textarea>
                </div>
                
                <div class="bg-slate-900/50 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-3">3. Reading & Writing</h3>
                    <p class="text-gray-300 mb-3">Research online: "What is the difference between blown film extrusion and cast film extrusion?"</p>
                    <p class="text-gray-300 mb-3">Write a short paragraph (50-70 words) explaining the main difference.</p>
                    <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-32 resize-none focus:border-blue-500 focus:outline-none" placeholder="My Answer:"></textarea>
                </div>
            </div>
        </div>
    </section>

    <!-- Navigation Buttons -->
    <div class="flex justify-between mt-8">
        <button id="prev-btn" class="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
            ← Previous Section
        </button>
        <button id="next-btn" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition">
            Next Section →
        </button>
    </div>

</div>

<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ============================================
// CONFIGURATION
// ============================================
let app, db, auth, appId, userId;

// ============================================
// DATA STRUCTURES
// ============================================
const VOCAB_PAIRS = [
    { id: 1, english: "extruder", polish: "wytłaczarka" },
    { id: 2, english: "calender", polish: "kalander" },
    { id: 3, english: "winder", polish: "nawijarka" },
    { id: 4, english: "extruder screw", polish: "ślimak wytłaczarki" },
    { id: 5, english: "die", polish: "dysza/głowica" },
    { id: 6, english: "nip rolls", polish: "walce dociskowe" },
    { id: 7, english: "chill rolls", polish: "walce chłodzące" },
    { id: 8, english: "haul-off unit", polish: "urządzenie ciągnące" },
    { id: 9, english: "slitter", polish: "urządzenie do krojenia" },
    { id: 10, english: "air ring", polish: "pierścień powietrzny" },
    { id: 11, english: "heating zone", polish: "strefa grzewcza" },
    { id: 12, english: "cooling ring", polish: "pierścień chłodzący" },
    { id: 13, english: "barrel", polish: "cylinder/tuleja" },
    { id: 14, english: "screen changer", polish: "wymiennik sit" },
    { id: 15, english: "core", polish: "rdzeń nawijający" }
];

const EQUIPMENT_QUESTIONS = [
    { id: 1, question: "Which picture shows the hopper filled with plastic pellets?", answer: "1" },
    { id: 2, question: "Which picture shows heated rollers with film passing between them?", answer: "2" },
    { id: 3, question: "Which picture shows the extruder barrel with visible heating zones?", answer: "1" },
    { id: 4, question: "Which picture shows a control panel with temperature displays?", answer: "1" },
    { id: 5, question: "Which picture shows film being wound onto a core?", answer: "3" },
    { id: 6, question: "Which picture shows nip rolls pressing the film?", answer: "2" },
    { id: 7, question: "Which picture shows equipment used for the calendering process?", answer: "2" },
    { id: 8, question: "Which picture shows the machine that melts plastic pellets?", answer: "1" }
];

const DIAGRAM_LABELS = [
    { id: 1, word: "hopper", position: 1 },
    { id: 2, word: "resin pellets", position: 2 },
    { id: 3, word: "extruder", position: 3 },
    { id: 4, word: "die", position: 4 },
    { id: 5, word: "air ring", position: 5 },
    { id: 6, word: "bubble", position: 6 },
    { id: 7, word: "collapsing frame", position: 7 },
    { id: 8, word: "nip rolls", position: 8 },
    { id: 9, word: "layflat", position: 9 },
    { id: 10, word: "idler roll", position: 10 },
    { id: 11, word: "roll of film", position: 11 }
];

const PROCESS_QUESTIONS = [
    { id: 1, question: "Where do the resin pellets enter the system?", answer: "hopper" },
    { id: 2, question: "What happens to the plastic in the extruder?", answer: "melted/mixed" },
    { id: 3, question: "What component creates the bubble shape?", answer: "air ring" },
    { id: 4, question: "What is the purpose of the collapsing frame?", answer: "guides bubble" },
    { id: 5, question: "What happens at the nip rolls?", answer: "bubble pressed flat" },
    { id: 6, question: "Where is the finished film collected?", answer: "roll/winder" }
];

const VIDEO_QUESTIONS = [
    { id: 1, text: "The machines used for producing plastic film are called ___ or ___.", answers: ["extruders", "blown film machines"] },
    { id: 2, text: "Plastic pellets are placed into a ___, which is the feeding zone.", answers: ["hopper"] },
    { id: 3, text: "Inside the machine, a ___ rotates, and the plastic pellets get ___ and ___.", answers: ["screw", "heated", "melted"] },
    { id: 4, text: "The material is ___ to remove any minor impurities.", answers: ["filtered"] },
    { id: 5, text: "The melt comes out through a gap at the ___.", answers: ["die head"] },
    { id: 6, text: "The material is blown upwards by an ___, creating a bubble.", answers: ["air ring"] },
    { id: 7, text: "The bubble gets ___ as it goes up the machine.", answers: ["cooler"] },
    { id: 8, text: "At the top, the bubble is flattened by ___, creating a tubular film.", answers: ["nip rolls"] },
    { id: 9, text: "Finally, the film gets ___ into a film roll.", answers: ["wound"] }
];

const DIALOGUE_TF = [
    { id: 1, statement: "The rookie expected the extruder to be smaller.", answer: false },
    { id: 2, statement: "The extruder is compared to a giant mechanical mixer.", answer: true },
    { id: 3, statement: "The temperature today is set to about 150 degrees Celsius.", answer: false },
    { id: 4, statement: "The screen pack filters out contamination and impurities.", answer: true },
    { id: 5, statement: "The rookie compares the bubble formation to blowing up a balloon.", answer: true },
    { id: 6, statement: "The air ring blows hot air onto the plastic.", answer: false },
    { id: 7, statement: "The production rate today is about 60 kilos per hour.", answer: false },
    { id: 8, statement: "The Chief Technologist reminds the rookie about wearing PPE.", answer: true }
];

const DIALOGUE_QUESTIONS = [
    { id: 1, question: "What happens to the plastic pellets inside the barrel?" },
    { id: 2, question: "According to the Chief Technologist, why is filtering important?" },
    { id: 3, question: "What does the rookie notice is 'like blowing up a balloon'?" },
    { id: 4, question: "What happens to the bubble at the nip rolls?" },
    { id: 5, question: "List the 7 main components the Chief Technologist mentions at the end:" }
];

const REFLECTION_QUESTIONS = [
    { id: 1, question: "What was the Chief Technologist's teaching style? Was it effective?" },
    { id: 2, question: "If you were explaining this process to a new colleague, what comparison or analogy would you use?" },
    { id: 3, question: "What safety reminder did the Chief give at the end? Why is this important?" },
    { id: 4, question: "The Chief says the process is 'elegant' once you understand the components. Do you agree?" }
];

const WORD_BUILDING = [
    { verb: "extrude", nounThing: "extrusion / extruder", nounPerson: "", adjective: "extruded" },
    { verb: "wind", nounThing: "winder", nounPerson: "", adjective: "wound" },
    { verb: "cool", nounThing: "cooling / cooler", nounPerson: "", adjective: "cool / cooled" },
    { verb: "heat", nounThing: "heating / heater", nounPerson: "", adjective: "hot / heated" },
    { verb: "compress", nounThing: "compression / compressor", nounPerson: "", adjective: "compressed" },
    { verb: "operate", nounThing: "operation", nounPerson: "operator", adjective: "operational" },
    { verb: "maintain", nounThing: "maintenance", nounPerson: "maintainer", adjective: "maintained" },
    { verb: "control", nounThing: "control / controller", nounPerson: "controller", adjective: "controlled" }
];

// ============================================
// STATE
// ============================================
let currentSection = 0;
let startTime = Date.now();
let timerInterval;
let generatedAssets = {
    images: {},
    audio: null
};
let vocabSelections = { english: null, polish: null };
let totalLoadingSteps = 8; // 3 images + 1 diagram base + 1 diagram edit + 1 audio + 2 setup steps
let completedSteps = 0;

// ============================================
// FIREBASE & UTILITIES
// ============================================
const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : '→';
    const color = type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-blue-400';
    const loadingLog = document.getElementById('loading-log');
    if (loadingLog) {
        loadingLog.innerHTML += `<div class="${color}">[${timestamp}] ${prefix} ${message}</div>`;
        loadingLog.scrollTop = loadingLog.scrollHeight;
    }
};

const updateLoadingProgress = (current, total, message) => {
    const percentage = (current / total) * 100;
    const loadingProgressBar = document.getElementById('loading-progress-bar');
    const loadingText = document.getElementById('loading-text');
    if (loadingProgressBar) loadingProgressBar.style.width = `${percentage}%`;
    if (loadingText) loadingText.textContent = message;
};

async function initFirebase() {
    try {
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        appId = 'worksheet-technical-english-v1';
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Auth flow
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        
        await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    resolve();
                    unsubscribe();
                }
            });
        });
        
        log("Cloud Storage Connected: " + userId.substring(0, 5) + "...", "success");
        completedSteps++;
        updateLoadingProgress(completedSteps, totalLoadingSteps, "Firebase ready");
    } catch (error) {
        log("Offline Mode / Config Error: " + error.message, "error");
        throw error;
    }
}

async function saveAssetToFirestore(assetName, mimeType, base64data) {
    if (!userId) throw new Error("User ID not available");
    
    const MAX_CHUNK_SIZE = 950 * 1024;
    const chunks = [];
    for (let i = 0; i < base64data.length; i += MAX_CHUNK_SIZE) {
        chunks.push(base64data.substring(i, i + MAX_CHUNK_SIZE));
    }
    
    const assetMetaRef = doc(db, 'artifacts', appId, 'users', userId, 'secret_data', assetName);
    await setDoc(assetMetaRef, { mimeType, chunkCount: chunks.length, createdAt: new Date() });
    
    const chunkPromises = chunks.map((chunkData, index) => {
        const chunkRef = doc(db, 'artifacts', appId, 'users', userId, 'secret_data', assetName, 'chunks', String(index));
        return setDoc(chunkRef, { data: chunkData });
    });
    
    await Promise.all(chunkPromises);
}

async function getAssetFromFirestore(assetName) {
    if (!userId) return null;
    
    const assetMetaRef = doc(db, 'artifacts', appId, 'users', userId, 'secret_data', assetName);
    const metaDocSnap = await getDoc(assetMetaRef);
    
    if (!metaDocSnap.exists()) return null;
    
    const { mimeType, chunkCount } = metaDocSnap.data();
    const chunkPromises = [];
    for (let i = 0; i < chunkCount; i++) {
        const chunkRef = doc(db, 'artifacts', appId, 'users', userId, 'secret_data', assetName, 'chunks', String(i));
        chunkPromises.push(getDoc(chunkRef));
    }
    
    const chunkDocs = await Promise.all(chunkPromises);
    let base64data = '';
    for (const chunkDoc of chunkDocs) {
        if (chunkDoc.exists()) {
            base64data += chunkDoc.data().data;
        } else {
            return null;
        }
    }
    
    return { base64data, mimeType };
}

// ============================================
// API CALLS WITH RETRY
// ============================================
const callWithRetry = async (apiCall, maxRetries = 5, initialDelay = 2000) => {
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
};

const generateImage = async (prompt, aspectRatio = "16:9") => {
    return callWithRetry(async () => {
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1, aspectRatio: aspectRatio }
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        
        if (result.predictions?.[0]?.bytesBase64Encoded) {
            return result.predictions[0].bytesBase64Encoded;
        }
        throw new Error("Invalid image data");
    });
};

const generateTTS = async (text) => {
    return callWithRetry(async () => {
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: [
                                { speaker: "Rookie", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
                                { speaker: "Chief", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
                            ]
                        }
                    }
                }
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        
        if (part?.inlineData?.data) {
            return part.inlineData.data;
        }
        throw new Error("Invalid audio data");
    });
};

// ============================================
// AUDIO CONVERSION UTILITIES
// ============================================
const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const pcmToWav = (pcmData, sampleRate = 24000) => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length * pcmData.BYTES_PER_ELEMENT;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    view.setUint32(0, 0x52494646, false); view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); view.setUint32(12, 0x666d7420, false);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true); view.setUint32(36, 0x64617461, false);
    view.setUint32(40, dataSize, true);
    
    const pcm16 = new Int16Array(pcmData.buffer);
    for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(44 + i * 2, pcm16[i], true);
    }
    return new Blob([view], { type: 'audio/wav' });
};

// ============================================
// ASSET GENERATION & LOADING
// ============================================
async function loadOrGenerateAssets() {
    try {
        // Generate Equipment Images
        const equipmentPrompts = [
            "Industrial plastic extruder machine with hopper on top filled with white plastic pellets, horizontal barrel with orange heating bands visible, control panel with temperature displays, industrial factory setting, professional photography, 8k quality",
            "Industrial calender machine with two large heated steel rollers, thin plastic film passing between the rollers, pressure mechanism visible, clean industrial setting, professional equipment photography, 8k quality",
            "Industrial film winder machine with large roll of clear plastic film being wound onto a cardboard core, tension control system visible, modern factory setting, professional photography, 8k quality"
        ];
        
        for (let i = 0; i < equipmentPrompts.length; i++) {
            const assetId = `equipment_img_${i + 1}`;
            log(`Generating equipment image ${i + 1}/3...`, 'info');
            
            let assetData = await getAssetFromFirestore(assetId);
            if (!assetData) {
                const base64 = await generateImage(equipmentPrompts[i], "4:3");
                await saveAssetToFirestore(assetId, 'image/png', base64);
                assetData = { base64data: base64, mimeType: 'image/png' };
                log(`Equipment image ${i + 1} generated`, 'success');
            } else {
                log(`Equipment image ${i + 1} loaded from cache`, 'success');
            }
            
            generatedAssets.images[assetId] = `data:${assetData.mimeType};base64,${assetData.base64data}`;
            const imgElement = document.getElementById(`equipment-img-${i + 1}`);
            imgElement.src = generatedAssets.images[assetId];
            imgElement.dataset.base64 = assetData.base64data;
            imgElement.dataset.mime = assetData.mimeType;
            
            completedSteps++;
            updateLoadingProgress(completedSteps, totalLoadingSteps, `Equipment image ${i + 1}/3 ready`);
        }
        
        // Generate Diagram (Two-step process for reliability)
        log('Generating process diagram...', 'info');
        let diagramData = await getAssetFromFirestore('diagram_img_edited');
        
        if (!diagramData) {
            // Step 1: Generate initial diagram
            const diagramPrompt = "Technical diagram of blown film extrusion process showing vertical flow from bottom to top: hopper at bottom feeding horizontal extruder machine, circular die head with air ring creating upward bubble, triangular collapsing frame guiding bubble, nip rolls at top flattening bubble, idler rolls, and final roll of film. Clear arrows showing flow direction, professional technical illustration style, clean white background, detailed engineering diagram";
            
            log('Step 1: Generating base diagram...', 'info');
            const baseBase64 = await generateImage(diagramPrompt, "4:3");
            completedSteps++;
            updateLoadingProgress(completedSteps, totalLoadingSteps, 'Base diagram generated');
            
            // Step 2: Edit to remove labels and add numbers
            log('Step 2: Removing labels and adding numbers...', 'info');
            const editedBase64 = await callWithRetry(async () => {
                const apiKey = "";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
                
                const editPrompt = "Remove ALL text labels from this diagram and replace them with ONLY numbered circles (1-11) with clear arrows pointing to each component. Number them in vertical order from bottom to top: 1=hopper/feeding system at bottom, 2=material/pellets, 3=horizontal extruder machine, 4=die head at end, 5=air ring around die, 6=bubble rising upward, 7=triangular collapsing frame, 8=nip rolls at top, 9=flattened film, 10=guide roller, 11=final roll. Keep diagram structure identical, ONLY replace text with numbers 1-11.";
                
                const payload = {
                    contents: [{
                        parts: [
                            { text: editPrompt },
                            {
                                inlineData: {
                                    mimeType: "image/png",
                                    data: baseBase64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE']
                    }
                };
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                
                const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
                if (!base64Data) {
                    throw new Error("Invalid image data in editing response");
                }
                
                return base64Data;
            });
            
            await saveAssetToFirestore('diagram_img_edited', 'image/png', editedBase64);
            diagramData = { base64data: editedBase64, mimeType: 'image/png' };
            log('Diagram generated and edited successfully', 'success');
            completedSteps++;
            updateLoadingProgress(completedSteps, totalLoadingSteps, 'Diagram ready (labels removed)');
        } else {
            log('Diagram loaded from cache', 'success');
            completedSteps += 2; // Skip both generation and editing steps
            updateLoadingProgress(completedSteps, totalLoadingSteps, 'Diagram loaded from cache');
        }
        
        generatedAssets.images['diagram_img'] = `data:${diagramData.mimeType};base64,${diagramData.base64data}`;
        const diagramElement = document.getElementById('diagram-img');
        diagramElement.src = generatedAssets.images['diagram_img'];
        diagramElement.dataset.base64 = diagramData.base64data;
        diagramElement.dataset.mime = diagramData.mimeType;
        
        completedSteps++;
        updateLoadingProgress(completedSteps, totalLoadingSteps, 'Diagram ready');
        
        // Generate Audio Dialogue
        const dialogueScript = `TTS the following conversation between Rookie and Chief on the production floor:

Rookie: Wow, Chief! This extruder is much bigger than I expected!

Chief: Ha! Yeah, it's impressive, isn't it? Think of it like a giant mechanical mixer. See that hopper on top? That's where we feed in the plastic pellets.

Rookie: And what happens inside the barrel?

Chief: Inside, there's a rotating screw that moves the pellets forward while heating zones melt them. We're running at about 190 degrees Celsius today. The screw also mixes everything thoroughly.

Rookie: I see those orange bands - are those the heating zones?

Chief: Exactly! And here, before the die, we have a screen pack. It filters out any contamination or impurities. Quality control starts at the source.

Rookie: So the melt comes out through that circular die at the end?

Chief: Right! And that's where it gets interesting. See that ring around the die? That's the air ring. It blows cool air onto the plastic as we inflate it into a bubble - kind of like blowing up a balloon!

Rookie: Oh wow, that's exactly what it looks like! And it keeps going up?

Chief: Yes, as the bubble rises, it cools and solidifies. Then at the top, those nip rolls press it flat, and we wind it onto a roll. We're running at about 80 kilos per hour today.

Rookie: This is fascinating! So the main components are: hopper, extruder with screw, screen pack, die, air ring, nip rolls, and winder?

Chief: Perfect summary! You're getting it. Now remember - always wear your safety glasses and keep clear of the nip rolls. They don't care if it's plastic or fingers.

Rookie: Got it, Chief. Safety first!`;
        
        log('Generating dialogue audio...', 'info');
        let audioData = await getAssetFromFirestore('dialogue_audio');
        if (!audioData) {
            const pcmBase64 = await generateTTS(dialogueScript);
            await saveAssetToFirestore('dialogue_audio', 'audio/pcm;rate=24000', pcmBase64);
            audioData = { base64data: pcmBase64, mimeType: 'audio/pcm;rate=24000' };
            log('Audio dialogue generated', 'success');
        } else {
            log('Audio dialogue loaded from cache', 'success');
        }
        
        const sampleRate = parseInt(audioData.mimeType.match(/rate=(\d+)/)[1], 10);
        const pcmArray = new Int16Array(base64ToArrayBuffer(audioData.base64data));
        const wavBlob = pcmToWav(pcmArray, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        generatedAssets.audio = { url: audioUrl, element: new Audio(audioUrl) };
        document.getElementById('dialogue-audio').src = audioUrl;
        
        completedSteps++;
        updateLoadingProgress(completedSteps, totalLoadingSteps, 'Audio dialogue ready');
        
        log('All assets loaded successfully!', 'success');
        completedSteps++;
        updateLoadingProgress(completedSteps, totalLoadingSteps, 'Complete!');
        
    } catch (error) {
        log(`Asset generation failed: ${error.message}`, 'error');
        throw error;
    }
}

// ============================================
// UI INITIALIZATION
// ============================================
function initializeUI() {
    // Vocabulary Matching
    const englishTermsEl = document.getElementById('english-terms');
    const polishTermsEl = document.getElementById('polish-terms');
    
    VOCAB_PAIRS.forEach(pair => {
        const engCard = document.createElement('div');
        engCard.className = 'vocab-card bg-slate-900 p-3 rounded-lg border-2 border-slate-700';
        engCard.dataset.id = pair.id;
        engCard.dataset.type = 'english';
        engCard.textContent = pair.english;
        englishTermsEl.appendChild(engCard);
        
        const polCard = document.createElement('div');
        polCard.className = 'vocab-card bg-slate-900 p-3 rounded-lg border-2 border-slate-700';
        polCard.dataset.id = pair.id;
        polCard.dataset.type = 'polish';
        polCard.textContent = pair.polish;
        polishTermsEl.appendChild(polCard);
    });
    
    // Equipment Questions
    const equipmentQuestionsEl = document.getElementById('equipment-questions');
    EQUIPMENT_QUESTIONS.forEach(q => {
        const div = document.createElement('div');
        div.className = 'bg-slate-900/50 p-4 rounded-lg';
        div.innerHTML = `
            <p class="font-semibold mb-2">${q.id}. ${q.question}</p>
            <select class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white" data-question-id="${q.id}">
                <option value="">Select a picture...</option>
                <option value="1">Picture 1</option>
                <option value="2">Picture 2</option>
                <option value="3">Picture 3</option>
            </select>
        `;
        equipmentQuestionsEl.appendChild(div);
    });
    
    // Diagram Labels Word Bank
    const labelWordBankEl = document.getElementById('label-word-bank');
    DIAGRAM_LABELS.forEach(label => {
        const span = document.createElement('span');
        span.className = 'draggable-label bg-blue-600 px-3 py-1 rounded-lg cursor-move text-sm';
        span.textContent = label.word;
        span.draggable = true;
        span.dataset.word = label.word;
        labelWordBankEl.appendChild(span);
    });
    
    // Diagram Drop Zones
    const diagramDropZonesEl = document.getElementById('diagram-drop-zones');
    DIAGRAM_LABELS.forEach(label => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-3';
        div.innerHTML = `
            <span class="w-6 text-center font-bold">${label.position}.</span>
            <div class="drop-zone flex-1 rounded-lg p-2 text-center" data-position="${label.position}">
                Drop label here
            </div>
        `;
        diagramDropZonesEl.appendChild(div);
    });
    
    // Process Flow Questions
    const processQuestionsEl = document.getElementById('process-questions');
    PROCESS_QUESTIONS.forEach(q => {
        const div = document.createElement('div');
        div.className = 'bg-slate-900/50 p-4 rounded-lg';
        div.innerHTML = `
            <p class="font-semibold mb-2">${q.id}. ${q.question}</p>
            <input type="text" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white" placeholder="Your answer...">
        `;
        processQuestionsEl.appendChild(div);
    });
    
    // Video Questions
    const videoQuestionsEl = document.getElementById('video-questions');
    VIDEO_QUESTIONS.forEach(q => {
        const div = document.createElement('div');
        div.className = 'bg-slate-900/50 p-4 rounded-lg';
        div.innerHTML = `
            <p class="mb-2">${q.id}. ${q.text}</p>
            <input type="text" class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white" placeholder="Fill in the blank(s)...">
        `;
        videoQuestionsEl.appendChild(div);
    });
    
    // Dialogue True/False
    const dialogueTFEl = document.getElementById('dialogue-tf-questions');
    DIALOGUE_TF.forEach(q => {
        const div = document.createElement('div');
        div.className = 'bg-slate-900/50 p-3 rounded-lg flex items-center justify-between';
        div.innerHTML = `
            <span class="flex-1">${q.id}. ${q.statement}</span>
            <div class="flex gap-2">
                <button class="tf-btn px-4 py-1 bg-slate-700 hover:bg-green-600 rounded" data-value="true">True</button>
                <button class="tf-btn px-4 py-1 bg-slate-700 hover:bg-red-600 rounded" data-value="false">False</button>
            </div>
        `;
        dialogueTFEl.appendChild(div);
    });
    
    // Dialogue Questions
    const dialogueQuestionsEl = document.getElementById('dialogue-questions');
    DIALOGUE_QUESTIONS.forEach(q => {
        const div = document.createElement('div');
        div.className = 'bg-slate-900/50 p-4 rounded-lg';
        div.innerHTML = `
            <p class="font-semibold mb-2">${q.id}. ${q.question}</p>
            <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-24 resize-none" placeholder="Your answer..."></textarea>
        `;
        dialogueQuestionsEl.appendChild(div);
    });
    
    // Reflection Questions
    const reflectionQuestionsEl = document.getElementById('reflection-questions');
    REFLECTION_QUESTIONS.forEach(q => {
        const div = document.createElement('div');
        div.className = 'bg-slate-900/50 p-4 rounded-lg';
        div.innerHTML = `
            <p class="font-semibold mb-2">${q.question}</p>
            <textarea class="question-input w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white h-24 resize-none" placeholder="Your thoughts..."></textarea>
        `;
        reflectionQuestionsEl.appendChild(div);
    });
    
    // Word Building Table
    const wordBuildingTableEl = document.getElementById('word-building-table');
    WORD_BUILDING.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/50';
        tr.innerHTML = `
            <td class="p-3 border border-slate-700">
                <input type="text" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white" value="${row.verb}">
            </td>
            <td class="p-3 border border-slate-700">
                <input type="text" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white" placeholder="${row.nounThing}">
            </td>
            <td class="p-3 border border-slate-700">
                <input type="text" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white" placeholder="${row.nounPerson}">
            </td>
            <td class="p-3 border border-slate-700">
                <input type="text" class="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white" placeholder="${row.adjective}">
            </td>
        `;
        wordBuildingTableEl.appendChild(tr);
    });
    
    setupEventListeners();
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Navigation
    document.getElementById('prev-btn').addEventListener('click', () => navigateSection(-1));
    document.getElementById('next-btn').addEventListener('click', () => navigateSection(1));
    
    document.querySelectorAll('.nav-dot').forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSection = index;
            updateSectionDisplay();
        });
    });
    
    // Vocabulary Matching
    document.querySelectorAll('.vocab-card').forEach(card => {
        card.addEventListener('click', handleVocabClick);
    });
    
    document.getElementById('check-vocab-btn').addEventListener('click', checkVocabAnswers);
    document.getElementById('reset-vocab-btn').addEventListener('click', resetVocabExercise);
    
    // Equipment Questions
    document.getElementById('check-equipment-btn').addEventListener('click', checkEquipmentAnswers);
    
    // Diagram Drag & Drop
    setupDragAndDrop();
    document.getElementById('check-labels-btn').addEventListener('click', checkLabelAnswers);
    
    // Diagram Manual Editing
    document.getElementById('edit-diagram-btn').addEventListener('click', editDiagramWithAI);
    
    // Audio Player
    const playBtn = document.getElementById('play-audio-btn');
    const audio = document.getElementById('dialogue-audio');
    const visualizer = document.getElementById('audio-visualizer');
    
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            document.getElementById('play-icon').textContent = '⏸';
            document.getElementById('play-text').textContent = 'Pause Audio';
            visualizer.classList.remove('hidden');
        } else {
            audio.pause();
            document.getElementById('play-icon').textContent = '▶';
            document.getElementById('play-text').textContent = 'Play Audio';
            visualizer.classList.add('hidden');
        }
    });
    
    audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        document.getElementById('audio-progress').style.width = `${progress}%`;
        document.getElementById('audio-time').textContent = 
            `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });
    
    audio.addEventListener('ended', () => {
        document.getElementById('play-icon').textContent = '▶';
        document.getElementById('play-text').textContent = 'Play Audio';
        visualizer.classList.add('hidden');
    });
    
    // Word Count for Problem Report
    const problemReportText = document.getElementById('problem-report-text');
    problemReportText.addEventListener('input', () => {
        const words = problemReportText.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        document.getElementById('word-count').textContent = `${words} words`;
        
        const status = document.getElementById('word-count-status');
        if (words < 80) {
            status.textContent = 'Too short (minimum 80)';
            status.className = 'text-red-400';
        } else if (words > 100) {
            status.textContent = 'Too long (maximum 100)';
            status.className = 'text-red-400';
        } else {
            status.textContent = 'Perfect length ✓';
            status.className = 'text-green-400';
        }
    });
    
    // Save Progress
    document.getElementById('save-progress-btn').addEventListener('click', saveProgress);
    
    // Download Offline
    document.getElementById('download-offline-btn').addEventListener('click', downloadOfflineWorksheet);
}

// ============================================
// VOCABULARY MATCHING LOGIC
// ============================================
function handleVocabClick(e) {
    const card = e.currentTarget;
    const type = card.dataset.type;
    const id = card.dataset.id;
    
    // Toggle selection
    if (vocabSelections[type] === id) {
        vocabSelections[type] = null;
        card.classList.remove('border-blue-500');
        card.style.borderColor = '#374151';
    } else {
        // Clear previous selection of same type
        document.querySelectorAll(`.vocab-card[data-type="${type}"]`).forEach(c => {
            c.classList.remove('border-blue-500');
            c.style.borderColor = '#374151';
        });
        
        vocabSelections[type] = id;
        card.classList.add('border-blue-500');
        card.style.borderColor = '#3b82f6';
    }
    
    // If both selected, check match
    if (vocabSelections.english && vocabSelections.polish) {
        if (vocabSelections.english === vocabSelections.polish) {
            // Correct match
            document.querySelectorAll('.vocab-card').forEach(c => {
                if (c.dataset.id === vocabSelections.english) {
                    c.classList.add('correct');
                    c.style.pointerEvents = 'none';
                }
            });
        }
        
        // Reset selections
        vocabSelections = { english: null, polish: null };
    }
}

function checkVocabAnswers() {
    let correct = 0;
    document.querySelectorAll('.vocab-card').forEach(card => {
        if (card.classList.contains('correct')) correct++;
    });
    
    const score = correct / 2; // Each correct pair counts once
    document.getElementById('vocab-score').classList.remove('hidden');
    document.getElementById('vocab-score-value').textContent = `${score}/15`;
}

function resetVocabExercise() {
    document.querySelectorAll('.vocab-card').forEach(card => {
        card.classList.remove('correct', 'border-blue-500');
        card.style.borderColor = '#374151';
        card.style.pointerEvents = 'auto';
    });
    vocabSelections = { english: null, polish: null };
    document.getElementById('vocab-score').classList.add('hidden');
}

// ============================================
// EQUIPMENT QUESTIONS LOGIC
// ============================================
function checkEquipmentAnswers() {
    let correct = 0;
    document.querySelectorAll('#equipment-questions select').forEach(select => {
        const questionId = select.dataset.questionId;
        const question = EQUIPMENT_QUESTIONS.find(q => q.id == questionId);
        const userAnswer = select.value;
        
        if (userAnswer === question.answer) {
            select.style.borderColor = '#10b981';
            correct++;
        } else {
            select.style.borderColor = '#ef4444';
        }
    });
    
    alert(`You got ${correct} out of ${EQUIPMENT_QUESTIONS.length} correct!`);
}

// ============================================
// DRAG & DROP FOR DIAGRAM LABELS
// ============================================
function setupDragAndDrop() {
    const draggables = document.querySelectorAll('.draggable-label');
    const dropZones = document.querySelectorAll('.drop-zone');
    
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });
        
        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
        });
    });
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const dragging = document.querySelector('.dragging');
            if (dragging) {
                // Clear zone if already filled
                zone.innerHTML = '';
                
                // Clone the label
                const clone = dragging.cloneNode(true);
                clone.classList.remove('dragging');
                clone.draggable = false;
                zone.appendChild(clone);
                zone.classList.add('filled');
                
                // Hide original
                dragging.style.display = 'none';
            }
        });
    });
}

function checkLabelAnswers() {
    let correct = 0;
    document.querySelectorAll('.drop-zone').forEach(zone => {
        const position = zone.dataset.position;
        const label = DIAGRAM_LABELS.find(l => l.position == position);
        const dropped = zone.textContent.trim();
        
        if (dropped === label.word) {
            zone.style.borderColor = '#10b981';
            correct++;
        } else {
            zone.style.borderColor = '#ef4444';
        }
    });
    
    alert(`You labeled ${correct} out of ${DIAGRAM_LABELS.length} correctly!`);
}

// ============================================
// NAVIGATION & PROGRESS
// ============================================
function navigateSection(direction) {
    const newSection = currentSection + direction;
    if (newSection >= 0 && newSection <= 7) {
        currentSection = newSection;
        updateSectionDisplay();
    }
}

function updateSectionDisplay() {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show current section
    document.getElementById(`section-${currentSection}`).classList.add('active');
    
    // Update navigation dots
    document.querySelectorAll('.nav-dot').forEach((dot, index) => {
        dot.classList.remove('active', 'completed');
        if (index === currentSection) {
            dot.classList.add('active');
        } else if (index < currentSection) {
            dot.classList.add('completed');
        }
    });
    
    // Update progress bar
    const progress = (currentSection / 7) * 100;
    document.getElementById('progress-bar-fill').style.width = `${progress}%`;
    
    // Update buttons
    document.getElementById('prev-btn').disabled = currentSection === 0;
    document.getElementById('next-btn').textContent = currentSection === 7 ? 'Complete ✓' : 'Next Section →';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// TIMER
// ============================================
function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('timer').textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ============================================
// SAVE PROGRESS
// ============================================
async function saveProgress() {
    const button = document.getElementById('save-progress-btn');
    const originalText = button.textContent;
    button.textContent = '💾 Saving...';
    button.disabled = true;
    
    try {
        // Collect all user inputs
        const progressData = {
            currentSection,
            timeElapsed: Date.now() - startTime,
            answers: {}
        };
        
        // Save to Firestore
        const progressRef = doc(db, 'artifacts', appId, 'users', userId, 'secret_data', 'progress');
        await setDoc(progressRef, progressData);
        
        button.textContent = '✓ Saved!';
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Save failed:', error);
        button.textContent = '✗ Save Failed';
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }
}

// ============================================
// DIAGRAM EDITING WITH AI
// ============================================
async function editDiagramWithAI() {
    const button = document.getElementById('edit-diagram-btn');
    const statusEl = document.getElementById('diagram-edit-status');
    const promptInput = document.getElementById('diagram-edit-prompt');
    const originalButtonText = button.textContent;
    
    // Get custom prompt or use default
    let userPrompt = promptInput.value.trim();
    if (!userPrompt) {
        userPrompt = "Remove all text labels from this diagram and replace them with ONLY numbered circles (1 through 11) with arrows pointing to each component in this order: 1=hopper at bottom, 2=resin pellets, 3=horizontal extruder, 4=die at end of extruder, 5=air ring around die, 6=bubble going upward, 7=triangular collapsing frame, 8=nip rolls at top, 9=layflat film, 10=idler roll, 11=final roll of film. Keep the diagram structure identical, only change text to numbers.";
    }
    
    button.textContent = '✏️ Editing...';
    button.disabled = true;
    statusEl.textContent = 'Processing...';
    statusEl.className = 'ml-3 text-sm text-blue-400';
    
    try {
        // Get current diagram
        const diagramImg = document.getElementById('diagram-img');
        let base64Image = diagramImg.dataset.base64;
        
        if (!base64Image) {
            throw new Error("Diagram not loaded yet");
        }
        
        log('Editing diagram with gemini-2.5-flash-image-preview...', 'info');
        
        // Call gemini-2.5-flash-image-preview for image editing
        const editedBase64 = await callWithRetry(async () => {
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{
                    parts: [
                        { text: userPrompt },
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: base64Image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    responseModalities: ['IMAGE']
                }
            };
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            
            const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (!base64Data) {
                throw new Error("Invalid image data in response");
            }
            
            return base64Data;
        });
        
        // Update diagram in DOM
        const newDataUrl = `data:image/png;base64,${editedBase64}`;
        diagramImg.src = newDataUrl;
        diagramImg.dataset.base64 = editedBase64;
        generatedAssets.images['diagram_img'] = newDataUrl;
        
        // Save edited diagram to Firebase
        await saveAssetToFirestore('diagram_img_edited', 'image/png', editedBase64);
        
        log('Diagram edited successfully!', 'success');
        button.textContent = '✓ Edited!';
        statusEl.textContent = 'Success! Diagram updated.';
        statusEl.className = 'ml-3 text-sm text-green-400';
        
        setTimeout(() => {
            button.textContent = originalButtonText;
            button.disabled = false;
            statusEl.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('Diagram editing failed:', error);
        log(`Diagram editing failed: ${error.message}`, 'error');
        button.textContent = '✗ Failed';
        statusEl.textContent = 'Error: ' + error.message;
        statusEl.className = 'ml-3 text-sm text-red-400';
        
        setTimeout(() => {
            button.textContent = originalButtonText;
            button.disabled = false;
        }, 3000);
    }
}

// ============================================
// DOWNLOAD OFFLINE FUNCTIONALITY
// ============================================
async function downloadOfflineWorksheet() {
    const button = document.getElementById('download-offline-btn');
    const originalText = button.textContent;
    button.textContent = '⬇ Preparing...';
    button.disabled = true;
    
    try {
        log("Preparing offline download...", "info");
        
        // Clone the entire HTML
        const clone = document.documentElement.cloneNode(true);
        
        // Remove loading screen
        const loadingScreen = clone.querySelector('#loading-screen');
        if (loadingScreen) loadingScreen.remove();
        
        // Show main container
        const mainContainer = clone.querySelector('#main-container');
        if (mainContainer) mainContainer.classList.remove('hidden');
        
        // Embed all images as base64
        const images = clone.querySelectorAll('img');
        images.forEach(img => {
            // Images are already data: URLs, but ensure they're properly set
            if (img.dataset.base64 && img.dataset.mime) {
                img.src = `data:${img.dataset.mime};base64,${img.dataset.base64}`;
            }
        });
        
        // Embed audio as base64
        const audio = clone.querySelector('#dialogue-audio');
        if (audio && generatedAssets.audio?.url) {
            // Convert blob URL to base64
            const response = await fetch(generatedAssets.audio.url);
            const blob = await response.blob();
            const reader = new FileReader();
            const base64Audio = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            audio.src = base64Audio;
        }
        
        // Remove Firebase-related buttons
        const saveBtn = clone.querySelector('#save-progress-btn');
        if (saveBtn) saveBtn.remove();
        const downloadBtn = clone.querySelector('#download-offline-btn');
        if (downloadBtn) downloadBtn.remove();
        
        // Remove all existing scripts
        const scripts = clone.querySelectorAll('script[type="module"]');
        scripts.forEach(script => script.remove());
        
        // Create simplified offline script
        const offlineScript = document.createElement('script');
        offlineScript.textContent = `
// ============================================
// OFFLINE MODE - SIMPLIFIED SCRIPT
// ============================================
let currentSection = 0;
let startTime = Date.now();
let timerInterval;
let vocabSelections = { english: null, polish: null };

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('timer').textContent = 
            String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }, 1000);
}

// Navigation
function navigateSection(direction) {
    const newSection = currentSection + direction;
    if (newSection >= 0 && newSection <= 7) {
        currentSection = newSection;
        updateSectionDisplay();
    }
}

function updateSectionDisplay() {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('section-' + currentSection).classList.add('active');
    
    document.querySelectorAll('.nav-dot').forEach((dot, index) => {
        dot.classList.remove('active', 'completed');
        if (index === currentSection) {
            dot.classList.add('active');
        } else if (index < currentSection) {
            dot.classList.add('completed');
        }
    });
    
    const progress = (currentSection / 7) * 100;
    document.getElementById('progress-bar-fill').style.width = progress + '%';
    
    document.getElementById('prev-btn').disabled = currentSection === 0;
    document.getElementById('next-btn').textContent = currentSection === 7 ? 'Complete ✓' : 'Next Section →';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Vocabulary matching
function handleVocabClick(e) {
    const card = e.currentTarget;
    const type = card.dataset.type;
    const id = card.dataset.id;
    
    if (vocabSelections[type] === id) {
        vocabSelections[type] = null;
        card.classList.remove('border-blue-500');
        card.style.borderColor = '#374151';
    } else {
        document.querySelectorAll('.vocab-card[data-type="' + type + '"]').forEach(c => {
            c.classList.remove('border-blue-500');
            c.style.borderColor = '#374151';
        });
        vocabSelections[type] = id;
        card.classList.add('border-blue-500');
        card.style.borderColor = '#3b82f6';
    }
    
    if (vocabSelections.english && vocabSelections.polish) {
        if (vocabSelections.english === vocabSelections.polish) {
            document.querySelectorAll('.vocab-card').forEach(c => {
                if (c.dataset.id === vocabSelections.english) {
                    c.classList.add('correct');
                    c.style.pointerEvents = 'none';
                }
            });
        }
        vocabSelections = { english: null, polish: null };
    }
}

// Audio player
function setupAudioPlayer() {
    const playBtn = document.getElementById('play-audio-btn');
    const audio = document.getElementById('dialogue-audio');
    const visualizer = document.getElementById('audio-visualizer');
    
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            document.getElementById('play-icon').textContent = '⏸';
            document.getElementById('play-text').textContent = 'Pause Audio';
            visualizer.classList.remove('hidden');
        } else {
            audio.pause();
            document.getElementById('play-icon').textContent = '▶';
            document.getElementById('play-text').textContent = 'Play Audio';
            visualizer.classList.add('hidden');
        }
    });
    
    audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        document.getElementById('audio-progress').style.width = progress + '%';
        
        const formatTime = (s) => {
            const mins = Math.floor(s / 60);
            const secs = Math.floor(s % 60);
            return mins + ':' + String(secs).padStart(2, '0');
        };
        
        document.getElementById('audio-time').textContent = 
            formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
    });
    
    audio.addEventListener('ended', () => {
        document.getElementById('play-icon').textContent = '▶';
        document.getElementById('play-text').textContent = 'Play Audio';
        visualizer.classList.add('hidden');
    });
}

// Word count
function setupWordCount() {
    const problemReportText = document.getElementById('problem-report-text');
    if (problemReportText) {
        problemReportText.addEventListener('input', () => {
            const words = problemReportText.value.trim().split(/\\s+/).filter(w => w.length > 0).length;
            document.getElementById('word-count').textContent = words + ' words';
            
            const status = document.getElementById('word-count-status');
            if (words < 80) {
                status.textContent = 'Too short (minimum 80)';
                status.className = 'text-red-400';
            } else if (words > 100) {
                status.textContent = 'Too long (maximum 100)';
                status.className = 'text-red-400';
            } else {
                status.textContent = 'Perfect length ✓';
                status.className = 'text-green-400';
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.getElementById('prev-btn').addEventListener('click', () => navigateSection(-1));
    document.getElementById('next-btn').addEventListener('click', () => navigateSection(1));
    
    document.querySelectorAll('.nav-dot').forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSection = index;
            updateSectionDisplay();
        });
    });
    
    // Vocabulary
    document.querySelectorAll('.vocab-card').forEach(card => {
        card.addEventListener('click', handleVocabClick);
    });
    
    // Audio
    setupAudioPlayer();
    
    // Word count
    setupWordCount();
    
    // Start timer
    startTimer();
    updateSectionDisplay();
});
`;
        
        clone.querySelector('body').appendChild(offlineScript);
        
        // Add offline indicator
        const header = clone.querySelector('header h1');
        if (header) {
            header.textContent += ' (Offline Version)';
        }
        
        // Generate final HTML
        const finalHtml = '<!DOCTYPE html>\n' + clone.outerHTML;
        const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Technical_English_Worksheet_Offline.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        log("Offline file downloaded successfully!", "success");
        button.textContent = '✓ Downloaded!';
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Download failed:', error);
        log("Download failed: " + error.message, "error");
        button.textContent = '✗ Download Failed';
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }
}

// ============================================
// MAIN INITIALIZATION
// ============================================
async function init() {
    try {
        await initFirebase();
        await loadOrGenerateAssets();
        
        // Hide loading, show main container
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('main-container').classList.remove('hidden');
            
            initializeUI();
            startTimer();
            updateSectionDisplay();
        }, 1000);
        
    } catch (error) {
        log('Initialization failed: ' + error.message, 'error');
        console.error(error);
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
</script>

</body>
</html>
</FULL APP WORKING EXAMPLE>


