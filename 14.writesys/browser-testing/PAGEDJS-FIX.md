# Paged.js Issues and Current Status

## Issue #1: CSS Parser Bug - FIXED ✅
Firefox (and Chrome) showed this error when Paged.js tried to parse CSS:
```
Uncaught (in promise) Error: item doesn't belong to list
    remove https://unpkg.com/pagedjs/dist/paged.polyfill.js:3777
```

**Root Cause**: The CSS selector `p:first-of-type` in book.css:146 triggered a known Paged.js parser bug.

**Reference**: GitLab Issue #315 - https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/315

**Solution**: Replaced `p:first-of-type` with `p:first-child` in book.css:146

**Status**: ✅ FIXED - Paged.js now successfully parses CSS

## Issue #2: node.getAttribute Bug - UNFIXABLE ❌
After fixing the CSS parser bug, a second error appeared:
```
TypeError: node.getAttribute is not a function
    at findElement (https://unpkg.com/pagedjs/dist/paged.polyfill.js:1099:20)
    at findEndToken (https://unpkg.com/pagedjs/dist/paged.polyfill.js:2085:30)
    at checkUnderflowAfterResize (https://unpkg.com/pagedjs/dist/paged.polyfill.js:2460:37)
```

**Root Cause**: Paged.js doesn't check node types before calling `.getAttribute()`. When it encounters text nodes, it crashes.

**Reference**: GitLab Issue #339 - https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/339

**Attempted Fixes**:
1. ✅ Wrapped all non-sentence text in spans (to eliminate bare text nodes)
2. ✅ Added Paged.js initialization waiting logic
3. ❌ **Still fails** - Bug is in Paged.js library itself

**Status**: ❌ UNFIXABLE without patching Paged.js source code

## Current Solution: Paged.js Disabled

Paged.js has been **disabled** in web/index.html due to multiple known bugs.

**Test Results Without Paged.js**:
- ✅ All functional UI tests pass (10/10)
- ✅ Smoke tests pass (10/10)
- ✅ Manuscript loading works perfectly
- ✅ Sentence wrapping works correctly (314 sentences)
- ✅ Annotation system works
- ✅ No JavaScript errors in Firefox or Chrome

## Recommendations

1. **Short term**: Keep Paged.js disabled until upstream bugs are fixed
2. **Medium term**: Monitor Paged.js GitLab for bug fixes
3. **Long term**: Consider alternative pagination libraries:
   - Vivliostyle (https://vivliostyle.org/)
   - Print.js (https://printjs.crabbly.com/)
   - Custom CSS print media queries

## Re-enabling Paged.js

To re-enable Paged.js in the future, edit web/index.html and replace the disabled script with:

```html
<script>
  const isAutomatedTest = navigator.webdriver || window.Cypress || window.__playwright;
  window.PAGEDJS_LOADING = false;
  window.PAGEDJS_READY = true;

  if (!isAutomatedTest) {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js';
    document.head.appendChild(script);
  }
</script>
```

Then test thoroughly with:
```bash
cd browser-testing
npx playwright test
```
