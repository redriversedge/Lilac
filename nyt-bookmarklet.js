// NYT Cooking Recipe Box Export Bookmarklet
// Drag the minified version to your bookmarks bar, then click it
// while on your NYT Cooking recipe box page to copy all recipe URLs.
//
// Bookmarklet (minified) - copy everything between javascript: and the ending semicolon:
// javascript:void(function(){if(location.hostname!=='cooking.nytimes.com'){alert('Open your NYT Cooking recipe box first!');return}var t=document.createElement('div');t.style.cssText='position:fixed;top:20px;right:20px;background:#333;color:#fff;padding:12px 20px;border-radius:8px;z-index:99999;font:14px sans-serif';t.textContent='Scrolling to load all recipes...';document.body.appendChild(t);var last=0;function scroll(){window.scrollTo(0,document.body.scrollHeight);setTimeout(function(){if(document.body.scrollHeight>last){last=document.body.scrollHeight;scroll()}else{gather()}},1500)}function gather(){var links=document.querySelectorAll('a[href*="/recipes/"]');var seen={};var urls=[];links.forEach(function(a){var h=a.href.split('?')[0];if(!seen[h]&&h.match(/\/recipes\/\d+/)){seen[h]=true;urls.push(h)}});if(urls.length===0){t.textContent='No recipes found. Make sure you are on your recipe box page.';setTimeout(function(){t.remove()},4000);return}navigator.clipboard.writeText(urls.join('\n')).then(function(){t.textContent='Copied '+urls.length+' recipe URLs!';setTimeout(function(){t.remove()},4000)}).catch(function(){var ta=document.createElement('textarea');ta.value=urls.join('\n');ta.style.cssText='position:fixed;top:60px;right:20px;width:400px;height:200px;z-index:99999';document.body.appendChild(ta);ta.select();t.textContent=urls.length+' URLs ready - copy from the box below';setTimeout(function(){t.remove()},10000)})}scroll()})();

(function() {
  // Only run on NYT Cooking
  if (location.hostname !== 'cooking.nytimes.com') {
    alert('Open your NYT Cooking recipe box first!');
    return;
  }

  // Show status toast
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#333;color:#fff;padding:12px 20px;border-radius:8px;z-index:99999;font:14px sans-serif';
  toast.textContent = 'Scrolling to load all recipes...';
  document.body.appendChild(toast);

  var lastHeight = 0;

  // Scroll to load all recipes (infinite scroll)
  function autoScroll() {
    window.scrollTo(0, document.body.scrollHeight);
    setTimeout(function() {
      if (document.body.scrollHeight > lastHeight) {
        lastHeight = document.body.scrollHeight;
        autoScroll();
      } else {
        gatherUrls();
      }
    }, 1500);
  }

  // Gather all recipe URLs from the page
  function gatherUrls() {
    var links = document.querySelectorAll('a[href*="/recipes/"]');
    var seen = {};
    var urls = [];

    links.forEach(function(a) {
      var href = a.href.split('?')[0]; // strip query params
      if (!seen[href] && href.match(/\/recipes\/\d+/)) {
        seen[href] = true;
        urls.push(href);
      }
    });

    if (urls.length === 0) {
      toast.textContent = 'No recipes found. Make sure you are on your recipe box page.';
      setTimeout(function() { toast.remove(); }, 4000);
      return;
    }

    // Try to copy to clipboard
    navigator.clipboard.writeText(urls.join('\n')).then(function() {
      toast.textContent = 'Copied ' + urls.length + ' recipe URLs!';
      setTimeout(function() { toast.remove(); }, 4000);
    }).catch(function() {
      // Fallback: show textarea for manual copy
      var ta = document.createElement('textarea');
      ta.value = urls.join('\n');
      ta.style.cssText = 'position:fixed;top:60px;right:20px;width:400px;height:200px;z-index:99999';
      document.body.appendChild(ta);
      ta.select();
      toast.textContent = urls.length + ' URLs ready - copy from the box below';
      setTimeout(function() { toast.remove(); }, 10000);
    });
  }

  autoScroll();
})();
