/**
 * Canvas Library - Abstraction layer for Gemini Canvas apps
 * Handles Firebase, Gemini API, Firestore, asset management, and common utilities
 * @version 2.0.0
 *
 * NEW IN V2:
 * - Auto-chunking in Firestore (no more separate save/saveAsset methods!)
 * - app.ready promise pattern (cleaner initialization)
 * - Real-time subscriptions with subscribe()
 * - Optimizer class (PNG→JPG, PCM→MP3 compression)
 * - Simplified multi-speaker TTS syntax
 * - Copy to clipboard helper
 * - Auto viewport meta tag fix
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ============================================
// 1. CORE APP & AUTH
// ============================================
class CanvasApp {
    constructor(appId) {
        this.appId = appId || (typeof __app_id !== 'undefined' ? __app_id : 'canvas-app-default');
        this.app = null;
        this.db = null;
        this.auth = null;
        this.userId = null;

        // NEW: The ready promise allows "await app.ready"
        this.ready = this._initialize();
    }

    /**
     * Initialize Firebase with Canvas environment variables
     * @private
     * @returns {Promise<CanvasApp>} - this
     */
    async _initialize() {
        try {
            // NEW: Auto-fix viewport if missing
            if (!document.querySelector('meta[name="viewport"]')) {
                document.head.insertAdjacentHTML('beforeend',
                    '<meta name="viewport" content="width=device-width, initial-scale=1.0">');
            }

            // Use Canvas-provided Firebase config
            const firebaseConfig = typeof __firebase_config !== 'undefined'
                ? JSON.parse(__firebase_config)
                : this._throwError('Firebase config not found in Canvas environment');

            this.app = initializeApp(firebaseConfig);
            this.db = getFirestore(this.app);
            this.auth = getAuth(this.app);

            // Auth with Canvas-provided token or anonymous
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(this.auth, __initial_auth_token);
            } else {
                await signInAnonymously(this.auth);
            }

            // Wait for auth state
            await new Promise((resolve) => {
                const unsubscribe = onAuthStateChanged(this.auth, (user) => {
                    if (user) {
                        this.userId = user.uid;
                        resolve();
                        unsubscribe();
                    }
                });
            });

            return this;
        } catch (error) {
            throw new Error(`Canvas initialization failed: ${error.message}`);
        }
    }

    _throwError(message) {
        throw new Error(message);
    }
}

// ============================================
// 2. AI CLIENT - Gemini Models
// ============================================
class GeminiAPI {
    constructor() {
        this.apiKey = ""; // Canvas auto-provides API key when empty
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
    }

    /**
     * Call with exponential backoff retry logic
     * @private
     */
    async _callWithRetry(apiCall, maxRetries = 5, initialDelay = 1000) {
        let delay = initialDelay;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error) {
                if (attempt === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }

    /**
     * Generate text content with Gemini
     * @param {string} prompt - User prompt
     * @param {Object} options - { model, systemPrompt, temperature, maxTokens, googleSearch }
     * @returns {Promise<string>} - Generated text
     */
    async generateText(prompt, options = {}) {
        const {
            model = 'gemini-2.5-flash-preview-09-2025',
            systemPrompt = '',
            temperature,
            maxTokens,
            googleSearch = false
        } = options;

        return this._callWithRetry(async () => {
            const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            if (systemPrompt) {
                payload.systemInstruction = { parts: [{ text: systemPrompt }] };
            }

            if (googleSearch) {
                payload.tools = [{ "google_search": {} }];
            }

            if (temperature !== undefined || maxTokens !== undefined) {
                payload.generationConfig = {};
                if (temperature !== undefined) payload.generationConfig.temperature = temperature;
                if (maxTokens !== undefined) payload.generationConfig.maxOutputTokens = maxTokens;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate?.content?.parts?.[0]?.text) {
                return candidate.content.parts[0].text;
            }

            throw new Error('Invalid response structure');
        });
    }

    /**
     * Generate structured JSON response
     * @param {string} prompt - User prompt
     * @param {Object} schema - JSON schema for response
     * @param {Object} options - { model, systemPrompt }
     * @returns {Promise<Object>} - Parsed JSON response
     */
    async generateJSON(prompt, schema, options = {}) {
        const {
            model = 'gemini-2.5-flash-preview-09-2025',
            systemPrompt = ''
        } = options;

        return this._callWithRetry(async () => {
            const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: schema
                }
            };

            if (systemPrompt) {
                payload.systemInstruction = { parts: [{ text: systemPrompt }] };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) throw new Error('Invalid response structure');

            return JSON.parse(text);
        });
    }

    /**
     * Analyze image with Gemini
     * @param {string} prompt - Analysis prompt
     * @param {string} base64Image - Base64-encoded image
     * @param {Object} options - { model, mimeType }
     * @returns {Promise<string>} - Analysis result
     */
    async analyzeImage(prompt, base64Image, options = {}) {
        const {
            model = 'gemini-2.5-flash-preview-09-2025',
            mimeType = 'image/png'
        } = options;

        return this._callWithRetry(async () => {
            const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;

            const payload = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: base64Image } }
                    ]
                }]
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        });
    }

    /**
     * Generate image with Imagen
     * @param {string} prompt - Image generation prompt
     * @param {Object} options - { model, aspectRatio, sampleCount }
     * @returns {Promise<string>} - Base64-encoded image
     */
    async generateImage(prompt, options = {}) {
        const {
            model = 'imagen-4.0-generate-001',
            aspectRatio = '16:9',
            sampleCount = 1
        } = options;

        return this._callWithRetry(async () => {
            const url = `${this.baseUrl}/${model}:predict?key=${this.apiKey}`;

            const payload = {
                instances: [{ prompt }],
                parameters: { sampleCount, aspectRatio }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            const base64 = result.predictions?.[0]?.bytesBase64Encoded;

            if (!base64) throw new Error('No image data in response');

            return base64;
        });
    }

    /**
     * Edit image with gemini-2.5-flash-image-preview
     * @param {string} prompt - Edit instruction
     * @param {string} base64Image - Base64-encoded source image
     * @returns {Promise<string>} - Base64-encoded edited image
     */
    async editImage(prompt, base64Image) {
        return this._callWithRetry(async () => {
            const url = `${this.baseUrl}/gemini-2.5-flash-image-preview:generateContent?key=${this.apiKey}`;

            const payload = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/png", data: base64Image } }
                    ]
                }],
                generationConfig: {
                    responseModalities: ['IMAGE']
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            const base64 = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

            if (!base64) throw new Error('No image data in response');

            return base64;
        });
    }

    /**
     * Generate speech with TTS
     * NEW: Simplified multi-speaker syntax - pass array [{name, voice}]
     * @param {string} text - Text to speak
     * @param {Object} options - { voice: 'Kore' } OR { speakers: [{name, voice}] }
     * @returns {Promise<string>} - Base64-encoded PCM audio
     */
    async generateSpeech(text, options = {}) {
        const { voice = 'Kore', speakers = null } = options;

        return this._callWithRetry(async () => {
            const url = `${this.baseUrl}/gemini-2.5-flash-preview-tts:generateContent?key=${this.apiKey}`;

            let speechConfig;

            // NEW: Simplified multi-speaker handling
            if (speakers && Array.isArray(speakers)) {
                speechConfig = {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: speakers.map(s => ({
                            speaker: s.name,
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } }
                        }))
                    }
                };
            } else {
                speechConfig = {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
                };
            }

            const payload = {
                contents: [{ parts: [{ text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            const audioData = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

            if (!audioData) throw new Error('No audio data in response');

            return audioData;
        });
    }
}

// ============================================
// 3. FIRESTORE MANAGER - With Auto-Chunking
// ============================================
class FirestoreManager {
    constructor(canvasApp) {
        this.canvasApp = canvasApp;
        this.CHUNK_THRESHOLD = 800 * 1024; // NEW: 800KB threshold for auto-chunking
    }

    /**
     * Get Firestore path for private user data
     * @private
     */
    _getPrivatePath(...pathSegments) {
        return ['artifacts', this.canvasApp.appId, 'users', this.canvasApp.userId, ...pathSegments];
    }

    /**
     * Get Firestore path for public data
     * @private
     */
    _getPublicPath(...pathSegments) {
        return ['artifacts', this.canvasApp.appId, 'public', 'data', ...pathSegments];
    }

    /**
     * NEW: Intelligent Save - Auto-detects size and chunks if necessary
     * @param {string} docName - Document name
     * @param {Object|string} data - Data to save (any JSON-serializable data OR base64 string for assets)
     * @param {boolean} isPublic - Save to public path
     * @param {string} mimeType - Optional: if saving base64 asset, specify MIME type
     * @returns {Promise<void>}
     */
    async save(docName, data, isPublic = false, mimeType = null) {
        // Wait for app to be ready
        await this.canvasApp.ready;

        // Handle base64 asset vs regular data
        const isAsset = mimeType !== null;
        const dataStr = isAsset ? data : JSON.stringify(data);

        // Auto-chunking if data is large
        if (dataStr.length > this.CHUNK_THRESHOLD) {
            return this._saveChunked(docName, dataStr, isPublic, isAsset, mimeType);
        }

        // Regular save for small data
        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        const docRef = doc(this.canvasApp.db, ...pathSegments);

        if (isAsset) {
            await setDoc(docRef, {
                _isAsset: true,
                _isChunked: false,
                mimeType,
                data: dataStr,
                timestamp: Date.now()
            });
        } else {
            await setDoc(docRef, {
                _isChunked: false,
                data,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Load data (transparently handles chunked data)
     * @param {string} docName - Document name
     * @param {boolean} isPublic - Load from public path
     * @returns {Promise<Object|string|null>} - Loaded data, base64 string for assets, or null
     */
    async load(docName, isPublic = false) {
        await this.canvasApp.ready;

        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        const docRef = doc(this.canvasApp.db, ...pathSegments);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        const docData = docSnap.data();

        // Handle chunked data transparently
        if (docData._isChunked) {
            const reassembled = await this._loadChunked(docName, docData, isPublic);

            // Return base64 for assets, parsed JSON for regular data
            if (docData._isAsset) {
                return { base64Data: reassembled, mimeType: docData.mimeType };
            } else {
                return JSON.parse(reassembled);
            }
        }

        // Return data directly for non-chunked
        if (docData._isAsset) {
            return { base64Data: docData.data, mimeType: docData.mimeType };
        } else {
            return docData.data;
        }
    }

    /**
     * NEW: Subscribe to real-time updates
     * @param {string} docName - Document name
     * @param {Function} onData - Callback(data)
     * @param {boolean} isPublic - Subscribe to public path
     * @returns {Function} - Unsubscribe function
     */
    subscribe(docName, onData, isPublic = false) {
        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        const docRef = doc(this.canvasApp.db, ...pathSegments);

        return onSnapshot(docRef, async (snap) => {
            if (!snap.exists()) return onData(null);

            const docData = snap.data();

            // Note: Real-time chunk re-assembly can be heavy
            // For chunked data, just notify that update is available
            if (docData._isChunked) {
                onData({ _needsReload: true, timestamp: docData.timestamp });
            } else {
                onData(docData._isAsset ? { base64Data: docData.data, mimeType: docData.mimeType } : docData.data);
            }
        });
    }

    /**
     * Delete data or asset (handles chunked data automatically)
     * @param {string} docName - Document name
     * @param {boolean} isPublic - Delete from public path
     * @returns {Promise<void>}
     */
    async delete(docName, isPublic = false) {
        await this.canvasApp.ready;

        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        const docRef = doc(this.canvasApp.db, ...pathSegments);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return;

        const docData = docSnap.data();

        // Delete chunks if necessary
        if (docData._isChunked) {
            const deletePromises = [];
            for (let i = 0; i < docData.totalChunks; i++) {
                const chunkPath = [...pathSegments.slice(0, -1), `${docName}_chunk_${i}`];
                const chunkRef = doc(this.canvasApp.db, ...chunkPath);
                deletePromises.push(deleteDoc(chunkRef));
            }
            await Promise.all(deletePromises);
        }

        // Delete main document
        await deleteDoc(docRef);
    }

    // --- Internal Chunking Methods ---
    async _saveChunked(docName, dataStr, isPublic, isAsset, mimeType) {
        const chunks = [];
        for (let i = 0; i < dataStr.length; i += this.CHUNK_THRESHOLD) {
            chunks.push(dataStr.substring(i, i + this.CHUNK_THRESHOLD));
        }

        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        // Save metadata
        const docRef = doc(this.canvasApp.db, ...pathSegments);
        await setDoc(docRef, {
            _isChunked: true,
            _isAsset: isAsset,
            mimeType: isAsset ? mimeType : null,
            totalChunks: chunks.length,
            timestamp: Date.now()
        });

        // Save chunks in parallel
        const chunkPromises = chunks.map((chunk, i) => {
            const chunkPath = [...pathSegments.slice(0, -1), `${docName}_chunk_${i}`];
            const chunkRef = doc(this.canvasApp.db, ...chunkPath);
            return setDoc(chunkRef, { data: chunk });
        });

        await Promise.all(chunkPromises);
    }

    async _loadChunked(docName, meta, isPublic) {
        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        const chunkPromises = [];
        for (let i = 0; i < meta.totalChunks; i++) {
            const chunkPath = [...pathSegments.slice(0, -1), `${docName}_chunk_${i}`];
            const chunkRef = doc(this.canvasApp.db, ...chunkPath);
            chunkPromises.push(getDoc(chunkRef));
        }

        const chunkDocs = await Promise.all(chunkPromises);

        if (chunkDocs.some(s => !s.exists())) {
            throw new Error('Corrupted chunked data - missing chunks');
        }

        return chunkDocs.map(s => s.data().data).join('');
    }
}

// ============================================
// 4. OPTIMIZER - Client-Side Compression
// ============================================
class Optimizer {
    /**
     * Compress PNG to JPG (saves ~90% space)
     * @param {string} base64Png - Base64-encoded PNG
     * @param {number} quality - JPG quality 0-1 (default 0.6)
     * @returns {Promise<string>} - Base64-encoded JPG
     */
    static async compressImage(base64Png, quality = 0.6) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFF'; // JPG needs white background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
            img.src = `data:image/png;base64,${base64Png}`;
        });
    }

    /**
     * Note: MP3 compression requires external library (lamejs)
     * Include: <script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js"></script>
     *
     * Compress PCM to MP3 (saves ~80% space)
     * @param {string} base64Pcm - Base64-encoded PCM
     * @returns {Promise<string>} - Base64-encoded MP3
     */
    static async compressAudio(base64Pcm) {
        if (typeof lamejs === 'undefined') {
            console.warn("Optimizer: lamejs library not found. Install via: <script src='https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js'></script>");
            return base64Pcm;
        }

        return new Promise((resolve) => {
            const binaryString = atob(base64Pcm);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const pcm16 = new Int16Array(bytes.buffer);
            const encoder = new lamejs.Mp3Encoder(1, 24000, 128); // Mono, 24kHz, 128kbps
            const chunks = [];
            const blockSize = 1152;

            for (let i = 0; i < pcm16.length; i += blockSize) {
                const buffer = encoder.encodeBuffer(pcm16.subarray(i, i + blockSize));
                if (buffer.length > 0) chunks.push(buffer);
            }

            const endBuffer = encoder.flush();
            if (endBuffer.length > 0) chunks.push(endBuffer);

            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(new Blob(chunks, { type: 'audio/mp3' }));
        });
    }
}

// ============================================
// 5. ASSET MANAGER - Smart Caching
// ============================================
class AssetManager {
    constructor(canvasApp, firestoreManager, geminiAPI) {
        this.canvasApp = canvasApp;
        this.firestore = firestoreManager;
        this.gemini = geminiAPI;
        this.cache = new Map();
    }

    /**
     * Get or generate image asset
     * @param {string} assetId - Unique identifier
     * @param {string} prompt - Image generation prompt
     * @param {Object} options - { aspectRatio, forceRegenerate, isPublic, compress }
     * @returns {Promise<string>} - Data URL (data:image/png;base64,...)
     */
    async getImage(assetId, prompt, options = {}) {
        const {
            aspectRatio = '16:9',
            forceRegenerate = false,
            isPublic = false,
            compress = false // NEW: Auto-compress to JPG
        } = options;

        // Check memory cache
        if (!forceRegenerate && this.cache.has(assetId)) {
            return this.cache.get(assetId);
        }

        // Check Firestore cache
        if (!forceRegenerate) {
            const cached = await this.firestore.load(assetId, isPublic);
            if (cached) {
                const dataUrl = `data:${cached.mimeType};base64,${cached.base64Data}`;
                this.cache.set(assetId, dataUrl);
                return dataUrl;
            }
        }

        // Generate new image
        let base64 = await this.gemini.generateImage(prompt, { aspectRatio });
        let mimeType = 'image/png';

        // NEW: Optional compression
        if (compress) {
            base64 = await Optimizer.compressImage(base64, 0.6);
            mimeType = 'image/jpeg';
        }

        await this.firestore.save(assetId, base64, isPublic, mimeType);

        const dataUrl = `data:${mimeType};base64,${base64}`;
        this.cache.set(assetId, dataUrl);
        return dataUrl;
    }

    /**
     * Get or generate audio asset
     * @param {string} assetId - Unique identifier
     * @param {string} text - Text to speak
     * @param {Object} options - { voice, speakers: [{name, voice}], forceRegenerate, isPublic }
     * @returns {Promise<string>} - Blob URL
     */
    async getAudio(assetId, text, options = {}) {
        const {
            voice = 'Kore',
            speakers = null, // NEW: Simplified syntax
            forceRegenerate = false,
            isPublic = false
        } = options;

        // Check memory cache
        if (!forceRegenerate && this.cache.has(assetId)) {
            return this.cache.get(assetId);
        }

        // Check Firestore cache
        if (!forceRegenerate) {
            const cached = await this.firestore.load(assetId, isPublic);
            if (cached) {
                const sampleRate = parseInt(cached.mimeType.match(/rate=(\d+)/)?.[1] || '24000', 10);
                const pcmArray = new Int16Array(this._base64ToArrayBuffer(cached.base64Data));
                const wavBlob = this._pcmToWav(pcmArray, sampleRate);
                const blobUrl = URL.createObjectURL(wavBlob);
                this.cache.set(assetId, blobUrl);
                return blobUrl;
            }
        }

        // Generate new audio
        const base64 = await this.gemini.generateSpeech(text, { voice, speakers });
        await this.firestore.save(assetId, base64, isPublic, 'audio/pcm;rate=24000');

        const pcmArray = new Int16Array(this._base64ToArrayBuffer(base64));
        const wavBlob = this._pcmToWav(pcmArray, 24000);
        const blobUrl = URL.createObjectURL(wavBlob);
        this.cache.set(assetId, blobUrl);
        return blobUrl;
    }

    /**
     * Preload multiple assets in parallel
     * @param {Array<Object>} assets - [{ type: 'image'|'audio', id, prompt|text, options }]
     * @param {Function} onProgress - Callback(current, total, assetId)
     * @returns {Promise<Map>} - Map of assetId -> dataUrl/blobUrl
     */
    async preloadAssets(assets, onProgress = null) {
        const results = new Map();
        let completed = 0;

        const loadPromises = assets.map(async (asset) => {
            const { type, id, prompt, text, options = {} } = asset;

            let result;
            if (type === 'image') {
                result = await this.getImage(id, prompt, options);
            } else if (type === 'audio') {
                result = await this.getAudio(id, text, options);
            }

            results.set(id, result);
            completed++;

            if (onProgress) {
                onProgress(completed, assets.length, id);
            }
        });

        await Promise.all(loadPromises);
        return results;
    }

    /**
     * Convert base64 to ArrayBuffer
     * @private
     */
    _base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Convert PCM to WAV
     * @private
     */
    _pcmToWav(pcmData, sampleRate = 24000) {
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = pcmData.length * pcmData.BYTES_PER_ELEMENT;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // WAV header
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + dataSize, true); // File size - 8
        view.setUint32(8, 0x57415645, false); // "WAVE"
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true); // AudioFormat (PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, dataSize, true);

        // PCM data
        const pcm16 = new Int16Array(pcmData.buffer);
        for (let i = 0; i < pcm16.length; i++) {
            view.setInt16(44 + i * 2, pcm16[i], true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }
}

// ============================================
// 6. UI HELPERS
// ============================================
class UIHelpers {
    /**
     * Create loading overlay
     * @param {string} message - Loading message
     * @returns {HTMLElement} - Overlay element
     */
    static createLoadingOverlay(message = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="loading-spinner mx-auto mb-4"></div>
                <p class="text-white text-xl">${message}</p>
            </div>
            <style>
                .loading-spinner {
                    border: 4px solid #1f2937;
                    border-top: 4px solid #3b82f6;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * Remove loading overlay
     * @param {HTMLElement} overlay - Overlay to remove
     */
    static removeLoadingOverlay(overlay) {
        overlay.remove();
    }

    /**
     * Show toast notification
     * @param {string} message - Notification message
     * @param {string} type - 'success' | 'error' | 'info'
     * @param {number} duration - Duration in ms (default 3000)
     */
    static showToast(message, type = 'info', duration = 3000) {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };

        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up`;
        toast.textContent = message;
        toast.style.animation = 'slideUp 0.3s ease-out';

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from { transform: translateY(100px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Create progress bar
     * @param {string} id - Progress bar ID
     * @returns {Object} - { element, update(current, total), setMessage(msg) }
     */
    static createProgressBar(id) {
        const container = document.createElement('div');
        container.id = id;
        container.className = 'w-full bg-slate-700 rounded-full h-4 overflow-hidden';
        container.innerHTML = `
            <div class="bg-blue-500 h-full transition-all duration-300" style="width: 0%"></div>
        `;

        const bar = container.querySelector('div');

        return {
            element: container,
            update(current, total) {
                const percentage = (current / total) * 100;
                bar.style.width = `${percentage}%`;
            },
            setMessage(message) {
                let textEl = container.querySelector('.progress-text');
                if (!textEl) {
                    textEl = document.createElement('p');
                    textEl.className = 'progress-text text-sm text-gray-300 mt-2 text-center';
                    container.appendChild(textEl);
                }
                textEl.textContent = message;
            }
        };
    }

    /**
     * NEW: Copy to clipboard with fallback for older browsers
     * @param {string} text - Text to copy
     */
    static copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success', 2000);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Copied to clipboard!', 'success', 2000);
        }
    }
}

// ============================================
// EXPORTS
// ============================================
export {
    CanvasApp,
    GeminiAPI,
    FirestoreManager,
    AssetManager,
    UIHelpers,
    Optimizer
};

/**
 * Quick start helper
 * @param {string} appId - Your app identifier (optional, auto-detects __app_id)
 * @returns {Promise<Object>} - { app, gemini, firestore, assets, ui, optimizer }
 */
export async function initCanvas(appId) {
    const app = new CanvasApp(appId);
    await app.ready; // NEW: Use ready promise instead of initialize()

    const gemini = new GeminiAPI();
    const firestore = new FirestoreManager(app);
    const assets = new AssetManager(app, firestore, gemini);
    const ui = UIHelpers;
    const optimizer = Optimizer;

    return { app, gemini, firestore, assets, ui, optimizer };
}
