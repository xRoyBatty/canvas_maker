# Media Storage Fix Explanation

## ❌ What Was WRONG in Original Code

### 1. **No Audio Conversion** (CRITICAL BUG)
```javascript
// WRONG: Saves raw PCM audio
await saveAsset(audioId, 'audio/mp3', base64);

// PROBLEM: PCM audio is raw, unplayable format
// TTS returns signed PCM16 data at 24000Hz sample rate
// Browsers cannot play raw PCM - needs WAV container
```

### 2. **No Chunking** (Will Fail on Large Files)
```javascript
// WRONG: Tries to save entire file in one document
await addDoc(colRef, {
    assetId: assetId,
    type: type,
    content: finalData  // ❌ Can exceed 1MB limit!
});

// FIRESTORE LIMIT: ~1MB per document
// Compressed JPEG images: OK (usually 200-600KB)
// Audio files: FAIL (60 seconds ≈ 2-4MB even compressed)
```

### 3. **Used addDoc Instead of setDoc**
```javascript
// WRONG: Creates new document each save
await addDoc(colRef, { ... });

// PROBLEM: Every regeneration creates duplicates
// No way to "overwrite" existing asset
// Storage balloons with duplicate data
```

### 4. **Inefficient Retrieval Pattern**
```javascript
// WRONG: Queries collection for every asset
const q = query(colRef, where('assetId', '==', assetId));
const snapshot = await getDocs(q);

// PROBLEM: Slow, requires index, wasteful
// Better: Direct document reference with setDoc/getDoc
```

---

## ✅ What's FIXED

### 1. **Proper Audio Conversion**
```javascript
// CORRECT: Convert PCM → WAV before storage
const pcmArray = new Int16Array(base64ToArrayBuffer(pcmBase64));
const wavBlob = pcmToWav(pcmArray, 24000);  // ← Critical function

// pcmToWav creates proper WAV container:
// - Adds RIFF header
// - Adds fmt chunk with sample rate
// - Adds data chunk with PCM samples
// Result: Playable audio file
```

**The `pcmToWav` function** (from CLAUDE.md example):
- Creates 44-byte WAV header
- Sets format: 1 channel, 16-bit, 24000Hz
- Wraps raw PCM data in proper container
- Returns Blob ready for playback

### 2. **Chunking for Large Files**
```javascript
// CORRECT: Split into 900KB chunks
const MAX_CHUNK_SIZE = 900 * 1024; // Safe margin under 1MB
const chunks = [];
for (let i = 0; i < base64data.length; i += MAX_CHUNK_SIZE) {
    chunks.push(base64data.substring(i, i + MAX_CHUNK_SIZE));
}

// Save metadata document
await setDoc(metaRef, {
    mimeType,
    chunkCount: chunks.length,
    createdAt: Date.now()
});

// Save chunks to subcollection
chunks.forEach((chunk, i) => {
    setDoc(chunkRef, { data: chunk });
});
```

**Storage Structure:**
```
/artifacts/{APP_ID}/users/{userId}/lesson_assets/
  ├─ slide_0_audio/                    ← Metadata doc
  │   ├─ mimeType: "audio/wav"
  │   ├─ chunkCount: 3
  │   └─ chunks/                        ← Subcollection
  │       ├─ 0: { data: "base64..." }
  │       ├─ 1: { data: "base64..." }
  │       └─ 2: { data: "base64..." }
  └─ slide_0_img_0/
      ├─ mimeType: "image/jpeg"
      ├─ chunkCount: 1
      └─ chunks/
          └─ 0: { data: "base64..." }
```

### 3. **Direct Document References**
```javascript
// CORRECT: Use document paths, not queries
const metaRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'lesson_assets', assetName);
await setDoc(metaRef, { ... });  // Overwrites if exists

// Benefits:
// ✓ Fast direct access
// ✓ No duplicate data
// ✓ Works across regenerations (same assetName = same doc)
```

### 4. **Enhanced Image Compression**
```javascript
// CORRECT: Aggressive compression + resizing
function compressImage(base64Data, quality = 0.6) {
    // 1. Resize to max 1920x1080
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
    }

    // 2. Convert to JPEG at 60% quality
    const compressed = canvas.toDataURL('image/jpeg', quality);

    // Result: Typical 16:9 image goes from 2-4MB → 200-400KB
}
```

---

## 📊 Size Comparison

### Original Code (Would Fail):
| Asset | Format | Size | Status |
|-------|--------|------|--------|
| Image | PNG base64 | ~2-4 MB | ❌ Too large |
| Audio (60s) | Raw PCM | ~2.8 MB | ❌ Too large + unplayable |

### Fixed Code (Works):
| Asset | Format | Size | Chunks | Status |
|-------|--------|------|--------|--------|
| Image | JPEG 60% | ~300 KB | 1 | ✅ Single chunk |
| Audio (60s) | WAV | ~2.8 MB | 4 | ✅ Chunked |

---

## 🔍 How to Verify It Works

### Test in Firebase Console:
1. Navigate to Firestore
2. Path: `artifacts/allegro-module1-fixed-v1/users/{yourUserId}/lesson_assets/`
3. Check structure:
   - Each asset should have metadata doc
   - Each metadata doc should have `chunks` subcollection
   - Chunk sizes should be < 1MB

### Test Audio Playback:
```javascript
// In browser console after load:
const audioUrl = generatedSlides[0].assets.audio.url;
const audio = new Audio(audioUrl);
audio.play(); // Should play narration clearly
```

### Test Persistence:
1. Run app first time → generates assets
2. Refresh page → should load from cache (fast!)
3. Click "Reload Assets" → regenerates fresh

---

## 📋 Security Rules (No Changes Needed!)

Your existing Canvas rules already support this pattern:
```javascript
// Private user data rule (already exists in Canvas):
match /artifacts/{appId}/users/{userId}/{document=**} {
  allow read, write: if request.auth.uid == userId;
}
```

The chunking pattern uses subcollections, which are covered by `{document=**}`.

---

## 🎯 Key Takeaways

1. **Always convert TTS audio**: PCM → WAV (use `pcmToWav`)
2. **Always chunk large files**: 900KB per chunk (safe margin)
3. **Use setDoc, not addDoc**: For persistence across regenerations
4. **Compress aggressively**: JPEG 60% quality is fine for backgrounds
5. **Test with real data**: 60-second audio is a good stress test

---

## 📖 Reference from CLAUDE.md

The example code in CLAUDE.md demonstrates this exact pattern:

```javascript
// From the "FULL APP WORKING EXAMPLE" in CLAUDE.md:

async function saveAssetToFirestore(assetName, mimeType, base64data) {
    const MAX_CHUNK_SIZE = 950 * 1024;  // ← They use 950KB
    const chunks = [];
    for (let i = 0; i < base64data.length; i += MAX_CHUNK_SIZE) {
        chunks.push(base64data.substring(i, i + MAX_CHUNK_SIZE));
    }

    const assetMetaRef = doc(db, 'artifacts', appId, 'users', userId, 'secret_data', assetName);
    await setDoc(assetMetaRef, { mimeType, chunkCount: chunks.length });

    // Save chunks to subcollection
    const chunkPromises = chunks.map((chunkData, index) => {
        const chunkRef = doc(db, 'artifacts', appId, 'users', userId, 'secret_data', assetName, 'chunks', String(index));
        return setDoc(chunkRef, { data: chunkData });
    });

    await Promise.all(chunkPromises);
}

// And for audio conversion:
const pcmArray = new Int16Array(base64ToArrayBuffer(pcmBase64));
const wavBlob = pcmToWav(pcmArray, sampleRate);
```

**This is the proven pattern for Canvas environments!** ✅
