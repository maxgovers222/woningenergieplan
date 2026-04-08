'use client'

import { useReducer } from 'react'
import type { FunnelState, FunnelAction, HealthScoreResult, ROIResult, MeterkastAnalyse, PlaatsingsAnalyse, OmvormerAnalyse } from './types'
import { FunnelProgress } from './FunnelProgress'
import { Step1Adres } from './Step1Adres'
import { Step2ROI } from './Step2ROI'
import { Step3Meterkast } from './Step3Meterkast'
import { Step4Plaatsing } from './Step4Plaatsing'
import { Step5Omvormer } from './Step5Omvormer'
import { Step6LeadCapture } from './Step6LeadCapture'

function funnelReducer(state: FunnelState, action: FunnelAction): FunnelState {
  switch (action.type) {
    case 'SET_STEP': return { ...state, step: action.step, error: null }
    case 'SET_BAG_DATA': return { ...state, bagData: action.bagData }
    case 'SET_NETCONGESTIE': return { ...state, netcongestie: action.netcongestie }
    case 'SET_HEALTH_SCORE': return { ...state, healthScore: action.healthScore }
    case 'SET_ROI': return { ...state, roiResult: action.roiResult }
    case 'SET_METERKAST': return { ...state, meterkastAnalyse: action.meterkastAnalyse }
    case 'SET_PLAATSING': return { ...state, plaatsingsAnalyse: action.plaatsingsAnalyse }
    case 'SET_OMVORMER': return { ...state, omvormerAnalyse: action.omvormerAnalyse }
    case 'SET_LEAD_ID': return { ...state, leadId: action.leadId }
    case 'SET_ADRES': return { ...state, adres: action.adres }
    case 'SET_LOADING': return { ...state, loading: action.loading }
    case 'SET_ERROR': return { ...state, error: action.error }
    default: return state
  }
}

const initialState: FunnelState = {
  step: 1,
  adres: '',
  bagData: null,
  netcongestie: null,
  healthScore: null,
  roiResult: null,
  meterkastAnalyse: null,
  plaatsingsAnalyse: null,
  omvormerAnalyse: null,
  leadId: null,
  loading: false,
  error: null,
}

export function useFunnelState() {
  return useReducer(funnelReducer, initialState)
}

export function FunnelContainer() {
  const [state, dispatch] = useReducer(funnelReducer, initialState)

  return (
    <div className="space-y-6">
      <FunnelProgress currentStep={state.step} />
      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        {state.step === 1 && <Step1Adres state={state} dispatch={dispatch} />}
        {state.step === 2 && <Step2ROI state={state} dispatch={dispatch} />}
        {state.step === 3 && <Step3Meterkast state={state} dispatch={dispatch} />}
        {state.step === 4 && <Step4Plaatsing state={state} dispatch={dispatch} />}
        {state.step === 5 && <Step5Omvormer state={state} dispatch={dispatch} />}
        {state.step === 6 && <Step6LeadCapture state={state} dispatch={dispatch} />}
      </div>
    </div>
  )
}
