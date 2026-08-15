# Checklist de "pagado" en gastos fijos y variables

## Contexto

Las cards de gastos fijos (`billRow`) y gastos variables (`varExpenseBillRow`) en `index.html`
no tienen forma de marcar si un gasto ya fue pagado/transferido. Se pide agregar un check a la
derecha del tag "Paga Nicolas"/"Paga Valentina" (fijos) o en el lugar equivalente de la card
(variables, donde ese tag casi nunca se muestra porque la pestaña activa ya filtra por persona).

## Alcance

- Aplica a gastos fijos y variables únicamente (no a "Gastos posibles", que no tiene entradas
  por mes).
- Es un indicador puramente visual/informativo: **no** afecta `financeFor()` ni ningún cálculo
  de saldo, deuda o Ahorro. El gasto sigue contando en la cadena de plata apenas se carga, igual
  que hoy.
- No cambia el estilo de la card al marcar pagado (sin opacidad, sin tachado): el único cambio
  visible es el checkbox tildado.

## Modelo de datos

- Nuevo campo `paid: boolean` en cada objeto de `expenses` (gastos fijos) y `varExpenses`
  (gastos variables). Ausente/`undefined` se trata como `false`.
- No requiere columna nueva en Supabase: `paid` vive dentro del mismo jsonb (`expenses` /
  `variable_expenses`) que ya se persiste.
- Gastos existentes sin el campo se ven como no pagados hasta que se tilden.

## UI

- Checkbox nativo a la derecha de la card, después de `.bill-amt` y antes de los botones
  ✎/✕, en `billRow(ex)` y `varExpenseBillRow(ex)`.
- Siempre visible en ambas cards (tenga o no tag "Paga X" en fijos).
- Tildado = pagado. Click togglea el estado.
- Estilo acorde a la paleta existente (gold/clay), tamaño consistente con los botones ✎/✕
  vecinos.

## Funciones nuevas

- `toggleExpensePaid(id)`: busca el gasto en `expenses` por id, flipea `paid`, llama a
  `saveExpenses()` (fire-and-forget, try/catch) y `render()`.
- `toggleVarExpensePaid(id)`: mismo patrón para `varExpenses` / `saveVarExpenses()`.
- Ambas siguen el patrón mutar → persistir → re-render usado por el resto de la app (ver
  `togglePaid`-style handlers existentes como `deleteExpense`/`deleteVarExpense`).

## Fuera de alcance

- No hay reset automático "mensual" explícito: cada mes ya tiene sus propias entradas de
  `expenses`/`varExpenses` (no hay generación automática de recurrentes en el código actual),
  así que cada entrada nueva nace con `paid: false` naturalmente.
- No se toca `financeFor()`, `netBalances()`, `settlements()` ni ningún otro cálculo.
- No se agrega a "Gastos posibles".
