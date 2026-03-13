// ============================================================
// LILAC - Recommendation Engine (Spoonacular-powered)
// ============================================================

var discoverSuggestions = [];
var discoverLoading = false;
var discoverError = '';

function renderDiscoverView() {
  var profile = buildTasteProfile();
  var html = '';

  // Header
  html += '<div class="discover-header">';
  html += '<h1>Discover Recipes</h1>';
  if (allRecipes.length > 0) {
    html += '<p>Based on your ' + profile.totalRecipes + ' saved recipes</p>';
  } else {
    html += '<p>Add some recipes to get personalized recommendations</p>';
  }
  html += '</div>';

  // Taste profile tags
  if (profile.topCuisines.length > 0 || profile.avgPrepTime > 0) {
    html += '<div class="taste-profile">';
    profile.topCuisines.forEach(function(c) {
      html += '<span class="taste-tag">' + escapeHtml(c) + '</span>';
    });
    if (profile.avgPrepTime > 0) {
      html += '<span class="taste-tag">~' + profile.avgPrepTime + ' min avg</span>';
    }
    html += '</div>';
  }

  // Action buttons
  html += '<div style="text-align:center;padding:0.75rem 1rem">';
  html += '<button class="btn btn-accent" onclick="fetchRecommendations()" ' + (discoverLoading ? 'disabled' : '') + '>';
  html += discoverLoading ? 'Finding recipes...' : (discoverSuggestions.length > 0 ? 'Get More Suggestions' : 'Get Suggestions');
  html += '</button>';
  html += '</div>';

  // Loading state
  if (discoverLoading) {
    html += '<div class="discover-loading">';
    html += '<div class="spinner"></div>';
    html += '<p>Finding recipes you\'ll love...</p>';
    html += '</div>';
  }

  // Error state
  if (discoverError) {
    html += '<div style="padding:1rem;text-align:center;color:var(--error)">' + escapeHtml(discoverError) + '</div>';
  }

  // Suggestions as tile grid
  if (discoverSuggestions.length > 0 && !discoverLoading) {
    html += '<div class="recipe-grid">';
    discoverSuggestions.forEach(function(s, idx) {
      html += renderSuggestionTile(s, idx);
    });
    html += '</div>';
  }

  // Empty state if no recipes yet
  if (allRecipes.length === 0 && !discoverLoading) {
    html += renderEmptyState(
      'No recipes yet',
      'Add some recipes to your collection first, then come back for personalized suggestions!',
      '&#9733;'
    );
  }

  return html;
}

function renderSuggestionTile(suggestion, index) {
  var totalTime = suggestion.totalTime || suggestion.prepTime || 0;
  var timeStr = totalTime > 0 ? totalTime + ' min' : '';

  var html = '<div class="recipe-card">';
  html += '<div class="recipe-card-wrapper">';

  // Image area - matching Browse/Saved card style
  if (suggestion.image) {
    html += '<img class="recipe-card-img" src="' + escapeHtml(suggestion.image) + '" alt="' + escapeHtml(suggestion.title) + '" loading="lazy" onerror="this.outerHTML=\'<div class=\\\'recipe-card-img-placeholder\\\'>&#127860;</div>\'">';
  } else {
    html += '<div class="recipe-card-img-placeholder">&#127860;</div>';
  }

  // Save button overlay (matching the heart button style from Browse cards)
  html += '<button class="recipe-card-save-btn" onclick="event.stopPropagation();saveSuggestion(' + index + ')" title="Save">&#9825;</button>';
  html += '</div>';

  // Card body - matching Browse/Saved layout
  html += '<div class="recipe-card-body">';
  html += '<div class="recipe-card-title">' + escapeHtml(suggestion.title || 'Untitled') + '</div>';

  // Metadata row
  html += '<div class="recipe-card-meta">';
  if (timeStr) html += '<span>&#9201; ' + timeStr + '</span>';
  if (suggestion.cuisine) html += '<span class="recipe-card-badge">' + escapeHtml(suggestion.cuisine) + '</span>';
  if (suggestion.difficulty) html += '<span>' + escapeHtml(suggestion.difficulty) + '</span>';
  html += '</div>';

  // Why you'll like it
  if (suggestion.whyYoullLikeIt) {
    html += '<div class="suggestion-tile-why">' + escapeHtml(suggestion.whyYoullLikeIt) + '</div>';
  }

  // Action buttons
  html += '<div class="suggestion-tile-actions">';
  if (suggestion.url) {
    html += '<a href="' + escapeHtml(suggestion.url) + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline" onclick="event.stopPropagation()">View &#8599;</a>';
  }
  html += '<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();dismissSuggestion(' + index + ')">Dismiss</button>';
  html += '</div>';

  html += '</div></div>';
  return html;
}

function fetchRecommendations() {
  if (allRecipes.length === 0) {
    showToast('Add some recipes first!');
    return;
  }

  discoverLoading = true;
  discoverError = '';
  renderCurrentView();

  var profile = buildTasteProfile();

  fetch('/.netlify/functions/lilac-recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: profile, count: 6 })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    discoverLoading = false;
    if (data.error) {
      discoverError = data.error;
    } else if (data.suggestions && data.suggestions.length > 0) {
      discoverSuggestions = data.suggestions;
    } else {
      discoverError = 'No matching recipes found. Try again for different results!';
    }
    renderCurrentView();
  })
  .catch(function(err) {
    discoverLoading = false;
    discoverError = 'Failed to get recommendations. Please try again.';
    renderCurrentView();
    console.error('Recommend error:', err);
  });
}

function saveSuggestion(index) {
  var s = discoverSuggestions[index];
  if (!s) return;

  var recipeData = {
    url: s.url || '',
    title: s.title || '',
    description: s.description || '',
    image: s.image || '',
    prepTime: parseInt(s.prepTime) || 0,
    cookTime: parseInt(s.cookTime) || 0,
    totalTime: parseInt(s.totalTime) || ((parseInt(s.prepTime) || 0) + (parseInt(s.cookTime) || 0)),
    servings: s.servings || '',
    cuisine: s.cuisine || '',
    mealType: s.mealType || '',
    difficulty: s.difficulty || '',
    gathering: '',
    dietary: s.dietary || [],
    ingredients: s.ingredients || [],
    instructions: s.instructions || [],
    tags: ['discovered']
  };

  addRecipe(recipeData).then(function() {
    showToast('"' + s.title + '" saved!');
    discoverSuggestions.splice(index, 1);
    renderCurrentView();
  }).catch(function(err) {
    showToast('Error saving recipe');
    console.error(err);
  });
}

function dismissSuggestion(index) {
  discoverSuggestions.splice(index, 1);
  renderCurrentView();
  if (discoverSuggestions.length === 0) {
    showToast('All suggestions reviewed!');
  }
}
