'use client'

import { FunnelContainer } from '@/components/funnel/FunnelContainer'

export default function CheckPage() {
  return (
    <main className="min-h-screen bg-[#0f172a]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-xs font-mono text-amber-400 mb-2">// WONING DIAGNOSE SYSTEEM v2.1</p>
          <h1 className="text-2xl font-bold text-slate-100">Energiepotentieel Analyse</h1>
          <p className="text-slate-400 text-sm mt-1">6 stappen naar uw persoonlijk energiedossier</p>
        </div>
        <FunnelContainer />
      </div>
    </main>
  )
}
