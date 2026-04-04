// ══════════════════════════════════════════════════════════
//  viewer.js — Sketchfab viewer with ANNOTATION-based pins
//  Annotations are native to Sketchfab — they move with the
//  3D model as the user rotates/zooms it.
// ══════════════════════════════════════════════════════════

const SKETCHFAB_MODEL = 'bcd9eee09ce044ef98a69c315aa792e2';

let api = null;
let viewerReady = false;

// 3D world-space positions for each vertebra in this specific model
// (bcd9eee09ce044ef98a69c315aa792e2 — "The human spinal column by 3D")
// These are approximate positions along the Y axis (vertical spine)
// X=0 is centre, Y increases upward, Z is depth
const LEVEL_3D = {
    'C1': [0, 130, 10], 'C2': [0, 120, 10], 'C3': [0, 110, 10],
    'C4': [0, 100, 10], 'C5': [0, 90, 10], 'C6': [0, 80, 10],
    'C7': [0, 70, 10],
    'T1': [0, 60, 5], 'T2': [0, 50, 5], 'T3': [0, 40, 5],
    'T4': [0, 30, 5], 'T5': [0, 20, 5], 'T6': [0, 10, 5],
    'T7': [0, 0, 5], 'T8': [0, -10, 5], 'T9': [0, -20, 5],
    'T10': [0, -30, 5], 'T11': [0, -40, 5], 'T12': [0, -50, 5],
    'L1': [0, -62, 8], 'L2': [0, -72, 8], 'L3': [0, -82, 8],
    'L4': [0, -92, 8], 'L5': [0, -102, 8],
    'S1': [0, -115, 5], 'S2': [0, -122, 5], 'S3': [0, -129, 5],
};

const REGION_3D_CENTER = {
    cervical: [0, 100, 10],
    thoracic: [0, 5, 5],
    lumbar: [0, -82, 8],
    sacral: [0, -120, 5],
};

const REGION_COLORS = {
    cervical: '#ff8c42',
    thoracic: '#3a8fff',
    lumbar: '#00d4aa',
    sacral: '#c77dff',
    affected: '#ff4455',
};

// ── INIT ───────────────────────────────────────────────────
export function initViewer(onReady) {
    const iframe = document.getElementById('sketchfab-iframe');

    function tryInit() {
        if (!window.Sketchfab) { setTimeout(tryInit, 100); return; }
        const client = new window.Sketchfab(iframe);
        client.init(SKETCHFAB_MODEL, {
            success(sfApi) {
                api = sfApi;
                api.start();
                api.addEventListener('viewerready', () => {
                    viewerReady = true;
                    console.log('[SpineViz] Viewer ready');
                    if (onReady) onReady();
                });
            },
            error(e) {
                console.error('Sketchfab init error', e);
                if (onReady) onReady();
            },
            ui_stop: 0, ui_infos: 0, ui_watermark: 0, ui_annotations: 0,
            ui_controls: 1, preload: 1, autostart: 1, camera: 0,
        });
    }
    tryInit();
}

// ── RESET — remove all annotations ────────────────────────
export function resetMaterials() {
    if (!api) return;
    // Remove all annotations
    api.getAnnotationList(list => {
        if (!list || !list.length) return;
        // Remove in reverse order so indices stay valid
        for (let i = list.length - 1; i >= 0; i--) {
            api.removeAnnotation(i, () => { });
        }
    });
}

// ── HIGHLIGHT REGION ───────────────────────────────────────
export function highlightRegion(regionKey) {
    resetMaterials();
    if (!api) return;

    const pos = REGION_3D_CENTER[regionKey];
    const color = REGION_COLORS[regionKey] || '#ffffff';
    const label = regionKey.charAt(0).toUpperCase() + regionKey.slice(1);

    if (pos) {
        _addAnnotation(pos, label + ' Region', color);
    }
}

// ── HIGHLIGHT AFFECTED LEVELS ──────────────────────────────
export function highlightAffectedLevels(levels) {
    resetMaterials();
    if (!api || !levels.length) return;

    // Small delay to ensure previous annotations are removed
    setTimeout(() => {
        levels.forEach(level => {
            const pos = LEVEL_3D[level.toUpperCase()];
            if (pos) {
                _addAnnotation(pos, '⚠ ' + level.toUpperCase(), '#ff4455');
            } else {
                console.warn('[SpineViz] No 3D position for level:', level);
            }
        });
    }, 300);
}

// ── ADD ANNOTATION at 3D world position ───────────────────
function _addAnnotation(position, label, color) {
    if (!api) return;

    // Sketchfab addAnnotation: (position3d, cameraPosition, title, body, callback)
    // We use position as both the point and slightly offset camera eye
    const eye = [position[0] + 80, position[1] + 20, position[2] + 150];
    const target = [position[0], position[1], position[2]];

    api.addAnnotation(
        position,  // 3D point on model surface
        eye,       // camera eye for when annotation is clicked
        target,    // camera target
        label,     // title shown on annotation
        '',        // body text
        (err, index) => {
            if (err) {
                console.warn('[SpineViz] addAnnotation failed:', err);
                // Fallback to CSS pin if annotation API not available
                _cssFallbackPin(label, color);
                return;
            }
            console.log('[SpineViz] Annotation added at index', index, '— label:', label);
            // Style the annotation via CSS injection into iframe
            _styleAnnotation(index, color);
        }
    );
}

// ── STYLE annotation dot color via iframe CSS ──────────────
function _styleAnnotation(index, color) {
    try {
        const iframe = document.getElementById('sketchfab-iframe');
        const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iDoc) return;

        const styleId = 'sf-ann-style-' + index;
        if (iDoc.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        // Sketchfab annotation dots use .annotation class
        style.textContent = `
            .annotation:nth-child(${index + 1}) .annotation-dot { background: ${color} !important; box-shadow: 0 0 12px ${color} !important; }
            .annotation:nth-child(${index + 1}) .annotation-label { color: ${color} !important; border-color: ${color} !important; }
        `;
        iDoc.head.appendChild(style);
    } catch (e) {
        // Cross-origin iframe — can't inject styles, that's fine
    }
}

// ── CSS FALLBACK if addAnnotation not supported ────────────
function _cssFallbackPin(label, color) {
    const mid = document.querySelector('.mid');
    if (!mid) return;
    mid.style.position = 'relative';

    // Map label back to approximate screen position
    const levelKey = label.replace('⚠ ', '').trim();
    const screenPos = {
        'C1': '20%', 'C2': '22%', 'C3': '24%', 'C4': '26%', 'C5': '28%', 'C6': '30%', 'C7': '32%',
        'T1': '34%', 'T2': '36%', 'T3': '38%', 'T4': '40%', 'T5': '42%',
        'T6': '44%', 'T7': '46%', 'T8': '48%', 'T9': '50%', 'T10': '52%', 'T11': '54%', 'T12': '56%',
        'L1': '58%', 'L2': '61%', 'L3': '63%', 'L4': '66%', 'L5': '69%',
        'S1': '72%', 'S2': '74%', 'S3': '76%', 'S4': '78%', 'S5': '80%',
    };
    const top = screenPos[levelKey] || '60%';

    const el = document.createElement('div');
    el.className = 'sf-pin';
    el.style.cssText = `
        position:absolute; top:${top}; left:52%;
        transform:translate(-50%,-50%);
        pointer-events:none; z-index:40;
        display:flex; align-items:center; gap:7px;
    `;
    el.innerHTML = `
        <div style="width:14px;height:14px;border-radius:50%;background:${color};
            box-shadow:0 0 10px ${color};animation:sfPulse 1.3s ease-out infinite;
            flex-shrink:0;"></div>
        <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;
            color:${color};letter-spacing:1.5px;background:rgba(6,6,14,.88);
            border:1px solid ${color}55;border-radius:5px;padding:3px 9px;
            white-space:nowrap;">${levelKey}</span>
    `;
    mid.appendChild(el);

    // Inject pulse animation once
    if (!document.getElementById('sf-styles')) {
        const s = document.createElement('style');
        s.id = 'sf-styles';
        s.textContent = `@keyframes sfPulse{0%{box-shadow:0 0 0 0 #ff445599}70%{box-shadow:0 0 0 12px transparent}100%{box-shadow:0 0 0 0 transparent}}`;
        document.head.appendChild(s);
    }
}

// ── CAMERA — intentionally disabled (was blanking model) ───
export function setCameraForRegion(key) { }
export function setCameraForLevels(levels) { }

export function isViewerReady() { return viewerReady; }
export { api };