# Reparto "según ingresos" en gastos variables y gastos posibles compartidos

## Contexto

El gasto fijo ya tiene un selector "¿Cómo se divide?" (Partes iguales / Según ingresos / Todo a
cada persona) que define cómo se reparte la deuda de un gasto, independiente de quién lo pagó.
Gastos variables y gastos posibles no lo tienen: los compartidos siempre se dividen en partes
iguales, sin alternativa.

- En variables, el dato ya soporta cualquier reparto (`shares` por entrada, igual que en fijos)
  — solo falta la UI para elegirlo.
- En posibles no existe reparto por rubro en absoluto: todo el balde `shared` se divide siempre
  parejo a través de `sharedBudgetShare()`, que alimenta directamente `financeFor()` (la cadena
  de plata). Este caso requiere tocar ese cálculo.

## Alcance

- Aplica solo cuando el gasto/rubro es Compartido. No se agregan las opciones "Todo a Persona X"
  — ya están cubiertas eligiendo esa persona directamente en "¿De quién es?".
- No se toca nada de gastos fijos.
- Rubros de gastos posibles ya existentes sin `splitType` se leen como `'equal'`: ningún saldo
  cambia hasta que alguien elija "Según ingresos" a propósito.

## Gastos variables

**Modelo:** nuevo campo `splitType: 'equal' | 'income'` en cada entrada de `varExpenses`,
presente solo cuando `paidBy === SHARED_PAY`. Se persiste junto con `shares` (mismo patrón que
`expenses` en gastos fijos: el reparto queda congelado en el momento de cargar el gasto).

**UI (modal "Agregar gasto variable"):**
- Nuevo bloque `¿Cómo se divide?` (`#vxSplitField` con `#vxSplitToggle`, dos botones: Partes
  iguales / Según ingresos), insertado entre el bloque de Monto/Fecha y el botón de submit.
- Visible solo cuando `currentVxPaidBy === SHARED_PAY` y `peopleCount() > 1`; oculto en cualquier
  otro caso.
- Nuevo estado `currentVxSplit` (default `'equal'`), función `setVxSplit(split)` que refleja el
  estado activo en los botones, y un listener de click en `#vxSplitToggle` que la invoca.
- `setVxPaidBy(who)` pasa a actualizar también la visibilidad de `#vxSplitField`.
- `openVarExpenseModal(expenseId)`: al editar una entrada compartida, precarga
  `setVxSplit(ex.splitType === 'income' ? 'income' : 'equal')`. `resetVarExpenseForm()` la
  resetea a `'equal'`.
- Al enviar el formulario: `shares: isSharedPay(currentVxPaidBy) ? sharesFor(currentVxSplit) :
  null`, `splitType: isSharedPay(currentVxPaidBy) ? currentVxSplit : undefined`. Reutiliza
  `sharesFor()`/`incomeShares()` ya existentes — mismo cálculo que gastos fijos.

**Visualización:** `varExpenseBillRow(ex)` agrega la misma etiqueta que ya usan los fijos
(`splitLabelOf(ex)`, que ya es genérica y lee `ex.shares`) en `bill-meta`, para poder ver qué
reparto quedó guardado en cada entrada.

## Gastos posibles

**Modelo:** nuevo campo `splitType: 'equal' | 'income'` en cada rubro (`{id, label, amount,
locked, splitType}`), relevante solo para los que viven en `budgetTemplates.shared`. A diferencia
de los gastos variables/fijos, un rubro es una plantilla recurrente sin fecha — su reparto no se
congela: se recalcula en cada render con el ingreso y la cantidad de personas actuales, igual que
ya pasa hoy con `sharedBudgetShare()`.

**UI (modal del rubro, compartido entre Ajustes y el ✎ de Gastos):**
- Mismo bloque `¿Cómo se divide?` (`#brSplitField` / `#brSplitToggle`), insertado después del
  campo Monto.
- Visible solo cuando `currentBrWho === SHARED_PAY` y `peopleCount() > 1`.
- Nuevo estado `currentBrSplit` (default `'equal'`), `setBrSplit(split)` y su listener de click.
- `setBrWho(who)` actualiza también la visibilidad de `#brSplitField`.
- `openBudgetRubroModal(id)`: al editar un rubro existente, precarga `setBrSplit(c && c.splitType
  === 'income' ? 'income' : 'equal')`; al agregar uno nuevo, arranca en `'equal'`.
- Al guardar (`$('budgetRubroForm')` submit): el rubro (nuevo o editado) guarda `splitType:
  destino === SHARED_PAY ? currentBrSplit : undefined`.

**Cálculo (`financeFor`):** `sharedBudgetShare()` (que hoy devuelve un promedio único,
`sharedBudgetTotal() / peopleCount()`, igual para todas las personas) se reemplaza por
`sharedBudgetShareFor(person)`:

```js
function sharedBudgetShareFor(person){
  return (budgetTemplates[SHARED_PAY] || []).reduce((s,c)=>{
    const shares = c.splitType === 'income' ? (incomeShares() || equalShares()) : equalShares();
    return s + (c.amount||0) * (shares[person] || 0) / 100;
  }, 0);
}
```

`financeFor()` pasa de `const compartido = sharedBudgetShare();` a `const compartido =
sharedBudgetShareFor(person);`. `sharedBudgetShare` (sin persona) se elimina — era de uso único.
`sharedBudgetTotal()`/`budgetTotalOf()` no cambian: siguen alimentando el total de la plantilla en
Ajustes y el `Totales` de la lista en Gastos, que no dependen de reparto por persona.

**Visualización:** `budgetRubroRow(c)` muestra "según ingresos" en `bill-meta` cuando el rubro es
compartido y `c.splitType === 'income'` (mismo criterio visual que en variables).

## Fuera de alcance

- No se agregan opciones "Todo a Persona X" en variables ni en posibles.
- No se toca `expenses`, `billRow()`, ni el selector de reparto de gastos fijos.
- No hace falta migración de datos: `splitType` ausente se interpreta como `'equal'` en todos los
  puntos de lectura.
