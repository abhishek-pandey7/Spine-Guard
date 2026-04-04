// ══════════════════════════════════════════════════════════
//  gemini.js — MRI Analysis with Visual Grounding
// ══════════════════════════════════════════════════════════

const DEFAULT_API_KEY = ''; // ← paste your key here if hardcoding

// RECOMMENDATION: Use 'gemini-1.5-pro' for better medical OCR if available
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export let mriBase64 = null;
export let mriMimeType = null;

/**
 * PROMPT STRATEGY:
 * 1. Forced Counting: Anchor to Sacrum or Skull to prevent L4/L5 bias.
 * 2. Marker Priority: Explicitly look for arrows or red dots.
 * 3. JSON Enforcement: Strict formatting rules to prevent truncation.
 */
const GEMINI_PROMPT = `You are a Neuroradiology AI. Analyze the attached spine image.

DIAGNOSTIC PROTOCOL:
1. Identify the reference point (Sacrum at the bottom or C1/Skull at the top).
2. Look for VISUAL MARKERS: White arrows, red dots, or dark/bulging discs.
3. Count vertebrae from your reference point to the marker. Do NOT guess based on common cases.
4. If a white arrow is pointing to a specific bone (like L2), that is the level you report.

OUTPUT RULES:
- Return ONLY a raw JSON object. 
- No conversation, no markdown fences, no "Here is the result".
- Ensure the JSON is complete and valid.

Required structure:
{
  "affectedLevels": ["L2"],
  "finding": "Specific description of markers or pathology seen at the counted level",
  "region": "cervical" | "thoracic" | "lumbar",
  "confidence": 0-100,
  "severity": "mild" | "moderate" | "severe",
  "recommendedSurgery": "Clinical correlation required"
}`;

// ── FILE HANDLING ─────────────────────────────────────────
export function setupFileHandlers(callbacks) {
    const fileInp = document.getElementById('file-inp');
    const uploadZone = document.getElementById('upload-zone');

    if (DEFAULT_API_KEY) {
        const inp = document.getElementById('api-key-inp');
        if (inp && !inp.value) inp.value = DEFAULT_API_KEY;
    }

    uploadZone.addEventListener('dragover', e => {
        e.preventDefault();
        uploadZone.classList.add('drag');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
    uploadZone.addEventListener('drop', e => {
        e.preventDefault();
        uploadZone.classList.remove('drag');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], callbacks);
    });
    fileInp.addEventListener('change', e => {
        if (e.target.files[0]) handleFile(e.target.files[0], callbacks);
    });
}

function handleFile(file, callbacks) {
    const reader = new FileReader();
    reader.onload = ev => {
        mriMimeType = file.type || 'image/jpeg';
        mriBase64 = ev.target.result.split(',')[1];
        document.getElementById('mri-preview').src = ev.target.result;
        document.getElementById('preview-wrap').style.display = 'block';
        document.getElementById('upload-zone').classList.add('has-img');
        document.getElementById('analyse-btn').disabled = false;
        if (callbacks.onFileLoaded) callbacks.onFileLoaded();
    };
    reader.readAsDataURL(file);
}

export function clearMRIState() {
    mriBase64 = null;
    mriMimeType = null;
    document.getElementById('mri-preview').src = '';
    document.getElementById('preview-wrap').style.display = 'none';
    document.getElementById('upload-zone').classList.remove('has-img');
    document.getElementById('analyse-btn').disabled = true;
    document.getElementById('ai-result').style.display = 'none';
    const scanBar = document.getElementById('scan-bar');
    if (scanBar) scanBar.classList.remove('active');
    document.getElementById('file-inp').value = '';
}

// ── GEMINI API CALL ───────────────────────────────────────
export async function analyseWithGemini() {
    const apiKey = document.getElementById('api-key-inp').value.trim() || DEFAULT_API_KEY;
    if (!apiKey) throw new Error('Please paste your Gemini API key in the header input field.');
    if (!mriBase64) throw new Error('Please upload an MRI image first.');

    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { inline_data: { mime_type: mriMimeType, data: mriBase64 } },
                    { text: GEMINI_PROMPT }
                ]
            }],
            generationConfig: {
                // FIXED: 0.0 forces the model to stick to visual facts, not guesses
                temperature: 0.0,
                // FIXED: Increased token count to prevent JSON truncation
                maxOutputTokens: 2048,
                // Optional: For Flash 1.5+, you can try adding responseMimeType here
                responseMimeType: "application/json"
            }
        })
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const candidate = data?.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidates. Try again.');

    const parts = candidate?.content?.parts || [];
    const rawText = parts.map(p => p.text || '').join('').trim();

    // ── ROBUST BRUTE-FORCE JSON EXTRACTION ────────────────
    // This finds the first { and last } to ignore any text the model adds
    const startIdx = rawText.indexOf('{');
    const endIdx = rawText.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
        console.error('[SpineViz] No JSON block found. Raw text:', rawText);
        throw new Error('AI response did not contain a valid JSON object.');
    }

    const cleanedJson = rawText.substring(startIdx, endIdx + 1);

    try {
        const parsed = JSON.parse(cleanedJson);

        // Basic Validation
        if (!parsed.affectedLevels || !Array.isArray(parsed.affectedLevels)) {
            parsed.affectedLevels = [];
        }

        return parsed;
    } catch (e) {
        console.error('[SpineViz] JSON Parse Error:', e, 'Raw:', cleanedJson);
        throw new Error('Failed to parse AI medical data. The response was truncated.');
    }
}