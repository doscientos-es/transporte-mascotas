import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Printer } from 'lucide-react'
import { PageIntro } from '../components/page-intro'
import { statusLabels } from '../lib/status-labels'
import type { DailyRoute } from '../lib/types'
import { boxGridSpan, boxSize, vanLanes } from '../lib/van'

export function VanPage({ route, assignments, onPrint }: { route: DailyRoute; assignments: Array<{ box: number; label: string }>; onPrint: () => void }) {
  const leftLanes = vanLanes.filter((lane) => lane.side === 'left')
  const rightLanes = vanLanes.filter((lane) => lane.side === 'right')
  const renderLane = (lane: typeof vanLanes[number]) => <div className={`van-lane ${lane.id}`} key={lane.id}>{lane.boxes.map((box) => { const assignment = assignments.find((entry) => entry.box === box); return <button type="button" style={{ gridRow: `span ${boxGridSpan[lane.size]}` }} title={assignment ? assignment.label : `Box ${box} libre`} key={box} className={`van-box box-${boxSize(box)} ${assignment ? 'is-occupied' : ''}`}><b>{box}</b>{assignment && <span>{assignment.label.replace('CARTA DE PORTE Nº ', '#')}</span>}</button> })}</div>
  return <><PageIntro text="Ocupación actual por tramo. Los boxes se liberan después de cada entrega."><Button onClick={onPrint}><Printer /> Imprimir tramo</Button></PageIntro><div className="van-legend"><span><i className="box-large" /> Grandes 1–4, 37–40</span><span><i className="box-medium" /> Medianos 5–12, 41–48</span><span><i className="box-small" /> Pequeños 13–36, 49–72</span></div><Card className="van-card"><CardContent><div className="van-title">F U R G Ó N</div><div className="van-plan"><div className="van-front">PARTE DELANTERA (CONDUCTORES)</div><div className="van-banks van-banks-left">{leftLanes.map(renderLane)}</div><div className="van-aisle">P A S I L L O</div><div className="van-banks van-banks-right">{rightLanes.map(renderLane)}</div></div></CardContent></Card><section className="assignments"><h3>Asignaciones activas</h3>{route.actions.filter((action) => action.box).map((action) => <div key={action.id}><span className={`box-chip box-${boxSize(action.box!)}`}>{action.box}</span><div><strong>{action.letterId}</strong><p>{action.type === 'recogida' ? 'Recogida' : 'Entrega'} · {action.stop}</p></div><span className={`status status-${action.status}`}>{statusLabels[action.status]}</span></div>)}</section></>
}