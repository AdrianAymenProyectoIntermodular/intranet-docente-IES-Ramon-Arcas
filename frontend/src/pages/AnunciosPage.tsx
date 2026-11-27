import { Building2, Globe, GraduationCap, Megaphone, Pin, PinOff, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { useUser } from '../auth/auth-context'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/toast-context'
import { useApi } from '../hooks/useApi'
import { CURSOS, departamentosCon } from '../lib/centro'
import { formatFecha, formatRelativa, isoLocal, parseApiDate } from '../lib/format'
import { puede } from '../lib/permissions'
import { errorMessage } from '../services/api'
import { createAnuncio, fijarAnuncio, listAnuncios } from '../services/modulos'
import type { Anuncio } from '../services/types'

type Ambito = 'todos' | 'general' | 'departamento'

export function AnunciosPage() {
  const user = useUser()
  const toast = useToast()
  const location = useLocation()
  const { data, error, loading, reload, setData } = useApi(() => listAnuncios())
  const [ambito, setAmbito] = useState<Ambito>('todos')
  const [texto, setTexto] = useState('')
  const [curso, setCurso] = useState('')
  const [crear, setCrear] = useState(false)
  const puedePublicar = puede(user.roles, 'anuncios.publicar')
  const puedeFijar = puede(user.roles, 'anuncios.fijar')

  const anuncios = useMemo(() => data ?? [], [data])
  // Cursos con algún anuncio vigente: solo se ofrecen filtros que devuelven resultados.
  const cursosConAnuncios = useMemo(
    () => [...new Set(anuncios.map((a) => a.curso).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'es')),
    [anuncios],
  )
  const [ahora] = useState(() => Date.now())
  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return anuncios.filter((a) => {
      if (ambito === 'general' && a.departamento) return false
      if (ambito === 'departamento' && !a.departamento) return false
      if (curso && a.curso !== curso) return false
      if (!q) return true
      return `${a.titulo} ${a.cuerpo} ${a.departamento ?? ''} ${a.curso ?? ''}`.toLowerCase().includes(q)
    })
  }, [anuncios, ambito, curso, texto])

  const destacados = filtrados.filter((a) => a.fijado)
  const resto = filtrados.filter((a) => !a.fijado)

  // Enlace directo desde Inicio (#id): desplaza hasta el anuncio cuando ya está pintado.
  useEffect(() => {
    if (!location.hash || loading) return
    document.getElementById(`anuncio-${location.hash.slice(1)}`)?.scrollIntoView({ block: 'center' })
  }, [location.hash, loading])

  const toggleFijado = async (a: Anuncio) => {
    try {
      const updated = await fijarAnuncio(a.id, !a.fijado)
      setData((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)))
      toast.ok(updated.fijado ? 'Anuncio destacado' : 'Anuncio ya no está destacado')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const contar = (a: Ambito) =>
    a === 'todos' ? anuncios.length : anuncios.filter((x) => (a === 'general' ? !x.departamento : !!x.departamento)).length

  return (
    <>
      <PageHeader
        title="Tablón de anuncios"
        description={`Comunicados generales y de ${user.departamento || 'tu departamento'}. Los caducados desaparecen solos.`}
        actions={
          puedePublicar && (
            <Button variant="primary" icon={Plus} onClick={() => setCrear(true)}>
              Publicar anuncio
            </Button>
          )
        }
      />

      <div className="toolbar">
        <Tabs<Ambito>
          label="Ámbito de los anuncios"
          value={ambito}
          onChange={setAmbito}
          items={[
            { value: 'todos', label: 'Todos', count: contar('todos') },
            { value: 'general', label: 'Generales', count: contar('general') },
            { value: 'departamento', label: 'Departamento', count: contar('departamento') },
          ]}
        />
        {cursosConAnuncios.length > 0 && (
          <Select aria-label="Filtrar por curso" className="select-inline" value={curso} onChange={(e) => setCurso(e.target.value)}>
            <option value="">Todos los cursos</option>
            {cursosConAnuncios.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
        <label className="search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Buscar en el tablón</span>
          <input
            type="search"
            placeholder="Buscar en el tablón"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <Skeleton lines={6} height={22} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={anuncios.length === 0 ? 'Todavía no hay anuncios' : 'Ningún anuncio coincide'}
          action={
            anuncios.length > 0 ? (
              <Button
                onClick={() => {
                  setTexto('')
                  setAmbito('todos')
                  setCurso('')
                }}
              >
                Quitar filtros
              </Button>
            ) : undefined
          }
        >
          {anuncios.length === 0
            ? 'Cuando dirección o tu departamento publiquen algo, aparecerá aquí.'
            : 'Prueba con otro término o cambia el ámbito.'}
        </EmptyState>
      ) : (
        <div className="stack">
          {destacados.length > 0 && (
            <section aria-label="Destacados" className="anuncios-destacados">
              {destacados.map((a) => (
                <AnuncioCard
                  key={a.id}
                  anuncio={a}
                  autor={a.autor_id === user.id ? 'Tú' : (a.autor_nombre ?? null)}
                  puedeFijar={puedeFijar}
                  ahora={ahora}
                  onFijar={() => void toggleFijado(a)}
                  resaltado={location.hash === `#${a.id}`}
                />
              ))}
            </section>
          )}
          <section aria-label="Anuncios" className="anuncios-lista">
            {resto.map((a) => (
              <AnuncioCard
                key={a.id}
                anuncio={a}
                autor={a.autor_id === user.id ? 'Tú' : (a.autor_nombre ?? null)}
                puedeFijar={puedeFijar}
                ahora={ahora}
                onFijar={() => void toggleFijado(a)}
                resaltado={location.hash === `#${a.id}`}
              />
            ))}
          </section>
        </div>
      )}

      <CrearAnuncioModal
        open={crear}
        onClose={() => setCrear(false)}
        departamentoUsuario={user.departamento}
        onCreated={(a) => {
          setData((prev) => [a, ...(prev ?? [])])
          toast.ok('Anuncio publicado')
        }}
      />
    </>
  )
}

function AnuncioCard({
  anuncio: a,
  autor,
  puedeFijar,
  ahora,
  onFijar,
  resaltado,
}: {
  anuncio: Anuncio
  autor: string | null
  puedeFijar: boolean
  ahora: number
  onFijar: () => void
  resaltado: boolean
}) {
  const expira = parseApiDate(a.expira_en)
  const diasRestantes = expira ? Math.ceil((expira.getTime() - ahora) / 86_400_000) : null
  return (
    <article
      id={`anuncio-${a.id}`}
      className={[
        'anuncio',
        a.fijado && 'anuncio-fijado',
        a.departamento ? 'anuncio-dep' : 'anuncio-general',
        resaltado && 'is-highlight',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="anuncio-head">
        <span className="anuncio-ambito">
          {a.departamento ? <Building2 size={15} aria-hidden /> : <Globe size={15} aria-hidden />}
          {a.departamento ?? 'General'}
        </span>
        {a.curso && (
          <Badge tone="info">
            <GraduationCap size={12} aria-hidden /> {a.curso}
          </Badge>
        )}
        {a.fijado && (
          <Badge tone="sol">
            <Pin size={12} aria-hidden /> Destacado
          </Badge>
        )}
        {diasRestantes !== null && diasRestantes <= 7 && (
          <Badge tone="aviso">{diasRestantes <= 1 ? 'Caduca hoy' : `Caduca en ${diasRestantes} días`}</Badge>
        )}
        {puedeFijar && (
          <Button size="sm" variant="ghost" icon={a.fijado ? PinOff : Pin} onClick={onFijar} className="anuncio-fijar">
            {a.fijado ? 'Quitar destacado' : 'Destacar'}
          </Button>
        )}
      </header>
      <h2 className="anuncio-title">{a.titulo}</h2>
      <p className="anuncio-body">{a.cuerpo}</p>
      <footer className="anuncio-foot subtle">
        <span title={formatFecha(a.creado_en)}>Publicado {formatRelativa(a.creado_en)}</span>
        {autor && <span>por {autor}</span>}
        {expira && <span>Visible hasta el {formatFecha(a.expira_en)}</span>}
      </footer>
    </article>
  )
}

function CrearAnuncioModal({
  open,
  onClose,
  onCreated,
  departamentoUsuario,
}: {
  open: boolean
  onClose: () => void
  onCreated: (a: Anuncio) => void
  departamentoUsuario: string
}) {
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [cursoAnuncio, setCursoAnuncio] = useState('')
  const [caducidad, setCaducidad] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)

  const reset = () => {
    setTitulo('')
    setCuerpo('')
    setDepartamento('')
    setCursoAnuncio('')
    setCaducidad('')
    setErrores({})
    setErrorApi(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!titulo.trim()) errs.titulo = 'Escribe un título.'
    else if (titulo.trim().length > 140) errs.titulo = 'Máximo 140 caracteres.'
    if (!cuerpo.trim()) errs.cuerpo = 'Escribe el contenido del anuncio.'
    if (caducidad && caducidad < isoLocal()) errs.caducidad = 'La fecha de caducidad no puede ser pasada.'
    setErrores(errs)
    if (Object.keys(errs).length) return

    setEnviando(true)
    setErrorApi(null)
    try {
      const creado = await createAnuncio({
        titulo: titulo.trim(),
        cuerpo: cuerpo.trim(),
        departamento: departamento || null,
        curso: cursoAnuncio || null,
        // Visible hasta el final del día elegido (hora local).
        expira_en: caducidad ? new Date(`${caducidad}T23:59:59`).toISOString() : null,
      })
      onCreated(creado)
      reset()
      onClose()
    } catch (err) {
      setErrorApi(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publicar anuncio"
      description="Los anuncios generales los ve todo el claustro; los departamentales, solo ese departamento."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="form-anuncio" loading={enviando}>
            Publicar
          </Button>
        </>
      }
    >
      <form id="form-anuncio" className="form" onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Título" required error={errores.titulo}>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} autoFocus />
        </Field>
        <Field label="Contenido" required error={errores.cuerpo}>
          <Textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={5} />
        </Field>
        <div className="form-row">
          <Field label="Ámbito" hint="General o un departamento concreto">
            <Select value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
              <option value="">General (todo el claustro)</option>
              {departamentosCon(departamentoUsuario).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Curso" hint="Opcional. Para avisos de un curso concreto">
            <Select value={cursoAnuncio} onChange={(e) => setCursoAnuncio(e.target.value)}>
              <option value="">Todos los cursos</option>
              {CURSOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Caduca el" hint="Opcional. Después deja de mostrarse." error={errores.caducidad}>
            <Input type="date" min={isoLocal()} value={caducidad} onChange={(e) => setCaducidad(e.target.value)} />
          </Field>
        </div>
        {errorApi && (
          <p className="text-error" role="alert">
            {errorApi}
          </p>
        )}
      </form>
    </Modal>
  )
}
