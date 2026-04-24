// ══════════════════════════════════════════════════════════
//  panel.js — Right panel card renderer
// ══════════════════════════════════════════════════════════

import { REGION_DATA } from './data.js';

export function renderPanel(regionKey, aiData = null) {
    const d = REGION_DATA[regionKey];
    if (!d) return;

    // Update header
    document.getElementById('rp-dot').style.background = d.clr;
    const tagEl = document.getElementById('rp-tag');
    tagEl.style.color = d.clr;
    tagEl.textContent = d.tag;
    document.getElementById('rp-title').innerHTML = d.title.replace('\n', '<br>');
    document.getElementById('rp-sub').textContent = d.sub;

    // AI diagnosis banner
    const diagBanner = document.getElementById('diag-banner');
    if (aiData) {
        diagBanner.style.display = 'block';
        document.getElementById('diag-banner-val').textContent =
            `${aiData.finding} · Recommended: ${aiData.surgery}`;
    } else {
        diagBanner.style.display = 'none';
    }

    // Body cards
    const body = document.getElementById('rp-body');
    body.innerHTML = _buildAICard(aiData, d) + _buildSurgeryCard(d) +
        _buildStatsCard(d) + _buildTimelineCard(d) + _buildRisksCard(d);
}

function _buildAICard(aiData, d) {
    if (!aiData) return '';
    return `
    <div class="card affected-card">
      <div class="card-lbl" style="color:#c0392b;font-weight:700">🔴 AI Diagnosis — ${aiData.conf}% Confidence</div>
      <div style="font-size:13px;font-weight:700;color:#c0392b;margin-bottom:6px">${aiData.finding}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${aiData.levels.map(l => `
          <span style="font-family:'DM Mono',monospace;font-size:10px;padding:3px 9px;
            border-radius:12px;background:rgba(192,57,43,0.12);
            border:1px solid rgba(192,57,43,0.4);color:#c0392b;font-weight:700">${l}</span>
        `).join('')}
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:#5a6e6f">
        Recommended: <span style="color:#2c3e3f;font-weight:600">${aiData.surgery}</span>
      </div>
      <div style="font-size:10px;color:#8a9e9f;margin-top:8px;font-family:'DM Mono',monospace">
        Affected vertebrae are highlighted in the 3D model.
      </div>
    </div>`;
}

function _buildSurgeryCard(d) {
    return `
    <div class="card">
      <div class="card-lbl">Surgical Options for this Region</div>
      <div class="surg-list">
        ${d.surgeries.map(s => `
          <div class="surg-item">
            <div class="surg-ico">${s.ico}</div>
            <div>
              <div class="surg-name">${s.name}</div>
              <div class="surg-full">${s.full}</div>
              <div class="surg-desc">${s.desc}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function _buildStatsCard(d) {
    return `
    <div class="stats2">
      <div class="stat-box">
        <div class="stat-lbl">Estimated Cost</div>
        <div class="stat-val" style="font-size:13px;color:${d.clr}">${d.cost}</div>
        <div class="cbar"><div class="cbar-fill" style="width:${d.pct}%;background:${d.clr}"></div></div>
        <div class="stat-sub">India avg · varies by centre</div>
      </div>
      <div class="stat-box">
        <div class="stat-lbl">Success Rate</div>
        <div class="stat-val" style="color:${d.clr}">${d.success}</div>
        <div class="stat-sub">Qualified surgeon, right candidate</div>
      </div>
    </div>`;
}

function _buildTimelineCard(d) {
    const nodes = d.timeline.map((lbl, i) => `
    ${i > 0 ? `<div class="tl-line" style="background:linear-gradient(90deg,${d.clr}55,${d.clr}11)"></div>` : ''}
    <div class="tl-node">
      <div class="tl-dot" style="background:${d.clr};box-shadow:0 0 6px ${d.clr}99;opacity:${1 - i * 0.17}"></div>
      <div class="tl-lbl">${lbl}</div>
    </div>`).join('');

    return `
    <div class="card">
      <div class="card-lbl">Recovery Timeline · ${d.recovery}</div>
      <div class="timeline">${nodes}</div>
      <div style="font-size:10.5px;color:var(--text2);margin-top:10px;line-height:1.6">
        Physiotherapy and lifestyle changes required throughout. Individual results vary significantly.
      </div>
    </div>`;
}

function _buildRisksCard(d) {
    return `
    <div class="card">
      <div class="card-lbl">Possible Risks &amp; Complications</div>
      <div class="risks">
        ${d.risks.map(r => `<span class="risk-pill">${r}</span>`).join('')}
      </div>
      <div style="font-size:10.5px;color:var(--text2);margin-top:10px;line-height:1.6">
        Consult a board-certified spine surgeon for personalised risk assessment.
      </div>
    </div>`;
}