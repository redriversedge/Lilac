# Lilac Planned Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship four features: dietary checkbox fix, cursive branding, bulk URL import, and shared grocery list.

**Architecture:** Vanilla JS SPA with Firestore real-time sync. No build step. All code uses ES5 `var` declarations and string concatenation for HTML. Netlify serverless functions handle API calls. New grocery list feature adds a Firestore collection with `onSnapshot` listener. Bulk import reuses the existing parse-recipe function.

**Tech Stack:** Vanilla HTML/CSS/JS, Firebase Firestore (compat SDK), Netlify Functions, Google Fonts

---

### Task 1: Fix dietary tag detection in parse-recipe

**Files:**
- Modify: `netlify/functions/parse-recipe.js` (lines 262-272, mapDietary function)

**Step 1: Add missing dietary mappings**

The `mapDietary` function is missing `nut-free` and `low-carb`. Update it:

```javascript
function mapDietary(diet) {
  if (!diet) return null;
  var lower = String(diet).toLowerCase();
  if (lower.includes('vegetarian')) return 'vegetarian';
  if (lower.includes('vegan')) return 'vegan';
  if (lower.includes('gluten')) return 'gluten-free';
  if (lower.includes('dairy')) return 'dairy-free';
  if (lower.includes('keto') || lower.includes('ketogenic')) return 'keto';
  if (lower.includes('paleo')) return 'paleo';
  if (lower.includes('nut-free') || lower.includes('nut free')) return 'nut-free';
  if (lower.includes('low-carb') || lower.includes('low carb') || lower.includes('lowcarb')) return 'low-carb';
  return null;
}
```

**Step 2: Add dietary detection from keywords/tags in normalizeRecipe**

In the `normalizeRecipe` function, after the `suitableForDiet` block (after line 227), add fallback detection from keywords and tags:

```javascript
  // Also detect dietary from keywords if not already found via suitableForDiet
  if (recipe.dietary.length === 0 && recipe.tags.length > 0) {
    var tagStr = recipe.tags.join(' ').toLowerCase();
    var dietaryChecks = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'nut-free', 'low-carb'];
    dietaryChecks.forEach(function(d) {
      if (tagStr.includes(d) && recipe.dietary.indexOf(d) < 0) {
        recipe.dietary.push(d);
      }
    });
  }
```

**Step 3: Verify AI prompt already requests dietary**

Confirm the AI fallback prompt at line 301 already includes `"dietary"` in the JSON schema. It does. No changes needed.

**Step 4: Commit**

```bash
git add netlify/functions/parse-recipe.js
git commit -m "feat: improve dietary tag detection from JSON-LD keywords"
```

---

### Task 2: Cursive branding

**Files:**
- Modify: `index.html` (lines 11, 28-31, 42-45)
- Modify: `css/lilac.css` (lines 91-94, 182-188, 332-338)

**Step 1: Add Google Font**

In `index.html`, add this line after the manifest link (line 11):

```html
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
```

**Step 2: Update SVG logos to use cursive font**

In `index.html`, update both SVG `<text>` elements. There are two: the auth logo (line 30) and the header logo (line 44).

Auth logo SVG text (line 30), replace:
```
<text x="96" y="130" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="120" font-weight="bold" fill="white">L</text>
```
with:
```
<text x="96" y="130" text-anchor="middle" font-family="'Dancing Script', cursive" font-size="120" font-weight="bold" fill="white">L</text>
```

Header logo SVG text (line 44), same change:
```
<text x="96" y="130" text-anchor="middle" font-family="'Dancing Script', cursive" font-size="120" font-weight="bold" fill="white">L</text>
```

**Step 3: Update CSS for header title and auth title**

In `css/lilac.css`, update `.header-title` (lines 183-188):

```css
.header-title {
  font-family: 'Dancing Script', cursive;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
}
```

Remove the `font-style: italic` since the cursive font handles it.

Update `.auth-title` (lines 333-338):

```css
.auth-title {
  font-family: 'Dancing Script', cursive;
  font-size: 2.5rem;
  color: var(--accent);
  margin-bottom: 0.5rem;
}
```

Remove `font-style: italic` from here too.

**Step 4: Commit**

```bash
git add index.html css/lilac.css
git commit -m "feat: add cursive Dancing Script branding for Lilac logo and title"
```

---

### Task 3: Bulk URL import

**Files:**
- Modify: `index.html` (add bulk import toggle in add-recipe-url-section)
- Modify: `js/recipes.js` (add bulkImportRecipes function)
- Modify: `css/lilac.css` (add bulk import styles)

**Step 1: Add bulk import UI to index.html**

In `index.html`, replace the add-recipe-url-section div (lines 110-118) with:

```html
        <div id="add-recipe-url-section" class="add-url-section">
          <label>Paste a recipe URL</label>
          <div id="single-url-mode">
            <div class="url-input-row">
              <input type="url" id="recipe-url-input" placeholder="https://example.com/recipe..." autocomplete="off">
              <button class="btn btn-accent" onclick="importRecipeFromUrl()" id="import-btn">Import</button>
            </div>
            <div id="import-status" class="import-status hidden"></div>
            <div class="bulk-toggle"><a href="#" onclick="event.preventDefault();toggleBulkImport(true)">Import multiple URLs</a></div>
          </div>
          <div id="bulk-url-mode" class="hidden">
            <textarea id="bulk-url-input" rows="5" placeholder="Paste one URL per line...&#10;https://example.com/recipe-1&#10;https://example.com/recipe-2"></textarea>
            <div id="bulk-import-progress" class="bulk-progress hidden"></div>
            <div class="bulk-actions">
              <a href="#" onclick="event.preventDefault();toggleBulkImport(false)">Single import</a>
              <button class="btn btn-accent" onclick="bulkImportRecipes()" id="bulk-import-btn">Import All</button>
            </div>
          </div>
          <div class="divider-text"><span>or enter manually</span></div>
        </div>
```

**Step 2: Add bulk import styles to css/lilac.css**

Add after the `.import-status.success` block (after line 578):

```css
.bulk-toggle {
  margin-top: 0.75rem;
  font-size: 0.8125rem;
}

.bulk-toggle a {
  color: var(--accent);
  font-weight: 500;
}

#bulk-url-input {
  width: 100%;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.bulk-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bulk-actions a {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.bulk-progress {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
}

.bulk-progress-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  color: var(--text-secondary);
}

.bulk-progress-item.success { color: var(--success); }
.bulk-progress-item.error { color: var(--error); }
.bulk-progress-item.loading { color: var(--accent); }
```

**Step 3: Add bulk import functions to js/recipes.js**

Add at the end of `js/recipes.js`:

```javascript
// --- Bulk URL Import ---

function toggleBulkImport(showBulk) {
  var single = document.getElementById('single-url-mode');
  var bulk = document.getElementById('bulk-url-mode');
  if (showBulk) {
    single.classList.add('hidden');
    bulk.classList.remove('hidden');
  } else {
    single.classList.remove('hidden');
    bulk.classList.add('hidden');
  }
}

function bulkImportRecipes() {
  var textarea = document.getElementById('bulk-url-input');
  var urls = textarea.value.trim().split('\n').map(function(u) { return u.trim(); }).filter(function(u) { return u && u.startsWith('http'); });
  if (urls.length === 0) {
    showToast('No valid URLs found');
    return;
  }

  var progressEl = document.getElementById('bulk-import-progress');
  var importBtn = document.getElementById('bulk-import-btn');
  progressEl.classList.remove('hidden');
  progressEl.innerHTML = '';
  importBtn.disabled = true;

  var succeeded = 0;
  var failed = 0;
  var failedUrls = [];

  function processNext(index) {
    if (index >= urls.length) {
      importBtn.disabled = false;
      showToast(succeeded + ' imported, ' + failed + ' failed');
      // Keep failed URLs in textarea for retry
      textarea.value = failedUrls.join('\n');
      return;
    }

    var url = urls[index];
    var shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;

    // Show loading state
    progressEl.innerHTML += '<div class="bulk-progress-item loading" id="bulk-item-' + index + '">' +
      '<span>&#8987;</span> <span>Importing ' + (index + 1) + ' of ' + urls.length + ': ' + escapeHtml(shortUrl) + '</span></div>';
    progressEl.scrollTop = progressEl.scrollHeight;

    fetch('/.netlify/functions/parse-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var itemEl = document.getElementById('bulk-item-' + index);
      if (data.error) {
        failed++;
        failedUrls.push(url);
        if (itemEl) {
          itemEl.className = 'bulk-progress-item error';
          itemEl.innerHTML = '<span>&#10007;</span> <span>' + escapeHtml(shortUrl) + ' - ' + escapeHtml(data.error) + '</span>';
        }
      } else {
        succeeded++;
        data.url = url;
        addRecipe(data).then(function() {
          if (itemEl) {
            itemEl.className = 'bulk-progress-item success';
            itemEl.innerHTML = '<span>&#10003;</span> <span>' + escapeHtml(data.title || shortUrl) + '</span>';
          }
        });
      }
    })
    .catch(function(err) {
      failed++;
      failedUrls.push(url);
      var itemEl = document.getElementById('bulk-item-' + index);
      if (itemEl) {
        itemEl.className = 'bulk-progress-item error';
        itemEl.innerHTML = '<span>&#10007;</span> <span>' + escapeHtml(shortUrl) + ' - Failed</span>';
      }
    })
    .finally(function() {
      processNext(index + 1);
    });
  }

  processNext(0);
}
```

**Step 4: Commit**

```bash
git add index.html js/recipes.js css/lilac.css
git commit -m "feat: add bulk URL import for importing multiple recipes at once"
```

---

### Task 4: Shared grocery list - Firestore helpers

**Files:**
- Modify: `js/firebase-config.js` (add grocery list Firestore helpers)

**Step 1: Add grocery list Firestore helpers**

Add at the end of `js/firebase-config.js`:

```javascript
// --- Grocery List Firestore Helpers ---

var groceryCollection = db.collection('groceryList');
var GROCERY_DOC_ID = 'shared';

function fbGetGroceryList() {
  return groceryCollection.doc(GROCERY_DOC_ID).get().then(function(doc) {
    if (doc.exists) return doc.data();
    return { items: [], lastUpdated: null };
  });
}

function fbSetGroceryList(data) {
  data.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
  return groceryCollection.doc(GROCERY_DOC_ID).set(data);
}

function fbListenToGroceryList(callback) {
  return groceryCollection.doc(GROCERY_DOC_ID).onSnapshot(function(doc) {
    if (doc.exists) {
      callback(doc.data());
    } else {
      callback({ items: [], lastUpdated: null });
    }
  }, function(error) {
    console.error('Grocery list listener error:', error);
  });
}
```

**Step 2: Commit**

```bash
git add js/firebase-config.js
git commit -m "feat: add Firestore helpers for shared grocery list"
```

---

### Task 5: Shared grocery list - JS logic

**Files:**
- Create: `js/grocery.js`

**Step 1: Create grocery.js**

Create `js/grocery.js` with all grocery list logic:

```javascript
// ============================================================
// LILAC - Grocery List (Shared via Firestore)
// ============================================================

var groceryData = { items: [], lastUpdated: null };
var unsubscribeGrocery = null;

var PANTRY_STAPLES = [
  'salt', 'pepper', 'black pepper', 'oil', 'olive oil', 'vegetable oil',
  'cooking spray', 'butter', 'sugar', 'flour', 'water', 'garlic',
  'onion', 'eggs', 'baking powder', 'baking soda', 'vanilla extract',
  'cinnamon', 'paprika', 'cumin'
];

function startGroceryListener() {
  if (unsubscribeGrocery) unsubscribeGrocery();
  unsubscribeGrocery = fbListenToGroceryList(function(data) {
    groceryData = data || { items: [], lastUpdated: null };
    updateGroceryBadge();
    if (!document.getElementById('grocery-overlay').classList.contains('hidden')) {
      renderGroceryList();
    }
  });
}

function stopGroceryListener() {
  if (unsubscribeGrocery) {
    unsubscribeGrocery();
    unsubscribeGrocery = null;
  }
}

function updateGroceryBadge() {
  var badge = document.getElementById('grocery-badge');
  if (!badge) return;
  var unchecked = groceryData.items.filter(function(item) { return !item.checked; }).length;
  if (unchecked > 0) {
    badge.textContent = unchecked > 99 ? '99+' : unchecked;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function addRecipeToGroceryList(recipeId) {
  var recipe = getRecipeById(recipeId);
  if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
    showToast('No ingredients to add');
    return;
  }

  var user = getCurrentUser();
  var existingIngredients = {};
  groceryData.items.forEach(function(item) {
    existingIngredients[item.recipeId + '|' + item.ingredient.toLowerCase()] = true;
  });

  var newItems = [];
  recipe.ingredients.forEach(function(ing) {
    var key = recipeId + '|' + ing.toLowerCase();
    if (!existingIngredients[key]) {
      newItems.push({
        ingredient: ing,
        recipeId: recipeId,
        recipeTitle: recipe.title,
        addedBy: user,
        checked: false
      });
    }
  });

  if (newItems.length === 0) {
    showToast('Ingredients already on list');
    return;
  }

  var updated = {
    items: groceryData.items.concat(newItems)
  };

  fbSetGroceryList(updated).then(function() {
    showToast(newItems.length + ' ingredients added to list');
  });
}

function toggleGroceryItem(index) {
  if (index < 0 || index >= groceryData.items.length) return;
  groceryData.items[index].checked = !groceryData.items[index].checked;
  fbSetGroceryList({ items: groceryData.items });
}

function clearCheckedGroceryItems() {
  var remaining = groceryData.items.filter(function(item) { return !item.checked; });
  fbSetGroceryList({ items: remaining });
}

function clearAllGroceryItems() {
  fbSetGroceryList({ items: [] });
}

function isPantryStaple(ingredient) {
  var lower = ingredient.toLowerCase();
  for (var i = 0; i < PANTRY_STAPLES.length; i++) {
    // Check if the ingredient contains the staple as a word
    var regex = new RegExp('\\b' + PANTRY_STAPLES[i] + '\\b', 'i');
    if (regex.test(lower)) return true;
  }
  return false;
}

function openGroceryList() {
  document.getElementById('grocery-overlay').classList.remove('hidden');
  renderGroceryList();
}

function closeGroceryList() {
  document.getElementById('grocery-overlay').classList.add('hidden');
}

function renderGroceryList() {
  var content = document.getElementById('grocery-list-content');
  if (!content) return;

  var items = groceryData.items || [];

  if (items.length === 0) {
    content.innerHTML = '<div class="empty-state" style="padding:2rem">' +
      '<div class="empty-state-icon">&#128722;</div>' +
      '<h3>Grocery list is empty</h3>' +
      '<p>Open a recipe and tap "Add to List" to start building your list.</p>' +
      '</div>';
    return;
  }

  // Separate pantry staples from regular items
  var regularItems = [];
  var stapleItems = [];
  items.forEach(function(item, idx) {
    item._idx = idx; // preserve original index for toggle
    if (isPantryStaple(item.ingredient)) {
      stapleItems.push(item);
    } else {
      regularItems.push(item);
    }
  });

  // Group by recipe
  var html = '';

  // Action buttons
  var checkedCount = items.filter(function(i) { return i.checked; }).length;
  html += '<div class="grocery-actions">';
  if (checkedCount > 0) {
    html += '<button class="btn btn-sm btn-secondary" onclick="clearCheckedGroceryItems()">Clear Checked (' + checkedCount + ')</button>';
  }
  html += '<button class="btn btn-sm btn-ghost" onclick="if(confirm(\'Clear entire grocery list?\'))clearAllGroceryItems()">Clear All</button>';
  html += '</div>';

  // Render regular items grouped by recipe
  html += renderGroceryGroup(regularItems, false);

  // Render pantry staples
  if (stapleItems.length > 0) {
    html += '<div class="grocery-section">';
    html += '<h3 class="grocery-section-title pantry-title">Pantry Staples</h3>';
    html += '<p class="grocery-section-subtitle">You may already have these</p>';
    html += renderGroceryItems(stapleItems, true);
    html += '</div>';
  }

  content.innerHTML = html;
}

function renderGroceryGroup(items, dimmed) {
  // Group by recipe
  var groups = {};
  var groupOrder = [];
  items.forEach(function(item) {
    var key = item.recipeId || 'other';
    if (!groups[key]) {
      groups[key] = { title: item.recipeTitle || 'Other', addedBy: item.addedBy, items: [] };
      groupOrder.push(key);
    }
    groups[key].items.push(item);
  });

  var html = '';
  groupOrder.forEach(function(key) {
    var group = groups[key];
    html += '<div class="grocery-section">';
    html += '<h3 class="grocery-section-title">' + escapeHtml(group.title) + '</h3>';
    html += '<span class="grocery-added-by">Added by ' + escapeHtml(group.addedBy || '') + '</span>';
    html += renderGroceryItems(group.items, dimmed);
    html += '</div>';
  });

  return html;
}

function renderGroceryItems(items, dimmed) {
  var html = '<ul class="grocery-item-list">';
  items.forEach(function(item) {
    var checkedClass = item.checked ? ' checked' : '';
    var dimClass = dimmed ? ' dimmed' : '';
    html += '<li class="grocery-item' + checkedClass + dimClass + '" onclick="toggleGroceryItem(' + item._idx + ')">';
    html += '<input type="checkbox"' + (item.checked ? ' checked' : '') + ' class="grocery-checkbox" onclick="event.stopPropagation();toggleGroceryItem(' + item._idx + ')">';
    html += '<span class="grocery-item-text">' + escapeHtml(item.ingredient) + '</span>';
    html += '</li>';
  });
  html += '</ul>';
  return html;
}
```

**Step 2: Commit**

```bash
git add js/grocery.js
git commit -m "feat: add grocery list logic with Firestore sync and pantry staple detection"
```

---

### Task 6: Shared grocery list - HTML and CSS

**Files:**
- Modify: `index.html` (add cart button in header, grocery modal, script tag)
- Modify: `css/lilac.css` (add grocery list styles)

**Step 1: Add cart button to header**

In `index.html`, in the `.header-right` div (line 54), add a cart button before the theme toggle button:

```html
        <button class="header-btn grocery-btn" onclick="openGroceryList()" title="Grocery List">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="grocery-badge hidden" id="grocery-badge">0</span>
        </button>
```

**Step 2: Add grocery list modal**

In `index.html`, after the user menu overlay (after line 253), add:

```html
  <!-- GROCERY LIST -->
  <div id="grocery-overlay" class="overlay hidden" onclick="if(event.target===this)closeGroceryList()">
    <div class="modal grocery-modal">
      <div class="modal-header">
        <h2>Grocery List</h2>
        <button class="close-btn" onclick="closeGroceryList()">&times;</button>
      </div>
      <div class="modal-body" id="grocery-list-content"></div>
    </div>
  </div>
```

**Step 3: Add grocery.js script tag**

In `index.html`, add the grocery script tag after `recommend.js` and before `app.js`:

```html
  <script src="/js/grocery.js"></script>
```

**Step 4: Add grocery list CSS**

Add to end of `css/lilac.css` (before the utility classes section):

```css
/* --- GROCERY LIST --- */
.grocery-btn {
  position: relative;
}

.grocery-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 0.625rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}

.grocery-modal {
  max-height: 92vh;
  max-height: 92dvh;
}

.grocery-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.75rem;
}

.grocery-section {
  margin-bottom: 1.25rem;
}

.grocery-section-title {
  font-family: Georgia, 'Times New Roman', Times, serif;
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.125rem;
}

.grocery-section-title.pantry-title {
  color: var(--text-muted);
}

.grocery-section-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.grocery-added-by {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-bottom: 0.5rem;
}

.grocery-item-list {
  list-style: none;
}

.grocery-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: opacity var(--transition);
}

.grocery-item:last-child {
  border-bottom: none;
}

.grocery-item.checked .grocery-item-text {
  text-decoration: line-through;
  color: var(--text-muted);
}

.grocery-item.dimmed {
  opacity: 0.6;
}

.grocery-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  flex-shrink: 0;
  cursor: pointer;
}

.grocery-item-text {
  font-size: 0.9375rem;
  flex: 1;
}
```

**Step 5: Commit**

```bash
git add index.html css/lilac.css
git commit -m "feat: add grocery list modal, cart icon, and styles"
```

---

### Task 7: Wire up grocery list to recipe detail and app init

**Files:**
- Modify: `js/ui.js` (add "Add to List" button in recipe detail)
- Modify: `js/app.js` (start grocery listener on init)

**Step 1: Add "Add to List" button in recipe detail**

In `js/ui.js`, in the `openRecipeDetail` function, find the recipe-actions section (around line 174-178). Add the "Add to List" button after the Save button:

Replace the actions bar block:
```javascript
  // Actions bar
  html += '<div class="recipe-actions">';
  html += '<button class="btn ' + (saved ? 'btn-accent' : 'btn-outline') + '" onclick="toggleSaveRecipe(\'' + recipe.id + '\');setTimeout(function(){openRecipeDetail(\'' + recipe.id + '\')},300)">' + (saved ? '&#9829; Saved' : '&#9825; Save') + '</button>';
  html += '<button class="btn btn-secondary" onclick="markRecipeCooked(\'' + recipe.id + '\');showToast(\'Marked as cooked!\');setTimeout(function(){openRecipeDetail(\'' + recipe.id + '\')},300)">&#127373; Cooked' + (cookedCount > 0 ? ' (' + cookedCount + ')' : '') + '</button>';
  html += '<button class="btn btn-ghost" onclick="confirmDeleteRecipe(\'' + recipe.id + '\')">&#128465;</button>';
  html += '</div>';
```

With:
```javascript
  // Actions bar
  html += '<div class="recipe-actions">';
  html += '<button class="btn ' + (saved ? 'btn-accent' : 'btn-outline') + '" onclick="toggleSaveRecipe(\'' + recipe.id + '\');setTimeout(function(){openRecipeDetail(\'' + recipe.id + '\')},300)">' + (saved ? '&#9829; Saved' : '&#9825; Save') + '</button>';
  html += '<button class="btn btn-secondary" onclick="addRecipeToGroceryList(\'' + recipe.id + '\')">&#128722; Add to List</button>';
  html += '<button class="btn btn-secondary" onclick="markRecipeCooked(\'' + recipe.id + '\');showToast(\'Marked as cooked!\');setTimeout(function(){openRecipeDetail(\'' + recipe.id + '\')},300)">&#127373; Cooked' + (cookedCount > 0 ? ' (' + cookedCount + ')' : '') + '</button>';
  html += '<button class="btn btn-ghost" onclick="confirmDeleteRecipe(\'' + recipe.id + '\')">&#128465;</button>';
  html += '</div>';
```

**Step 2: Start grocery listener in app init**

In `js/app.js`, in the `initApp` function (line 198-202), add grocery listener start:

```javascript
function initApp() {
  startRecipeListener();
  startGroceryListener();
  updateUserAvatar(getCurrentUser());
  renderCurrentView();
}
```

**Step 3: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat: wire up grocery list to recipe detail and app initialization"
```

---

### Task 8: Update CLAUDE.md and clean up

**Files:**
- Modify: `CLAUDE.md` (update planned features, add grocery.js to key files)

**Step 1: Update CLAUDE.md**

Remove the four planned features from the list (they're now built). Add `js/grocery.js` to the Key Files section. Update the Architecture section to mention the grocery list collection.

**Step 2: Test manually**

Open the app in a browser and verify:
1. Import a recipe via URL - dietary checkboxes should auto-check
2. Logo and header show cursive "L" and "lilac"
3. Bulk import: toggle to multi-URL mode, paste 2+ URLs, import works with progress
4. Grocery list: open a recipe, tap "Add to List", cart badge shows count, open grocery modal, items grouped by recipe, pantry staples at bottom, check/uncheck works, clear works

**Step 3: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect shipped features"
```
