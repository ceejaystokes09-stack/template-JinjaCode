(() => {
  const components = [...document.querySelectorAll("[data-side-nav-component]")];
  if (!components.length) {
    return;
  }

  const isNarrow = () =>
    window.matchMedia("(max-width: 680px)").matches ||
    components.some((component) => {
      const canvas = component.closest(".preview-canvas");
      if (!canvas) {
        return false;
      }
      return canvas.dataset.previewSize
        ? canvas.dataset.previewSize === "mobile"
        : canvas.clientWidth <= 680;
    });

  const setExpanded = (component, expanded, narrow) => {
    const button = component.querySelector("[data-side-nav-toggle]");
    const label = component.querySelector(".side-nav-toggle-label");
    const layout = component.closest(".side-nav-layout");
    if (!button || !label) {
      return;
    }

    component.classList.toggle("is-open", narrow && expanded);
    component.classList.toggle("is-collapsed", !narrow && !expanded);
    if (layout) {
      layout.classList.toggle("is-nav-collapsed", !narrow && !expanded);
    }
    button.setAttribute("aria-expanded", String(expanded));
    label.textContent = narrow
      ? expanded
        ? "Close navigation"
        : "Open navigation"
      : expanded
        ? "Hide navigation"
        : "Show navigation";
  };

  components.forEach((component) => {
    const narrow = isNarrow();
    setExpanded(component, !narrow, narrow);

    component.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const toggle = target.closest("[data-side-nav-toggle]");
      const close = target.closest("[data-side-nav-close]");
      const navLink = target.closest(".side-nav a");
      const isMobile = isNarrow();

      if (toggle) {
        event.preventDefault();
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        setExpanded(component, expanded, isMobile);
        if (isMobile && expanded) {
          component.querySelector(".side-nav a, .side-nav input")?.focus();
        }
      } else if (close || (isMobile && navLink)) {
        setExpanded(component, false, isMobile);
        component.querySelector("[data-side-nav-toggle]")?.focus();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    components.forEach((component) => {
      if (component.classList.contains("is-open")) {
        setExpanded(component, false, true);
        component.querySelector("[data-side-nav-toggle]")?.focus();
      }
    });
  });

  let previousNarrow = isNarrow();
  window.addEventListener("resize", () => {
    const narrow = isNarrow();
    if (narrow === previousNarrow) {
      return;
    }
    previousNarrow = narrow;
    components.forEach((component) => setExpanded(component, !narrow, narrow));
  });
})();
