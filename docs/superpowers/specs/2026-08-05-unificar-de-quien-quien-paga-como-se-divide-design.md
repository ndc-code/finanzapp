# Unificar "¿De quién es? / ¿Quién lo paga? / ¿Cómo se divide?" en los 3 modals

## Contexto

Hoy los 3 modals de carga (gastos fijos, gastos variables, gastos posibles) resuelven
"propiedad" (a qué persona/pestaña pertenece un gasto) y "quién puso la plata" de formas
distintas e inconsistentes entre sí:

- **Fijos**: `paidBySeg` (label "¿Quién lo paga?": Compartido/Persona1/Persona2) fija
  literalmente `paidBy`. La propiedad real (a qué pestaña pertenece) sale de `splitToggle`
  ("¿Cómo se divide?": Partes iguales/Según ingresos/Todo a Persona1/Todo a Persona2, siempre
  visible), vía `expenseOwner()` que lee `shares`. Es decir: ya separa "quién paga" de "de quién
  es", pero mezclado en dos campos sin relación visual clara, y "Compartido" es una opción válida
  de "quién paga" (pago simultáneo, sin deuda).
- **Variables**: `vxPaidBySeg` (label "¿De quién es?": Compartido/Persona1/Persona2) fija
  `paidBy` DIRECTAMENTE — no hay forma de decir "es compartido pero lo pagué yo". Si es
  Compartido, `paidBy` queda literalmente `'shared'`, sin deuda posible.
- **Posibles**: mismo patrón que variables (`brWhoSeg`), pero un rubro nunca tuvo ni siquiera el
  concepto de `paidBy` — es una plantilla recurrente sin fecha.

Esto se unifica en la misma estructura de 3 preguntas en los 3 modals, con la lógica que
corresponde:

1. **¿De quién es?** → Compartido / Nicolás / Valentina. Define la propiedad (`shares`): a qué
   pestaña pertenece el gasto/rubro.
   - Si es de una persona: implícito `shares = soloShares(esa persona)` y `paidBy = esa persona`.
     Los otros dos campos no se muestran.
   - Si es Compartido: se muestran los siguientes dos campos.
2. **¿Quién lo paga?** (solo si Compartido) → Nicolás / Valentina. Ya no existe "Compartido"
   como opción acá — siempre lo pone alguien específico. Define `paidBy`.
3. **¿Cómo se divide?** (solo si Compartido) → Partes iguales / Según ingresos. Define `shares`.
   Se elimina la opción "Todo a Persona X" del selector de reparto: ese caso ahora se cubre
   eligiendo esa persona directamente en "¿De quién es?".

## Alcance

- Aplica a los 3 modals: gasto fijo (`addForm`), gasto variable (`varExpenseForm`), gasto posible
  (`budgetRubroForm`).
- **Gastos variables empiezan a generar deuda real**: hoy `netBalances()` (la función detrás de
  "quién le debe a quién" en Resumen) solo procesa `expenses` (fijos). Pasa a procesar también
  `varExpenses`, con la misma lógica que ya usa para fijos. Un gasto variable compartido con un
  pagador específico y reparto no parejo va a generar una deuda visible que hoy no existe.
- **Gastos posibles NO generan deuda**: un rubro es una plantilla recurrente sin fecha, no una
  transacción puntual — no hay nada que sumar a `netBalances()` (que sólo tiene sentido "sobre
  todos los meses" para eventos con fecha). El campo "¿Quién lo paga?" en posibles queda
  guardado (`c.payer`) y se muestra en la card, pero es puramente informativo.
- Los datos existentes con `paidBy: 'shared'` (pago simultáneo, sin deuda) siguen funcionando
  exactamente igual que hoy — sin tag, sin deuda — simplemente ese valor deja de poder elegirse
  desde la UI para gastos nuevos o editados. No hace falta migrar `expenses` existentes.
- Los gastos variables personales (no compartidos) ya guardaban `shares: null`; pasan a guardar
  `shares: soloShares(dueño)` (igual que los fijos) para que `expenseOwner()` los ubique bien.
  Los que ya están guardados con `shares: null` se migran on-read (ver más abajo) — sin esto, el
  cambio de la pestaña de variables (ver siguiente punto) los mostraría mal.
- La pestaña Compartidos/Persona de gastos variables pasa de decidirse por `paidBy` crudo a
  decidirse por `expenseOwner()` (igual criterio que ya usan los fijos), para que un gasto
  compartido con pagador específico siga cayendo en "Compartidos" y no en la pestaña de quien lo
  pagó.

## Modelo de datos

**Gastos fijos** (`expenses[]`): sin cambios de forma — sigue siendo `{shares, splitType,
paidBy, ...}`. Cambia únicamente qué combinaciones puede producir la UI: `splitType` ahora solo
vale `'equal' | 'income' | undefined` (nunca más `'only:X'` para entradas nuevas/editadas;
entradas viejas con `'only:X'` quedan como metadata inerte, ya no se lee para nada — la
propiedad siempre se deriva de `shares` vía `expenseOwner()`).

**Gastos variables** (`varExpenses[]`): mismo shape, con dos cambios:
- `shares` para una entrada personal pasa a ser `soloShares(dueño)` en vez de `null`.
- Migración on-read (`normalizeVarExpenses()`, mismo patrón que `normalizeExpenses()`, llamada
  desde los mismos 3 lugares: `loadAll()`, `applyCoupleRow()`, `paintFromLocalCache()`): a toda
  entrada sin `shares` cuyo `paidBy` sea una persona (no compartido) se le asigna
  `soloShares(paidBy)`.

**Gastos posibles** (`budgetTemplates[who][]`): nuevo campo `payer` (id de persona), presente
solo en rubros del balde `shared`. No participa de ningún cálculo — sólo se lee para mostrar
"paga <Nombre>" en la card.

## UI — estructura común

Cada modal pasa a tener, en este orden: **¿De quién es?** (arriba, donde ya estaba el selector
existente) → **¿Quién lo paga?** (nuevo bloque, oculto salvo Compartido) → **¿Cómo se divide?**
(bloque existente, oculto salvo Compartido, reducido a 2 opciones).

### Gastos fijos
- El `#paidBySeg` existente (label "¿Quién lo paga?") se convierte en `#ownerSeg` (label
  "¿De quién es?"): mismas opciones (Compartido + cada persona), mismo lugar en el form.
- Nuevo `#payerField`/`#paidBySeg` (label "¿Quién lo paga?", solo personas, sin "Compartido"),
  oculto salvo Compartido — reutiliza el id `paidBySeg` para el nuevo campo de pagador real, ya
  que el rol de "elige quién paga" se muda ahí.
- `#splitField`/`#splitToggle` (label "¿Cómo se divide?") pasa a estar oculto salvo Compartido,
  y sus opciones bajan de 4 a 2 (se sacan los "Todo a Persona X").
- Nuevo estado `currentOwner` (reemplaza el rol de propiedad que hoy cumple `currentPaidBy` +
  `currentSplit` combinados). `currentPaidBy` pasa a significar únicamente "quién paga",
  editable sólo cuando `currentOwner` es Compartido. `currentSplit` sigue significando "cómo se
  divide", con el mismo alcance reducido.
- Se eliminan `isSplitAvailable()` y `splitForOwner()` (quedan sin ningún llamador tras el
  cambio) y los efectos cruzados que hoy tiene el click de `paidBySeg`/`splitToggle` (auto-pasar
  a "todo a X" o auto-volver a "partes iguales"), que dejan de tener sentido sin la opción "todo
  a X" en el selector de reparto.
- El chip de gasto fijo recurrente (`f.owner` en Ajustes) pasa a llamar `setOwner(...)` en vez de
  `setSplit(splitForOwner(...))` + `setPaidBy(...)`.

### Gastos variables
- `#vxPaidBySeg` (label "¿De quién es?") no cambia de rol ni de opciones — ya representaba
  correctamente la propiedad.
- Nuevo `#vxPayerField`/`#vxPayerSeg` (label "¿Quién lo paga?", solo personas), oculto salvo
  Compartido, insertado antes de `#vxSplitField` (que ya existe de la sesión anterior).
- Nuevo estado `currentVxPayer`.
- Al enviar: `paidBy: isSharedPay(currentVxPaidBy) ? currentVxPayer : currentVxPaidBy`,
  `shares: isSharedPay(currentVxPaidBy) ? sharesFor(currentVxSplit) : soloShares(currentVxPaidBy)`.

### Gastos posibles
- `#brWhoSeg` (label "¿De quién es?") no cambia — ya es el balde (`budgetTemplates[who]`).
- Nuevo `#brPayerField`/`#brPayerSeg`, oculto salvo Compartido, insertado antes de
  `#brSplitField`.
- Nuevo estado `currentBrPayer`.
- Al guardar: `payer: destino === SHARED_PAY ? currentBrPayer : undefined` en el rubro.

## Cálculo

- `netBalances()` pasa a sumar `expenses` y `varExpenses` (se extrae un helper
  `accumulateNet(net, list)` con la lógica que ya tenía, reutilizado para las dos listas).
- `sharedBudgetShareFor(person)` (gastos posibles) no cambia — el nuevo campo `payer` no entra
  en ningún cálculo de saldo.

## Visualización

- La card de gasto variable (`varExpenseBillRow`) gana el mismo tag "Paga <Nombre>" que ya
  tienen los gastos fijos, para que se entienda de dónde sale la deuda nueva. Se extrae un
  helper `payerTagHtml(ex)` (misma lógica que ya usa `billRow`, genérica vía `expenseOwner()`) y
  se usa en ambas cards.
- La card de rubro (`budgetRubroRow`) agrega "paga <Nombre>" junto al "según ingresos" que ya
  se agregó antes, cuando el rubro tiene `payer`.

## Efectos secundarios que hay que corregir

- **`dropPersonData(id)`** hoy borra *todos* los gastos variables cuyo `paidBy === id`
  (`varExpenses = varExpenses.filter(e=>e.paidBy !== id)`). Antes de este cambio eso sólo podía
  matchear entradas personales (un compartido nunca tenía `paidBy` de una persona puntual). Con
  el nuevo modelo, un compartido pagado por quien se va también matchea, y borrarlo entero
  perdería una deuda real. Pasa a: borrar sólo las entradas cuya propiedad (`expenseOwner`) sea
  esa persona (las personales — esto es lo que ya anuncia el mensaje de confirmación de
  "Se borran... gastos variables... de X"), y reasignar `paidBy` al primero de los que quedan en
  las compartidas que esa persona pagaba (mismo criterio que ya aplica hoy a `expenses`).
- **`redistributeShares()`** tiene una línea que corrige `splitType` con `isSplitAvailable()`;
  se elimina junto con la función, ya que `splitType` deja de leerse para determinar
  comportamiento (sólo es un hint de UI para prellenar "Partes iguales" vs "Según ingresos").

## Fuera de alcance

- No se migran los `expenses` existentes con `paidBy: 'shared'` — siguen sin deuda y sin tag,
  como siempre.
- No se agrega ningún mecanismo de deuda recurrente/mensual para gastos posibles.
- No se toca `financeFor()`, `sharedBudgetShareFor()`, ni el checklist de pagado agregado antes.
