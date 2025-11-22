# Canvas Library Changelog

## Version 2.0.0 (2025-01-22)

### 🎉 Major Improvements

#### 1. **Auto-Chunking in Firestore** - No More Manual Asset Management!
**Before (v1):**
```javascript
// You had to decide: save() or saveAsset()?
await firestore.save('small-data', { user: 'Alice' });
await firestore.saveAsset('big-image', 'image/png', base64String);
```

**Now (v2):**
```javascript
// Just use save() for everything! Auto-chunks if needed
await firestore.save('small-data', { user: 'Alice' });
await firestore.save('big-image', base64String, false, 'image/png');
// Automatically chunks if >800KB ✨
```

**Benefits:**
- No more thinking about file sizes
- Transparent handling of 1MB Firestore limit
- Automatic compression and decompression

---

#### 2. **app.ready Promise Pattern** - Cleaner Initialization
**Before (v1):**
```javascript
const app = new CanvasApp('my-app');
await app.initialize(); // Separate step
```

**Now (v2):**
```javascript
const app = new CanvasApp('my-app');
await app.ready; // Cleaner!

// Or use initCanvas helper
const { gemini, firestore, assets } = await initCanvas('my-app');
```

---

#### 3. **Real-Time Subscriptions** - Live Data Updates
**NEW Feature:**
```javascript
// Subscribe to real-time changes
const unsubscribe = firestore.subscribe('game-state', (data) => {
  if (data) {
    updateUI(data);
  }
});

// Later: unsubscribe()
```

**Use Cases:**
- Real-time multiplayer games
- Live collaborative apps
- Chat applications
- Shared whiteboards

---

#### 4. **Optimizer Class** - Reduce Storage by 90%
**NEW Feature:**
```javascript
// Compress PNG → JPG (saves ~90% space)
const jpgBase64 = await optimizer.compressImage(pngBase64, 0.6);

// Compress PCM → MP3 (saves ~80% space)
// Requires: <script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js"></script>
const mp3Base64 = await optimizer.compressAudio(pcmBase64);
```

**Benefits:**
- Use with `assets.getImage()` via `compress: true`
- Reduce Firestore quota usage
- Faster load times

**Example:**
```javascript
// Generate + compress image automatically
const imageUrl = await assets.getImage(
  'hero-bg',
  'A futuristic city',
  { compress: true } // Auto-compresses to JPG
);
```

---

#### 5. **Simplified Multi-Speaker TTS**
**Before (v1):**
```javascript
await gemini.generateSpeech(text, {
  multiSpeaker: [
    {
      speaker: "Alice",
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
    },
    {
      speaker: "Bob",
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
    }
  ]
});
```

**Now (v2):**
```javascript
await gemini.generateSpeech(
  "TTS conversation between Alice and Bob:\nAlice: Hi!\nBob: Hello!",
  {
    speakers: [
      { name: "Alice", voice: "Kore" },
      { name: "Bob", voice: "Puck" }
    ]
  }
);
```

**Benefits:**
- 60% less boilerplate
- Much more readable
- Same functionality

---

#### 6. **Copy to Clipboard Helper**
**NEW Feature:**
```javascript
ui.copyToClipboard('https://my-game.com/share/abc123');
// Shows toast notification automatically
// Falls back to old method for older browsers
```

---

#### 7. **Auto Viewport Meta Tag Fix**
**NEW Feature:**
- Automatically adds `<meta name="viewport">` if missing
- Fixes common Canvas mobile display issues
- No action required - works automatically!

---

### 📊 Performance Improvements

| Feature | v1 | v2 | Improvement |
|---------|----|----|-------------|
| Initialization | Manual `await app.initialize()` | Auto with `app.ready` | Cleaner API |
| Chunking | Manual `saveAsset()` | Auto-detected | 100% automatic |
| Image Storage | 2MB PNG | 200KB JPG (with compress) | **90% savings** |
| Audio Storage | 1MB PCM | 200KB MP3 (with lamejs) | **80% savings** |
| Multi-Speaker TTS | 10 lines | 4 lines | **60% less code** |
| Real-time Updates | Manual polling | `subscribe()` | **Instant updates** |

---

### 🔄 Migration Guide (v1 → v2)

#### Breaking Changes: **NONE** ✅
v2 is fully backward compatible! Old code will continue to work.

#### Recommended Updates:

**1. Initialization:**
```javascript
// Old (still works)
const app = new CanvasApp('my-app');
await app.initialize();

// New (recommended)
const app = new CanvasApp('my-app');
await app.ready;

// Best (use helper)
const { gemini, firestore, assets, ui, optimizer } = await initCanvas('my-app');
```

**2. Firestore Saves:**
```javascript
// Old (still works)
await firestore.saveAsset('image', 'image/png', base64);

// New (simpler)
await firestore.save('image', base64, false, 'image/png');
```

**3. Multi-Speaker TTS:**
```javascript
// Old (still works)
const audio = await gemini.generateSpeech(text, {
  multiSpeaker: [
    { speaker: "A", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
  ]
});

// New (cleaner)
const audio = await gemini.generateSpeech(text, {
  speakers: [{ name: "A", voice: "Kore" }]
});
```

---

### 📖 New API Reference

#### FirestoreManager

**`save(docName, data, isPublic, mimeType)`**
- Auto-detects size and chunks if needed
- `mimeType` optional - only for base64 assets
- Example: `await firestore.save('data', { foo: 'bar' })`

**`subscribe(docName, onData, isPublic)`** ⭐ NEW
- Real-time updates
- Returns `unsubscribe()` function
- Example: `const unsub = firestore.subscribe('state', data => console.log(data))`

#### Optimizer ⭐ NEW CLASS

**`Optimizer.compressImage(base64Png, quality)`**
- Converts PNG → JPG
- Quality: 0-1 (default 0.6)
- Returns base64 JPG

**`Optimizer.compressAudio(base64Pcm)`**
- Converts PCM → MP3 (requires lamejs library)
- Returns base64 MP3

#### AssetManager

**`getImage(id, prompt, options)`**
- New option: `compress: true` - Auto-compress to JPG
- Example: `await assets.getImage('bg', 'Sunset', { compress: true })`

**`getAudio(id, text, options)`**
- New option: `speakers: [{name, voice}]` - Simplified multi-speaker
- Example: `await assets.getAudio('conv', text, { speakers: [...] })`

#### UIHelpers

**`UIHelpers.copyToClipboard(text)`** ⭐ NEW
- Copy text to clipboard
- Auto-fallback for older browsers
- Shows toast notification

---

### 🐛 Bug Fixes

- Fixed viewport meta tag missing on some Canvas instances
- Improved chunking performance (parallel writes)
- Better error messages for corrupted chunks

---

### 🔮 Coming Soon (v3 ideas)

- Offline package generator
- Image editing via gemini-2.5-flash-image-preview integration
- Vector database support
- Built-in state management

---

### 💡 Tips for v2

1. **Always use `compress: true` for backgrounds** - saves 90% storage
2. **Use `subscribe()` for multiplayer apps** - instant updates
3. **No need to worry about chunking** - it's automatic now!
4. **Use simplified speakers syntax** - much cleaner code

---

### 🙏 Credits

Major improvements inspired by community feedback and Canvas v4 patterns.

---

**Full Documentation:** See [README.md](./README.md)
