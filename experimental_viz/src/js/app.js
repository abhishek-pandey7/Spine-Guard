// ══════════════════════════════════════════════════════════
//  app.js — Main controller
//  FIXED: removed setCameraForRegion/Levels calls that were
//         blanking the Sketchfab model
// ══════════════════════════════════════════════════════════

import {
    initViewer, highlightRegion, highlightAffectedLevels,
    resetMaterials, isViewerReady
} from './viewer.js';
import { setupFileHandlers, analyseWithGemini, clearMRIState } from './gemini.js';
import { renderPanel } from './panel.js';

// ── VIEWER INIT ────────────────────────────────────────────
initViewer(() => {
    console.log('SpineViz: viewer ready');
});

// ── FILE UPLOAD ────────────────────────────────────────────
setupFileHandlers({ onFileLoaded() { } });

// ── CLEAR MRI ──────────────────────────────────────────────
window.clearMRI = function () {
    clearMRIState();
    _clearAffected();
};

// ── ANALYSE ────────────────────────────────────────────────
window.analyseMRI = async function () {
    const btn = document.getElementById('analyse-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-ico">⏳</span> Analysing…';
    document.getElementById('scan-bar').classList.add('active');
    document.getElementById('ai-result').style.display = 'none';
    _clearAffected();

    try {
        const parsed = await analyseWithGemini();
        _handleAIResult(parsed);
    } catch (e) {
        _showToast(`❌ ${e.message}`);
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-ico">🔬</span> Analyse with AI';
        document.getElementById('scan-bar').classList.remove('active');
    }
};

function _handleAIResult(parsed) {
    const levels = parsed.affectedLevels || [];
    const region = parsed.region || null;
    const conf = Math.min(100, Math.max(0, parsed.confidence || 0));
    const finding = parsed.finding || 'Unknown finding';
    const surgery = parsed.recommendedSurgery || 'Consult surgeon';

    // Left panel result box
    document.getElementById('ai-result').style.display = 'block';
    document.getElementById('res-level').textContent = levels.join(', ') || 'None detected';
    document.getElementById('res-conf').textContent = `${conf}%`;
    document.getElementById('conf-fill').style.width = `${conf}%`;
    document.getElementById('res-finding').textContent = finding;

    if (!levels.length || !region) {
        _showToast('ℹ No specific spinal pathology detected.');
        return;
    }

    // Highlight region buttons
    document.querySelectorAll('.reg-btn').forEach(b => {
        b.classList.toggle('highlighted', b.dataset.region === region);
    });

    // Show AI popup overlay
    const popup = document.getElementById('affected-popup');
    popup.style.display = 'block';
    document.getElementById('popup-label').textContent = '⚠ AI Detected';
    document.getElementById('popup-level').textContent = levels.join(' · ');
    document.getElementById('popup-finding').textContent = finding;

    // ✅ FIXED: Only call highlight — NO camera calls that blank the model
    if (isViewerReady()) {
        highlightAffectedLevels(levels);
    } else {
        const poll = setInterval(() => {
            if (isViewerReady()) {
                clearInterval(poll);
                highlightAffectedLevels(levels);
            }
        }, 500);
    }

    // Right panel
    selectRegion(region, { levels, finding, surgery, conf, region });
}

// ── SELECT REGION ──────────────────────────────────────────
window.selectRegion = function (key, aiData = null) {
    selectRegion(key, aiData);
};

function selectRegion(key, aiData = null) {
    document.querySelectorAll('.reg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.region === key);
    });

    // ✅ FIXED: NO camera calls — only highlight overlay
    if (!aiData && isViewerReady()) {
        highlightRegion(key);
    }

    document.getElementById('region-overlay').style.display = 'block';
    renderPanel(key, aiData);
}

// ── CLEAR ──────────────────────────────────────────────────
function _clearAffected() {
    resetMaterials(); // now only clears overlays, never touches 3D model
    document.getElementById('affected-popup').style.display = 'none';
    document.getElementById('diag-banner').style.display = 'none';
    document.getElementById('region-overlay').style.display = 'none';
    document.querySelectorAll('.reg-btn').forEach(b => {
        b.classList.remove('highlighted');
    });
}

// ── TOAST ──────────────────────────────────────────────────
function _showToast(msg, dur = 4500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show';
    setTimeout(() => t.className = '', dur);
}