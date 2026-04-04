// ══════════════════════════════════════════════════════════
//  data.js — All static region data and mappings
// ══════════════════════════════════════════════════════════

export const REGION_DATA = {
    cervical: {
        clr: '#ff8c42', rgb: '255,140,66',
        tag: 'C1–C7 · NECK',
        title: 'Cervical\nSpine',
        sub: 'Seven vertebrae support the skull and allow the head to rotate and flex. Vulnerable to disc herniation, cervical myelopathy, and whiplash injuries that radiate into arms and hands.',
        surgeries: [
            {
                ico: '🔬', name: 'ACDF', full: 'Anterior Cervical Discectomy & Fusion',
                desc: 'Front-of-neck approach removes the damaged disc; adjacent vertebrae fused with cage and plate. High fusion rates, fast relief of nerve compression.'
            },
            {
                ico: '💿', name: 'Cervical ADR', full: 'Artificial Disc Replacement',
                desc: 'Prosthetic implant replaces degenerated disc, preserving natural motion and reducing adjacent-level stress.'
            },
            {
                ico: '🩺', name: 'Laminoplasty', full: 'Cervical Canal Expansion',
                desc: 'Lamina hinged open to widen the spinal canal and relieve multi-level cord compression without fusion.'
            },
        ],
        cost: '₹3.5L – ₹8L', pct: 52, recovery: '6–12 weeks', success: '92%',
        risks: ['Nerve root injury', 'Dysphagia', 'Adjacent segment disease', 'Hardware failure', 'C5 palsy'],
        timeline: ['Day 1–3', 'Week 2', 'Month 2', 'Month 4'],
    },
    thoracic: {
        clr: '#3a8fff', rgb: '58,143,255',
        tag: 'T1–T12 · MID-BACK',
        title: 'Thoracic\nSpine',
        sub: 'Twelve vertebrae articulate with the rib cage for structural rigidity. Less mobile than other regions yet susceptible to kyphotic deformity, compression fractures, and rare disc herniations.',
        surgeries: [
            {
                ico: '🔩', name: 'Posterior Fusion', full: 'Thoracic Pedicle Screw Instrumentation',
                desc: 'Rods and pedicle screws span multiple levels to restore alignment. Indicated for fractures, scoliosis, and tumour resection.'
            },
            {
                ico: '🎥', name: 'VATS', full: 'Video-Assisted Thoracoscopic Surgery',
                desc: 'Minimally invasive anterior approach for thoracic disc herniations. Dramatically reduces muscle trauma vs. open thoracotomy.'
            },
            {
                ico: '📐', name: 'Osteotomy', full: 'Ponte / PSO Kyphosis Correction',
                desc: 'Vertebral bone reshaping corrects pathological kyphosis and restores global sagittal balance.'
            },
        ],
        cost: '₹4L – ₹10L', pct: 68, recovery: '10–20 weeks', success: '87%',
        risks: ['Spinal cord injury', 'Pneumonia', 'Rod breakage', 'Deep infection', 'Flatback syndrome'],
        timeline: ['Week 1–2', 'Month 2', 'Month 4', 'Month 8'],
    },
    lumbar: {
        clr: '#00d4aa', rgb: '0,212,170',
        tag: 'L1–L5 · LOWER BACK',
        title: 'Lumbar\nSpine',
        sub: 'Five vertebrae bear the greatest biomechanical load in the body. Disc herniation, spinal stenosis, and degenerative spondylolisthesis are the most common surgical indications in adults.',
        surgeries: [
            {
                ico: '💡', name: 'Microdiscectomy', full: 'Lumbar Micro-Discectomy',
                desc: 'Gold standard for sciatica. Microsurgical removal of herniated nucleus under magnification, preserving spinal stability with rapid recovery.'
            },
            {
                ico: '🔗', name: 'TLIF / PLIF', full: 'Transforaminal / Posterior Lumbar Interbody Fusion',
                desc: 'Interbody cage restores disc height; pedicle screws and rods provide rigid fixation. Treats instability, spondylolisthesis, and recurrent herniations.'
            },
            {
                ico: '🌀', name: 'Laminectomy', full: 'Decompressive Lumbar Laminectomy',
                desc: 'Removal of lamina decompresses the canal, relieving neurogenic claudication from stenosis.'
            },
        ],
        cost: '₹2.5L – ₹7L', pct: 44, recovery: '4–16 weeks', success: '94%',
        risks: ['Dural tear / CSF leak', 'Failed back syndrome', 'Adjacent segment disease', 'Pseudarthrosis', 'Nerve root damage'],
        timeline: ['Day 1', 'Week 3', 'Month 2', 'Month 5'],
    },
    sacral: {
        clr: '#c77dff', rgb: '199,125,255',
        tag: 'S1–S5 · PELVIS',
        title: 'Sacral &\nCoccyx',
        sub: 'The sacrum anchors the lumbar spine to the pelvic ring via the SI joints. Disorders here affect pelvic stability, bowel, bladder, and sexual function.',
        surgeries: [
            {
                ico: '🔐', name: 'SI Joint Fusion', full: 'Sacroiliac Joint Arthrodesis',
                desc: 'Triangular titanium implants placed percutaneously across the SI joint, eliminating painful micro-motion.'
            },
            {
                ico: '🛡️', name: 'Sacroplasty', full: 'Percutaneous Sacroplasty',
                desc: 'Bone cement injected under fluoroscopic guidance into sacral insufficiency fractures. Near-immediate pain relief.'
            },
            {
                ico: '🧩', name: 'Coccygectomy', full: 'Surgical Coccyx Excision',
                desc: 'Removal of the coccyx for intractable coccydynia unresponsive to ≥3 months of conservative management.'
            },
        ],
        cost: '₹1.5L – ₹5.5L', pct: 28, recovery: '6–14 weeks', success: '85%',
        risks: ['Wound healing delay', 'Sacral nerve injury', 'Cement leakage', 'Symptom recurrence', 'Pelvic instability'],
        timeline: ['Day 1–3', 'Week 2', 'Month 2', 'Month 4'],
    },
};

export const LEVEL_TO_REGION = {
    C1: 'cervical', C2: 'cervical', C3: 'cervical', C4: 'cervical', C5: 'cervical', C6: 'cervical', C7: 'cervical',
    T1: 'thoracic', T2: 'thoracic', T3: 'thoracic', T4: 'thoracic', T5: 'thoracic', T6: 'thoracic',
    T7: 'thoracic', T8: 'thoracic', T9: 'thoracic', T10: 'thoracic', T11: 'thoracic', T12: 'thoracic',
    L1: 'lumbar', L2: 'lumbar', L3: 'lumbar', L4: 'lumbar', L5: 'lumbar',
    S1: 'sacral', S2: 'sacral', S3: 'sacral', S4: 'sacral', S5: 'sacral',
};