# Checklist de "pagado" en gastos fijos y variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a checkbox to the fixed-expense and variable-expense cards in `index.html` that
marks an entry as paid, purely as a visual reminder with zero effect on any money calculation.

**Architecture:** Single-file app, no build step. Add a `paid: boolean` field to expense/
var-expense objects (defaults falsy for existing data — no migration needed since it lives in
the same jsonb blob already persisted). Two new toggle functions follow the existing
mutate → `save*()` → `render()` pattern used by `deleteExpense`/`deleteVarExpense`. Two render
functions (`billRow`, `varExpenseBillRow`) get a checkbox `<label>` inserted before the ✎/✕
buttons. New CSS rule for the checkbox.

**Tech Stack:** Vanilla JS/HTML/CSS in `index.html`, Supabase-backed `store` (unaffected —
`paid` rides inside the existing `expenses`/`variable_expenses` jsonb columns).

## Global Constraints

- No automated test suite exists in this repo. "Testing" means manually exercising the UI in a
  browser, per this repo's own CLAUDE.md guidance — every verification step below is a manual
  browser check, not an automated test run.
- Do not touch `financeFor()`, `netBalances()`, `settlements()`, or any other saldo/debt
  calculation — `paid` must not be read by any of them.
- Do not add a style change (opacity/strikethrough) to paid cards — only the checkbox state
  changes.
- Use `var(--good)` (`#1c7a3d`, already defined at index.html:33) as the checkbox accent color —
  it's the app's existing semantic "done/success" color.
- Keep everything inside `index.html` — this repo has no build step and is deployed as a static
  file (per CLAUDE.md).

---

### Task 1: Toggle functions for fixed and variable expenses

**Files:**
- Modify: `index.html` (add `toggleExpensePaid` near `deleteExpense` at index.html:3753, add
  `toggleVarExpensePaid` near `deleteVarExpense` at index.html:3039)

**Interfaces:**
- Consumes: `expenses` / `varExpenses` (existing global arrays), `saveExpenses()`
  (index.html:2290), `saveVarExpenses()` (index.html:2295), `render()` (index.html:3930).
- Produces: `toggleExpensePaid(id: string): void`, `toggleVarExpensePaid(id: string): void` —
  both used by Task 2's checkbox markup via inline `onchange`.

- [ ] **Step 1: Add `toggleExpensePaid`**

Insert directly above `function deleteExpense(id){` at index.html:3753:

```js
function toggleExpensePaid(id){
  const ex = expenses.find(x=>x.id === id);
  if(!ex) return;
  ex.paid = !ex.paid;
  saveExpenses();
  render();
}

```

- [ ] **Step 2: Add `toggleVarExpensePaid`**

Insert directly above `function deleteVarExpense(id){` at index.html:3039:

```js
function toggleVarExpensePaid(id){
  const e = varExpenses.find(x=>x.id === id);
  if(!e) return;
  e.paid = !e.paid;
  saveVarExpenses();
  render();
}

```

- [ ] **Step 3: Manual verification (functions exist, no UI yet)**

Open `index.html` in a browser, open devtools console, run:
```js
typeof toggleExpensePaid === 'function' && typeof toggleVarExpensePaid === 'function'
```
Expected: `true`. No visible UI change yet — that's Task 2.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: agrega funciones toggle de pagado para gastos fijos y variables"
```

---

### Task 2: Checkbox UI in the expense cards

**Files:**
- Modify: `index.html` (`billRow` at index.html:3790-3813, `varExpenseBillRow` at
  index.html:3827-3839, CSS block near index.html:479 for `.bill-edit,.bill-del`)

**Interfaces:**
- Consumes: `toggleExpensePaid(id)` and `toggleVarExpensePaid(id)` from Task 1, `ex.paid` /
  `e.paid` (may be `undefined`, treat as falsy — no default-assignment needed since `undefined`
  is already falsy in the `checked` check below).
- Produces: visible checkbox in both card types; no new exports for later tasks.

- [ ] **Step 1: Add the checkbox markup to `billRow`**

In index.html:3800-3812, insert the checkbox `<label>` between the `bill-amt` div and the
edit button:

```js
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>${splitLabel ? `<span>·</span><span>${escapeHtml(splitLabel)}</span>` : ''}
        ${showPayer ? `<span class="tag ${personTagClass(ex.paidBy)}">Paga ${escapeHtml(nameOf(ex.paidBy))}</span>` : ''}
      </div>
    </div>
    <div class="bill-amt">${fmt(ex.amount)}</div>
    <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
      <input type="checkbox" ${ex.paid ? 'checked' : ''} onchange="toggleExpensePaid('${ex.id}')">
    </label>
    <button class="bill-edit" onclick="openModal('${ex.id}')" aria-label="Editar">✎</button>
    <button class="bill-del" onclick="deleteExpense('${ex.id}')" aria-label="Eliminar"
      ${locked ? `disabled title="Protegido por el candado de ${escapeHtml(locked.label)} en Ajustes"` : ''}>✕</button>
  </div>`;
```

- [ ] **Step 2: Add the checkbox markup to `varExpenseBillRow`**

In index.html:3829-3839, same placement:

```js
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>
      </div>
    </div>
    <div class="bill-amt">${fmt(ex.amount)}</div>
    <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
      <input type="checkbox" ${ex.paid ? 'checked' : ''} onchange="toggleVarExpensePaid('${ex.id}')">
    </label>
    <button class="bill-edit" onclick="openVarExpenseModal('${ex.id}')" aria-label="Editar">✎</button>
    <button class="bill-del" onclick="deleteVarExpense('${ex.id}')" aria-label="Eliminar">✕</button>
  </div>`;
```

- [ ] **Step 3: Add CSS for `.bill-paid`**

Insert directly after the `.bill-edit,.bill-del{...}` rule at index.html:479:

```css
  .bill-paid{display:flex;align-items:center;flex-shrink:0;}
  .bill-paid input{width:18px;height:18px;accent-color:var(--good);cursor:pointer;}
```

- [ ] **Step 4: Manual verification in browser**

Open `index.html` in a browser (or use the `run` skill). In the Gastos tab:
1. Open the Gastos fijos block — confirm each card shows an unchecked checkbox to the left of
   ✎/✕.
2. Click a checkbox — confirm it stays checked, no page error in console, and the card's other
   content (amount, tag, buttons) is unchanged.
3. Reload the page — confirm the checked state persisted (survives `render()`/Supabase reload).
4. Repeat steps 1-3 in the Gastos variables block, across the "Compartidos" and per-person tabs.
5. Confirm the Ahorro tab numbers and the block "Saldos" footers are unchanged after checking a
   box (no impact on money chain).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: agrega checkbox de pagado en las cards de gastos fijos y variables"
```
