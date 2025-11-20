# Canvas Library

A comprehensive abstraction layer for building Gemini Canvas apps. Eliminates boilerplate code and handles all the quirks of the Canvas environment (Firebase, Gemini API, Firestore, asset management).

## 🚀 Quick Start

```javascript
import { initCanvas } from './canvas-lib.js';

// Initialize everything with one line
const { app, gemini, firestore, assets, ui } = await initCanvas('my-app-id');

// Generate an image (with auto-retry & caching)
const imageUrl = await assets.getImage('hero-image', 'A futuristic city at sunset');
document.getElementById('myImage').src = imageUrl;

// Generate text
const text = await gemini.generateText('Explain quantum computing in simple terms');

// Save data to Firestore
await firestore.save('user-preferences', { theme: 'dark', language: 'en' });

// Load data from Firestore
const prefs = await firestore.load('user-preferences');
```

That's it! **~200 lines of boilerplate reduced to ~5 lines.**

---

## 📦 What's Included

### 1. **CanvasApp** - Firebase Initialization
Handles all Canvas environment quirks:
- ✅ Automatic detection of `__firebase_config`
- ✅ Automatic detection of `__app_id`
- ✅ Authentication with `__initial_auth_token` or anonymous fallback
- ✅ User ID management

### 2. **GeminiAPI** - AI Model Client
All Gemini models with automatic retry logic:
- ✅ Text generation (with Google Search grounding)
- ✅ Structured JSON responses
- ✅ Image analysis
- ✅ Image generation (Imagen)
- ✅ Image editing (gemini-2.5-flash-image-preview)
- ✅ Text-to-Speech (single & multi-speaker)
- ✅ Exponential backoff retry (no more 429 errors!)

### 3. **FirestoreManager** - Data Persistence
Smart Firestore operations with automatic chunking:
- ✅ Automatic public/private path handling
- ✅ Chunking for large data (>1MB)
- ✅ Save/Load/Delete operations
- ✅ Asset storage (images, audio) with chunking

### 4. **AssetManager** - Smart Caching
Generate once, cache forever:
- ✅ Generate images with Firestore caching
- ✅ Generate audio with PCM→WAV conversion
- ✅ Memory + Firestore dual-layer caching
- ✅ Parallel asset preloading
- ✅ Progress callbacks

### 5. **UIHelpers** - Common UI Patterns
Pre-built UI components:
- ✅ Loading overlays
- ✅ Toast notifications
- ✅ Progress bars
- ✅ Tailwind-styled components

---

## 📖 Detailed Usage

### Initialization

```javascript
import { initCanvas } from './canvas-lib.js';

// Method 1: Quick start (recommended)
const { app, gemini, firestore, assets, ui } = await initCanvas('my-app-id');

// Method 2: Manual (if you need more control)
import { CanvasApp, GeminiAPI, FirestoreManager, AssetManager, UIHelpers } from './canvas-lib.js';

const app = new CanvasApp('my-app-id');
await app.initialize();

const gemini = new GeminiAPI();
const firestore = new FirestoreManager(app);
const assets = new AssetManager(app, firestore, gemini);
```

---

### Text Generation

```javascript
// Basic text generation
const text = await gemini.generateText('Explain quantum computing');

// With system prompt
const text = await gemini.generateText(
  'What is the capital of France?',
  {
    systemPrompt: 'You are a helpful geography tutor.',
    temperature: 0.7,
    maxTokens: 500
  }
);

// With Google Search grounding
const text = await gemini.generateText(
  'What are the latest news about AI?',
  { googleSearch: true }
);
```

---

### Structured JSON Responses

```javascript
// Define your schema
const schema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    keyPoints: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    sentiment: {
      type: "STRING",
      enum: ["positive", "negative", "neutral"]
    }
  }
};

// Get structured data
const result = await gemini.generateJSON(
  'Analyze this product review: "Great phone, but battery life could be better."',
  schema
);

console.log(result);
// {
//   summary: "Mixed review with positive overall sentiment",
//   keyPoints: ["Good phone quality", "Poor battery life"],
//   sentiment: "positive"
// }
```

---

### Image Generation

```javascript
// Generate image (auto-cached to Firestore)
const imageUrl = await assets.getImage(
  'product-image',
  'A sleek smartphone with a holographic display',
  { aspectRatio: '16:9' }
);

document.getElementById('myImage').src = imageUrl;

// Force regenerate (bypass cache)
const newImageUrl = await assets.getImage(
  'product-image',
  'A different prompt',
  { forceRegenerate: true }
);

// Different aspect ratios
const square = await assets.getImage('icon', 'App icon', { aspectRatio: '1:1' });
const portrait = await assets.getImage('poster', 'Movie poster', { aspectRatio: '9:16' });
```

---

### Image Analysis

```javascript
// Analyze an image
const analysis = await gemini.analyzeImage(
  'Describe this image in detail',
  base64ImageData,
  { mimeType: 'image/png' }
);

console.log(analysis);
```

---

### Image Editing

```javascript
// Edit an existing image
const editedImage = await gemini.editImage(
  'Remove the background and make it transparent',
  base64SourceImage
);

// Use the edited image
document.getElementById('result').src = `data:image/png;base64,${editedImage}`;
```

---

### Text-to-Speech

```javascript
// Single speaker
const audioUrl = await assets.getAudio(
  'welcome-message',
  'Welcome to our app! Let me show you around.',
  { voice: 'Puck' }  // Upbeat voice
);

const audio = new Audio(audioUrl);
audio.play();

// Multi-speaker dialogue
const dialogueUrl = await assets.getAudio(
  'conversation',
  'TTS the following conversation between Alice and Bob:\nAlice: How are you today?\nBob: I\'m doing great, thanks!',
  {
    multiSpeaker: [
      { speaker: "Alice", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      { speaker: "Bob", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
    ]
  }
);

// Available voices (each with distinct characteristics):
// Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe,
// Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, etc.
```

---

### Data Persistence

```javascript
// Save data (automatically uses correct Firestore paths)
await firestore.save('user-settings', {
  theme: 'dark',
  notifications: true,
  lastLogin: new Date()
});

// Load data
const settings = await firestore.load('user-settings');
console.log(settings.theme); // 'dark'

// Save to public collection (shareable with other users)
await firestore.save('public-leaderboard', {
  username: 'Player1',
  score: 1000
}, true);  // isPublic = true

// Load from public collection
const leaderboard = await firestore.load('public-leaderboard', true);

// Delete data
await firestore.delete('user-settings');
```

---

### Asset Caching (Images & Audio)

```javascript
// Assets are automatically cached to Firestore
// First call: generates + saves to Firestore
const img1 = await assets.getImage('logo', 'Company logo design');

// Second call: loads from Firestore (instant!)
const img2 = await assets.getImage('logo', 'Company logo design');

// Works the same for audio
const audio1 = await assets.getAudio('intro', 'Welcome!');
const audio2 = await assets.getAudio('intro', 'Welcome!'); // Cached

// Preload multiple assets in parallel
const assetList = [
  { type: 'image', id: 'hero', prompt: 'Futuristic city' },
  { type: 'image', id: 'icon', prompt: 'App icon', options: { aspectRatio: '1:1' } },
  { type: 'audio', id: 'welcome', text: 'Hello!' }
];

const results = await assets.preloadAssets(
  assetList,
  (current, total, assetId) => {
    console.log(`Loading ${assetId}: ${current}/${total}`);
  }
);

// Access preloaded assets
document.getElementById('hero').src = results.get('hero');
document.getElementById('audio').src = results.get('welcome');
```

---

### UI Helpers

```javascript
// Loading overlay
const overlay = ui.createLoadingOverlay('Generating your content...');
// ... do async work ...
ui.removeLoadingOverlay(overlay);

// Toast notifications
ui.showToast('Settings saved successfully!', 'success');
ui.showToast('An error occurred', 'error');
ui.showToast('Processing your request', 'info', 5000); // 5 second duration

// Progress bar
const progress = ui.createProgressBar('myProgressBar');
document.getElementById('container').appendChild(progress.element);

// Update progress
for (let i = 0; i <= 100; i += 10) {
  progress.update(i, 100);
  progress.setMessage(`Processing step ${i}%`);
  await new Promise(r => setTimeout(r, 500));
}
```

---

## 🔥 Advanced Examples

### Complete App Template

```javascript
import { initCanvas } from './canvas-lib.js';

let gemini, assets, firestore, ui;

async function init() {
  // Initialize
  const overlay = UIHelpers.createLoadingOverlay('Initializing app...');

  try {
    ({ gemini, assets, firestore, ui } = await initCanvas('my-app'));

    // Preload assets
    await assets.preloadAssets([
      { type: 'image', id: 'background', prompt: 'Abstract gradient background' },
      { type: 'audio', id: 'notification', text: 'You have a new message!' }
    ]);

    // Load saved state
    const savedState = await firestore.load('app-state');
    if (savedState) {
      restoreState(savedState);
    }

    ui.showToast('App ready!', 'success');
  } catch (error) {
    ui.showToast('Initialization failed: ' + error.message, 'error');
  } finally {
    UIHelpers.removeLoadingOverlay(overlay);
  }
}

// Auto-save state on changes
async function saveState(state) {
  await firestore.save('app-state', state);
  ui.showToast('Progress saved', 'info', 2000);
}

init();
```

### Parallel Asset Generation

```javascript
// Generate multiple images in parallel
const prompts = [
  'A red apple',
  'A blue car',
  'A green tree'
];

const imagePromises = prompts.map((prompt, i) =>
  assets.getImage(`image-${i}`, prompt)
);

const images = await Promise.all(imagePromises);

images.forEach((url, i) => {
  document.getElementById(`img-${i}`).src = url;
});
```

### Conversational AI with History

```javascript
const chatHistory = [];

async function chat(userMessage) {
  // Build conversation context
  const context = chatHistory
    .map(msg => `${msg.role}: ${msg.text}`)
    .join('\n');

  const fullPrompt = `${context}\nUser: ${userMessage}\nAssistant:`;

  const response = await gemini.generateText(fullPrompt, {
    systemPrompt: 'You are a helpful assistant.',
    temperature: 0.8
  });

  // Update history
  chatHistory.push({ role: 'User', text: userMessage });
  chatHistory.push({ role: 'Assistant', text: response });

  // Save to Firestore
  await firestore.save('chat-history', chatHistory);

  return response;
}
```

---

## 🎯 Best Practices

### 1. **Always Use Asset IDs Consistently**
```javascript
// ✅ GOOD: Same ID = cached result
const img1 = await assets.getImage('app-logo', 'Company logo');
const img2 = await assets.getImage('app-logo', 'Company logo'); // Cached!

// ❌ BAD: Different ID = regenerates unnecessarily
const img1 = await assets.getImage('logo1', 'Company logo');
const img2 = await assets.getImage('logo2', 'Company logo'); // Wastes quota!
```

### 2. **Use Public Storage for Shared Data**
```javascript
// Private data (default) - unique per user
await firestore.save('user-preferences', { theme: 'dark' });

// Public data - shared across all users
await firestore.save('global-config', { version: '1.0' }, true);
```

### 3. **Preload Assets for Better UX**
```javascript
// Load all assets during initialization
await assets.preloadAssets([
  { type: 'image', id: 'bg', prompt: 'Background' },
  { type: 'audio', id: 'sfx', text: 'Click!' }
], (current, total) => {
  console.log(`Loading ${current}/${total}`);
});
```

### 4. **Handle Errors Gracefully**
```javascript
try {
  const img = await assets.getImage('hero', 'A beautiful sunset');
  document.getElementById('hero').src = img;
} catch (error) {
  console.error('Failed to load image:', error);
  ui.showToast('Failed to load image', 'error');
  // Show placeholder
  document.getElementById('hero').src = 'placeholder.png';
}
```

### 5. **Use Structured Responses for Complex Data**
```javascript
// Instead of parsing unstructured text
const text = await gemini.generateText('List 5 colors');
// Now you have to parse: "1. Red\n2. Blue\n..."

// Use structured JSON
const schema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      hex: { type: "STRING" }
    }
  }
};

const colors = await gemini.generateJSON('List 5 colors with hex codes', schema);
// [{ name: "Red", hex: "#FF0000" }, ...]
```

---

## 🐛 Troubleshooting

### "Firebase config not found"
- Make sure you're running in Gemini Canvas environment
- Check that `__firebase_config` is available in global scope

### "Failed to generate image after retries"
- You may have hit rate limits (wait 60 seconds)
- Check your prompt isn't violating content policies

### "Chunk count mismatch"
- Firestore write may have failed partway through
- Delete the asset and regenerate: `await firestore.delete('asset-name', false, true)`

### "PCM audio won't play"
- The library automatically converts PCM→WAV
- If you see issues, check browser console for errors
- Try a different voice or reduce text length

---

## 📊 Performance Tips

1. **Cache Everything**: Asset caching reduces API calls by 90%+
2. **Parallel Loading**: Use `Promise.all()` for multiple assets
3. **Lazy Load**: Only generate assets when needed
4. **Use Memory Cache**: Assets are cached in-memory after first load
5. **Structured Responses**: Faster than parsing unstructured text

---

## 🎨 Code Size Comparison

### Without Library (Traditional Approach)
```javascript
// ~200+ lines of boilerplate:
// - Firebase initialization (30 lines)
// - Auth handling (20 lines)
// - API retry logic (40 lines)
// - Chunking implementation (60 lines)
// - Audio conversion (50 lines)
// - Path management (20 lines)
// Total: ~220 lines before you write ANY app logic
```

### With Canvas Library
```javascript
import { initCanvas } from './canvas-lib.js';
const { gemini, assets, firestore, ui } = await initCanvas('my-app');

// Start building your app immediately!
// Total: 2 lines
```

**Result: 99% code reduction for setup and infrastructure.**

---

## 🚦 API Rate Limits

Gemini Canvas uses quotas. The library includes automatic retry with exponential backoff, but be aware:

- **Imagen**: ~10 requests/minute
- **Gemini Text**: ~60 requests/minute
- **TTS**: ~10 requests/minute
- **Firestore**: ~1 write/second per document

The retry logic handles temporary failures automatically.

---

## 📝 License

MIT License - Use freely in your Canvas apps!

---

## 🤝 Contributing

Found a bug or have a feature request? Open an issue on GitHub!

---

## 🎓 Learn More

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Canvas Environment Guide](https://support.google.com/gemini/answer/15271481)

---

**Happy building! 🚀**
