# Lilac Planned Features Design

Date: 2026-03-09

Four features to build, in order: dietary checkbox fix, cursive branding, bulk URL import, shared grocery list.

## 1. Auto-select Dietary Checkboxes

Problem: The form population code already checks dietary boxes, but the parse-recipe function doesn't reliably detect and return dietary tags from recipe URLs.

Fix:
- Update `netlify/functions/parse-recipe.js` to extract `suitableForDiet` from JSON-LD schema
- Map schema.org diet values to Lilac's tag set (vegetarian, vegan, gluten-free, dairy-free, keto, paleo, nut-free, low-carb)
- In the AI fallback prompt, explicitly ask Claude to detect dietary tags and return them in the `dietary` array
- No frontend changes needed; `populateRecipeForm` already handles the checkbox setting

## 2. Cursive Branding

Changes:
- Add a cursive Google Font (Dancing Script or Great Vibes) via stylesheet link in index.html
- Update the SVG `<text>` elements (auth logo + header logo) to use the cursive font-family
- Update `.header-title` and `.auth-title` CSS to use the cursive font
- Keep all colors and sizes the same; only the typeface changes

## 3. Bulk URL Import

Location: Enhancement to the Add Recipe modal's URL import section.

Flow:
- Add an "Import multiple" toggle link below the single URL input
- When toggled, show a textarea for pasting multiple URLs (one per line)
- Hide the single URL input when bulk mode is active
- Process URLs sequentially to avoid API rate issues
- Show per-URL progress inline: URL, status icon (spinner/checkmark/X)
- Successfully parsed recipes saved directly to Firestore (skip form review)
- Summary toast: "4 imported, 1 failed"
- Failed URLs remain in the textarea so user can retry or fix them

New functions in recipes.js:
- `bulkImportRecipes(urls)` - orchestrates sequential import
- Progress UI rendered inline in the modal

## 4. Shared Grocery List

Storage: Firestore `groceryList` collection, single shared document (both users contribute).

Data model:
```
groceryList (collection)
  shared (document)
    items: [
      {
        ingredient: "2 cups flour",
        recipeId: "abc123",
        recipeTitle: "Banana Bread",
        addedBy: "Clifford",
        checked: false
      },
      ...
    ]
    lastUpdated: timestamp
```

Pantry staples list (hardcoded):
- salt, pepper, black pepper, oil, olive oil, vegetable oil, cooking spray, butter, sugar, flour, water, garlic, onion, eggs

UI:
- Cart icon in header (between theme toggle and add button)
- Badge showing unchecked item count
- Click opens grocery list modal (slide-up, same pattern as other modals)
- Items grouped by recipe, with recipe title as section header
- Pantry staples auto-sorted to bottom section, visually dimmed
- Checkbox to strike through items
- "Clear Checked" and "Clear All" buttons at top
- Shows who added each recipe's items

Entry point:
- "Add to List" button in recipe detail actions bar
- Adds all ingredients from that recipe (skips duplicates by ingredient text)

Real-time sync:
- `onSnapshot` listener on the shared document
- Both users see changes immediately
- New Firestore helper functions in firebase-config.js

New files:
- `js/grocery.js` - grocery list logic and UI rendering

Modified files:
- `index.html` - cart icon in header, grocery list modal markup, script tag
- `css/lilac.css` - grocery list styles
- `js/ui.js` - "Add to List" button in recipe detail
- `js/firebase-config.js` - Firestore helpers for grocery list
- `js/app.js` - grocery badge update on recipe changes
