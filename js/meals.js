// ============================================================
// LILAC - Meals This Week (Shared via Firestore)
// ============================================================

var mealsData = { recipes: [], lastUpdated: null };
var unsubscribeMeals = null;

function startMealsListener() {
  if (unsubscribeMeals) unsubscribeMeals();
  unsubscribeMeals = fbListenToWeeklyMeals(function(data) {
    mealsData = data || { recipes: [], lastUpdated: null };
    if (!mealsData.recipes) mealsData.recipes = [];
    updateMealsBadge();
    if (currentTab === 'meals') {
      renderCurrentView();
    }
  });
}

function stopMealsListener() {
  if (unsubscribeMeals) {
    unsubscribeMeals();
    unsubscribeMeals = null;
  }
}

function updateMealsBadge() {
  var badge = document.getElementById('meals-badge');
  if (!badge) return;
  var count = mealsData.recipes.length;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function addRecipeToWeeklyMeals(recipeId) {
  var recipe = getRecipeById(recipeId);
  if (!recipe) {
    showToast('Recipe not found');
    return;
  }

  var current = mealsData.recipes || [];

  // Check if already added
  for (var i = 0; i < current.length; i++) {
    if (current[i].recipeId === recipeId) {
      showToast('Already on this week\'s menu');
      return;
    }
  }

  var user = getCurrentUser();
  current.push({
    recipeId: recipeId,
    title: recipe.title || 'Untitled',
    image: recipe.image || '',
    cuisine: recipe.cuisine || '',
    totalTime: recipe.totalTime || recipe.prepTime || 0,
    addedBy: user,
    addedAt: new Date().toISOString()
  });

  fbSetWeeklyMeals({ recipes: current }).then(function() {
    showToast('Added to this week\'s meals');
  }).catch(function(err) {
    showToast('Error: ' + (err.message || 'Failed to update meals'));
  });
}

function removeRecipeFromWeeklyMeals(recipeId) {
  var current = mealsData.recipes || [];
  var filtered = current.filter(function(item) {
    return item.recipeId !== recipeId;
  });
  fbSetWeeklyMeals({ recipes: filtered }).then(function() {
    showToast('Removed from this week\'s meals');
  });
}

function clearAllWeeklyMeals() {
  fbSetWeeklyMeals({ recipes: [] }).then(function() {
    showToast('Cleared all meals for the week');
  });
}

function isRecipeInWeeklyMeals(recipeId) {
  var recipes = mealsData.recipes || [];
  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i].recipeId === recipeId) return true;
  }
  return false;
}

// --- Meals View (Tab) ---

function renderMealsView() {
  var html = '<div class="meals-view">';
  html += '<div class="meals-view-header">';
  html += '<h1>Meals This Week</h1>';

  var recipes = mealsData.recipes || [];
  if (recipes.length > 0) {
    html += '<p>' + recipes.length + ' meal' + (recipes.length !== 1 ? 's' : '') + ' planned</p>';
  }
  html += '</div>';

  html += '<div id="meals-tab-content">';
  html += renderMealsTabContent();
  html += '</div>';

  html += '</div>';
  return html;
}

function renderMealsTabContent() {
  var recipes = mealsData.recipes || [];

  if (recipes.length === 0) {
    return '<div class="empty-state" style="padding:2rem">' +
      '<div class="empty-state-icon">&#127869;</div>' +
      '<h3>No meals planned yet</h3>' +
      '<p>Browse recipes and tap "Cook this Week" to add meals to your plan.</p>' +
      '</div>';
  }

  var html = '';

  // Actions
  html += '<div class="meals-actions">';
  html += '<button class="btn btn-sm btn-ghost" onclick="if(confirm(\'Clear all meals for the week?\'))clearAllWeeklyMeals()">Clear All</button>';
  html += '</div>';

  // Meal cards
  html += '<div class="meals-list">';
  recipes.forEach(function(meal) {
    var fullRecipe = getRecipeById(meal.recipeId);
    var timeStr = meal.totalTime > 0 ? meal.totalTime + ' min' : '';

    html += '<div class="meal-item" onclick="openRecipeDetail(\'' + escapeHtml(meal.recipeId) + '\')">';
    if (meal.image) {
      html += '<img class="meal-item-img" src="' + escapeHtml(meal.image) + '" alt="' + escapeHtml(meal.title) + '" loading="lazy" onerror="this.outerHTML=\'<div class=\\\'meal-item-img-placeholder\\\'>&#127860;</div>\'">';
    } else {
      html += '<div class="meal-item-img-placeholder">&#127860;</div>';
    }
    html += '<div class="meal-item-info">';
    html += '<div class="meal-item-title">' + escapeHtml(meal.title) + '</div>';
    html += '<div class="meal-item-meta">';
    if (timeStr) html += '<span>&#9201; ' + timeStr + '</span>';
    if (meal.cuisine) html += '<span>' + escapeHtml(meal.cuisine) + '</span>';
    html += '</div>';
    html += '<div class="meal-item-added">Added by ' + escapeHtml(meal.addedBy || 'Unknown') + '</div>';
    html += '</div>';
    html += '<button class="meal-item-remove" onclick="event.stopPropagation();removeRecipeFromWeeklyMeals(\'' + escapeHtml(meal.recipeId) + '\')" title="Remove">&times;</button>';
    html += '</div>';
  });
  html += '</div>';

  return html;
}
