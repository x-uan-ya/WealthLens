import { useEffect, useState } from 'react'
import { Save, RotateCcw, Check, Bell, PieChart } from 'lucide-react'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import {
  getPreferenceSchema,
  getPreferences,
  savePreferences,
  resetPreferences,
} from '../services/dataService.js'

const SECTION_ICON = { notifications: Bell, portfolio: PieChart }

export default function Settings() {
  const [schema, setSchema] = useState(null)
  const [values, setValues] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([getPreferenceSchema(), getPreferences()]).then(([s, v]) => {
      setSchema(s)
      setValues(v)
    })
  }, [])

  if (!schema || !values) return <Loading label="Loading preferences" />

  const setValue = (id, val) => {
    setValues((v) => ({ ...v, [id]: val }))
    setDirty(true)
    setSaved(false)
  }

  const onSave = () => {
    savePreferences(values).then((merged) => {
      setValues(merged)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    })
  }

  const onReset = () => {
    resetPreferences().then((defaults) => {
      setValues(defaults)
      setDirty(true)
      setSaved(false)
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Preferences"
        subtitle="Generic notification and portfolio display preferences. These are placeholders and carry no alert logic or investment rules; they will be replaced once official requirements are defined."
        actions={
          <>
            <button className="btn" onClick={onReset}>
              <RotateCcw size={15} /> Reset to defaults
            </button>
            <button className="btn btn-primary" onClick={onSave} disabled={!dirty}>
              {saved ? <Check size={15} /> : <Save size={15} />}
              {saved ? 'Saved' : 'Save changes'}
            </button>
          </>
        }
      />

      <div className="grid" style={{ gap: 20, maxWidth: 820 }}>
        {schema.map((section) => {
          const Icon = SECTION_ICON[section.id] || Bell
          return (
            <Card key={section.id}>
              <div className="card-head">
                <div className="row" style={{ gap: 10 }}>
                  <span className="summary-icon" style={{ width: 32, height: 32 }}>
                    <Icon size={15} />
                  </span>
                  <div>
                    <h3>{section.title}</h3>
                    {section.description && (
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                        {section.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card-pad" style={{ paddingTop: 6 }}>
                {section.controls.map((c) => (
                  <div className="setting-row" key={c.id}>
                    <div className="setting-copy">
                      <div className="setting-label">{c.label}</div>
                      {c.help && <div className="setting-help">{c.help}</div>}
                    </div>
                    <div className="setting-control">
                      <Control control={c} value={values[c.id]} onChange={(v) => setValue(c.id, v)} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Control({ control, value, onChange }) {
  switch (control.type) {
    case 'toggle':
      return (
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          className={`switch${value ? ' on' : ''}`}
          onClick={() => onChange(!value)}
        >
          <span className="switch-knob" />
        </button>
      )
    case 'select':
      return (
        <select className="setting-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {control.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    case 'radio':
      return (
        <div className="chip-group">
          {control.options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`chip${value === o.value ? ' active' : ''}`}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )
    default:
      return null
  }
}
