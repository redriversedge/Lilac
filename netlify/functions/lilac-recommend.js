// ============================================================
// LILAC - Recipe Recommendation Netlify Function
// Uses Spoonacular API to find real recipes based on taste profile
// ============================================================
var https = require('https');

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'POST only' }) };
  }

  try {
    var parsed = JSON.parse(event.body);
    var profile = parsed.profile;
    var count = parsed.count || 5;

    var apiKey = process.env.SPOONACULAR_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'SPOONACULAR_API_KEY not configured. Add it in Netlify site settings.' })
      };
    }

    // Build Spoonacular query params from taste profile
    var params = [
      'apiKey=' + apiKey,
      'addRecipeInformation=true',
      'fillIngredients=true',
      'number=' + count,
      'sort=random',
      'instructionsRequired=true'
    ];

    if (profile.topCuisines && profile.topCuisines.length > 0) {
      params.push('cuisine=' + encodeURIComponent(profile.topCuisines.slice(0, 3).join(',')));
    }

    // Use the most common meal type
    if (profile.mealTypeCounts) {
      var topMealType = Object.keys(profile.mealTypeCounts)
        .sort(function(a, b) { return profile.mealTypeCounts[b] - profile.mealTypeCounts[a]; })[0];
      if (topMealType) {
        params.push('type=' + encodeURIComponent(topMealType));
      }
    }

    if (profile.avgPrepTime && profile.avgPrepTime > 0) {
      // Add some buffer to the max ready time
      params.push('maxReadyTime=' + Math.round(profile.avgPrepTime * 1.5));
    }

    if (profile.topIngredients && profile.topIngredients.length > 0) {
      params.push('includeIngredients=' + encodeURIComponent(profile.topIngredients.slice(0, 5).join(',')));
    }

    // Use dominant dietary preference if one stands out
    if (profile.dietaryCounts) {
      var dietKeys = Object.keys(profile.dietaryCounts);
      if (dietKeys.length > 0) {
        var topDiet = dietKeys.sort(function(a, b) {
          return profile.dietaryCounts[b] - profile.dietaryCounts[a];
        })[0];
        // Only apply if it covers a meaningful portion of recipes
        if (profile.totalRecipes && profile.dietaryCounts[topDiet] >= profile.totalRecipes * 0.3) {
          params.push('diet=' + encodeURIComponent(topDiet));
        }
      }
    }

    var url = '/recipes/complexSearch?' + params.join('&');

    var data = await callSpoonacular(url);
    var response = JSON.parse(data);

    if (response.status === 'failure' || response.code === 402) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          suggestions: [],
          error: 'Daily recommendation limit reached. Try again tomorrow.'
        })
      };
    }

    var suggestions = [];
    if (response.results && response.results.length > 0) {
      suggestions = response.results.map(function(r) {
        return normalizeRecipe(r, profile);
      });
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ suggestions: suggestions })
    };

  } catch (error) {
    console.error('Recommendation error:', error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to get recommendations: ' + error.message })
    };
  }
};

function normalizeRecipe(r, profile) {
  // Strip HTML from summary
  var description = (r.summary || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  // Truncate to first 2 sentences
  var sentences = description.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 2) {
    description = sentences.slice(0, 2).join('').trim();
  }

  // Extract ingredients
  var ingredients = [];
  if (r.extendedIngredients) {
    ingredients = r.extendedIngredients.map(function(ing) {
      return ing.original || ing.originalString || '';
    }).filter(Boolean);
  }

  // Extract instructions
  var instructions = [];
  if (r.analyzedInstructions && r.analyzedInstructions.length > 0) {
    var steps = r.analyzedInstructions[0].steps || [];
    instructions = steps.map(function(s) { return s.step; });
  }

  // Build cuisines string
  var cuisine = '';
  if (r.cuisines && r.cuisines.length > 0) {
    cuisine = r.cuisines[0];
  }

  // Build dietary tags
  var dietary = [];
  if (r.vegetarian) dietary.push('vegetarian');
  if (r.vegan) dietary.push('vegan');
  if (r.glutenFree) dietary.push('gluten-free');
  if (r.dairyFree) dietary.push('dairy-free');

  // Meal type
  var mealType = '';
  if (r.dishTypes && r.dishTypes.length > 0) {
    mealType = r.dishTypes[0];
  }

  // Difficulty estimate based on ready time and ingredient count
  var difficulty = 'intermediate';
  var readyTime = r.readyInMinutes || 0;
  if (readyTime <= 20 && ingredients.length <= 8) {
    difficulty = 'easy';
  } else if (readyTime > 60 || ingredients.length > 15) {
    difficulty = 'advanced';
  }

  // Generate a "why you'll like it" reason based on profile match
  var whyReason = generateWhyReason(r, profile);

  return {
    title: r.title || '',
    description: description,
    image: r.image || '',
    url: r.sourceUrl || '',
    prepTime: r.preparationMinutes || 0,
    cookTime: r.cookingMinutes || 0,
    totalTime: readyTime,
    servings: String(r.servings || ''),
    cuisine: cuisine,
    mealType: mealType,
    difficulty: difficulty,
    dietary: dietary,
    ingredients: ingredients,
    instructions: instructions,
    tags: ['discovered'],
    whyYoullLikeIt: whyReason
  };
}

function generateWhyReason(recipe, profile) {
  var reasons = [];

  // Check cuisine match
  if (profile.topCuisines && recipe.cuisines) {
    var matchedCuisine = profile.topCuisines.find(function(c) {
      return recipe.cuisines.some(function(rc) {
        return rc.toLowerCase() === c.toLowerCase();
      });
    });
    if (matchedCuisine) {
      reasons.push('Matches your love of ' + matchedCuisine + ' cuisine');
    }
  }

  // Check prep time match
  if (profile.avgPrepTime && recipe.readyInMinutes) {
    if (recipe.readyInMinutes <= profile.avgPrepTime) {
      reasons.push('Quick to make at ' + recipe.readyInMinutes + ' minutes');
    }
  }

  // Check ingredient overlap
  if (profile.topIngredients && recipe.extendedIngredients) {
    var matchedIngs = [];
    profile.topIngredients.forEach(function(pi) {
      recipe.extendedIngredients.forEach(function(ri) {
        if ((ri.name || '').toLowerCase().indexOf(pi.toLowerCase()) !== -1) {
          matchedIngs.push(pi);
        }
      });
    });
    if (matchedIngs.length > 0) {
      reasons.push('Uses ingredients you love like ' + matchedIngs.slice(0, 2).join(' and '));
    }
  }

  if (reasons.length === 0) {
    if (recipe.veryPopular) {
      reasons.push('A highly popular recipe worth trying');
    } else if (recipe.healthScore && recipe.healthScore > 70) {
      reasons.push('A healthy option with great flavor');
    } else {
      reasons.push('Something new to expand your recipe collection');
    }
  }

  return reasons[0];
}

function callSpoonacular(path) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'api.spoonacular.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        if (res.statusCode === 402) {
          resolve(JSON.stringify({ status: 'failure', code: 402 }));
        } else if (res.statusCode >= 400) {
          reject(new Error('Spoonacular API returned ' + res.statusCode + ': ' + body));
        } else {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(); reject(new Error('Spoonacular API timed out')); });
    req.end();
  });
}
