// ============================================================
// LILAC - Recipe Data Layer (Firestore CRUD + local cache)
// ============================================================

// Local cache of all recipes (updated by real-time listener)
var allRecipes = [];
var unsubscribeRecipes = null;

// --- Start Real-Time Listener ---
function startRecipeListener() {
  if (unsubscribeRecipes) unsubscribeRecipes();
  unsubscribeRecipes = fbListenToRecipes(function(recipes) {
    allRecipes = recipes;
    onRecipesUpdated();
  });
}

function stopRecipeListener() {
  if (unsubscribeRecipes) {
    unsubscribeRecipes();
    unsubscribeRecipes = null;
  }
}

// Called whenever recipes change (re-render current view)
function onRecipesUpdated() {
  renderCurrentView();
}

// --- Recipe CRUD ---

function addRecipe(recipeData) {
  var user = getCurrentUser();
  recipeData.addedBy = user;
  recipeData.savedBy = [user]; // auto-save for the person who added it
  recipeData.ratings = {};
  recipeData.notes = {};
  recipeData.cookedBy = {};
  recipeData.dietary = recipeData.dietary || [];
  recipeData.ingredients = recipeData.ingredients || [];
  recipeData.instructions = recipeData.instructions || [];
  recipeData.tags = recipeData.tags || [];
  return fbAddRecipe(recipeData);
}

function updateRecipe(docId, updates) {
  return fbUpdateRecipe(docId, updates);
}

function deleteRecipe(docId) {
  return fbDeleteRecipe(docId);
}

function getRecipeById(docId) {
  for (var i = 0; i < allRecipes.length; i++) {
    if (allRecipes[i].id === docId) return allRecipes[i];
  }
  return null;
}

// --- Save/Unsave ---

function toggleSaveRecipe(docId) {
  var user = getCurrentUser();
  return fbToggleSave(docId, user);
}

function isRecipeSaved(recipe) {
  var user = getCurrentUser();
  return recipe.savedBy && recipe.savedBy.indexOf(user) >= 0;
}

// --- Rating ---

function rateRecipe(docId, rating) {
  var user = getCurrentUser();
  return fbSetRating(docId, user, rating);
}

function getMyRating(recipe) {
  var user = getCurrentUser();
  return (recipe.ratings && recipe.ratings[user]) || 0;
}

function getAvgRating(recipe) {
  if (!recipe.ratings) return 0;
  var keys = Object.keys(recipe.ratings);
  if (keys.length === 0) return 0;
  var sum = 0;
  keys.forEach(function(k) { sum += recipe.ratings[k]; });
  return sum / keys.length;
}

// --- Cooked ---

function markRecipeCooked(docId) {
  var user = getCurrentUser();
  return fbMarkCooked(docId, user);
}

function getMyCookedCount(recipe) {
  var user = getCurrentUser();
  return (recipe.cookedBy && recipe.cookedBy[user]) || 0;
}

function getTotalCookedCount(recipe) {
  if (!recipe.cookedBy) return 0;
  var total = 0;
  Object.keys(recipe.cookedBy).forEach(function(k) { total += recipe.cookedBy[k]; });
  return total;
}

// --- Notes ---

function setRecipeNotes(docId, notes) {
  var user = getCurrentUser();
  return fbSetNotes(docId, user, notes);
}

function getMyNotes(recipe) {
  var user = getCurrentUser();
  return (recipe.notes && recipe.notes[user]) || '';
}

// --- Filter & Search ---

function filterRecipes(recipes, filters) {
  return recipes.filter(function(r) {
    if (filters.search) {
      var q = filters.search.toLowerCase();
      var searchable = (r.title || '').toLowerCase() + ' ' +
        (r.cuisine || '').toLowerCase() + ' ' +
        (r.description || '').toLowerCase() + ' ' +
        (r.tags || []).join(' ').toLowerCase() + ' ' +
        (r.ingredients || []).join(' ').toLowerCase();
      if (searchable.indexOf(q) < 0) return false;
    }
    if (filters.cuisine && r.cuisine !== filters.cuisine) return false;
    if (filters.mealType && r.mealType !== filters.mealType) return false;
    if (filters.difficulty && r.difficulty !== filters.difficulty) return false;
    if (filters.gathering && r.gathering !== filters.gathering) return false;
    if (filters.dietary && filters.dietary.length > 0) {
      var rd = r.dietary || [];
      for (var i = 0; i < filters.dietary.length; i++) {
        if (rd.indexOf(filters.dietary[i]) < 0) return false;
      }
    }
    if (filters.prepTime) {
      var total = r.totalTime || r.prepTime || 0;
      if (filters.prepTime === 'quick' && total > 30) return false;
      if (filters.prepTime === 'medium' && (total <= 30 || total > 60)) return false;
      if (filters.prepTime === 'long' && total <= 60) return false;
    }
    if (filters.source) {
      var tags = r.tags || [];
      if (filters.source === 'nyt-cooking') {
        if (tags.indexOf('nyt-cooking') < 0) return false;
      } else if (filters.source === 'other') {
        if (tags.indexOf('nyt-cooking') >= 0) return false;
      }
    }
    if (filters.savedOnly) {
      if (!isRecipeSaved(r)) return false;
    }
    return true;
  });
}

function sortRecipes(recipes, sortBy) {
  var sorted = recipes.slice();
  switch (sortBy) {
    case 'newest':
      sorted.sort(function(a, b) {
        var da = a.dateAdded ? (a.dateAdded.toDate ? a.dateAdded.toDate() : new Date(a.dateAdded)) : new Date(0);
        var db2 = b.dateAdded ? (b.dateAdded.toDate ? b.dateAdded.toDate() : new Date(b.dateAdded)) : new Date(0);
        return db2 - da;
      });
      break;
    case 'rating':
      sorted.sort(function(a, b) { return getAvgRating(b) - getAvgRating(a); });
      break;
    case 'prepTime':
      sorted.sort(function(a, b) { return (a.totalTime || a.prepTime || 999) - (b.totalTime || b.prepTime || 999); });
      break;
    case 'mostCooked':
      sorted.sort(function(a, b) { return getTotalCookedCount(b) - getTotalCookedCount(a); });
      break;
    case 'title':
      sorted.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });
      break;
  }
  return sorted;
}

// --- Taste Profile ---

function buildTasteProfile() {
  var profile = {
    cuisineCounts: {},
    mealTypeCounts: {},
    ingredientCounts: {},
    dietaryCounts: {},
    totalRecipes: allRecipes.length,
    avgPrepTime: 0,
    topCuisines: [],
    topIngredients: []
  };

  var totalTime = 0;
  var timeCount = 0;

  allRecipes.forEach(function(r) {
    if (r.cuisine) {
      profile.cuisineCounts[r.cuisine] = (profile.cuisineCounts[r.cuisine] || 0) + 1;
    }
    if (r.mealType) {
      profile.mealTypeCounts[r.mealType] = (profile.mealTypeCounts[r.mealType] || 0) + 1;
    }
    if (r.dietary) {
      r.dietary.forEach(function(d) {
        profile.dietaryCounts[d] = (profile.dietaryCounts[d] || 0) + 1;
      });
    }
    if (r.ingredients) {
      r.ingredients.forEach(function(ing) {
        // Extract key ingredient words (skip measurements)
        var words = ing.toLowerCase().replace(/[0-9\/.,]+/g, '').trim().split(/\s+/);
        var key = words.slice(-2).join(' ').trim();
        if (key.length > 2) {
          profile.ingredientCounts[key] = (profile.ingredientCounts[key] || 0) + 1;
        }
      });
    }
    var t = r.totalTime || r.prepTime || 0;
    if (t > 0) {
      totalTime += t;
      timeCount++;
    }
  });

  profile.avgPrepTime = timeCount > 0 ? Math.round(totalTime / timeCount) : 0;

  // Top cuisines
  profile.topCuisines = Object.keys(profile.cuisineCounts)
    .sort(function(a, b) { return profile.cuisineCounts[b] - profile.cuisineCounts[a]; })
    .slice(0, 5);

  // Top ingredients
  profile.topIngredients = Object.keys(profile.ingredientCounts)
    .sort(function(a, b) { return profile.ingredientCounts[b] - profile.ingredientCounts[a]; })
    .slice(0, 10);

  return profile;
}

// --- URL Deduplication ---

function normalizeUrl(url) {
  if (!url) return '';
  try {
    var u = new URL(url);
    var normalized = u.protocol + '//' + u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '');
    return normalized.toLowerCase();
  } catch (e) {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

function findRecipeByUrl(url) {
  if (!url) return null;
  var normalized = normalizeUrl(url);
  if (!normalized) return null;
  for (var i = 0; i < allRecipes.length; i++) {
    if (allRecipes[i].url && normalizeUrl(allRecipes[i].url) === normalized) {
      return allRecipes[i];
    }
  }
  return null;
}

function isNytCookingUrl(url) {
  return url && url.indexOf('cooking.nytimes.com') >= 0;
}

// --- Import from URL ---

function importRecipeFromUrl(urlOverride) {
  var urlInput = document.getElementById('recipe-url-input');
  var url = urlOverride || (urlInput ? urlInput.value.trim() : '');
  if (!url) return;

  var statusEl = document.getElementById('import-status');
  var importBtn = document.getElementById('import-btn');

  // Check for duplicate before fetching
  var existing = findRecipeByUrl(url);
  if (existing) {
    var user = getCurrentUser();
    if (existing.savedBy && existing.savedBy.indexOf(user) < 0) {
      fbToggleSave(existing.id, user);
      statusEl.className = 'import-status success';
      statusEl.textContent = 'Already saved! Added to your collection.';
    } else {
      statusEl.className = 'import-status success';
      statusEl.textContent = 'This recipe is already in your collection.';
    }
    statusEl.classList.remove('hidden');
    return;
  }

  statusEl.className = 'import-status loading';
  statusEl.textContent = 'Importing recipe...';
  statusEl.classList.remove('hidden');

  if (importBtn) importBtn.disabled = true;

  fetch('/.netlify/functions/parse-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) {
      statusEl.className = 'import-status error';
      statusEl.textContent = 'Error: ' + data.error;
      return;
    }
    statusEl.className = 'import-status success';
    statusEl.textContent = 'Recipe imported! Review and save below.';
    populateRecipeForm(data, url);
  })
  .catch(function(err) {
    statusEl.className = 'import-status error';
    statusEl.textContent = 'Failed to import. Try entering details manually.';
    console.error('Import error:', err);
  })
  .finally(function() {
    if (importBtn) importBtn.disabled = false;
  });
}

function populateRecipeForm(data, url) {
  setFormValue('recipe-title', data.title);
  setFormValue('recipe-description', data.description);
  setFormValue('recipe-image', data.image);
  setFormValue('recipe-prep-time', data.prepTime);
  setFormValue('recipe-cook-time', data.cookTime);
  setFormValue('recipe-servings', data.servings);

  // Match cuisine to select options (case-insensitive)
  setSelectBestMatch('recipe-cuisine', data.cuisine);

  // Match meal type to select options (case-insensitive)
  setSelectBestMatch('recipe-meal-type', data.mealType);

  // Match difficulty to select options (case-insensitive)
  setSelectBestMatch('recipe-difficulty', data.difficulty);

  // Infer gathering size from servings if not provided
  var gathering = data.gathering || inferGathering(data.servings);
  if (gathering) {
    setSelectBestMatch('recipe-gathering', gathering);
  }

  if (data.ingredients && data.ingredients.length) {
    setFormValue('recipe-ingredients', data.ingredients.join('\n'));
  }
  if (data.instructions && data.instructions.length) {
    setFormValue('recipe-instructions', data.instructions.join('\n'));
  }
  if (data.tags && data.tags.length) {
    setFormValue('recipe-tags', data.tags.join(', '));
  }
  // Store URL in a data attribute on the form
  var form = document.getElementById('add-recipe-form');
  if (form) form.dataset.recipeUrl = url || '';
  // Set dietary checkboxes
  if (data.dietary) {
    var checkboxes = document.querySelectorAll('#dietary-checkboxes input[type="checkbox"]');
    checkboxes.forEach(function(cb) {
      cb.checked = data.dietary.indexOf(cb.value) >= 0;
    });
  }
}

// Match a value to a select element's options case-insensitively
function setSelectBestMatch(selectId, value) {
  if (!value) return;
  var el = document.getElementById(selectId);
  if (!el) return;
  var lower = String(value).toLowerCase().trim();
  for (var i = 0; i < el.options.length; i++) {
    if (el.options[i].value.toLowerCase() === lower) {
      el.value = el.options[i].value;
      return;
    }
  }
  // Try partial match (e.g. "main course" -> "dinner")
  for (var j = 0; j < el.options.length; j++) {
    if (el.options[j].value && lower.indexOf(el.options[j].value.toLowerCase()) >= 0) {
      el.value = el.options[j].value;
      return;
    }
  }
}

// Infer gathering size from servings string
function inferGathering(servings) {
  if (!servings) return '';
  var num = parseInt(String(servings).replace(/[^0-9]/g, ''), 10);
  if (!num || isNaN(num)) return '';
  if (num <= 1) return 'solo';
  if (num <= 2) return 'couple';
  if (num <= 6) return 'family';
  return 'party';
}

function setFormValue(id, value) {
  var el = document.getElementById(id);
  if (el && value !== undefined && value !== null) {
    el.value = value;
  }
}

function saveNewRecipe(event) {
  event.preventDefault();
  var form = document.getElementById('add-recipe-form');

  var dietary = [];
  var checkboxes = document.querySelectorAll('#dietary-checkboxes input[type="checkbox"]:checked');
  checkboxes.forEach(function(cb) { dietary.push(cb.value); });

  var ingredientsRaw = (document.getElementById('recipe-ingredients').value || '').trim();
  var instructionsRaw = (document.getElementById('recipe-instructions').value || '').trim();

  var recipeData = {
    url: form.dataset.recipeUrl || '',
    title: document.getElementById('recipe-title').value.trim(),
    description: document.getElementById('recipe-description').value.trim(),
    image: document.getElementById('recipe-image').value.trim(),
    prepTime: parseInt(document.getElementById('recipe-prep-time').value) || 0,
    cookTime: parseInt(document.getElementById('recipe-cook-time').value) || 0,
    totalTime: (parseInt(document.getElementById('recipe-prep-time').value) || 0) + (parseInt(document.getElementById('recipe-cook-time').value) || 0),
    servings: document.getElementById('recipe-servings').value.trim(),
    cuisine: document.getElementById('recipe-cuisine').value,
    mealType: document.getElementById('recipe-meal-type').value,
    difficulty: document.getElementById('recipe-difficulty').value,
    gathering: document.getElementById('recipe-gathering').value,
    dietary: dietary,
    ingredients: ingredientsRaw ? ingredientsRaw.split('\n').filter(function(l) { return l.trim(); }) : [],
    instructions: instructionsRaw ? instructionsRaw.split('\n').filter(function(l) { return l.trim(); }) : [],
    tags: document.getElementById('recipe-tags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
  };

  // Auto-tag NYT Cooking recipes
  if (isNytCookingUrl(recipeData.url) && recipeData.tags.indexOf('nyt-cooking') < 0) {
    recipeData.tags.push('nyt-cooking');
  }

  if (!recipeData.title) {
    showToast('Please enter a recipe title');
    return false;
  }

  addRecipe(recipeData).then(function() {
    showToast('Recipe saved!');
    closeAddRecipe();
    resetRecipeForm();
  }).catch(function(err) {
    showToast('Error saving recipe');
    console.error('Save error:', err);
  });

  return false;
}

// --- Batch Import ---

function toggleBatchImport() {
  var section = document.getElementById('batch-import-section');
  var btn = document.getElementById('batch-toggle-btn');
  if (section.classList.contains('hidden')) {
    section.classList.remove('hidden');
    btn.textContent = 'Hide batch import';
  } else {
    section.classList.add('hidden');
    btn.textContent = 'Batch import multiple URLs';
  }
}

function toggleNytImport() {
  var section = document.getElementById('nyt-import-section');
  var btn = document.getElementById('nyt-toggle-btn');
  if (section.classList.contains('hidden')) {
    section.classList.remove('hidden');
    btn.textContent = 'Hide NYT import';
    // Also show batch import since that's where they paste URLs
    var batchSection = document.getElementById('batch-import-section');
    var batchBtn = document.getElementById('batch-toggle-btn');
    if (batchSection && batchSection.classList.contains('hidden')) {
      batchSection.classList.remove('hidden');
      batchBtn.textContent = 'Hide batch import';
    }
  } else {
    section.classList.add('hidden');
    btn.textContent = 'Import from NYT Cooking';
  }
}

function startBatchImport() {
  var textarea = document.getElementById('batch-url-input');
  var raw = (textarea ? textarea.value : '').trim();
  if (!raw) return;

  var urls = raw.split('\n').map(function(line) { return line.trim(); }).filter(function(line) {
    return line && (line.startsWith('http://') || line.startsWith('https://'));
  });

  if (urls.length === 0) {
    showToast('No valid URLs found. Each URL should start with http:// or https://');
    return;
  }

  var statusEl = document.getElementById('batch-status');
  statusEl.classList.remove('hidden');
  statusEl.innerHTML = '';

  var batchBtn = document.getElementById('batch-import-btn');
  batchBtn.disabled = true;
  batchBtn.textContent = 'Importing...';

  // Create status items for each URL
  var items = [];
  urls.forEach(function(url, idx) {
    var div = document.createElement('div');
    div.className = 'batch-status-item pending';
    div.innerHTML = '<span class="batch-url-text">' + escapeHtml(truncateUrl(url)) + '</span><span>Waiting...</span>';
    statusEl.appendChild(div);
    items.push({ url: url, el: div });
  });

  // Process URLs sequentially
  var successCount = 0;
  var failCount = 0;

  function processNext(idx) {
    if (idx >= items.length) {
      // Done - show summary
      batchBtn.disabled = false;
      batchBtn.textContent = 'Import All';
      var summary = document.createElement('div');
      summary.className = 'batch-summary';
      summary.textContent = successCount + ' of ' + items.length + ' recipes imported successfully';
      if (failCount > 0) {
        summary.style.background = 'var(--warning)';
        summary.style.color = 'white';
      }
      statusEl.appendChild(summary);
      return;
    }

    var item = items[idx];
    item.el.className = 'batch-status-item loading';
    item.el.innerHTML = '<span class="batch-url-text">' + escapeHtml(truncateUrl(item.url)) + '</span><span>Importing...</span>';

    // Check for duplicate before fetching
    var existing = findRecipeByUrl(item.url);
    if (existing) {
      var user = getCurrentUser();
      if (existing.savedBy && existing.savedBy.indexOf(user) < 0) {
        fbToggleSave(existing.id, user);
      }
      item.el.className = 'batch-status-item success';
      item.el.innerHTML = '<span class="batch-url-text">' + escapeHtml(existing.title || truncateUrl(item.url)) + '</span><span>Already saved</span>';
      successCount++;
      processNext(idx + 1);
      return;
    }

    fetch('/.netlify/functions/parse-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: item.url })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.error) {
        item.el.className = 'batch-status-item error';
        item.el.innerHTML = '<span class="batch-url-text">' + escapeHtml(truncateUrl(item.url)) + '</span><span>Failed</span>';
        failCount++;
        processNext(idx + 1);
        return;
      }

      // Auto-tag NYT Cooking recipes
      var tags = data.tags || [];
      if (isNytCookingUrl(item.url) && tags.indexOf('nyt-cooking') < 0) {
        tags.push('nyt-cooking');
      }

      // Auto-save the recipe directly
      var recipeData = {
        url: item.url,
        title: data.title || '',
        description: data.description || '',
        image: data.image || '',
        prepTime: parseInt(data.prepTime) || 0,
        cookTime: parseInt(data.cookTime) || 0,
        totalTime: (parseInt(data.prepTime) || 0) + (parseInt(data.cookTime) || 0),
        servings: data.servings || '',
        cuisine: data.cuisine || '',
        mealType: data.mealType || '',
        difficulty: data.difficulty || '',
        gathering: data.gathering || '',
        dietary: data.dietary || [],
        ingredients: data.ingredients || [],
        instructions: data.instructions || [],
        tags: tags
      };

      addRecipe(recipeData).then(function() {
        item.el.className = 'batch-status-item success';
        item.el.innerHTML = '<span class="batch-url-text">' + escapeHtml(data.title || truncateUrl(item.url)) + '</span><span>Saved</span>';
        successCount++;
        processNext(idx + 1);
      }).catch(function() {
        item.el.className = 'batch-status-item error';
        item.el.innerHTML = '<span class="batch-url-text">' + escapeHtml(truncateUrl(item.url)) + '</span><span>Save failed</span>';
        failCount++;
        processNext(idx + 1);
      });
    })
    .catch(function() {
      item.el.className = 'batch-status-item error';
      item.el.innerHTML = '<span class="batch-url-text">' + escapeHtml(truncateUrl(item.url)) + '</span><span>Failed</span>';
      failCount++;
      processNext(idx + 1);
    });
  }

  processNext(0);
}

function truncateUrl(url) {
  try {
    var u = new URL(url);
    var path = u.pathname.length > 30 ? u.pathname.substring(0, 30) + '...' : u.pathname;
    return u.hostname + path;
  } catch (e) {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
}

function resetRecipeForm() {
  var form = document.getElementById('add-recipe-form');
  if (form) {
    form.reset();
    form.dataset.recipeUrl = '';
  }
  var status = document.getElementById('import-status');
  if (status) status.classList.add('hidden');
  // Reset batch import
  var batchSection = document.getElementById('batch-import-section');
  if (batchSection) batchSection.classList.add('hidden');
  var batchInput = document.getElementById('batch-url-input');
  if (batchInput) batchInput.value = '';
  var batchStatus = document.getElementById('batch-status');
  if (batchStatus) { batchStatus.classList.add('hidden'); batchStatus.innerHTML = ''; }
  var batchToggle = document.getElementById('batch-toggle-btn');
  if (batchToggle) batchToggle.textContent = 'Batch import multiple URLs';
  var batchBtn = document.getElementById('batch-import-btn');
  if (batchBtn) { batchBtn.disabled = false; batchBtn.textContent = 'Import All'; }
}
