# La Espiga de Oro

Experiencia web para el taller de **Ingeniería de Requerimientos**: los equipos se inscriben escaneando un QR, pasan por Marta (la dueña), el arquitecto y el gestor, ajustan la perilla de disponibilidad, preparan su defensa de 2 minutos y al final compañeros y profes votan al mejor equipo.

Las tareas escritas (las 5 necesidades, RF/RNF, historia de usuario y criterio de aceptación) se hacen **en papel**; la web reemplaza a los personajes.

## Páginas

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Equipos | Qué es La Espiga de Oro, inscripción y recorrido Marta → Arquitecto → Gestor → perilla y defensa → final |
| `/votar` | Compañeros y profes | Lista de equipos, un solo voto por celular |
| `/resultados` | Proyector (la docente) | QR de inscripción, QR de votación, conteo en vivo y ganador. Botón **Administrar** (PIN) para cambiar de fase |

## Fases de la clase

1. **Inscripción** (por defecto): los equipos se anotan.
2. **Votación**: se cierra la inscripción y se habilita `/votar`. Los resultados quedan ocultos.
3. **Cerrada**: se muestra el ganador y el ranking.

Se cambian desde `/resultados` → **Administrar** → ingresar el PIN.

## Publicar en Vercel (cuenta nueva)

1. En Vercel: **Add New → Project → Import Git Repository** y elegir este repo. No hace falta tocar el build.
2. En el proyecto: **Storage → Create → Blob**. Elegir acceso **Public** y conectarlo al proyecto (agrega solo `BLOB_READ_WRITE_TOKEN`).
3. **Settings → Environment Variables**: crear `ADMIN_PIN` con el PIN que quieras.
4. **Deployments → Redeploy** para que tome las variables.
5. Abrir `/resultados`: los QR ya apuntan al dominio real.

> Si falta el Blob, la web muestra "Falta conectar el almacenamiento Blob…".

## Correr en tu compu

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # prueba la API de punta a punta
```

En local los datos van a `.data/` y el PIN de prueba es `1234`.

## Antes de la clase

- [ ] Probar con 2 celulares: inscribir un equipo, abrir votación, votar, cerrar.
- [ ] Tocar **Reiniciar todo** en el panel para dejar todo en cero.
- [ ] Tener `/resultados` abierto en el proyector a pantalla completa.
- [ ] Tener el PIN a mano.

## Cosas a saber

- El "un voto por celular" se guarda en el navegador: con otro navegador o modo incógnito se podría votar de nuevo. Alcanza para una clase, no para una votación formal.
- No se guardan datos personales: solo nombres de equipo y votos.
- Vercel Blob se usa como base mínima (archivos vacíos con los datos en el nombre). Máximo 40 equipos y 1000 votos.

## Estructura

```
public/        páginas estáticas (alumnos, votar, resultados, assets)
api/           funciones serverless (estado, equipos, votar, admin)
lib/           almacenamiento (Blob o carpeta local) y reglas
dev-server.js  servidor local
scripts/       prueba de la API
```
