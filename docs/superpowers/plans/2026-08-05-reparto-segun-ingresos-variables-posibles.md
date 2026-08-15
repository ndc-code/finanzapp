# Reparto "según ingresos" en gastos variables y gastos posibles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Compartido variable expense or Compartido "gasto posible" rubro be split
"Según ingresos" instead of always "Partes iguales", mirroring the selector gastos fijos already
has.

**Architecture:** Single-file app, no build step (`index.html`). Reuse the existing
`sharesFor()`/`incomeShares()`/`equalShares()` helpers everywhere — no new split math. Variable
expenses already carry a per-entry `shares` map, so Task 1 is UI + a new `splitType` field, no
core-calc change. Gastos posibles have no per-rubro split today — Task 2 adds `splitType` to each
rubro and changes `financeFor()`'s single `sharedBudgetShare()` average into a per-person
`sharedBudgetShareFor(person)`.

**Tech Stack:** Vanilla JS/HTML/CSS in `index.html`.

## Global Constraints

- Only two split options: `'equal'` and `'income'`. Do **not** add "Todo a Persona X" — that's
  already covered by picking that person directly in "¿De quién es?" (per spec's explicit
  out-of-scope note).
- The split selector is visible only when Compartido is selected **and** `peopleCount() > 1`.
- Existing shared rubros/entries with no `splitType` must read as `'equal'` — no migration
  function needed, every read site treats missing/other value as equal split.
- Do not touch `expenses`, `billRow()`, or the gastos-fijos split selector (`#splitToggle`,
  `currentSplit`, `sharesFor`, `isSplitAvailable`) — those stay exactly as they are, only reused.
- No automated test suite in this repo — every verification step below is a manual browser check
  (open `index.html`, use guest mode, exercise the UI), per this repo's CLAUDE.md.

---

### Task 1: "Según ingresos" for Compartido variable expenses

**Files:**
- Modify: `index.html` — form markup (~line 1019-1041), `openVarExpenseModal`/
  `resetVarExpenseForm`/`setVxPaidBy` (~line 2948-2987), submit handler (~line 3018-3037),
  `varExpenseBillRow` (~line 3848-3864), state declarations near `let currentVxPaidBy = 'A';`
  (line 1182).

**Interfaces:**
- Consumes: `sharesFor(splitType)`, `isSharedPay(v)`, `peopleCount()` (existing, unchanged).
- Produces: `currentVxSplit` (module-level string `'equal'|'income'`), `setVxSplit(split)` — no
  other task depends on these (Task 2 has its own independent `currentBrSplit`/`setBrSplit`).

- [ ] **Step 1: Add the split toggle markup to the var expense form**

In index.html, the `varExpenseForm` currently ends with:

```html
      <div class="row2">
        <div>
          <label for="vxAmount">Monto (ARS)</label>
          <input type="text" inputmode="numeric" class="ie-money" id="vxAmount" placeholder="0" required>
        </div>
        <div>
          <label for="vxDate">Fecha</label>
          <input type="date" id="vxDate">
        </div>
      </div>
      <button type="submit" class="btn-primary" id="vxSubmitBtn">Agregar gasto variable</button>
    </form>
```

Replace it with (new `#vxSplitField` block inserted before the submit button):

```html
      <div class="row2">
        <div>
          <label for="vxAmount">Monto (ARS)</label>
          <input type="text" inputmode="numeric" class="ie-money" id="vxAmount" placeholder="0" required>
        </div>
        <div>
          <label for="vxDate">Fecha</label>
          <input type="date" id="vxDate">
        </div>
      </div>
      <div id="vxSplitField" style="display:none;">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="vxSplitToggle">
          <button type="button" data-split="equal">Partes iguales</button>
          <button type="button" data-split="income">Según ingresos</button>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="vxSubmitBtn">Agregar gasto variable</button>
    </form>
```

- [ ] **Step 2: Add `currentVxSplit` state next to `currentVxPaidBy`**

In index.html, find:

```js
let currentVxPaidBy = 'A';
let editingVarExpenseId = null;
```

Replace with:

```js
let currentVxPaidBy = 'A';
let currentVxSplit = 'equal';
let editingVarExpenseId = null;
```

- [ ] **Step 3: Add `setVxSplit`, wire visibility into `setVxPaidBy`, add the click handler**

In index.html, find:

```js
function setVxPaidBy(who){
  currentVxPaidBy = who;
  document.querySelectorAll('#vxPaidBySeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentVxPaidBy));
  renderVxChips();
}
$('varExpenseModal').addEventListener('click', (e)=>{ if(e.target === $('varExpenseModal')) closeVarExpenseModal(); });
$('vxPaidBySeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setVxPaidBy(btn.dataset.paid);
});
```

Replace with:

```js
function setVxPaidBy(who){
  currentVxPaidBy = who;
  document.querySelectorAll('#vxPaidBySeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentVxPaidBy));
  $('vxSplitField').style.display = (isSharedPay(currentVxPaidBy) && peopleCount() > 1) ? '' : 'none';
  renderVxChips();
}
function setVxSplit(split){
  currentVxSplit = split;
  document.querySelectorAll('#vxSplitToggle button').forEach(b=>b.classList.toggle('active', b.dataset.split === currentVxSplit));
}
$('varExpenseModal').addEventListener('click', (e)=>{ if(e.target === $('varExpenseModal')) closeVarExpenseModal(); });
$('vxPaidBySeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setVxPaidBy(btn.dataset.paid);
});
$('vxSplitToggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setVxSplit(btn.dataset.split);
});
```

- [ ] **Step 4: Reset and prefill `currentVxSplit` in `resetVarExpenseForm`/`openVarExpenseModal`**

In index.html, find:

```js
function resetVarExpenseForm(){
  $('varExpenseForm').reset();
  editingVarExpenseId = null;
  $('vxDate').value = defaultDate();
  // arranca en la sub-pestaña que estás mirando: si estás en la de Ana, el
  // gasto que agregues es de Ana
  setVxPaidBy(peopleCount() > 1 ? currentVarTab : firstPid());
}
```

Replace with (adds `setVxSplit('equal')` before `setVxPaidBy`, since `setVxPaidBy` reads
`vxSplitField` visibility but not the split value itself):

```js
function resetVarExpenseForm(){
  $('varExpenseForm').reset();
  editingVarExpenseId = null;
  $('vxDate').value = defaultDate();
  setVxSplit('equal');
  // arranca en la sub-pestaña que estás mirando: si estás en la de Ana, el
  // gasto que agregues es de Ana
  setVxPaidBy(peopleCount() > 1 ? currentVarTab : firstPid());
}
```

Then find, in `openVarExpenseModal`:

```js
    const valido = isPerson(ex.paidBy) || (isSharedPay(ex.paidBy) && peopleCount() > 1);
    setVxPaidBy(valido ? ex.paidBy : firstPid());
  }
```

Replace with:

```js
    const valido = isPerson(ex.paidBy) || (isSharedPay(ex.paidBy) && peopleCount() > 1);
    setVxSplit(ex.splitType === 'income' ? 'income' : 'equal');
    setVxPaidBy(valido ? ex.paidBy : firstPid());
  }
```

- [ ] **Step 5: Use the chosen split on submit**

In index.html, find:

```js
  const fields = {
    desc, amount,
    date: $('vxDate').value || defaultDate(),
    category: categoryOf(desc),
    paidBy: currentVxPaidBy,
    // el reparto queda congelado en el gasto, igual que en los fijos: si mañana
    // cambia la cantidad de personas, este mes sigue dividido como fue
    shares: isSharedPay(currentVxPaidBy) ? equalShares() : null
  };
```

Replace with:

```js
  const fields = {
    desc, amount,
    date: $('vxDate').value || defaultDate(),
    category: categoryOf(desc),
    paidBy: currentVxPaidBy,
    // el reparto queda congelado en el gasto, igual que en los fijos: si mañana
    // cambia la cantidad de personas, este mes sigue dividido como fue
    shares: isSharedPay(currentVxPaidBy) ? sharesFor(currentVxSplit) : null,
    splitType: isSharedPay(currentVxPaidBy) ? currentVxSplit : undefined
  };
```

- [ ] **Step 6: Show the split label on the card**

In index.html, find:

```js
// same card design as billRow(), no split (personal, not shared)
function varExpenseBillRow(ex){
  const dateStr = new Date(ex.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>
        <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
          <input type="checkbox" ${ex.paid ? 'checked' : ''} onchange="toggleVarExpensePaid('${ex.id}')">
        </label>
      </div>
    </div>
```

Replace with:

```js
// same card design as billRow(): shows the split label too when it's shared
function varExpenseBillRow(ex){
  const dateStr = new Date(ex.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
  const splitLabel = splitLabelOf(ex);
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>${splitLabel ? `<span>·</span><span>${escapeHtml(splitLabel)}</span>` : ''}
        <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
          <input type="checkbox" ${ex.paid ? 'checked' : ''} onchange="toggleVarExpensePaid('${ex.id}')">
        </label>
      </div>
    </div>
```

- [ ] **Step 7: Manual verification in browser**

Open `index.html` (guest mode is fine — no real data at risk), go to Gastos → Gastos variables:
1. Click "+ Agregar gasto variable" with "¿De quién es?" on Compartido — confirm the new
   "¿Cómo se divide?" block appears with "Partes iguales" active by default.
2. Switch "¿De quién es?" to "Persona 1" — confirm the split block disappears. Switch back to
   Compartido — confirm it reappears.
3. With Compartido + "Según ingresos" selected, load some income for both people first (Ingresos
   tab) so the split isn't degenerate, then add a variable expense — confirm it saves without
   error and the card shows a split label other than "partes iguales" (e.g. "N $x / V $y").
4. Add another Compartido expense with "Partes iguales" — confirm its card shows "partes
   iguales".
5. Edit the "Según ingresos" expense (✎) — confirm the modal reopens with "Según ingresos" active
   on the split toggle.
6. Reload the page — confirm both cards still show their correct split label (persistence).
7. Confirm the "Saldos" footer numbers change appropriately between the two entries (the
   income-split one should not split 50/50 unless incomes happen to be equal).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: agrega reparto según ingresos a gastos variables compartidos"
```

---

### Task 2: "Según ingresos" for Compartido gastos posibles rubros

**Files:**
- Modify: `index.html` — form markup (~line 1051-1065), state near `let currentBrWho = 'A';`
  (~line 4089), `openBudgetRubroModal`/`setBrWho`/submit handler (~line 4091-4151),
  `budgetRubroRow` (~line 4072-4082), `sharedBudgetShare`/`financeFor` (~line 4036-4041 and
  ~3870-3886).

**Interfaces:**
- Consumes: `incomeShares()`, `equalShares()`, `isSharedPay(v)`, `SHARED_PAY`,
  `budgetTemplates` (existing, unchanged).
- Produces: `currentBrSplit`, `setBrSplit(split)`, `sharedBudgetShareFor(person): number`
  (replaces `sharedBudgetShare()`, which is removed — its only caller is `financeFor`, updated in
  Step 6 below).

- [ ] **Step 1: Add the split toggle markup to the rubro form**

In index.html, find:

```html
      <div>
        <label for="brAmount">Monto (ARS)</label>
        <input type="text" inputmode="numeric" class="ie-money" id="brAmount" placeholder="0">
      </div>
      <button type="submit" class="btn-primary" id="brSubmitBtn">Agregar gasto posible</button>
    </form>
```

Replace with:

```html
      <div>
        <label for="brAmount">Monto (ARS)</label>
        <input type="text" inputmode="numeric" class="ie-money" id="brAmount" placeholder="0">
      </div>
      <div id="brSplitField" style="display:none;">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="brSplitToggle">
          <button type="button" data-split="equal">Partes iguales</button>
          <button type="button" data-split="income">Según ingresos</button>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="brSubmitBtn">Agregar gasto posible</button>
    </form>
```

- [ ] **Step 2: Add `currentBrSplit` state next to `currentBrWho`**

In index.html, find:

```js
let editingRubroId = null;
let editingRubroWho = null;
let currentBrWho = 'A';
```

Replace with:

```js
let editingRubroId = null;
let editingRubroWho = null;
let currentBrWho = 'A';
let currentBrSplit = 'equal';
```

- [ ] **Step 3: Add `setBrSplit`, wire visibility into `setBrWho`, add the click handler**

In index.html, find:

```js
function setBrWho(who){
  currentBrWho = who;
  document.querySelectorAll('#brWhoSeg button').forEach(b=>b.classList.toggle('active', b.dataset.who === currentBrWho));
}
$('budgetRubroModal').addEventListener('click', (e)=>{ if(e.target === $('budgetRubroModal')) closeBudgetRubroModal(); });
$('brWhoSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setBrWho(btn.dataset.who);
});
```

Replace with:

```js
function setBrWho(who){
  currentBrWho = who;
  document.querySelectorAll('#brWhoSeg button').forEach(b=>b.classList.toggle('active', b.dataset.who === currentBrWho));
  $('brSplitField').style.display = (isSharedPay(currentBrWho) && peopleCount() > 1) ? '' : 'none';
}
function setBrSplit(split){
  currentBrSplit = split;
  document.querySelectorAll('#brSplitToggle button').forEach(b=>b.classList.toggle('active', b.dataset.split === currentBrSplit));
}
$('budgetRubroModal').addEventListener('click', (e)=>{ if(e.target === $('budgetRubroModal')) closeBudgetRubroModal(); });
$('brWhoSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setBrWho(btn.dataset.who);
});
$('brSplitToggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setBrSplit(btn.dataset.split);
});
```

- [ ] **Step 4: Prefill `currentBrSplit` in `openBudgetRubroModal`**

In index.html, find:

```js
function openBudgetRubroModal(id){
  const c = id ? (budgetTemplates[currentBudgetTab]||[]).find(x=>x.id === id) : null;
  editingRubroId = c ? c.id : null;
  editingRubroWho = c ? currentBudgetTab : null;
  $('budgetRubroForm').reset();
  setBrWho(c ? currentBudgetTab : (peopleCount() > 1 ? currentBudgetTab : firstPid()));
  if(c){
```

Replace with:

```js
function openBudgetRubroModal(id){
  const c = id ? (budgetTemplates[currentBudgetTab]||[]).find(x=>x.id === id) : null;
  editingRubroId = c ? c.id : null;
  editingRubroWho = c ? currentBudgetTab : null;
  $('budgetRubroForm').reset();
  setBrSplit(c && c.splitType === 'income' ? 'income' : 'equal');
  setBrWho(c ? currentBudgetTab : (peopleCount() > 1 ? currentBudgetTab : firstPid()));
  if(c){
```

- [ ] **Step 5: Save `splitType` on submit**

In index.html, find:

```js
  const c = editingRubroId ? (budgetTemplates[editingRubroWho]||[]).find(x=>x.id === editingRubroId) : null;
  if(c){
    c.label = label;
    c.amount = amount;
    // cambiar de quién es lo muda de pestaña, sin perder el candado
    if(destino !== editingRubroWho){
      budgetTemplates[editingRubroWho] = budgetTemplates[editingRubroWho].filter(x=>x.id !== c.id);
      budgetTemplates[destino].push(c);
      currentBudgetTab = destino;
    }
  }else{
    budgetTemplates[destino].push({ id: genId(), label, amount });
    currentBudgetTab = destino;
  }
```

Replace with:

```js
  const splitType = destino === SHARED_PAY ? currentBrSplit : undefined;
  const c = editingRubroId ? (budgetTemplates[editingRubroWho]||[]).find(x=>x.id === editingRubroId) : null;
  if(c){
    c.label = label;
    c.amount = amount;
    c.splitType = splitType;
    // cambiar de quién es lo muda de pestaña, sin perder el candado
    if(destino !== editingRubroWho){
      budgetTemplates[editingRubroWho] = budgetTemplates[editingRubroWho].filter(x=>x.id !== c.id);
      budgetTemplates[destino].push(c);
      currentBudgetTab = destino;
    }
  }else{
    budgetTemplates[destino].push({ id: genId(), label, amount, splitType });
    currentBudgetTab = destino;
  }
```

- [ ] **Step 6: Replace `sharedBudgetShare()` with a per-person `sharedBudgetShareFor(person)`**

In index.html, find:

```js
const budgetTotalOf = (who) => (budgetTemplates[who] || []).reduce((s,c)=>s+(c.amount||0), 0);
const ownBudgetTotal = (person) => budgetTotalOf(person);
// lo compartido se divide en partes iguales, igual que un gasto compartido
const sharedBudgetTotal = () => budgetTotalOf(SHARED_PAY);
const sharedBudgetShare = () => sharedBudgetTotal() / Math.max(peopleCount(), 1);
```

Replace with:

```js
const budgetTotalOf = (who) => (budgetTemplates[who] || []).reduce((s,c)=>s+(c.amount||0), 0);
const ownBudgetTotal = (person) => budgetTotalOf(person);
const sharedBudgetTotal = () => budgetTotalOf(SHARED_PAY);
// cada rubro compartido se reparte según su propio splitType (partes iguales por
// default); no se congela como en fijos/variables, se recalcula con el ingreso
// y la cantidad de personas de hoy, igual que hacía sharedBudgetShare() antes
function sharedBudgetShareFor(person){
  return (budgetTemplates[SHARED_PAY] || []).reduce((s,c)=>{
    const shares = c.splitType === 'income' ? (incomeShares() || equalShares()) : equalShares();
    return s + (c.amount||0) * (shares[person] || 0) / 100;
  }, 0);
}
```

Then find, in `financeFor`:

```js
  const compartido = sharedBudgetShare();
```

Replace with:

```js
  const compartido = sharedBudgetShareFor(person);
```

- [ ] **Step 7: Show the split label on the rubro card**

In index.html, find:

```js
// misma card que un gasto fijo: monto, lápiz para editarlo y ✕ que el candado
// deshabilita. Lo de siempre se carga en Ajustes; acá se corrige cuando cambia.
function budgetRubroRow(c){
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(c.label)}</div>
    </div>
    <div class="bill-amt">${fmt(c.amount || 0)}</div>
```

Replace with:

```js
// misma card que un gasto fijo: monto, lápiz para editarlo y ✕ que el candado
// deshabilita. Lo de siempre se carga en Ajustes; acá se corrige cuando cambia.
function budgetRubroRow(c){
  const splitLabel = c.splitType === 'income' ? 'según ingresos' : '';
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(c.label)}</div>
      ${splitLabel ? `<div class="bill-meta"><span>${escapeHtml(splitLabel)}</span></div>` : ''}
    </div>
    <div class="bill-amt">${fmt(c.amount || 0)}</div>
```

- [ ] **Step 8: Manual verification in browser**

Open `index.html` (guest mode), go to Gastos → Gastos posibles:
1. Click "+ Agregar gasto posible" with "¿De quién es?" on Compartido — confirm "¿Cómo se
   divide?" appears, "Partes iguales" active by default.
2. Switch to "Persona 1" — confirm the split block disappears; back to Compartido — reappears.
3. With income already loaded for both people (from Task 1's verification), add a Compartido
   rubro with "Según ingresos", some amount (e.g. 1000) — confirm it saves.
4. Go to the Ahorro tab (or check the "Saldos" footer under Gastos posibles) for both people —
   confirm their `compartido`/`podes` numbers differ proportionally to their income instead of
   splitting the rubro's amount 50/50.
5. Edit that rubro (✎) — confirm "Según ingresos" is active in the reopened modal.
6. Add a second Compartido rubro left on "Partes iguales" — confirm total saldo math still adds
   up (income-split rubro + equal-split rubro summed correctly per person).
7. Reload the page — confirm both rubros keep their split label ("según ingresos" / none) and the
   saldo numbers are unchanged.
8. Delete both test rubros and the Task 1 test expenses/income entries used for verification, to
   leave the guest space clean (guest data isn't persisted to a real couple, so this is optional
   but keeps the manual check tidy).

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: agrega reparto según ingresos a gastos posibles compartidos"
```
