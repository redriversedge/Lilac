# Lilac - Recipe Discovery App

Recipe discovery and meal planning app for Clifford and Michelle.

## Overview

- **URL:** lilacrecipes.netlify.app
- **Status:** Shipped MVP, may iterate
- **Users:** Clifford and Michelle (simple name-based auth, no passwords)

## Tech Stack

- Vanilla HTML/CSS/JS (no framework, no build step)
- Firebase Firestore (real-time sync via `onSnapshot`)
- Netlify hosting + serverless functions
- Anthropic API (Claude Sonnet) for AI features
- PWA manifest + service worker

## Architecture

Single-page app with tab-based navigation (Home, Browse, Discover, Saved). All state managed through global variables and Firestore real-time listeners.

### Key Files

- `index.html` - Full app shell, modals, overlays
- `js/firebase-config.js` - Firebase init + Firestore CRUD helpers (recipes + grocery list)
- `js/auth.js` - Name-based user selection (Clifford / Michelle)
- `js/recipes.js` - Recipe data layer (local cache, filtering, sorting, import, URL dedup, NYT batch import, taste profile)
- `js/ui.js` - UI rendering (cards, grids, modals, toasts, NYT badge)
- `js/browse.js` - Browse view with filters (cuisine, meal type, difficulty, source)
- `js/recommend.js` - Discover tab (Spoonacular API results rendered as unified recipe cards)
- `js/grocery.js` - Shared grocery list (Firestore sync, pantry staple detection, auto-retry listener)
- `js/app.js` - Navigation, home view, collection view, init
- `js/theme.js` - Dark mode toggle
- `css/lilac.css` - All styles
- `nyt-bookmarklet.js` - Source for NYT Cooking bookmarklet (auto-scrolls recipe box, copies URLs to clipboard)
- `netlify/functions/parse-recipe.js` - URL import (JSON-LD extraction + Claude AI fallback)
- `netlify/functions/lilac-recommend.js` - AI recipe recommendations via Claude

### Data Model

Recipes stored in Firestore `recipes` collection. Each recipe has:
- Core fields: title, description, image, prepTime, cookTime, totalTime, servings, cuisine, mealType, difficulty, gathering
- Arrays: ingredients, instructions, tags, dietary, savedBy
- Maps: ratings (per user), notes (per user), cookedBy (per user)
- Meta: addedBy, dateAdded, url

Grocery list stored in Firestore `groceryList` collection, single `shared` document:
- items: array of { ingredient, recipeId, recipeTitle, addedBy, checked }
- lastUpdated: timestamp

Firestore security rules must include both `recipes` and `groceryList` collections.

## Environment

- Firebase config is in `js/firebase-config.js` (client-side, public)
- `ANTHROPIC_API_KEY` must be set in Netlify site environment variables
- `SPOONACULAR_API_KEY` must be set in Netlify site environment variables (Discover tab)
- No `.env` file needed locally for basic dev (just open index.html)
- No build step required

## Conventions

- Vanilla JS with `var` declarations (ES5-compatible style)
- No modules, all scripts loaded via `<script>` tags in order
- String concatenation for HTML rendering (no template literals in app code)
- Netlify functions use Node.js with `require` (CommonJS)
- Theme color: #B57EDC (lilac purple)

## NYT Cooking Integration

Import recipes from NYT Cooking via a browser bookmarklet:
1. User drags bookmarklet link from Browse tab to their bookmarks bar
2. Opens cooking.nytimes.com/saved-recipes in their logged-in browser
3. Clicks the bookmarklet, which auto-scrolls and copies all recipe URLs to clipboard
4. Pastes URLs into Lilac's batch import field

Imported NYT recipes are auto-tagged `nyt-cooking` and get an NYT badge on cards. URL deduplication prevents the same recipe from being imported twice (normalized by stripping www, trailing slashes, query params).

Browse tab has a Source filter to show only NYT Cooking recipes or exclude them.

## Discover Tab

Uses Spoonacular API for recipe discovery. Tiles are rendered with the same card style as Browse/Saved tabs (image, heart overlay save button, metadata). Recommendations are influenced by the user's taste profile.

## Grocery List

- Add to List button on recipe detail adds all ingredients in one click (no selection step)
- Items grouped by recipe, pantry staples shown separately
- Firestore listener auto-retries on error; openGroceryList() does a direct read as fallback
- Requires `groceryList` collection in Firestore security rules

## Recent Features

Shipped 2026-03-09:
- Shared grocery list with Firestore sync
- Batch URL import (paste multiple URLs, sequential processing with progress)
- Cursive branding with Dancing Script Google Font
- Improved dietary tag detection (nut-free, low-carb, keyword fallback)
- Better form auto-population on URL import (case-insensitive matching, gathering/difficulty inference)

Shipped 2026-03-13:
- NYT Cooking bookmarklet import with URL deduplication
- NYT badge on recipe cards, Source filter in Browse tab
- Discover tab tiles redesigned to match Browse/Saved card style
- Add to List button fixed (Firestore rules + listener recovery)
- Grocery list listener auto-retry and fallback read on open
