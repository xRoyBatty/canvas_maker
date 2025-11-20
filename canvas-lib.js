/**
 * Canvas Library - Abstraction layer for Gemini Canvas apps
 * Handles Firebase, Gemini API, Firestore, asset management, and common utilities
 * @version 1.0.0
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ============================================
// CONFIGURATION & STATE
// ============================================
class CanvasApp {
    constructor(appId) {
        this.appId = appId || 'canvas-app-default';
        this.app = null;
        this.db = null;
        this.auth = null;
        this.userId = null;
        this.initialized = false;
    }

    /**
     * Initialize Firebase with Canvas environment variables
     * @returns {Promise<Object>} - { app, db, auth, userId }
     */
    async initialize() {
        if (this.initialized) {
            return { app: this.app, db: this.db, auth: this.auth, userId: this.userId };
        }

        try {
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

            this.initialized = true;
            return { app: this.app, db: this.db, auth: this.auth, userId: this.userId };
        } catch (error) {
            throw new Error(`Canvas initialization failed: ${error.message}`);
        }
    }

    _throwError(message) {
        throw new Error(message);
    }
}

// ============================================
// API CLIENT - Gemini Models
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
     * @param {string} text - Text to speak (can include speaker names for multi-speaker)
     * @param {Object} options - { voice, multiSpeaker: [{speaker, voice}], sampleRate }
     * @returns {Promise<string>} - Base64-encoded PCM audio
     */
    async generateSpeech(text, options = {}) {
        const {
            voice = 'Kore',
            multiSpeaker = null,
            sampleRate = 24000
        } = options;

        return this._callWithRetry(async () => {
            const url = `${this.baseUrl}/gemini-2.5-flash-preview-tts:generateContent?key=${this.apiKey}`;

            const payload = {
                contents: [{ parts: [{ text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: multiSpeaker ? {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: multiSpeaker
                        }
                    } : {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voice }
                        }
                    }
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
// FIRESTORE MANAGER - With Chunking
// ============================================
class FirestoreManager {
    constructor(canvasApp) {
        this.canvasApp = canvasApp;
        this.MAX_CHUNK_SIZE = 950 * 1024; // ~950KB per chunk (1MB limit with overhead)
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
     * Save data (auto-chunks if >950KB)
     * @param {string} docName - Document name
     * @param {Object} data - Data to save
     * @param {boolean} isPublic - Save to public path
     * @returns {Promise<void>}
     */
    async save(docName, data, isPublic = false) {
        if (!this.canvasApp.initialized) {
            throw new Error('CanvasApp not initialized. Call app.initialize() first.');
        }

        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        const docRef = doc(this.canvasApp.db, ...pathSegments);
        await setDoc(docRef, data);
    }

    /**
     * Load data
     * @param {string} docName - Document name
     * @param {boolean} isPublic - Load from public path
     * @returns {Promise<Object|null>} - Loaded data or null
     */
    async load(docName, isPublic = false) {
        if (!this.canvasApp.initialized) {
            throw new Error('CanvasApp not initialized. Call app.initialize() first.');
        }

        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        const docRef = doc(this.canvasApp.db, ...pathSegments);
        const docSnap = await getDoc(docRef);

        return docSnap.exists() ? docSnap.data() : null;
    }

    /**
     * Save large data with chunking (for images, audio, etc.)
     * @param {string} assetName - Asset identifier
     * @param {string} mimeType - MIME type
     * @param {string} base64Data - Base64-encoded data
     * @param {boolean} isPublic - Save to public path
     * @returns {Promise<void>}
     */
    async saveAsset(assetName, mimeType, base64Data, isPublic = false) {
        if (!this.canvasApp.initialized) {
            throw new Error('CanvasApp not initialized. Call app.initialize() first.');
        }

        // Split into chunks
        const chunks = [];
        for (let i = 0; i < base64Data.length; i += this.MAX_CHUNK_SIZE) {
            chunks.push(base64Data.substring(i, i + this.MAX_CHUNK_SIZE));
        }

        const pathSegments = isPublic
            ? this._getPublicPath(assetName)
            : this._getPrivatePath(assetName);

        // Save metadata
        const metaRef = doc(this.canvasApp.db, ...pathSegments);
        await setDoc(metaRef, {
            mimeType,
            chunkCount: chunks.length,
            createdAt: new Date(),
            size: base64Data.length
        });

        // Save chunks in parallel
        const chunkPromises = chunks.map((chunkData, index) => {
            const chunkRef = doc(this.canvasApp.db, ...pathSegments, 'chunks', String(index));
            return setDoc(chunkRef, { data: chunkData });
        });

        await Promise.all(chunkPromises);
    }

    /**
     * Load large data with chunking
     * @param {string} assetName - Asset identifier
     * @param {boolean} isPublic - Load from public path
     * @returns {Promise<Object|null>} - { base64Data, mimeType } or null
     */
    async loadAsset(assetName, isPublic = false) {
        if (!this.canvasApp.initialized) {
            throw new Error('CanvasApp not initialized. Call app.initialize() first.');
        }

        const pathSegments = isPublic
            ? this._getPublicPath(assetName)
            : this._getPrivatePath(assetName);

        // Load metadata
        const metaRef = doc(this.canvasApp.db, ...pathSegments);
        const metaSnap = await getDoc(metaRef);

        if (!metaSnap.exists()) return null;

        const { mimeType, chunkCount } = metaSnap.data();

        // Load chunks in parallel
        const chunkPromises = [];
        for (let i = 0; i < chunkCount; i++) {
            const chunkRef = doc(this.canvasApp.db, ...pathSegments, 'chunks', String(i));
            chunkPromises.push(getDoc(chunkRef));
        }

        const chunkDocs = await Promise.all(chunkPromises);

        // Reassemble data
        let base64Data = '';
        for (const chunkDoc of chunkDocs) {
            if (chunkDoc.exists()) {
                base64Data += chunkDoc.data().data;
            } else {
                return null; // Missing chunk
            }
        }

        return { base64Data, mimeType };
    }

    /**
     * Delete data or asset
     * @param {string} docName - Document/asset name
     * @param {boolean} isPublic - Delete from public path
     * @param {boolean} isAsset - Whether this is a chunked asset
     * @returns {Promise<void>}
     */
    async delete(docName, isPublic = false, isAsset = false) {
        if (!this.canvasApp.initialized) {
            throw new Error('CanvasApp not initialized. Call app.initialize() first.');
        }

        const pathSegments = isPublic
            ? this._getPublicPath(docName)
            : this._getPrivatePath(docName);

        if (isAsset) {
            // Delete all chunks first
            const metaRef = doc(this.canvasApp.db, ...pathSegments);
            const metaSnap = await getDoc(metaRef);

            if (metaSnap.exists()) {
                const { chunkCount } = metaSnap.data();
                const deletePromises = [];

                for (let i = 0; i < chunkCount; i++) {
                    const chunkRef = doc(this.canvasApp.db, ...pathSegments, 'chunks', String(i));
                    deletePromises.push(deleteDoc(chunkRef));
                }

                await Promise.all(deletePromises);
            }
        }

        // Delete main document
        const docRef = doc(this.canvasApp.db, ...pathSegments);
        await deleteDoc(docRef);
    }
}

// ============================================
// ASSET MANAGER - Cache & Load with Retry
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
     * @param {Object} options - { aspectRatio, forceRegenerate, isPublic }
     * @returns {Promise<string>} - Data URL (data:image/png;base64,...)
     */
    async getImage(assetId, prompt, options = {}) {
        const {
            aspectRatio = '16:9',
            forceRegenerate = false,
            isPublic = false
        } = options;

        // Check memory cache
        if (!forceRegenerate && this.cache.has(assetId)) {
            return this.cache.get(assetId);
        }

        // Check Firestore cache
        if (!forceRegenerate) {
            const cached = await this.firestore.loadAsset(assetId, isPublic);
            if (cached) {
                const dataUrl = `data:${cached.mimeType};base64,${cached.base64Data}`;
                this.cache.set(assetId, dataUrl);
                return dataUrl;
            }
        }

        // Generate new image
        const base64 = await this.gemini.generateImage(prompt, { aspectRatio });
        await this.firestore.saveAsset(assetId, 'image/png', base64, isPublic);

        const dataUrl = `data:image/png;base64,${base64}`;
        this.cache.set(assetId, dataUrl);
        return dataUrl;
    }

    /**
     * Get or generate audio asset
     * @param {string} assetId - Unique identifier
     * @param {string} text - Text to speak
     * @param {Object} options - { voice, multiSpeaker, forceRegenerate, isPublic }
     * @returns {Promise<string>} - Blob URL
     */
    async getAudio(assetId, text, options = {}) {
        const {
            voice = 'Kore',
            multiSpeaker = null,
            forceRegenerate = false,
            isPublic = false
        } = options;

        // Check memory cache
        if (!forceRegenerate && this.cache.has(assetId)) {
            return this.cache.get(assetId);
        }

        // Check Firestore cache
        if (!forceRegenerate) {
            const cached = await this.firestore.loadAsset(assetId, isPublic);
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
        const base64 = await this.gemini.generateSpeech(text, { voice, multiSpeaker });
        await this.firestore.saveAsset(assetId, 'audio/pcm;rate=24000', base64, isPublic);

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
// UI HELPERS
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
     * @returns {Object} - { element, update(current, total) }
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
                // Add a text element if needed
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
}

// ============================================
// EXPORTS
// ============================================
export {
    CanvasApp,
    GeminiAPI,
    FirestoreManager,
    AssetManager,
    UIHelpers
};

/**
 * Quick start helper
 * @param {string} appId - Your app identifier
 * @returns {Promise<Object>} - { app, gemini, firestore, assets, ui }
 */
export async function initCanvas(appId) {
    const app = new CanvasApp(appId);
    await app.initialize();

    const gemini = new GeminiAPI();
    const firestore = new FirestoreManager(app);
    const assets = new AssetManager(app, firestore, gemini);
    const ui = UIHelpers;

    return { app, gemini, firestore, assets, ui };
}
