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
    if (!groceryData.items) groceryData.items = [];
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
  console.log('[Grocery] addRecipeToGroceryList called with:', recipeId);

  var recipe = getRecipeById(recipeId);
  console.log('[Grocery] Recipe found:', !!recipe, recipe ? recipe.title : 'null');

  if (!recipe) {
    showToast('Recipe not found - try reopening it');
    console.error('[Grocery] Recipe not found for id:', recipeId);
    var btn = document.getElementById('add-to-list-btn');
    if (btn) { btn.textContent = '\uD83D\uDED2 Add to List'; btn.disabled = false; }
    return;
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    showToast('This recipe has no ingredients listed');
    console.warn('[Grocery] No ingredients for recipe:', recipe.title);
    var btn = document.getElementById('add-to-list-btn');
    if (btn) { btn.textContent = '\uD83D\uDED2 Add to List'; btn.disabled = false; }
    return;
  }

  console.log('[Grocery] Ingredients count:', recipe.ingredients.length);

  var user = getCurrentUser();
  console.log('[Grocery] Current user:', user);

  if (!user) {
    showToast('Please select a user first');
    return;
  }

  var currentItems = groceryData.items || [];
  console.log('[Grocery] Current grocery items:', currentItems.length);

  var existingIngredients = {};
  currentItems.forEach(function(item) {
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

  console.log('[Grocery] Adding', newItems.length, 'new items to list');

  // Show immediate feedback
  showToast('Adding ' + newItems.length + ' ingredients...');

  var updated = {
    items: currentItems.concat(newItems)
  };

  fbSetGroceryList(updated).then(function() {
    console.log('[Grocery] Successfully saved to Firestore');
    showToast(newItems.length + ' ingredients added to list');
    var btn = document.getElementById('add-to-list-btn');
    if (btn) { btn.textContent = '\uD83D\uDED2 Added!'; setTimeout(function() { btn.textContent = '\uD83D\uDED2 Add to List'; btn.disabled = false; }, 2000); }
  }).catch(function(err) {
    console.error('[Grocery] Firestore write FAILED:', err);
    showToast('Error: ' + (err.message || 'Failed to save grocery list'));
    var btn = document.getElementById('add-to-list-btn');
    if (btn) { btn.textContent = '\uD83D\uDED2 Add to List'; btn.disabled = false; }
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
    var regex = new RegExp('\\b' + PANTRY_STAPLES[i] + '\\b', 'i');
    if (regex.test(lower)) return true;
  }
  return false;
}

function openGroceryList() {
  document.getElementById('grocery-overlay').classList.remove('hidden');

  // Always restart the listener to recover from any prior errors
  startGroceryListener();

  // Also do a one-time read as immediate fallback
  fbGetGroceryList().then(function(data) {
    if (data && data.items && data.items.length > 0) {
      groceryData = data;
      if (!groceryData.items) groceryData.items = [];
      updateGroceryBadge();
      renderGroceryList();
    }
  }).catch(function(err) {
    console.error('[Grocery] Fallback read failed:', err);
  });

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

  var regularItems = [];
  var stapleItems = [];
  items.forEach(function(item, idx) {
    item._idx = idx;
    if (isPantryStaple(item.ingredient)) {
      stapleItems.push(item);
    } else {
      regularItems.push(item);
    }
  });

  var html = '';

  var checkedCount = items.filter(function(i) { return i.checked; }).length;
  html += '<div class="grocery-actions">';
  if (checkedCount > 0) {
    html += '<button class="btn btn-sm btn-secondary" onclick="clearCheckedGroceryItems()">Clear Checked (' + checkedCount + ')</button>';
  }
  html += '<button class="btn btn-sm btn-ghost" onclick="if(confirm(\'Clear entire grocery list?\'))clearAllGroceryItems()">Clear All</button>';
  html += '</div>';

  html += renderGroceryGroup(regularItems);

  if (stapleItems.length > 0) {
    html += '<div class="grocery-section">';
    html += '<h3 class="grocery-section-title pantry-title">Pantry Staples</h3>';
    html += '<p class="grocery-section-subtitle">You may already have these</p>';
    html += renderGroceryItems(stapleItems, true);
    html += '</div>';
  }

  content.innerHTML = html;
}

function renderGroceryGroup(items) {
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
    html += renderGroceryItems(group.items, false);
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
