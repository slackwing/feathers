// Function to apply or remove mobile scaling based on viewport width
function applyResponsiveScaling() {
  const pagesContainer = document.querySelector(".pagedjs_pages");
  if (!pagesContainer) return;

  if (window.innerWidth <= 768) {
    const pageWidth = 600; // 6in = ~600px at 96dpi
    const viewportWidth = window.innerWidth;
    const scale = (viewportWidth * 0.7) / pageWidth; // 70% to leave room for borders
    pagesContainer.style.transform = `scale(${scale})`;
    pagesContainer.style.transformOrigin = "top center";
    pagesContainer.style.padding = "1em";
    pagesContainer.style.background = "transparent";
    document.body.style.background = "white";
  } else {
    // Reset to desktop view
    pagesContainer.style.transform = "";
    pagesContainer.style.transformOrigin = "";
    pagesContainer.style.padding = "2em";
    pagesContainer.style.background = "#f5f5f5";
    document.body.style.background = "";
  }
}

// Run smartquotes after PagedJS finishes rendering
class SmartQuotesHandler extends Paged.Handler {
  afterRendered(pages) {
    smartquotes();
    applyResponsiveScaling();
  }
}
Paged.registerHandlers(SmartQuotesHandler);

// Listen for window resize events
window.addEventListener("resize", applyResponsiveScaling);
