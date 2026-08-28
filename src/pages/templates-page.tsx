import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, MapPin, Plus } from 'lucide-react'
import { useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { NewTemplateDialog, StopFormDialog, type StopFormValues } from '../components/operation-dialogs'
import type { RouteTemplate } from '../lib/types'

export function TemplatesPage({ templates, selected, onSelect, onCreate, onAddStop }: { templates: RouteTemplate[]; selected: RouteTemplate; onSelect: (template: RouteTemplate) => void; onCreate: (name: string, color: string) => Promise<void>; onAddStop: (templateId: string, stop: StopFormValues) => Promise<void> }) {
  const [creating, setCreating] = useState(false)
  const [addingStop, setAddingStop] = useState(false)
  return <><PageIntro text="El orden de las paradas se conservará al crear una ruta diaria."><Button onClick={() => setCreating(true)}><Plus /> Nueva ruta</Button></PageIntro><div className="template-layout"><Card className="template-list"><CardContent><h3>Plantillas</h3>{templates.map((template) => <button type="button" key={template.id} onClick={() => onSelect(template)} className={`template-row ${selected.id === template.id ? 'is-selected' : ''}`}><span className="template-dot" style={{ background: template.color }} /><span><strong>{template.name}</strong><small>{template.stops.length} paradas</small></span><ChevronRight size={16} /></button>)}</CardContent></Card><Card className="stops-card"><CardContent><div className="template-header"><div><span className="eyebrow">Plantilla activa</span><h3>Ruta {selected.name}</h3></div><Button variant="outline" onClick={() => setAddingStop(true)}><Plus /> Añadir parada</Button></div><ol className="stops-list">{selected.stops.map((stop, index) => <li key={stop.id}><div className="stop-index">{index + 1}</div><div><strong>{stop.locality}</strong><p>{stop.place}</p></div><span className="duration">{stop.minutes ? `${stop.minutes} min` : 'Final'}</span><a href={stop.mapUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${stop.locality} en mapas`}><MapPin size={17} /></a></li>)}</ol></CardContent></Card></div>{creating && <NewTemplateDialog onClose={() => setCreating(false)} onCreate={onCreate} />}{addingStop && <StopFormDialog onClose={() => setAddingStop(false)} onAdd={async (stop) => { await onAddStop(selected.id, stop); setAddingStop(false) }} />}</>
}
