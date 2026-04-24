import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SpineModel from './components/SpineModel'
import RegionDetail from './components/RegionDetail'
import { REGION_DATA } from './data/regionData'
import { ChevronRight, Layout, Info, Activity, Database } from 'lucide-react'

function App() {
  const [selectedRegion, setSelectedRegion] = useState(null)

  const regionKeys = Object.keys(REGION_DATA)

  return (
    <div className="relative w-full h-full text-white selection:bg-accent/30 overflow-hidden">
      
      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 w-full z-40 px-8 py-6 flex justify-between items-center pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto cursor-pointer" onClick={() => setSelectedRegion(null)}>
           <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent/20 border border-accent/30">
              <Database className="w-6 h-6 text-accent" />
           </div>
           <div>
             <h1 className="text-xl font-bold tracking-tighter uppercase font-sans">Spine<span className="text-accent">Viz</span></h1>
             <p className="text-[10px] font-mono text-text3 tracking-[0.3em] uppercase">Interactive 3D Engine</p>
           </div>
        </div>

        <div className="hidden md:flex items-center gap-2 pointer-events-auto">
          <div className="px-5 py-2 glass rounded-full flex items-center gap-3 text-xs font-mono tracking-widest text-text2 border-white/5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Live Visualization v1.0.8
          </div>
        </div>
      </header>

      {/* ─── BACKGROUND TEXT ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!selectedRegion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center font-serif pointer-events-none select-none text-[30vw] tracking-tighter"
          >
            SPINE
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LEFT NAVIGATION (Minimal) ──────────────────────────────────────── */}
      <AnimatePresence>
        {!selectedRegion && (
          <motion.aside
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="fixed left-8 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-4"
          >
            <div className="mb-6">
               <h2 className="text-[10px] font-mono text-text3 tracking-[0.4em] uppercase mb-1">Navigation</h2>
               <div className="w-8 h-px bg-accent/30" />
            </div>
            
            {regionKeys.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedRegion(key)}
                className="group flex items-center gap-4 text-left outline-none"
              >
                <div 
                  className="w-12 h-12 rounded-2xl glass flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-accent/40"
                  style={{ '--accent-color': REGION_DATA[key].colorHex }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REGION_DATA[key].colorHex }} />
                </div>
                <div className="hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0">
                  <span className="text-xs font-mono font-medium tracking-widest uppercase">{key}</span>
                </div>
              </button>
            ))}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── 3D CANVAS LAYER ────────────────────────────────────────────────── */}
      <main className="w-full h-full relative z-10 transition-all duration-1000">
        <SpineModel 
          selectedRegion={selectedRegion} 
          onSelect={setSelectedRegion} 
        />
      </main>

      {/* ─── FULL PAGE DETAIL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedRegion && (
          <RegionDetail 
            region={selectedRegion} 
            onBack={() => setSelectedRegion(null)} 
          />
        )}
      </AnimatePresence>

      {/* ─── CONTROLS HINT ──────────────────────────────────────────────────── */}
      {!selectedRegion && (
        <footer className="fixed bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none z-30">
          <div className="flex gap-8">
             <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono text-text3 tracking-[0.3em] uppercase">Controls</span>
                <div className="flex gap-6 text-[11px] font-medium text-text2">
                   <div className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[9px] uppercase">L</span> Drag to rotate</div>
                   <div className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-white/20 flex items-center justify-center text-[9px] uppercase">S</span> Scroll to zoom</div>
                </div>
             </div>
          </div>
          
          <div className="text-right flex flex-col gap-1">
             <span className="text-[10px] font-mono text-accent tracking-[0.3em] uppercase underline decoration-accent/20 cursor-help pointer-events-auto">Medical disclaimer</span>
             <span className="text-[9px] font-mono text-text3/50 tracking-widest uppercase">© 2024 SpineViz Visual Systems</span>
          </div>
        </footer>
      )}

    </div>
  )
}

export default App
