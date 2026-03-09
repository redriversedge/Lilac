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
- `js/recipes.js` - Recipe data layer (local cache, filtering, sorting, import, taste profile, batch import)
- `js/ui.js` - UI rendering (cards, grids, modals, toasts)
- `js/browse.js` - Browse view with filters
- `js/recommend.js` - AI-powered Discover tab
- `js/grocery.js` - Shared grocery list (Firestore sync, pantry staple detection)
- `js/app.js` - Navigation, home view, collection view, init
- `js/theme.js` - Dark mode toggle
- `css/lilac.css` - All styles
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

## Environment

- Firebase config is in `js/firebase-config.js` (client-side, public)
- `ANTHROPIC_API_KEY` must be set in Netlify site environment variables
- No `.env` file needed locally for basic dev (just open index.html)
- No build step required

## Conventions

- Vanilla JS with `var` declarations (ES5-compatible style)
- No modules, all scripts loaded via `<script>` tags in order
- String concatenation for HTML rendering (no template literals in app code)
- Netlify functions use Node.js with `require` (CommonJS)
- Theme color: #B57EDC (lilac purple)

## Recent Features (shipped 2026-03-09)

- Shared grocery list with Firestore sync (add ingredients from recipes, grouped by recipe, pantry staples separated, check/clear items, badge count)
- Batch URL import (paste multiple URLs, sequential processing with progress)
- Cursive branding with Dancing Script Google Font
- Improved dietary tag detection (nut-free, low-carb, keyword fallback)
- Better form auto-population on URL import (case-insensitive matching, gathering/difficulty inference)
