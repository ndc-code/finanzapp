# Unificar de quién es / quién paga / cómo se divide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Same 3-question structure in the 3 loading modals (gasto fijo, gasto variable, gasto
posible): ¿De quién es? (always) → ¿Quién lo paga? + ¿Cómo se divide? (only when Compartido).
Extend debt tracking (`netBalances`) to variable expenses; gastos posibles' payer stays
informational only.

**Architecture:** Single-file app, no build step (`index.html`). Ownership (ex.shares) and payer
(ex.paidBy) become fully independent concepts in all 3 modals, matching a pattern gastos fijos
already half-had. `expenseOwner(ex)` (existing, generic — reads `shares`/`amount`) becomes the
one source of truth for "which tab does this belong to", reused for variables too (replacing
their current raw-`paidBy` tab filter). `soloShares(person)` / `sharesFor(splitType)` (existing)
are reused everywhere instead of writing new share math.

**Tech Stack:** Vanilla JS/HTML/CSS in `index.html`.

## Global Constraints

- Only two split options where "¿Cómo se divide?" applies: `'equal'` and `'income'`. No
  "Todo a Persona X" anywhere anymore — covered by picking that person in "¿De quién es?".
- "¿Quién lo paga?" never offers "Compartido" as an option — always a specific person, once
  shown.
- Existing `expenses` with `paidBy: 'shared'` keep working exactly as today (no tag, no debt) —
  no migration for `expenses`. Do not add one.
- Gastos posibles' new `payer` field must never be read by `financeFor()`,
  `sharedBudgetShareFor()`, or `netBalances()` — informational only.
- No automated test suite — every verification step is a manual browser check (guest mode is
  fine, no real data at risk).

---

### Task 1: Gastos fijos — split "¿Quién lo paga?" into ownership + payer

**Files:**
- Modify: `index.html` — form markup (~line 981-1008), state declarations (~line 1212-1213),
  `openModal` (~line 2929), chip click handler (~line 3194-3211), `resetForm` (~line 3227),
  `refreshPeopleUI`'s fixed-expense section (~line 3263-3325), `isSplitAvailable` (~line
  3343-3346, removed), `splitToggle`/`paidBySeg` click handlers + `setPaidBy`/`setSplit` (~line
  3735-3765), submit handler (~line 3767-3790ish), `setPeople`'s `vale()` repointing block (~line
  2009-2011).

**Interfaces:**
- Consumes: `isSharedPay`, `isPerson`, `firstPid`, `SHARED_PAY`, `soloShares`, `sharesFor`,
  `equalShares`, `escapeHtml` (all existing).
- Produces: `currentOwner` (module-level `SHARED_PAY | personId`), `setOwner(who): void` — Task 4
  does not depend on these (fixed expenses stay self-contained), but the pattern here is mirrored
  by Tasks 2 and 3.

- [ ] **Step 1: Restructure the form markup**

In index.html, find:

```html
    <form class="add-form" id="addForm">
      <div>
        <label>¿Quién lo paga?</label>
        <div class="seg" id="paidBySeg"></div>
      </div>
      <div>
        <label for="fDesc">Descripción</label>
        <input type="text" id="fDesc" placeholder="Ej: Sillón, cena de aniversario" required>
        <!-- the usual ones: picking a chip sets the description AND the category -->
        <div class="chips" id="descChips"></div>
      </div>
      <div class="row2">
        <div>
          <label for="fAmount">Monto (ARS)</label>
          <input type="text" inputmode="numeric" id="fAmount" placeholder="0" required>
        </div>
        <div>
          <label for="fDate">Fecha</label>
          <input type="date" id="fDate">
        </div>
      </div>
      <!-- se esconde entero cuando el espacio es de una sola persona -->
      <div id="splitField">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="splitToggle"></div>
        <div class="income-note" id="incomeSplitPreview" style="display:none;"></div>
      </div>
      <button type="submit" class="btn-primary" id="submitBtn">Agregar gasto</button>
    </form>
```

Replace with:

```html
    <form class="add-form" id="addForm">
      <div>
        <label>¿De quién es?</label>
        <div class="seg" id="ownerSeg"></div>
      </div>
      <div>
        <label for="fDesc">Descripción</label>
        <input type="text" id="fDesc" placeholder="Ej: Sillón, cena de aniversario" required>
        <!-- the usual ones: picking a chip sets the description AND the category -->
        <div class="chips" id="descChips"></div>
      </div>
      <div class="row2">
        <div>
          <label for="fAmount">Monto (ARS)</label>
          <input type="text" inputmode="numeric" id="fAmount" placeholder="0" required>
        </div>
        <div>
          <label for="fDate">Fecha</label>
          <input type="date" id="fDate">
        </div>
      </div>
      <!-- estos dos solo importan cuando el gasto es Compartido -->
      <div id="payerField" style="display:none;">
        <label>¿Quién lo paga?</label>
        <div class="seg" id="paidBySeg"></div>
      </div>
      <div id="splitField" style="display:none;">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="splitToggle"></div>
        <div class="income-note" id="incomeSplitPreview" style="display:none;"></div>
      </div>
      <button type="submit" class="btn-primary" id="submitBtn">Agregar gasto</button>
    </form>
```

- [ ] **Step 2: Add `currentOwner` state**

In index.html, find:

```js
let currentSplit = 'equal';
let currentPaidBy = 'A';
```

Replace with:

```js
let currentSplit = 'equal';
let currentPaidBy = 'A';
let currentOwner = 'A';
```

- [ ] **Step 3: Repoint `currentOwner` in `setPeople()` like the other person-selectors**

In index.html, find:

```js
  const vale = (v) => isPerson(v) || (isSharedPay(v) && list.length > 1);
  if(!vale(currentPaidBy)) currentPaidBy = firstPid();
```

Replace with:

```js
  const vale = (v) => isPerson(v) || (isSharedPay(v) && list.length > 1);
  if(!vale(currentOwner)) currentOwner = firstPid();
  if(!isPerson(currentPaidBy)) currentPaidBy = firstPid();
```

- [ ] **Step 4: Rewrite `setPaidBy`/`setSplit`, add `setOwner`, rewrite the click handlers**

In index.html, find:

```js
$('splitToggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  document.querySelectorAll('#splitToggle button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentSplit = btn.dataset.split;
  // un gasto que va entero a una persona no puede estar pagado "compartido":
  // lo banca ella sola, así que el pagador la sigue
  if(isSharedPay(currentPaidBy) && currentSplit.startsWith('only:')) setPaidBy(currentSplit.slice(5));
  renderIncomePreview();
});

$('paidBySeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setPaidBy(btn.dataset.paid);
  // "Compartido" es, por definición, un gasto que se reparte: si estaba puesto
  // "todo a X" se vuelve a partes iguales
  if(isSharedPay(currentPaidBy) && currentSplit.startsWith('only:')) setSplit('equal');
});

// las dos tiras se pisan entre sí, así que cada una se setea en un solo lugar
function setPaidBy(who){
  currentPaidBy = who;
  document.querySelectorAll('#paidBySeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentPaidBy));
}
function setSplit(split){
  currentSplit = split;
  document.querySelectorAll('#splitToggle button').forEach(b=>b.classList.toggle('active', b.dataset.split === currentSplit));
  renderIncomePreview();
}
```

Replace with:

```js
$('ownerSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setOwner(btn.dataset.owner);
});
$('paidBySeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setPaidBy(btn.dataset.paid);
});
$('splitToggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setSplit(btn.dataset.split);
});

function setOwner(who){
  currentOwner = who;
  document.querySelectorAll('#ownerSeg button').forEach(b=>b.classList.toggle('active', b.dataset.owner === currentOwner));
  const shared = isSharedPay(currentOwner);
  $('payerField').style.display = shared ? '' : 'none';
  $('splitField').style.display = shared ? '' : 'none';
  if(shared && !isPerson(currentPaidBy)) setPaidBy(firstPid());
}
function setPaidBy(who){
  currentPaidBy = who;
  document.querySelectorAll('#paidBySeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentPaidBy));
}
function setSplit(split){
  currentSplit = split;
  document.querySelectorAll('#splitToggle button').forEach(b=>b.classList.toggle('active', b.dataset.split === currentSplit));
  renderIncomePreview();
}
```

- [ ] **Step 5: Rewrite `refreshPeopleUI`'s fixed-expense section**

In index.html, find:

```js
  // en un espacio de a uno "Compartido" no significa nada
  if(solo && isSharedPay(currentPaidBy)) currentPaidBy = firstPid();
  seg('paidBySeg', 'data-paid', currentPaidBy);
  // ...y con dos o más, "Compartido" va primero: es lo que suele pasar con los
  // gastos del hogar, que salen de la parte de cada uno y no le deben a nadie
  if(!solo){
    $('paidBySeg').insertAdjacentHTML('afterbegin',
      `<button type="button" data-paid="${SHARED_PAY}"${isSharedPay(currentPaidBy) ? ' class="active"' : ''}>Compartido</button>`);
  }
  // en pareja son tres opciones y entran juntas; de tres personas para arriba
  // conviene que se envuelvan de a dos
  $('paidBySeg').classList.toggle('seg-fit', n <= 2);
```

Replace with:

```js
  // en un espacio de a uno "Compartido" no significa nada
  if(solo && isSharedPay(currentOwner)) currentOwner = firstPid();
  seg('ownerSeg', 'data-owner', currentOwner);
  // ...y con dos o más, "Compartido" va primero: es lo que suele pasar con los
  // gastos del hogar, que salen de la parte de cada uno y no le deben a nadie
  if(!solo){
    $('ownerSeg').insertAdjacentHTML('afterbegin',
      `<button type="button" data-owner="${SHARED_PAY}"${isSharedPay(currentOwner) ? ' class="active"' : ''}>Compartido</button>`);
  }
  // en pareja son tres opciones y entran juntas; de tres personas para arriba
  // conviene que se envuelvan de a dos
  $('ownerSeg').classList.toggle('seg-fit', n <= 2);
  // quién paga y cómo se divide sólo importan cuando el gasto es Compartido
  const ownerShared = isSharedPay(currentOwner);
  if(!isPerson(currentPaidBy)) currentPaidBy = firstPid();
  seg('paidBySeg', 'data-paid', currentPaidBy);
  $('payerField').style.display = (!solo && ownerShared) ? '' : 'none';
```

- [ ] **Step 6: Reduce `#splitToggle` to 2 options and gate its visibility on ownership**

In index.html, find:

```js
  // división de un gasto: partes iguales, según ingresos, o todo a cargo de uno.
  // Con una sola persona no hay nada que dividir, así que el bloque se esconde.
  const split = $('splitToggle');
  $('splitField').style.display = solo ? 'none' : '';
  if(!solo){
    if(!isSplitAvailable(currentSplit)) currentSplit = 'equal';
    const opts = [
      { v:'equal',  label:'Partes iguales' },
      { v:'income', label:'Según ingresos' },
      ...people.map(p=>({ v:'only:' + p.id, label:'Todo a ' + p.name }))
    ];
    split.innerHTML = opts.map(o=>
      `<button type="button" data-split="${o.v}"${o.v === currentSplit ? ' class="active"' : ''}>${escapeHtml(o.label)}</button>`
    ).join('');
  }
```

Replace with:

```js
  // división de un gasto: partes iguales o según ingresos. Solo importa
  // cuando el gasto es Compartido; con una sola persona tampoco hay nada
  // que dividir.
  $('splitField').style.display = (!solo && ownerShared) ? '' : 'none';
  if(!solo){
    const opts = [
      { v:'equal',  label:'Partes iguales' },
      { v:'income', label:'Según ingresos' }
    ];
    $('splitToggle').innerHTML = opts.map(o=>
      `<button type="button" data-split="${o.v}"${o.v === currentSplit ? ' class="active"' : ''}>${escapeHtml(o.label)}</button>`
    ).join('');
  }
```

- [ ] **Step 7: Rewrite `resetForm` and `openModal`**

Note: `isSplitAvailable` is NOT deleted in this task — it still has one caller left
(`redistributeShares`, untouched until Task 2). Deleting it now would break that caller with a
`ReferenceError` the moment someone changes the people count between Task 1 and Task 2's
commits. Task 2 Step 9 removes both the last caller and the function definition together.

In index.html, find:

```js
function resetForm(){
  $('addForm').reset();
  editingExpenseId = null;
  $('fDate').value = defaultDate();
  setSplit('equal');
  // un gasto nuevo arranca compartido: es lo más común cuando se comparte el
  // espacio, y así cae en la sub-pestaña de Compartidos sin tocar nada
  setPaidBy(peopleCount() > 1 ? SHARED_PAY : firstPid());
  syncChips();
}
```

Replace with:

```js
function resetForm(){
  $('addForm').reset();
  editingExpenseId = null;
  $('fDate').value = defaultDate();
  setSplit('equal');
  // un gasto nuevo arranca compartido: es lo más común cuando se comparte el
  // espacio, y así cae en la sub-pestaña de Compartidos sin tocar nada
  setOwner(peopleCount() > 1 ? SHARED_PAY : firstPid());
  syncChips();
}
```

Then find, in `openModal`:

```js
    const paid = isPerson(ex.paidBy) || (isSharedPay(ex.paidBy) && peopleCount() > 1);
    setPaidBy(paid ? ex.paidBy : firstPid());
    setSplit(isSplitAvailable(ex.splitType) ? ex.splitType : 'equal');
    syncChips();
```

Replace with:

```js
    const owner = expenseOwner(ex);
    setSplit(ex.splitType === 'income' ? 'income' : 'equal');
    setOwner(owner);
    if(isSharedPay(owner)) setPaidBy(isPerson(ex.paidBy) ? ex.paidBy : firstPid());
    syncChips();
```

- [ ] **Step 8: Rewrite the fixed-expense chip handler**

In index.html, find:

```js
$('descChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const f = fixed.find(x=>x.id === btn.dataset.id);
  if(!f) return;
  $('fDesc').value = f.label;
  $('fAmount').value = f.amount ? groupThousands(String(f.amount)) : '';
  // la plantilla ya sabe si el gasto es del hogar o de alguien en particular
  const split = splitForOwner(f.owner);
  if(isSplitAvailable(split)){
    setSplit(split);
    // el dueño de un gasto propio suele ser también quien lo paga; los del
    // hogar salen de la parte de cada uno, así que quedan como compartidos
    if(isPerson(f.owner)) setPaidBy(f.owner);
    else if(peopleCount() > 1) setPaidBy(SHARED_PAY);
  }
  syncChips();
});
```

Replace with:

```js
$('descChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const f = fixed.find(x=>x.id === btn.dataset.id);
  if(!f) return;
  $('fDesc').value = f.label;
  $('fAmount').value = f.amount ? groupThousands(String(f.amount)) : '';
  // la plantilla ya sabe si el gasto es del hogar o de alguien en particular
  setOwner(isPerson(f.owner) ? f.owner : (peopleCount() > 1 ? SHARED_PAY : firstPid()));
  syncChips();
});
```

Then find the now-unused `splitForOwner` a few lines above (near `cycleFixedOwner`):

```js
const splitForOwner = (owner) => isPerson(owner) ? 'only:' + owner : 'equal';
```

Delete that line entirely.

- [ ] **Step 9: Update the submit handler**

In index.html, find:

```js
$('addForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const desc = $('fDesc').value.trim();
  const amount = numVal('fAmount');
  if(!desc || !amount) return;
  const fields = {
    desc, amount,
    date: $('fDate').value || defaultDate(),
    category: categoryOf(desc),
    shares: sharesFor(currentSplit),
    splitType: currentSplit,
    paidBy: currentPaidBy
  };
```

Replace with:

```js
$('addForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const desc = $('fDesc').value.trim();
  const amount = numVal('fAmount');
  if(!desc || !amount) return;
  const shared = isSharedPay(currentOwner);
  const fields = {
    desc, amount,
    date: $('fDate').value || defaultDate(),
    category: categoryOf(desc),
    shares: shared ? sharesFor(currentSplit) : soloShares(currentOwner),
    splitType: shared ? currentSplit : undefined,
    paidBy: shared ? currentPaidBy : currentOwner
  };
```

- [ ] **Step 10: Manual verification in browser**

Open `index.html` in guest mode. Load income for both people first (Ingresos tab): Persona 1
100000, Persona 2 50000 — leave both in place, later tasks in this plan reuse them. Then go to
Gastos → Gastos fijos, "+ Agregar gasto fijo":
1. Confirm the first field is now "¿De quién es?" with Compartido/Persona1/Persona2, and that
   "¿Quién lo paga?"/"¿Cómo se divide?" are both hidden by default (form opens on Compartido, so
   they should actually be visible by default — confirm they show).
2. Switch "¿De quién es?" to "Persona 1" — confirm both "¿Quién lo paga?" and "¿Cómo se divide?"
   disappear.
3. Switch back to Compartido — confirm both reappear, "¿Quién lo paga?" only offers the two
   people (no "Compartido" button), "¿Cómo se divide?" only offers Partes iguales/Según
   ingresos (no "Todo a X").
4. Add a Compartido expense, payer = Persona 1, split = Según ingresos, amount 1000. Confirm it
   saves, shows a "Paga Persona 1" tag on the card, and lands under the "Compartidos" sub-tab.
   Leave it in place — Task 4 reuses it.
5. Add a "Persona 1"-owned expense (no payer/split fields touched, since they're hidden).
   Confirm it saves and lands under the "Persona 1" sub-tab with no payer tag, then delete it —
   it was only to check the hide/show behavior.
6. Edit the Compartido/Según-ingresos expense from step 4 (✎) — confirm it reopens with
   "¿De quién es?"=Compartido, "¿Quién lo paga?"=Persona 1, "¿Cómo se divide?"=Según ingresos.
7. Click a chip from `#descChips` (a recurring fixed-expense template) whose owner is a specific
   person in Ajustes (if none exists, set one via the owner chip in Ajustes → Gastos fijos
   first) — confirm picking the chip sets "¿De quién es?" to that person and hides the other two
   fields, then close the modal without saving (don't touch the step-4 test expense).
8. Confirm Resumen shows the expected debt from step 4 (Persona 1 fronted 1000 split by income —
   Persona 2 owes Persona 1 their income-proportional share).

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "feat: separa de quién es de quién paga en el modal de gastos fijos"
```

---

### Task 2: Gastos variables — add "¿Quién lo paga?", fix ownership derivation, extend debt

**Files:**
- Modify: `index.html` — form markup (~line 1040), state declarations (~line 1196-1197),
  `openVarExpenseModal` (~line 2963), `setVxPaidBy` + new `setVxPayer` + click handlers (~line
  2994-3014), submit handler (~line 3050-3059), `renderVarExpenseTabs` (~line 4254),
  `normalizeExpenses`-adjacent new `normalizeVarExpenses` + its 3 call sites (`loadAll`,
  `applyCoupleRow`, `paintFromLocalCache`), `dropPersonData` (~line 3418-3433).

**Interfaces:**
- Consumes: `expenseOwner(ex)` (existing, from index.html — now also correct for var expenses
  once Step 7's data fix lands), `soloShares`, `sharesFor`, `isSharedPay`, `isPerson`,
  `firstPid`.
- Produces: `currentVxPayer`, `setVxPayer(who): void`, `normalizeVarExpenses(): boolean` (same
  contract as the existing `normalizeExpenses()` — returns whether it changed anything, so
  callers know whether to persist).

- [ ] **Step 1: Add the payer field markup, before the existing split field**

In index.html, find:

```html
      <div id="vxSplitField" style="display:none;">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="vxSplitToggle">
          <button type="button" data-split="equal">Partes iguales</button>
          <button type="button" data-split="income">Según ingresos</button>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="vxSubmitBtn">Agregar gasto variable</button>
```

Replace with:

```html
      <div id="vxPayerField" style="display:none;">
        <label>¿Quién lo paga?</label>
        <div class="seg" id="vxPayerSeg"></div>
      </div>
      <div id="vxSplitField" style="display:none;">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="vxSplitToggle">
          <button type="button" data-split="equal">Partes iguales</button>
          <button type="button" data-split="income">Según ingresos</button>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="vxSubmitBtn">Agregar gasto variable</button>
```

- [ ] **Step 2: Add `currentVxPayer` state**

In index.html, find:

```js
let currentVxPaidBy = 'A';
let currentVxSplit = 'equal';
```

Replace with:

```js
let currentVxPaidBy = 'A';
let currentVxPayer = 'A';
let currentVxSplit = 'equal';
```

- [ ] **Step 3: Rewrite `setVxPaidBy`, add `setVxPayer`, wire the payer field's `#vxPayerSeg` options**

In index.html, find:

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

Replace with:

```js
function setVxPaidBy(who){
  currentVxPaidBy = who;
  document.querySelectorAll('#vxPaidBySeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentVxPaidBy));
  const shared = isSharedPay(currentVxPaidBy) && peopleCount() > 1;
  $('vxPayerField').style.display = shared ? '' : 'none';
  $('vxSplitField').style.display = shared ? '' : 'none';
  if(shared){
    document.querySelectorAll('#vxPayerSeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentVxPayer));
    if(!isPerson(currentVxPayer)) setVxPayer(firstPid());
  }
  renderVxChips();
}
function setVxPayer(who){
  currentVxPayer = who;
  document.querySelectorAll('#vxPayerSeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentVxPayer));
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
$('vxPayerSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setVxPayer(btn.dataset.paid);
});
$('vxSplitToggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setVxSplit(btn.dataset.split);
});
```

`#vxPayerSeg`'s buttons need building somewhere people-dependent — reuse `refreshPeopleUI`'s
`seg()` helper the same way `vxPaidBySeg` already does. Find, in `refreshPeopleUI`:

```js
  if(solo && isSharedPay(currentVxPaidBy)) currentVxPaidBy = firstPid();
  seg('vxPaidBySeg', 'data-paid', currentVxPaidBy);
  // los variables también pueden ser de los dos: una cena, un viaje
  if(!solo){
    $('vxPaidBySeg').insertAdjacentHTML('afterbegin',
      `<button type="button" data-paid="${SHARED_PAY}"${isSharedPay(currentVxPaidBy) ? ' class="active"' : ''}>Compartido</button>`);
  }
  $('vxPaidBySeg').classList.toggle('seg-fit', n <= 2);
```

Replace with:

```js
  if(solo && isSharedPay(currentVxPaidBy)) currentVxPaidBy = firstPid();
  seg('vxPaidBySeg', 'data-paid', currentVxPaidBy);
  // los variables también pueden ser de los dos: una cena, un viaje
  if(!solo){
    $('vxPaidBySeg').insertAdjacentHTML('afterbegin',
      `<button type="button" data-paid="${SHARED_PAY}"${isSharedPay(currentVxPaidBy) ? ' class="active"' : ''}>Compartido</button>`);
  }
  $('vxPaidBySeg').classList.toggle('seg-fit', n <= 2);
  if(!isPerson(currentVxPayer)) currentVxPayer = firstPid();
  seg('vxPayerSeg', 'data-paid', currentVxPayer);
  $('vxPayerField').style.display = (!solo && isSharedPay(currentVxPaidBy)) ? '' : 'none';
```

- [ ] **Step 4: Prefill `currentVxPayer` in `openVarExpenseModal`, using `expenseOwner`**

In index.html, find:

```js
    const valido = isPerson(ex.paidBy) || (isSharedPay(ex.paidBy) && peopleCount() > 1);
    setVxSplit(ex.splitType === 'income' ? 'income' : 'equal');
    setVxPaidBy(valido ? ex.paidBy : firstPid());
  }
```

Replace with:

```js
    const owner = expenseOwner(ex);
    setVxSplit(ex.splitType === 'income' ? 'income' : 'equal');
    if(isSharedPay(owner)) setVxPayer(isPerson(ex.paidBy) ? ex.paidBy : firstPid());
    setVxPaidBy(owner);
  }
```

- [ ] **Step 5: Update the submit handler**

In index.html, find:

```js
    paidBy: currentVxPaidBy,
    // el reparto queda congelado en el gasto, igual que en los fijos: si mañana
    // cambia la cantidad de personas, este mes sigue dividido como fue
    shares: isSharedPay(currentVxPaidBy) ? sharesFor(currentVxSplit) : null,
    splitType: isSharedPay(currentVxPaidBy) ? currentVxSplit : undefined
  };
```

Replace with:

```js
    paidBy: isSharedPay(currentVxPaidBy) ? currentVxPayer : currentVxPaidBy,
    // el reparto queda congelado en el gasto, igual que en los fijos: si mañana
    // cambia la cantidad de personas, este mes sigue dividido como fue
    shares: isSharedPay(currentVxPaidBy) ? sharesFor(currentVxSplit) : soloShares(currentVxPaidBy),
    splitType: isSharedPay(currentVxPaidBy) ? currentVxSplit : undefined
  };
```

- [ ] **Step 6: Switch tab filtering from raw `paidBy` to `expenseOwner()`**

In index.html, find:

```js
  const shown = list.filter(e=>(isSharedPay(e.paidBy) ? SHARED_PAY : e.paidBy) === currentVarTab);
```

Replace with:

```js
  const shown = list.filter(e=>expenseOwner(e) === currentVarTab);
```

- [ ] **Step 7: Add `normalizeVarExpenses()` and call it everywhere `normalizeExpenses()` is
  called**

In index.html, find (the comment belongs to `normalizeExpenses`, right above it — keep it
attached to the right function):

```js
// expenses saved before the month view existed could have no date; without one
// they'd belong to no month and silently vanish from every screen
function normalizeExpenses(){
```

Replace with:

```js
// los gastos variables personales guardaban `shares: null` (no hacía falta:
// entryShareOf lee `paidBy` directo). Ahora expenseOwner() también los mira
// para decidir la pestaña, así que necesitan el mismo `shares` que ya tienen
// los fijos — sin esto quedarían mal ubicados (como si fueran de todos).
function normalizeVarExpenses(){
  let changed = false;
  varExpenses.forEach(e=>{
    if(!e.shares && !isSharedPay(e.paidBy) && isPerson(e.paidBy)){
      e.shares = soloShares(e.paidBy);
      changed = true;
    }
  });
  return changed;
}

// expenses saved before the month view existed could have no date; without one
// they'd belong to no month and silently vanish from every screen
function normalizeExpenses(){
```

Then find, in `applyCoupleRow`:

```js
  ensureSharedSlots();
  if(normalizeExpenses()) saveExpenses();
}
```

Replace with:

```js
  ensureSharedSlots();
  if(normalizeExpenses()) saveExpenses();
  if(normalizeVarExpenses()) saveVarExpenses();
}
```

Then find, in `paintFromLocalCache`:

```js
    if(normalizeExpenses()){ /* fixed up in-memory; loadAll()'s real save will persist it */ }
    render();
```

Replace with:

```js
    if(normalizeExpenses()){ /* fixed up in-memory; loadAll()'s real save will persist it */ }
    normalizeVarExpenses();
    render();
```

Then find, in `loadAll`:

```js
  if(normalizeExpenses()) saveExpenses();
  ensureSharedSlots();   // los datos vienen después de setPeople()
```

Replace with:

```js
  if(normalizeExpenses()) saveExpenses();
  if(normalizeVarExpenses()) saveVarExpenses();
  ensureSharedSlots();   // los datos vienen después de setPeople()
```

- [ ] **Step 8: Fix `dropPersonData` so a shared variable expense the departing person paid
  isn't deleted wholesale**

In index.html, find:

```js
function dropPersonData(id){
  delete income.entries[id];
  delete varEstimates[id];
  delete budgetTemplates[id];
  varExpenses = varExpenses.filter(e=>e.paidBy !== id);
  goals = goals.filter(g=>g.person !== id);
  // siempre se saca del final de la lista, así que la primera persona sigue ahí
  // y hereda los gastos compartidos que pagaba el que se va (si no, el gasto
  // quedaría sin nadie que lo haya puesto y el balance no cerraría)
  const fallback = people[0].id;
  expenses.forEach(ex=>{ if(ex.paidBy === id) ex.paidBy = fallback; });
  fixedIncome.forEach(f=>{ if(f.person === id) f.person = fallback; });
  // sus gastos fijos propios pasan a ser del hogar, igual que su parte de los
  // gastos ya cargados: quedan a la vista en Compartidos y no en la nada
  fixed.forEach(f=>{ if(f.owner === id) f.owner = null; });
}
```

Replace with:

```js
function dropPersonData(id){
  delete income.entries[id];
  delete varEstimates[id];
  delete budgetTemplates[id];
  goals = goals.filter(g=>g.person !== id);
  // siempre se saca del final de la lista, así que la primera persona sigue ahí
  // y hereda los gastos compartidos que pagaba el que se va (si no, el gasto
  // quedaría sin nadie que lo haya puesto y el balance no cerraría)
  const fallback = people[0].id;
  expenses.forEach(ex=>{ if(ex.paidBy === id) ex.paidBy = fallback; });
  // los variables propios de quien se va se borran (avisado en el mensaje de
  // confirmación de setPeopleCount); los compartidos que puso de su bolsillo
  // quedan, solo se reasigna quién los pagó para no perder esa deuda
  varExpenses = varExpenses.filter(e=>expenseOwner(e) !== id);
  varExpenses.forEach(e=>{ if(e.paidBy === id) e.paidBy = fallback; });
  fixedIncome.forEach(f=>{ if(f.person === id) f.person = fallback; });
  // sus gastos fijos propios pasan a ser del hogar, igual que su parte de los
  // gastos ya cargados: quedan a la vista en Compartidos y no en la nada
  fixed.forEach(f=>{ if(f.owner === id) f.owner = null; });
}
```

- [ ] **Step 9: Remove `redistributeShares`'s last use of `isSplitAvailable`, then delete
  `isSplitAvailable` itself**

`isSplitAvailable` had 3 callers before this plan; Task 1 already removed the other 2
(`openModal`'s prefill and `refreshPeopleUI`'s currentSplit check). This is the last one, so the
function definition can go too — deleting it earlier (in Task 1) would have left this call
throwing a `ReferenceError`.

In index.html, find:

```js
    // los variables no tienen tipo de división: no hay nada que corregirles
    if(ex.splitType && !isSplitAvailable(ex.splitType)) ex.splitType = 'equal';
  });
}
```

Replace with:

```js
  });
}
```

Then find:

```js
// un tipo de división sigue siendo válido mientras la persona que nombra exista
function isSplitAvailable(splitType){
  if(splitType === 'equal' || splitType === 'income') return true;
  return !!(splitType && splitType.startsWith('only:') && isPerson(splitType.slice(5)));
}
```

Delete it entirely.

- [ ] **Step 10: Manual verification in browser**

Note: the card doesn't show a "Paga X" tag yet, and Resumen doesn't show the new debt yet — both
land in Task 4 (`payerTagHtml` reuse and the `netBalances` extension). This step only checks
what Task 2 itself delivers: the field, correct storage, and correct tab placement.

Open `index.html` (guest mode), load income for both people again (Persona 1: 100000, Persona 2:
50000 — same as earlier session), then go to Gastos → Gastos variables, "+ Agregar gasto
variable":
1. With "¿De quién es?"=Compartido, confirm "¿Quién lo paga?" now appears (new field) along
   with "¿Cómo se divide?", and "¿Quién lo paga?" only offers the two people.
2. Switch "¿De quién es?" to "Persona 1" — confirm both fields disappear.
3. Back to Compartido, pick "¿Quién lo paga?"=Persona 1, "¿Cómo se divide?"=Según ingresos,
   amount 900 — save. Confirm it's listed under the "Compartidos" var-expense sub-tab (not under
   "Persona 1") and shows the right split label.
4. Add a "Persona 2"-owned variable expense (no payer/split shown) — confirm it saves and shows
   under the "Persona 2" sub-tab.
5. Edit the Compartido/Según-ingresos entry from step 3 — confirm it reopens with
   "¿De quién es?"=Compartido, "¿Quién lo paga?"=Persona 1, "¿Cómo se divide?"=Según ingresos.
6. Reload the page — confirm tab placement and the split label survive.
7. Leave both test entries and the income in place — Task 4's verification reuses them to check
   the tag and the debt in Resumen.

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "feat: agrega quién paga a gastos variables y suma su deuda a Resumen"
```

---

### Task 3: Gastos posibles — add "¿Quién lo paga?" (informational)

**Files:**
- Modify: `index.html` — form markup (~line 1071), state declarations (~line 4128),
  `openBudgetRubroModal` (~line 4130ish), `setBrWho` + new `setBrPayer` + click handler,
  `refreshPeopleUI`'s posibles section, submit handler, `budgetRubroRow`.

**Interfaces:**
- Consumes: `isSharedPay`, `isPerson`, `firstPid`, `nameOf` (existing).
- Produces: `currentBrPayer`, `setBrPayer(who): void`. Nothing here feeds `financeFor` or any
  saldo calculation — enforced by simply never reading `c.payer` outside `budgetRubroRow`.

- [ ] **Step 1: Add the payer field markup, before the existing split field**

In index.html, find:

```html
      <div id="brSplitField" style="display:none;">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="brSplitToggle">
          <button type="button" data-split="equal">Partes iguales</button>
          <button type="button" data-split="income">Según ingresos</button>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="brSubmitBtn">Agregar gasto posible</button>
```

Replace with:

```html
      <div id="brPayerField" style="display:none;">
        <label>¿Quién lo paga?</label>
        <div class="seg" id="brPayerSeg"></div>
      </div>
      <div id="brSplitField" style="display:none;">
        <label>¿Cómo se divide?</label>
        <div class="seg" id="brSplitToggle">
          <button type="button" data-split="equal">Partes iguales</button>
          <button type="button" data-split="income">Según ingresos</button>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="brSubmitBtn">Agregar gasto posible</button>
```

- [ ] **Step 2: Add `currentBrPayer` state**

In index.html, find:

```js
let currentBrWho = 'A';
let currentBrSplit = 'equal';
```

Replace with:

```js
let currentBrWho = 'A';
let currentBrPayer = 'A';
let currentBrSplit = 'equal';
```

- [ ] **Step 3: Rewrite `setBrWho`, add `setBrPayer`, add the click handler**

In index.html, find:

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

Replace with:

```js
function setBrWho(who){
  currentBrWho = who;
  document.querySelectorAll('#brWhoSeg button').forEach(b=>b.classList.toggle('active', b.dataset.who === currentBrWho));
  const shared = isSharedPay(currentBrWho) && peopleCount() > 1;
  $('brPayerField').style.display = shared ? '' : 'none';
  $('brSplitField').style.display = shared ? '' : 'none';
  if(shared && !isPerson(currentBrPayer)) setBrPayer(firstPid());
}
function setBrPayer(who){
  currentBrPayer = who;
  document.querySelectorAll('#brPayerSeg button').forEach(b=>b.classList.toggle('active', b.dataset.paid === currentBrPayer));
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
$('brPayerSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setBrPayer(btn.dataset.paid);
});
$('brSplitToggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  setBrSplit(btn.dataset.split);
});
```

Now build `#brPayerSeg`'s buttons in `refreshPeopleUI`. Find:

```js
  if(solo && isSharedPay(currentBrWho)) currentBrWho = firstPid();
  seg('brWhoSeg', 'data-who', currentBrWho);
  if(!solo){
    $('brWhoSeg').insertAdjacentHTML('afterbegin',
      `<button type="button" data-who="${SHARED_PAY}"${isSharedPay(currentBrWho) ? ' class="active"' : ''}>Compartido</button>`);
  }
  $('brWhoSeg').classList.toggle('seg-fit', n <= 2);
```

Replace with:

```js
  if(solo && isSharedPay(currentBrWho)) currentBrWho = firstPid();
  seg('brWhoSeg', 'data-who', currentBrWho);
  if(!solo){
    $('brWhoSeg').insertAdjacentHTML('afterbegin',
      `<button type="button" data-who="${SHARED_PAY}"${isSharedPay(currentBrWho) ? ' class="active"' : ''}>Compartido</button>`);
  }
  $('brWhoSeg').classList.toggle('seg-fit', n <= 2);
  if(!isPerson(currentBrPayer)) currentBrPayer = firstPid();
  seg('brPayerSeg', 'data-paid', currentBrPayer);
  $('brPayerField').style.display = (!solo && isSharedPay(currentBrWho)) ? '' : 'none';
```

- [ ] **Step 4: Prefill `currentBrPayer` in `openBudgetRubroModal`**

In index.html, find:

```js
  $('budgetRubroForm').reset();
  setBrSplit(c && c.splitType === 'income' ? 'income' : 'equal');
  setBrWho(c ? currentBudgetTab : (peopleCount() > 1 ? currentBudgetTab : firstPid()));
```

Replace with:

```js
  $('budgetRubroForm').reset();
  setBrSplit(c && c.splitType === 'income' ? 'income' : 'equal');
  setBrPayer(c && isPerson(c.payer) ? c.payer : firstPid());
  setBrWho(c ? currentBudgetTab : (peopleCount() > 1 ? currentBudgetTab : firstPid()));
```

- [ ] **Step 5: Save `payer` on submit**

In index.html, find:

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

Replace with:

```js
  const shared = destino === SHARED_PAY;
  const splitType = shared ? currentBrSplit : undefined;
  const payer = shared ? currentBrPayer : undefined;
  const c = editingRubroId ? (budgetTemplates[editingRubroWho]||[]).find(x=>x.id === editingRubroId) : null;
  if(c){
    c.label = label;
    c.amount = amount;
    c.splitType = splitType;
    c.payer = payer;
    // cambiar de quién es lo muda de pestaña, sin perder el candado
    if(destino !== editingRubroWho){
      budgetTemplates[editingRubroWho] = budgetTemplates[editingRubroWho].filter(x=>x.id !== c.id);
      budgetTemplates[destino].push(c);
      currentBudgetTab = destino;
    }
  }else{
    budgetTemplates[destino].push({ id: genId(), label, amount, splitType, payer });
    currentBudgetTab = destino;
  }
```

- [ ] **Step 6: Show the payer on the rubro card**

In index.html, find:

```js
function budgetRubroRow(c){
  const splitLabel = c.splitType === 'income' ? 'según ingresos' : '';
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(c.label)}</div>
      ${splitLabel ? `<div class="bill-meta"><span>${escapeHtml(splitLabel)}</span></div>` : ''}
    </div>
    <div class="bill-amt">${fmt(c.amount || 0)}</div>
```

Replace with:

```js
function budgetRubroRow(c){
  const bits = [];
  if(c.splitType === 'income') bits.push('según ingresos');
  if(isPerson(c.payer)) bits.push('paga ' + nameOf(c.payer));
  const meta = bits.join(' · ');
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(c.label)}</div>
      ${meta ? `<div class="bill-meta"><span>${escapeHtml(meta)}</span></div>` : ''}
    </div>
    <div class="bill-amt">${fmt(c.amount || 0)}</div>
```

- [ ] **Step 7: Manual verification in browser**

Open `index.html` (guest mode), Gastos → Gastos posibles, edit a rubro (e.g. "Salidas"):
1. With "¿De quién es?"=Compartido, confirm "¿Quién lo paga?" appears alongside "¿Cómo se
   divide?", offering only the two people.
2. Set amount 500, payer=Persona 1, split=Según ingresos. Save — confirm the card shows
   "según ingresos · paga Persona 1".
3. Confirm the Ahorro/Gastos-posibles "Saldos" footer still splits proportionally by income
   (unaffected by `payer` — this was already verified working in the previous session, just
   confirm it's still correct).
4. Confirm Resumen's debt total is unaffected by this rubro (no new debt appears from it,
   unlike Task 2's variable expense).
5. Edit it again — confirm "¿Quién lo paga?" reopens with Persona 1 selected.
6. Switch "¿De quién es?" to "Persona 1" on that same rubro, save — confirm the card no longer
   shows any "paga"/"según ingresos" text (both are now implicit/hidden).
7. Reload — confirm the saved state persists.
8. Reset the rubro back to amount 0, "¿De quién es?"=Compartido, Partes iguales, to leave the
   guest space clean (matches earlier sessions' cleanup habit).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: agrega quién paga (informativo) a gastos posibles"
```

---

### Task 4: Extend `netBalances()` to variable expenses, reuse the payer tag on variable cards

**Files:**
- Modify: `index.html` — `netBalances` (~line 4660ish, exact line shifts after Tasks 1-3),
  `varExpenseBillRow` (~line 3876), new `payerTagHtml` helper near `billRow`.

**Interfaces:**
- Consumes: `expenseOwner`, `isSharedPay`, `personTagClass`, `nameOf`, `escapeHtml` (existing).
- Produces: `payerTagHtml(ex): string`, `accumulateNet(net, list): void` — both local to this
  file, no other task depends on them being named differently.

- [ ] **Step 1: Extract `payerTagHtml` and use it in `billRow`**

In index.html, find:

```js
function billRow(ex){
  const dateStr = new Date(ex.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
  const splitLabel = splitLabelOf(ex);
  // en un gasto propio decir quién paga sobra... salvo que lo haya puesto otro,
  // porque ahí sí queda una deuda entre los dos y hay que poder verla
  // ...y si es compartido tampoco: nadie le debe nada a nadie
  const owner = expenseOwner(ex);
  const showPayer = isSharedPay(ex.paidBy) ? false
    : owner === 'shared' ? peopleCount() > 1 : ex.paidBy !== owner;
  const locked = lockedTemplateFor(ex);
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>${splitLabel ? `<span>·</span><span>${escapeHtml(splitLabel)}</span>` : ''}
        ${showPayer ? `<span class="tag ${personTagClass(ex.paidBy)}">Paga ${escapeHtml(nameOf(ex.paidBy))}</span>` : ''}
        <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
          <input type="checkbox" ${ex.paid ? 'checked' : ''} onchange="toggleExpensePaid('${ex.id}')">
        </label>
      </div>
    </div>
    <div class="bill-amt">${fmt(ex.amount)}</div>
    <button class="bill-edit" onclick="openModal('${ex.id}')" aria-label="Editar">✎</button>
    <button class="bill-del" onclick="deleteExpense('${ex.id}')" aria-label="Eliminar"
      ${locked ? `disabled title="Protegido por el candado de ${escapeHtml(locked.label)} en Ajustes"` : ''}>✕</button>
  </div>`;
}
```

Replace with:

```js
// en un gasto propio decir quién paga sobra... salvo que lo haya puesto otro,
// porque ahí sí queda una deuda entre los dos y hay que poder verla
// ...y si es compartido tampoco: nadie le debe nada a nadie. Misma regla para
// fijos y variables, ahora que los dos generan deuda.
function payerTagHtml(ex){
  const owner = expenseOwner(ex);
  const showPayer = isSharedPay(ex.paidBy) ? false
    : owner === 'shared' ? peopleCount() > 1 : ex.paidBy !== owner;
  return showPayer ? `<span class="tag ${personTagClass(ex.paidBy)}">Paga ${escapeHtml(nameOf(ex.paidBy))}</span>` : '';
}

function billRow(ex){
  const dateStr = new Date(ex.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
  const splitLabel = splitLabelOf(ex);
  const locked = lockedTemplateFor(ex);
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>${splitLabel ? `<span>·</span><span>${escapeHtml(splitLabel)}</span>` : ''}
        ${payerTagHtml(ex)}
        <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
          <input type="checkbox" ${ex.paid ? 'checked' : ''} onchange="toggleExpensePaid('${ex.id}')">
        </label>
      </div>
    </div>
    <div class="bill-amt">${fmt(ex.amount)}</div>
    <button class="bill-edit" onclick="openModal('${ex.id}')" aria-label="Editar">✎</button>
    <button class="bill-del" onclick="deleteExpense('${ex.id}')" aria-label="Eliminar"
      ${locked ? `disabled title="Protegido por el candado de ${escapeHtml(locked.label)} en Ajustes"` : ''}>✕</button>
  </div>`;
}
```

- [ ] **Step 2: Use `payerTagHtml` in `varExpenseBillRow`**

In index.html, find:

```js
function varExpenseBillRow(ex){
  const dateStr = new Date(ex.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
  const splitLabel = splitLabelOf(ex);
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>${splitLabel ? `<span>·</span><span>${escapeHtml(splitLabel)}</span>` : ''}
        <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
```

Replace with:

```js
function varExpenseBillRow(ex){
  const dateStr = new Date(ex.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
  const splitLabel = splitLabelOf(ex);
  return `<div class="bill">
    <div class="bill-main">
      <div class="bill-name">${escapeHtml(ex.desc)}</div>
      <div class="bill-meta">
        <span>${dateStr}</span>${splitLabel ? `<span>·</span><span>${escapeHtml(splitLabel)}</span>` : ''}
        ${payerTagHtml(ex)}
        <label class="bill-paid" title="${ex.paid ? 'Pagado' : 'Marcar como pagado'}">
```

- [ ] **Step 3: Extend `netBalances()` to include `varExpenses`**

In index.html, find:

```js
// cuánto puso cada uno de su bolsillo menos lo que le tocaba, sobre TODOS los
// meses. Positivo = le deben; negativo = debe.
function netBalances(){
  const net = {};
  pids().forEach(id=>{ net[id] = 0; });
  expenses.forEach(ex=>{
    // en un gasto compartido cada uno puso exactamente su parte: no hay deuda
    if(isSharedPay(ex.paidBy)) return;
    if(net[ex.paidBy] != null) net[ex.paidBy] += ex.amount;
    pids().forEach(id=>{ net[id] -= personShareOf(ex, id); });
  });
  return net;
}
```

Replace with:

```js
// cuánto puso cada uno de su bolsillo menos lo que le tocaba, sobre TODOS los
// meses (fijos y variables) — Positivo = le deben; negativo = debe. Gastos
// posibles no entra acá: es una plantilla recurrente sin fecha, no una
// transacción puntual.
function accumulateNet(net, list){
  list.forEach(ex=>{
    // en un gasto compartido cada uno puso exactamente su parte: no hay deuda
    if(isSharedPay(ex.paidBy)) return;
    if(net[ex.paidBy] != null) net[ex.paidBy] += ex.amount;
    pids().forEach(id=>{ net[id] -= personShareOf(ex, id); });
  });
}
function netBalances(){
  const net = {};
  pids().forEach(id=>{ net[id] = 0; });
  accumulateNet(net, expenses);
  accumulateNet(net, varExpenses);
  return net;
}
```

- [ ] **Step 4: Manual verification in browser**

Reload `index.html`. The fixed expense from Task 1 (Compartido, payer=Persona 1, split=Según
ingresos, 1000) and the two variable expenses from Task 2 (Compartido/payer=Persona 1/Según
ingresos/900, and a Persona-2-owned one) should still be there.
1. Confirm the fixed expense's card still shows its "Paga Persona 1" tag (unchanged after the
   `payerTagHtml` extraction).
2. Confirm the Compartido variable expense's card now shows a "Paga Persona 1" tag too (new,
   from this task).
3. Open Resumen — confirm the debt shown is Persona 1's fixed-expense debt AND variable-expense
   debt combined into one number per person (not two separate/conflicting entries) — i.e.
   Persona 2 owes Persona 1 their income share of 1000 + 900 = 1900 total.
4. Clean up everything used across Tasks 1, 2 and 4: delete the fixed expense, both variable
   expenses, and both income entries, leaving the guest space back at zero.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: extiende netBalances a gastos variables y reutiliza el tag de pagador"
```
