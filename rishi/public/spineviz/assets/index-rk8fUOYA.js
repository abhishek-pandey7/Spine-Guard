(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))i(o);new MutationObserver(o=>{for(const s of o)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function n(o){const s={};return o.integrity&&(s.integrity=o.integrity),o.referrerPolicy&&(s.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?s.credentials="include":o.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(o){if(o.ep)return;o.ep=!0;const s=n(o);fetch(o.href,s)}})();const S="bcd9eee09ce044ef98a69c315aa792e2";let l=null,w=!1;const T={C1:[0,130,10],C2:[0,120,10],C3:[0,110,10],C4:[0,100,10],C5:[0,90,10],C6:[0,80,10],C7:[0,70,10],T1:[0,60,5],T2:[0,50,5],T3:[0,40,5],T4:[0,30,5],T5:[0,20,5],T6:[0,10,5],T7:[0,0,5],T8:[0,-10,5],T9:[0,-20,5],T10:[0,-30,5],T11:[0,-40,5],T12:[0,-50,5],L1:[0,-62,8],L2:[0,-72,8],L3:[0,-82,8],L4:[0,-92,8],L5:[0,-102,8],S1:[0,-115,5],S2:[0,-122,5],S3:[0,-129,5]},k={cervical:[0,100,10],thoracic:[0,5,5],lumbar:[0,-82,8],sacral:[0,-120,5]},A={cervical:"#ff8c42",thoracic:"#3a8fff",lumbar:"#00d4aa",sacral:"#c77dff",affected:"#ff4455"};function B(e){const t=document.getElementById("sketchfab-iframe");function n(){if(!window.Sketchfab){setTimeout(n,100);return}new window.Sketchfab(t).init(S,{success(o){l=o,l.start(),l.addEventListener("viewerready",()=>{w=!0,console.log("[SpineViz] Viewer ready"),e&&e()})},error(o){console.error("Sketchfab init error",o),e&&e()},ui_stop:0,ui_infos:0,ui_watermark:0,ui_annotations:0,ui_controls:1,preload:1,autostart:1,camera:0})}n()}function m(){l&&l.getAnnotationList(e=>{if(!(!e||!e.length))for(let t=e.length-1;t>=0;t--)l.removeAnnotation(t,()=>{})})}function $(e){if(m(),!l)return;const t=k[e],n=A[e]||"#ffffff",i=e.charAt(0).toUpperCase()+e.slice(1);t&&E(t,i+" Region",n)}function b(e){m(),!(!l||!e.length)&&setTimeout(()=>{e.forEach(t=>{const n=T[t.toUpperCase()];n?E(n,"⚠ "+t.toUpperCase(),"#ff4455"):console.warn("[SpineViz] No 3D position for level:",t)})},300)}function E(e,t,n){if(!l)return;const i=[e[0]+80,e[1]+20,e[2]+150],o=[e[0],e[1],e[2]];l.addAnnotation(e,i,o,t,"",(s,a)=>{if(s){console.warn("[SpineViz] addAnnotation failed:",s),R(t,n);return}console.log("[SpineViz] Annotation added at index",a,"— label:",t),M(a,n)})}function M(e,t){var n;try{const i=document.getElementById("sketchfab-iframe"),o=i.contentDocument||((n=i.contentWindow)==null?void 0:n.document);if(!o)return;const s="sf-ann-style-"+e;if(o.getElementById(s))return;const a=document.createElement("style");a.id=s,a.textContent=`
            .annotation:nth-child(${e+1}) .annotation-dot { background: ${t} !important; box-shadow: 0 0 12px ${t} !important; }
            .annotation:nth-child(${e+1}) .annotation-label { color: ${t} !important; border-color: ${t} !important; }
        `,o.head.appendChild(a)}catch{}}function R(e,t){const n=document.querySelector(".mid");if(!n)return;n.style.position="relative";const i=e.replace("⚠ ","").trim(),s={C1:"20%",C2:"22%",C3:"24%",C4:"26%",C5:"28%",C6:"30%",C7:"32%",T1:"34%",T2:"36%",T3:"38%",T4:"40%",T5:"42%",T6:"44%",T7:"46%",T8:"48%",T9:"50%",T10:"52%",T11:"54%",T12:"56%",L1:"58%",L2:"61%",L3:"63%",L4:"66%",L5:"69%",S1:"72%",S2:"74%",S3:"76%",S4:"78%",S5:"80%"}[i]||"60%",a=document.createElement("div");if(a.className="sf-pin",a.style.cssText=`
        position:absolute; top:${s}; left:52%;
        transform:translate(-50%,-50%);
        pointer-events:none; z-index:40;
        display:flex; align-items:center; gap:7px;
    `,a.innerHTML=`
        <div style="width:14px;height:14px;border-radius:50%;background:${t};
            box-shadow:0 0 10px ${t};animation:sfPulse 1.3s ease-out infinite;
            flex-shrink:0;"></div>
        <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;
            color:${t};letter-spacing:1.5px;background:rgba(6,6,14,.88);
            border:1px solid ${t}55;border-radius:5px;padding:3px 9px;
            white-space:nowrap;">${i}</span>
    `,n.appendChild(a),!document.getElementById("sf-styles")){const c=document.createElement("style");c.id="sf-styles",c.textContent="@keyframes sfPulse{0%{box-shadow:0 0 0 0 #ff445599}70%{box-shadow:0 0 0 12px transparent}100%{box-shadow:0 0 0 0 transparent}}",document.head.appendChild(c)}}function u(){return w}const O="",P="gemini-2.5-flash",N="https://generativelanguage.googleapis.com/v1beta/models";let d=null,f=null;const _=`You are a Neuroradiology AI. Analyze the attached spine image.

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
}`;function D(e){const t=document.getElementById("file-inp"),n=document.getElementById("upload-zone");n.addEventListener("dragover",i=>{i.preventDefault(),n.classList.add("drag")}),n.addEventListener("dragleave",()=>n.classList.remove("drag")),n.addEventListener("drop",i=>{i.preventDefault(),n.classList.remove("drag"),i.dataTransfer.files[0]&&I(i.dataTransfer.files[0])}),t.addEventListener("change",i=>{i.target.files[0]&&I(i.target.files[0])})}function I(e,t){const n=new FileReader;n.onload=i=>{f=e.type||"image/jpeg",d=i.target.result.split(",")[1],document.getElementById("mri-preview").src=i.target.result,document.getElementById("preview-wrap").style.display="block",document.getElementById("upload-zone").classList.add("has-img"),document.getElementById("analyse-btn").disabled=!1},n.readAsDataURL(e)}function j(){d=null,f=null,document.getElementById("mri-preview").src="",document.getElementById("preview-wrap").style.display="none",document.getElementById("upload-zone").classList.remove("has-img"),document.getElementById("analyse-btn").disabled=!0,document.getElementById("ai-result").style.display="none";const e=document.getElementById("scan-bar");e&&e.classList.remove("active"),document.getElementById("file-inp").value=""}async function z(){var y,v,h;const e=document.getElementById("api-key-inp").value.trim()||O;if(!e)throw new Error("Please paste your Gemini API key in the header input field.");if(!d)throw new Error("Please upload an MRI image first.");const t=`${N}/${P}:generateContent?key=${e}`,n=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:f,data:d}},{text:_}]}],generationConfig:{temperature:0,maxOutputTokens:2048,responseMimeType:"application/json"}})});if(!n.ok){const r=await n.json().catch(()=>({}));throw new Error(((y=r==null?void 0:r.error)==null?void 0:y.message)||`HTTP ${n.status}`)}const i=await n.json(),o=(v=i==null?void 0:i.candidates)==null?void 0:v[0];if(!o)throw new Error("Gemini returned no candidates. Try again.");const a=(((h=o==null?void 0:o.content)==null?void 0:h.parts)||[]).map(r=>r.text||"").join("").trim(),c=a.indexOf("{"),p=a.lastIndexOf("}");if(c===-1||p===-1)throw console.error("[SpineViz] No JSON block found. Raw text:",a),new Error("AI response did not contain a valid JSON object.");const g=a.substring(c,p+1);try{const r=JSON.parse(g);return(!r.affectedLevels||!Array.isArray(r.affectedLevels))&&(r.affectedLevels=[]),r}catch(r){throw console.error("[SpineViz] JSON Parse Error:",r,"Raw:",g),new Error("Failed to parse AI medical data. The response was truncated.")}}const F={cervical:{clr:"#ff8c42",rgb:"255,140,66",tag:"C1–C7 · NECK",title:`Cervical
Spine`,sub:"Seven vertebrae support the skull and allow the head to rotate and flex. Vulnerable to disc herniation, cervical myelopathy, and whiplash injuries that radiate into arms and hands.",surgeries:[{ico:"🔬",name:"ACDF",full:"Anterior Cervical Discectomy & Fusion",desc:"Front-of-neck approach removes the damaged disc; adjacent vertebrae fused with cage and plate. High fusion rates, fast relief of nerve compression."},{ico:"💿",name:"Cervical ADR",full:"Artificial Disc Replacement",desc:"Prosthetic implant replaces degenerated disc, preserving natural motion and reducing adjacent-level stress."},{ico:"🩺",name:"Laminoplasty",full:"Cervical Canal Expansion",desc:"Lamina hinged open to widen the spinal canal and relieve multi-level cord compression without fusion."}],cost:"₹3.5L – ₹8L",pct:52,recovery:"6–12 weeks",success:"92%",risks:["Nerve root injury","Dysphagia","Adjacent segment disease","Hardware failure","C5 palsy"],timeline:["Day 1–3","Week 2","Month 2","Month 4"]},thoracic:{clr:"#3a8fff",rgb:"58,143,255",tag:"T1–T12 · MID-BACK",title:`Thoracic
Spine`,sub:"Twelve vertebrae articulate with the rib cage for structural rigidity. Less mobile than other regions yet susceptible to kyphotic deformity, compression fractures, and rare disc herniations.",surgeries:[{ico:"🔩",name:"Posterior Fusion",full:"Thoracic Pedicle Screw Instrumentation",desc:"Rods and pedicle screws span multiple levels to restore alignment. Indicated for fractures, scoliosis, and tumour resection."},{ico:"🎥",name:"VATS",full:"Video-Assisted Thoracoscopic Surgery",desc:"Minimally invasive anterior approach for thoracic disc herniations. Dramatically reduces muscle trauma vs. open thoracotomy."},{ico:"📐",name:"Osteotomy",full:"Ponte / PSO Kyphosis Correction",desc:"Vertebral bone reshaping corrects pathological kyphosis and restores global sagittal balance."}],cost:"₹4L – ₹10L",pct:68,recovery:"10–20 weeks",success:"87%",risks:["Spinal cord injury","Pneumonia","Rod breakage","Deep infection","Flatback syndrome"],timeline:["Week 1–2","Month 2","Month 4","Month 8"]},lumbar:{clr:"#00d4aa",rgb:"0,212,170",tag:"L1–L5 · LOWER BACK",title:`Lumbar
Spine`,sub:"Five vertebrae bear the greatest biomechanical load in the body. Disc herniation, spinal stenosis, and degenerative spondylolisthesis are the most common surgical indications in adults.",surgeries:[{ico:"💡",name:"Microdiscectomy",full:"Lumbar Micro-Discectomy",desc:"Gold standard for sciatica. Microsurgical removal of herniated nucleus under magnification, preserving spinal stability with rapid recovery."},{ico:"🔗",name:"TLIF / PLIF",full:"Transforaminal / Posterior Lumbar Interbody Fusion",desc:"Interbody cage restores disc height; pedicle screws and rods provide rigid fixation. Treats instability, spondylolisthesis, and recurrent herniations."},{ico:"🌀",name:"Laminectomy",full:"Decompressive Lumbar Laminectomy",desc:"Removal of lamina decompresses the canal, relieving neurogenic claudication from stenosis."}],cost:"₹2.5L – ₹7L",pct:44,recovery:"4–16 weeks",success:"94%",risks:["Dural tear / CSF leak","Failed back syndrome","Adjacent segment disease","Pseudarthrosis","Nerve root damage"],timeline:["Day 1","Week 3","Month 2","Month 5"]},sacral:{clr:"#c77dff",rgb:"199,125,255",tag:"S1–S5 · PELVIS",title:`Sacral &
Coccyx`,sub:"The sacrum anchors the lumbar spine to the pelvic ring via the SI joints. Disorders here affect pelvic stability, bowel, bladder, and sexual function.",surgeries:[{ico:"🔐",name:"SI Joint Fusion",full:"Sacroiliac Joint Arthrodesis",desc:"Triangular titanium implants placed percutaneously across the SI joint, eliminating painful micro-motion."},{ico:"🛡️",name:"Sacroplasty",full:"Percutaneous Sacroplasty",desc:"Bone cement injected under fluoroscopic guidance into sacral insufficiency fractures. Near-immediate pain relief."},{ico:"🧩",name:"Coccygectomy",full:"Surgical Coccyx Excision",desc:"Removal of the coccyx for intractable coccydynia unresponsive to ≥3 months of conservative management."}],cost:"₹1.5L – ₹5.5L",pct:28,recovery:"6–14 weeks",success:"85%",risks:["Wound healing delay","Sacral nerve injury","Cement leakage","Symptom recurrence","Pelvic instability"],timeline:["Day 1–3","Week 2","Month 2","Month 4"]}};function V(e,t=null){const n=F[e];if(!n)return;document.getElementById("rp-dot").style.background=n.clr;const i=document.getElementById("rp-tag");i.style.color=n.clr,i.textContent=n.tag,document.getElementById("rp-title").innerHTML=n.title.replace(`
`,"<br>"),document.getElementById("rp-sub").textContent=n.sub;const o=document.getElementById("diag-banner");t?(o.style.display="block",document.getElementById("diag-banner-val").textContent=`${t.finding} · Recommended: ${t.surgery}`):o.style.display="none";const s=document.getElementById("rp-body");s.innerHTML=G(t)+H(n)+J(n)+U(n)+W(n)}function G(e,t){return e?`
    <div class="card affected-card">
      <div class="card-lbl" style="color:var(--red)">🔴 AI Diagnosis — ${e.conf}% Confidence</div>
      <div style="font-size:13px;font-weight:600;color:#ff8899;margin-bottom:6px">${e.finding}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${e.levels.map(n=>`
          <span style="font-family:'DM Mono',monospace;font-size:10px;padding:3px 9px;
            border-radius:12px;background:rgba(255,68,85,.15);
            border:1px solid rgba(255,68,85,.3);color:var(--red)">${n}</span>
        `).join("")}
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text2)">
        Recommended: <span style="color:var(--text)">${e.surgery}</span>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px;font-family:'DM Mono',monospace">
        Affected vertebrae are highlighted in the 3D model.
      </div>
    </div>`:""}function H(e){return`
    <div class="card">
      <div class="card-lbl">Surgical Options for this Region</div>
      <div class="surg-list">
        ${e.surgeries.map(t=>`
          <div class="surg-item">
            <div class="surg-ico">${t.ico}</div>
            <div>
              <div class="surg-name">${t.name}</div>
              <div class="surg-full">${t.full}</div>
              <div class="surg-desc">${t.desc}</div>
            </div>
          </div>`).join("")}
      </div>
    </div>`}function J(e){return`
    <div class="stats2">
      <div class="stat-box">
        <div class="stat-lbl">Estimated Cost</div>
        <div class="stat-val" style="font-size:13px;color:${e.clr}">${e.cost}</div>
        <div class="cbar"><div class="cbar-fill" style="width:${e.pct}%;background:${e.clr}"></div></div>
        <div class="stat-sub">India avg · varies by centre</div>
      </div>
      <div class="stat-box">
        <div class="stat-lbl">Success Rate</div>
        <div class="stat-val" style="color:${e.clr}">${e.success}</div>
        <div class="stat-sub">Qualified surgeon, right candidate</div>
      </div>
    </div>`}function U(e){const t=e.timeline.map((n,i)=>`
    ${i>0?`<div class="tl-line" style="background:linear-gradient(90deg,${e.clr}55,${e.clr}11)"></div>`:""}
    <div class="tl-node">
      <div class="tl-dot" style="background:${e.clr};box-shadow:0 0 6px ${e.clr}99;opacity:${1-i*.17}"></div>
      <div class="tl-lbl">${n}</div>
    </div>`).join("");return`
    <div class="card">
      <div class="card-lbl">Recovery Timeline · ${e.recovery}</div>
      <div class="timeline">${t}</div>
      <div style="font-size:10.5px;color:var(--text2);margin-top:10px;line-height:1.6">
        Physiotherapy and lifestyle changes required throughout. Individual results vary significantly.
      </div>
    </div>`}function W(e){return`
    <div class="card">
      <div class="card-lbl">Possible Risks &amp; Complications</div>
      <div class="risks">
        ${e.risks.map(t=>`<span class="risk-pill">${t}</span>`).join("")}
      </div>
      <div style="font-size:10.5px;color:var(--text2);margin-top:10px;line-height:1.6">
        Consult a board-certified spine surgeon for personalised risk assessment.
      </div>
    </div>`}B(()=>{console.log("SpineViz: viewer ready")});D();window.clearMRI=function(){j(),x()};window.analyseMRI=async function(){const e=document.getElementById("analyse-btn");e.disabled=!0,e.innerHTML='<span class="btn-ico">⏳</span> Analysing…',document.getElementById("scan-bar").classList.add("active"),document.getElementById("ai-result").style.display="none",x();try{const t=await z();q(t)}catch(t){C(`❌ ${t.message}`),console.error(t)}finally{e.disabled=!1,e.innerHTML='<span class="btn-ico">🔬</span> Analyse with Gemini AI',document.getElementById("scan-bar").classList.remove("active")}};function q(e){const t=e.affectedLevels||[],n=e.region||null,i=Math.min(100,Math.max(0,e.confidence||0)),o=e.finding||"Unknown finding",s=e.recommendedSurgery||"Consult surgeon";if(document.getElementById("ai-result").style.display="block",document.getElementById("res-level").textContent=t.join(", ")||"None detected",document.getElementById("res-conf").textContent=`${i}%`,document.getElementById("conf-fill").style.width=`${i}%`,document.getElementById("res-finding").textContent=o,!t.length||!n){C("ℹ No specific spinal pathology detected.");return}document.querySelectorAll(".reg-btn").forEach(c=>{c.classList.toggle("highlighted",c.dataset.region===n)});const a=document.getElementById("affected-popup");if(a.style.display="block",document.getElementById("popup-label").textContent="⚠ AI Detected",document.getElementById("popup-level").textContent=t.join(" · "),document.getElementById("popup-finding").textContent=o,u())b(t);else{const c=setInterval(()=>{u()&&(clearInterval(c),b(t))},500)}L(n,{levels:t,finding:o,surgery:s,conf:i})}window.selectRegion=function(e,t=null){L(e,t)};function L(e,t=null){document.querySelectorAll(".reg-btn").forEach(n=>{n.classList.toggle("active",n.dataset.region===e)}),!t&&u()&&$(e),document.getElementById("region-overlay").style.display="block",V(e,t)}function x(){m(),document.getElementById("affected-popup").style.display="none",document.getElementById("diag-banner").style.display="none",document.getElementById("region-overlay").style.display="none",document.querySelectorAll(".reg-btn").forEach(e=>{e.classList.remove("highlighted")})}function C(e,t=4500){const n=document.getElementById("toast");n.textContent=e,n.className="show",setTimeout(()=>n.className="",t)}
