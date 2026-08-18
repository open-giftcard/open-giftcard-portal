/*
 * Paints the saved theme before the first frame.
 *
 * React applies the same attributes, but it applies them after hydration, so
 * without this a reader who chose the dark portal gets a white flash on every
 * navigation. It is a separate file rather than an inline script because the
 * BFF serves `script-src 'self'` and inline script is refused.
 *
 * The keys here must match `src/preferences/preferences.tsx`.
 */
(function () {
  var stored = null;
  try {
    stored = JSON.parse(localStorage.getItem("giftcard.portal.preferences"));
  } catch (error) {
    stored = null;
  }

  var choice = stored && stored.theme;
  if (choice !== "light" && choice !== "dark") {
    choice =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }

  var root = document.documentElement;
  root.dataset.theme = choice;
  root.style.colorScheme = choice;

  var language = stored && stored.language;
  root.lang = language === "en" || language === "tr" ? language : "tr";
})();
