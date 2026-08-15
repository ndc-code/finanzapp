# Sugerencia de montos en Gastos posibles (regla 50/30/20)

> **Actualización post-implementación (2026-08-06):** tras usar la primera versión, el diseño se
> simplificó dos veces más en la misma sesión. El estado final, vigente en el código:
> - **Sin "Compartido"**: Gastos posibles ya no tiene pestaña Compartido ni en Gastos ni en
>   Ajustes — solo un tab por persona. `financeFor()` ya no suma `compartido`; `podes` es
>   directamente `ownBudgetTotal(person)`.
> - **Sin modal**: se borró `budgetRubroModal` y todo lo que lo alimentaba (`openBudgetRubroModal`,
>   `brWhoSeg`, etc.). Las filas en Gastos son de solo lectura (label + monto + ✕ si no está
>   bloqueado); agregar/editar rubros pasa a ser exclusivo de Ajustes.
> - **Botón movido**: "Sugerir montos" ya no está en Ajustes — vive en la card de Gastos posibles
>   de la pestaña Gastos (`#budgetSuggestBtn`, junto a `#budgetIdealHint`), y opera sobre
>   `currentBudgetTab` (el tab de persona seleccionado ahí), no sobre `currentBudgetTplPerson`.
> - **Fórmula simplificada**: ya no hay escalones. `dólares = min(20% del ingreso, afterVar)`;
>   `Salidas + Gustos` se reparten en partes iguales lo que queda de `afterVar` después de eso.
>   Ver `sugerirMontosBudget()` en el código para la versión exacta — es la fuente de verdad, no
>   la sección "3. Fórmula de sugerencia" más abajo, que describe una versión intermedia
>   descartada.
> - **"Compra dólares" se probó como no-rubro y se revirtió**: hubo una iteración corta
>   (`budget_cats_m2`) donde Compra dólares dejó de ser un rubro y pasaba a ser
>   `financeFor(person).ahorro`. Se volvió atrás: Compra dólares **es** un rubro de nuevo (como en
>   `budget_cats_m1`), y una migración más (`budget_cats_m3`) se lo vuelve a agregar a quien se lo
>   había perdido. `DEFAULT_BUDGET_CATS` queda en 3 entradas (Salidas, Gustos, Compra dólares).
> - **Bloque final de Ahorro (Gastos) eliminado**: la card "Ahorro de {mes}" que cerraba la
>   pestaña Gastos ya no existe. Su función la absorbe el footer "Saldos" del bloque de Gastos
>   posibles (`#budgetSaldos`, `renderBudgetSaldos()`): muestra el monto del rubro "Compra
>   dólares" de cada persona en pesos y convertido a USD (`saldoDolarCell()`, `usdRate()`),
>   tonalizado verde/rojo según el signo. La idea explícita: el monto de Compra dólares es lo que
>   se decide primero (a mano o con "Sugerir montos"), y lo que queda para Salidas/Gustos es
>   consecuencia de eso, no al revés.

## Contexto

Hoy los rubros de "Gastos posibles" (`budgetTemplates`) son 5 por defecto — Salidas, Regalos,
Compras Hogar, Deudas, Diaria — cargados 100% a mano en Ajustes, sin relación con el ingreso ni
con el saldo real del mes. Se pide que la app pueda sugerir montos siguiendo la teoría 50/30/20
(Necesidades 50%, Deseos 30%, Ahorro 20% del ingreso), reduciendo los rubros a solo 3: Salidas,
Gustos y Compra dólares (este último representa el 20% de ahorro de la teoría). Los montos
siguen siendo editables a mano como hoy — la sugerencia solo pre-completa.

## Alcance

- Aplica únicamente al bloque "Gastos posibles" (`budgetTemplates`), tanto en Ajustes (donde se
  cargan) como en la lectura read-only de Gastos (`renderBudgetTabs`/`budgetRubroRow`), que no
  cambian de comportamiento salvo por los rubros que ahora existen.
- No toca `financeFor()`, `netBalances()`, `settlements()` ni la cadena de plata: el cálculo de
  `podes`/`ahorro` sigue leyendo `budgetTemplates[person]` y `budgetTemplates.shared` igual que
  hoy, solo que ahora con 3 rubros en vez de 5.
- No aplica a la pestaña "Compartidos" de Gastos posibles: la sugerencia es por persona, porque
  se basa en el ingreso y el afterVar de esa persona. Compartidos se sigue cargando a mano.
- No es recurrente/automático: es un botón que el usuario toca cuando quiere, sobrescribe los 3
  montos en ese momento y quedan fijos como plantilla (igual que cualquier edición manual) hasta
  la próxima vez que lo toque o los edite a mano.

## 1. Rubros por defecto

`DEFAULT_BUDGET_CATS` pasa de 5 a 3 entradas:

```js
const DEFAULT_BUDGET_CATS = [
  { key:'salidas', label:'Salidas' },
  { key:'gustos',  label:'Gustos' },
  { key:'dolares', label:'Compra dólares' }
];
```

`defaultBudgetCats()` sigue igual (mapea este array a `{id, label, amount:0, locked:true}`), así
que espacios y personas **nuevas** (creadas después de este cambio) nacen con estos 3 rubros.

## 2. Migración de datos existentes

Se agrega un flag más al `migration_flags` jsonb existente: `budget_cats_m1`.

Al cargar un espacio con `migration_flags.budget_cats_m1` falso/ausente, para cada slot de
`budgetTemplates` (cada persona y `SHARED_PAY`):

1. Borra los rubros cuyo `label` sea exactamente `Regalos`, `Compras Hogar`, `Deudas` o
   `Diaria`.
2. Si ya existe un rubro `Salidas`, conserva su `amount` tal cual.
3. Si no existen `Gustos` o `Compra dólares`, los agrega con `amount:0`, `locked:true`.
4. Rubros con cualquier otro label (agregados a mano por el usuario) quedan intactos.

Corre una sola vez por espacio; después escribe `migration_flags.budget_cats_m1 = true` y
persiste con `saveBudgetTemplates()` + el guardado de `migration_flags` que ya existe para el
resto de las migraciones one-time.

## 3. Fórmula de sugerencia

Por persona, usando `financeFor(person, viewMonth)`:

```
ingreso      = fin.inc
afterVar     = fin.afterVar
idealDolares = 0.20 * ingreso
idealWants   = 0.30 * ingreso   // Salidas + Gustos combinados

si afterVar >= idealDolares + idealWants:
    dolares = idealDolares
    resto   = afterVar - dolares
    salidas = gustos = resto / 2

si no, pero afterVar >= idealWants:
    salidas = gustos = idealWants / 2
    dolares = afterVar - idealWants

si no (afterVar < idealWants, incluyendo afterVar <= 0):
    dolares = 0
    salidas = gustos = Math.max(0, afterVar) / 2
```

Los tres montos resultantes se redondean al peso (`Math.round`) antes de guardarse, igual que el
resto de los montos de la app.

## 4. Botón "Sugerir montos"

- Ubicación: Ajustes, en la sección de rubros de cada persona (`renderBudgetTemplates()`,
  tabla `#bTplTable`), junto al total de esa persona. No aparece cuando `currentBudgetTplPerson`
  es `SHARED_PAY` (pestaña Compartido).
- Al tocarlo, `sugerirMontosBudget(person)`:
  1. Busca en `budgetTemplates[person]` los tres rubros por `label` exacto (`Salidas`,
     `Gustos`, `Compra dólares`).
  2. Si falta alguno de los tres, no calcula nada y muestra
     `notyf.error('Necesitás los rubros Salidas, Gustos y Compra dólares para sugerir montos.')`.
  3. Si `ingreso <= 0`, muestra `notyf.error('Cargá el ingreso de este mes para poder sugerir montos.')`
     y no hace nada.
  4. Si están los tres y hay ingreso, aplica la fórmula del punto 3 y sobrescribe el `amount` de
     esos tres rubros (rubros custom extra que la persona haya agregado no se tocan).
  5. Persiste con `saveBudgetTemplates()` (fire-and-forget, try/catch) y llama a `render()` /
     al refresco de Ajustes correspondiente.
  6. Si `afterVar <= 0` el resultado natural ya es 0/0/0 por la fórmula (tercer escalón); se
     muestra igual un `notyf` informativo tipo `'Sin saldo disponible este mes: los 3 rubros quedaron en $0.'`.

## 5. Referencia ideal (informativa)

Debajo de la lista de rubros de esa persona en Ajustes, un texto chico no editable:

```
Ideal (20/30 de la teoría): Compra dólares $<idealDolares> · Salidas + Gustos $<idealWants>
```

Calculado con `financeFor(person).inc` cada vez que se renderiza esa sección. Puramente
informativo — no se persiste, no afecta ningún cálculo.

## Fuera de alcance

- No hay recálculo automático mensual ni al cambiar de mes: el usuario vuelve a tocar el botón
  si quiere refrescar los montos con el afterVar del mes que está viendo.
- No se toca la pestaña Compartidos de Gastos posibles.
- No cambia `renderRule5030()` (la barra "Necesidades/Deseos/Ahorro" de la pestaña Ahorro, que
  ya compara contra 50/30/20 pero usando ingreso como base para todo, no afterVar) — son dos
  features relacionadas pero independientes, esta no reemplaza a esa.
- No agrega currency/USD real a "Compra dólares": el monto sigue siendo un número en ARS como
  cualquier otro rubro, sin conversión de FX.
