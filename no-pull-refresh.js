// Prevents pull-to-refresh on Android Chrome when swiping down at the top of the page.
// { passive: false } is required to call preventDefault() on touchmove.
{
  let _startY = 0;
  document.addEventListener("touchstart", e => {
    _startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (window.scrollY === 0 && e.touches[0].clientY > _startY) {
      e.preventDefault();
    }
  }, { passive: false });
}
