import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { REGION_DATA } from '../data/regionData'
import { ArrowLeft, Clock, Activity, CreditCard, AlertTriangle, Stethoscope, Gauge } from 'lucide-react'

const RegionDetail = ({ region, onBack }) => {
  const d = REGION_DATA[region]
  if (!d) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 glass p-6 md:p-12 overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto">
        {/* Navigation - Top Left Fixed for Quick Return */}
        <motion.button
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={onBack}
          className="flex items-center gap-3 text-text3 hover:text-white transition-all mb-16 group pointer-events-auto"
        >
          <div className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center group-hover:border-accent/50 group-hover:bg-accent/10 transition-all">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </div>
          <span className="font-mono text-xs tracking-widest uppercase font-semibold">Return to Overview</span>
        </motion.button>

        {/* Content Layout - Adjusted for Docking Model */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 md:pl-[380px] lg:pl-[380px] xl:pl-[380px] pointer-events-none">
          {/* Main Info */}
          <div className="lg:col-span-12 pointer-events-auto">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4 mb-4"
            >
              <div className="w-4 h-1 bg-accent/40 rounded-full" />
              <span className="font-mono text-[10px] tracking-[0.4em] text-text3 uppercase font-bold">{d.tag}</span>
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="font-serif text-7xl md:text-9xl mb-8 leading-[0.9]"
            >
              <span className="block text-white/10 text-4xl mb-4 font-sans font-bold tracking-tighter italic">Phase Detail</span>
              {d.name.split(' ')[0]}<br />
              <span className="italic" style={{ color: d.colorHex }}>{d.name.split(' ')[1]}</span>
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-2xl md:text-3xl text-text2 max-w-4xl leading-tight font-light tracking-tight"
            >
              {d.subtitle}
            </motion.p>
          </div>

          {/* Detailed Lists */}
          <div className="lg:col-span-8 space-y-12 pointer-events-auto">
            <div className="space-y-4">
              <h2 className="font-mono text-[10px] tracking-[0.4em] text-text3 mb-4 uppercase flex items-center gap-2">
                <Stethoscope className="w-3 h-3" /> Standard Procedures
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {d.surgeries.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="stat-card group hover:bg-[rgba(255,255,255,0.03)] flex gap-8 p-10 relative overflow-hidden"
                  >
                     <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-8xl pointer-events-none group-hover:scale-110 transition-transform">
                        {s.icon}
                     </div>
                     <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl flex-shrink-0 bg-black/30 group-hover:bg-accent/10 transition-all border border-white/5">
                        {s.icon}
                     </div>
                     <div className="flex-1">
                       <h3 className="text-2xl font-bold mb-3 tracking-tight">
                          {s.name}
                          <span className="ml-3 text-[10px] font-mono font-normal opacity-30 uppercase tracking-[0.2em] block mt-1">/ {s.full}</span>
                       </h3>
                       <p className="text-text2 text-lg leading-relaxed max-w-2xl">{s.desc}</p>
                     </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics Column */}
          <div className="lg:col-span-4 space-y-6 pointer-events-auto">
            <div className="grid grid-cols-1 gap-6">
              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="stat-card bg-gradient-to-br from-white/[0.03] to-transparent"
              >
                <div className="flex items-center gap-3 mb-6 text-text3 font-mono text-[10px] tracking-[0.4em] uppercase">
                  <CreditCard className="w-3 h-3 text-accent" /> Estimated Costs
                </div>
                <div className="text-5xl font-serif mb-4 tracking-tighter" style={{ color: d.colorHex }}>{d.costRange}</div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${d.costPct}%` }}
                    transition={{ delay: 1.2, duration: 1.5 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${d.colorHex}55, ${d.colorHex})` }}
                  />
                </div>
                <p className="text-[11px] text-text3 mt-6 leading-relaxed">Financial estimates based on premium facility averages including surgeon fees and hardware.</p>
              </motion.div>

              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="stat-card"
              >
                <div className="flex items-center gap-3 mb-6 text-text3 font-mono text-[10px] tracking-[0.4em] uppercase">
                  <Gauge className="w-3 h-3 text-accent" /> Outcome Analytics
                </div>
                <div className="flex items-end gap-2">
                  <div className="text-6xl font-serif leading-none" style={{ color: d.colorHex }}>{d.successRate}</div>
                  <span className="text-xs font-mono text-text3 uppercase mb-1 tracking-widest">Success</span>
                </div>
                <div className="mt-8 flex gap-1 h-8 items-end">
                   {[...Array(10)].map((_, i) => (
                     <motion.div 
                        key={i} 
                        initial={{ height: 0 }} 
                        animate={{ height: `${20 + Math.random() * 80}%` }}
                        transition={{ delay: 1.5 + i * 0.05 }}
                        className="flex-1 bg-white/[0.05] rounded-t-sm" 
                        style={{ backgroundColor: i < 9 ? `${d.colorHex}22` : `${d.colorHex}88` }}
                     />
                   ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="stat-card"
              >
                <div className="flex items-center gap-3 mb-6 text-text3 font-mono text-[10px] tracking-[0.4em] uppercase">
                  <Clock className="w-3 h-3 text-accent" /> Recovery Path
                </div>
                <div className="text-3xl font-bold mb-6 tracking-tight">{d.recoveryWeeks} <span className="text-text3 text-sm font-normal">Weeks Avg</span></div>
                <div className="space-y-4">
                  {d.timeline.map((t, i) => (
                    <div key={i} className="flex items-center gap-4">
                       <span className="w-16 text-[10px] font-mono text-text3 uppercase tracking-tighter">{t}</span>
                       <div className="flex-1 h-px bg-white/5 relative">
                          <motion.div 
                            initial={{ scale: 0 }} 
                            animate={{ scale: 1 }}
                            transition={{ delay: 2 + i *0.2 }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/20" 
                            style={{ backgroundColor: d.colorHex, opacity: 1 - i * 0.2 }}
                          />
                       </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="stat-card border-accent3/10"
              >
                <div className="flex items-center gap-3 mb-4 text-text3 font-mono text-[10px] tracking-[0.4em] uppercase">
                  <AlertTriangle className="w-3 h-3" /> Risk Profile
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.risks.map((r, i) => (
                    <span key={i} className="text-[10px] font-mono px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-text2 uppercase tracking-tighter">
                       {r}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 0.3 }}
           transition={{ delay: 2.5 }}
           className="mt-[200px] pb-12 border-t border-white/5 text-center"
        >
          <p className="text-[10px] text-text3 leading-relaxed font-mono pt-8 tracking-widest uppercase">
            Medical Disclaimer: Visualization purpose only. Refer to clinical records for diagnostics.
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default RegionDetail
