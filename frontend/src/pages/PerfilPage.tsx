import { Download, LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { PageHeader } from '../components/layout/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { ErrorState, Skeleton } from '../components/ui/Feedback'
import { Field, Input } from '../components/ui/Field'
import { Panel } from '../components/ui/Panel'
import { useToast } from '../components/ui/toast-context'
import { useApi } from '../hooks/useApi'
import { ROL_DESCRIPCION, ROL_LABEL } from '../lib/permissions'
import { errorMessage } from '../services/api'
import { exportarMisDatos, fetchMiPerfil, patchMiPerfil } from '../services/usuarios'
import type { UsuarioPublic } from '../services/types'

export function PerfilPage() {
  const { refresh, logout } = useAuth()
  const location = useLocation()
  const perfil = useApi(fetchMiPerfil)

  useEffect(() => {
    if (location.hash === '#privacidad' && !perfil.loading) {
      document.getElementById('privacidad')?.scrollIntoView({ block: 'start' })
    }
  }, [location.hash, perfil.loading])

  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Tus datos en la intranet. Se usan para rellenar los documentos que generes (ausencias, comisiones)."
        actions={
          <Button variant="ghost" icon={LogOut} onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        }
      />
      {perfil.loading ? (
        <Skeleton lines={6} height={24} />
      ) : perfil.error || !perfil.data ? (
        <ErrorState message={perfil.error ?? 'Sin datos'} onRetry={() => void perfil.reload()} />
      ) : (
        <div className="grid-perfil">
          <DatosForm
            usuario={perfil.data}
            onSaved={(u) => {
              perfil.setData(u)
              void refresh()
            }}
          />
          <Panel title="Roles y competencias" description={perfil.data.departamento || 'Sin departamento asignado'}>
            <div className="perfil-id">
              <Avatar name={perfil.data.name} size={52} />
              <div>
                <p className="perfil-nombre">{perfil.data.name}</p>
                <p className="subtle">{perfil.data.email}</p>
              </div>
            </div>
            <ul className="roles-lista">
              {perfil.data.roles.map((r) => (
                <li key={r}>
                  <strong>{ROL_LABEL[r] ?? r}</strong>
                  <span className="subtle">{ROL_DESCRIPCION[r]}</span>
                </li>
              ))}
            </ul>
            <p className="subtle">Los roles los asigna la administración del centro.</p>
          </Panel>
          <Privacidad />
        </div>
      )}
    </>
  )
}

function DatosForm({ usuario, onSaved }: { usuario: UsuarioPublic; onSaved: (u: UsuarioPublic) => void }) {
  const toast = useToast()
  const [name, setName] = useState(usuario.name)
  const [dni, setDni] = useState(usuario.dni ?? '')
  const [telefono, setTelefono] = useState(usuario.telefono ?? '')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  const cambios =
    name.trim() !== usuario.name || dni.trim() !== (usuario.dni ?? '') || telefono.trim() !== (usuario.telefono ?? '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es obligatorio.'
    if (dni.trim() && !/^[0-9XYZxyz][0-9]{7}[A-Za-z]$/.test(dni.trim())) errs.dni = 'Formato de DNI/NIE no válido (p. ej. 12345678Z).'
    if (telefono.trim() && !/^\+?[0-9 ]{9,15}$/.test(telefono.trim())) errs.telefono = 'Introduce un teléfono válido.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    try {
      const u = await patchMiPerfil({
        name: name.trim(),
        dni: dni.trim() ? dni.trim().toUpperCase() : null,
        telefono: telefono.trim() || null,
      })
      onSaved(u)
      toast.ok('Datos guardados')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Panel title="Datos personales" description="Puedes rectificarlos en cualquier momento.">
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Nombre completo" required error={errores.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" hint="Es tu cuenta de acceso; no se puede cambiar aquí.">
          <Input value={usuario.email} readOnly disabled />
        </Field>
        <div className="form-row">
          <Field label="DNI / NIE" error={errores.dni}>
            <Input value={dni} onChange={(e) => setDni(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Teléfono" error={errores.telefono}>
            <Input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
          </Field>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={enviando} disabled={!cambios}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function Privacidad() {
  const toast = useToast()
  const [descargando, setDescargando] = useState(false)

  const exportar = async () => {
    setDescargando(true)
    try {
      const datos = await exportarMisDatos()
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mis-datos-intranet-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.ok('Datos exportados')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Panel id="privacidad" title="Privacidad y datos" className="perfil-privacidad">
      <div className="stack">
        <div className="row privacidad-head">
          <ShieldCheck size={20} aria-hidden className="privacidad-icon" />
          <p className="grow">
            Tienes derecho a acceder a tus datos y a rectificarlos. La exportación incluye tu perfil, tus solicitudes y
            tus ausencias en formato JSON.
          </p>
        </div>
        <ul className="privacidad-lista subtle">
          <li>Las acciones sensibles (altas, cambios de roles, consultas de datos de alumnado) quedan registradas en auditoría.</li>
          <li>Tu sesión se guarda en una cookie segura; no se almacena tu contraseña de Google.</li>
        </ul>
        <div>
          <Button icon={Download} onClick={() => void exportar()} loading={descargando}>
            Descargar mis datos
          </Button>
        </div>
      </div>
    </Panel>
  )
}
