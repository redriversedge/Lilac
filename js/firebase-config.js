// ============================================================
// LILAC - Firebase Configuration
// Replace the config below with your Firebase project config
// ============================================================

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyApE1xcCN_5xEnsaj7Q2SugX0CGdzpVE",
  authDomain: "lilac-d0caf.firebaseapp.com",
  projectId: "lilac-d0caf",
  storageBucket: "lilac-d0caf.firebasestorage.app",
  messagingSenderId: "8272372665",
  appId: "1:8272372665:web:ba17e54fbe6169111d8c68"
};

// Initialize Firebase
var firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
var db = firebase.firestore();

// Firestore collection reference
var recipesCollection = db.collection('recipes');

// --- Firestore Helpers ---

function fbAddRecipe(recipeData) {
  recipeData.dateAdded = firebase.firestore.FieldValue.serverTimestamp();
  return recipesCollection.add(recipeData);
}

function fbUpdateRecipe(docId, updates) {
  return recipesCollection.doc(docId).update(updates);
}

function fbDeleteRecipe(docId) {
  return recipesCollection.doc(docId).delete();
}

function fbGetRecipe(docId) {
  return recipesCollection.doc(docId).get().then(function(doc) {
    if (doc.exists) {
      var data = doc.data();
      data.id = doc.id;
      return data;
    }
    return null;
  });
}

function fbGetAllRecipes() {
  return recipesCollection.orderBy('dateAdded', 'desc').get().then(function(snapshot) {
    var recipes = [];
    snapshot.forEach(function(doc) {
      var data = doc.data();
      data.id = doc.id;
      recipes.push(data);
    });
    return recipes;
  });
}

// Real-time listener - calls callback with full recipe array on any change
function fbListenToRecipes(callback) {
  return recipesCollection.orderBy('dateAdded', 'desc').onSnapshot(function(snapshot) {
    var recipes = [];
    snapshot.forEach(function(doc) {
      var data = doc.data();
      data.id = doc.id;
      recipes.push(data);
    });
    callback(recipes);
  }, function(error) {
    console.error('Firestore listener error:', error);
  });
}

// Toggle save/unsave for a user
function fbToggleSave(docId, userName) {
  return recipesCollection.doc(docId).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    var savedBy = data.savedBy || [];
    var idx = savedBy.indexOf(userName);
    if (idx >= 0) {
      savedBy.splice(idx, 1);
    } else {
      savedBy.push(userName);
    }
    // If nobody has it saved and it was a discovered recipe, delete it
    var tags = data.tags || [];
    if (savedBy.length === 0 && tags.indexOf('discovered') >= 0) {
      return recipesCollection.doc(docId).delete();
    }
    return recipesCollection.doc(docId).update({ savedBy: savedBy });
  });
}

// Update rating for a user
function fbSetRating(docId, userName, rating) {
  var update = {};
  update['ratings.' + userName] = rating;
  return recipesCollection.doc(docId).update(update);
}

// Toggle cooked status for a user
function fbMarkCooked(docId, userName) {
  return recipesCollection.doc(docId).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    var cookedBy = data.cookedBy || {};
    if (cookedBy[userName]) {
      delete cookedBy[userName];
    } else {
      cookedBy[userName] = 1;
    }
    return recipesCollection.doc(docId).update({ cookedBy: cookedBy });
  });
}

// Update notes for a user
function fbSetNotes(docId, userName, notes) {
  var update = {};
  update['notes.' + userName] = notes;
  return recipesCollection.doc(docId).update(update);
}

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
