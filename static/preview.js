(() => {
  const form = document.querySelector(".builder-controls");
  const canvas = document.querySelector("#preview-canvas");
  const status = document.querySelector("#builder-status");
  const paletteStorageKey = "template-builder-palette";
  const sizeStorageKey = "template-builder-preview-size";
  const presetsStorageKey = "template-builder-presets";
  const paletteInputs = [...document.querySelectorAll("[data-theme-variable]")];

  if (!form || !canvas || !status) {
    return;
  }

  const setStatus = (message) => {
    status.textContent = message;
  };

  const readStorage = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      setStatus("Browser storage is unavailable; saved presets may not persist.");
      return fallback;
    }
  };

  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      setStatus("Could not save to browser storage. Check your browser privacy settings.");
      return false;
    }
  };

  const readSession = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const writeSession = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      setStatus("This browser could not keep the unsaved preview settings.");
    }
  };

  const updateSharedCss = (variable, value) => {
    const sharedCode = document.querySelector("#css-shared");
    if (!sharedCode) {
      return;
    }
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const declaration = new RegExp(`(${escapedVariable}\\s*:\\s*)#[\\da-fA-F]{6}(?=\\s*;)`);
    sharedCode.textContent = sharedCode.textContent.replace(declaration, `$1${value}`);
  };

  const applyPalette = (palette) => {
    paletteInputs.forEach((input) => {
      const variable = input.dataset.themeVariable;
      const value = palette[variable];
      if (!value || !/^#[\da-fA-F]{6}$/.test(value)) {
        return;
      }
      input.value = value;
      canvas.style.setProperty(variable, value);
      updateSharedCss(variable, value);
    });
  };

  const currentPalette = () =>
    Object.fromEntries(
      paletteInputs.map((input) => [input.dataset.themeVariable, input.value]),
    );

  const savePaletteToSession = () => {
    writeSession(paletteStorageKey, JSON.stringify(currentPalette()));
  };

  const applyPreviewSize = (size) => {
    if (!["desktop", "tablet", "mobile"].includes(size)) {
      return;
    }
    canvas.dataset.previewSize = size;
    document.querySelectorAll(".preview-size-controls [data-preview-size]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.previewSize === size));
    });
    writeSession(sizeStorageKey, size);
    window.dispatchEvent(new Event("resize"));
  };

  const contentCheckbox = form.querySelector('input[type="checkbox"][name="show_content"]');
  const sampleContent = document.querySelector(".preview-below-hero");
  const updateSampleContent = () => {
    if (sampleContent && contentCheckbox) {
      sampleContent.hidden = !contentCheckbox.checked;
    }
  };

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) {
      throw new Error("Clipboard copy was rejected by the browser.");
    }
  };

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      if (!target) {
        setStatus("Could not find that code block.");
        return;
      }
      try {
        await copyText(target.textContent);
        setStatus("Code copied to clipboard.");
      } catch {
        setStatus("Clipboard access failed. Select and copy the code manually.");
      }
    });
  });

  document.querySelectorAll("[data-copy-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      const selector = button.dataset.copyGroup === "html" ? ".html-source" : ".css-source";
      const snippets = [...document.querySelectorAll(selector)]
        .map((element) => element.textContent.trim())
        .filter(Boolean);
      try {
        await copyText(snippets.join("\n\n"));
        setStatus(button.dataset.copyGroup === "html" ? "All selected Jinja copied." : "All selected CSS copied.");
      } catch {
        setStatus("Clipboard access failed. Use the individual code panels to copy manually.");
      }
    });
  });

  paletteInputs.forEach((input) => {
    input.addEventListener("input", () => {
      canvas.style.setProperty(input.dataset.themeVariable, input.value);
      updateSharedCss(input.dataset.themeVariable, input.value);
      savePaletteToSession();
    });
  });

  document.querySelectorAll(".preview-size-controls [data-preview-size]").forEach((button) => {
    button.addEventListener("click", () => applyPreviewSize(button.dataset.previewSize));
  });

  if (contentCheckbox) {
    contentCheckbox.addEventListener("change", updateSampleContent);
  }

  const sideNavToggleInput = form.querySelector('input[type="checkbox"][name="side_nav_toggle"]');
  const sideNavSelect = form.querySelector('select[name="side_nav"]');
  const updateSideNavToggleAvailability = () => {
    if (!sideNavSelect || !sideNavToggleInput) {
      return;
    }
    const wasDisabled = sideNavToggleInput.disabled;
    sideNavToggleInput.disabled = sideNavSelect.value === "none";
    if (wasDisabled && !sideNavToggleInput.disabled) {
      sideNavToggleInput.checked = true;
    }
    sideNavToggleInput.closest("label").setAttribute(
      "aria-disabled",
      String(sideNavToggleInput.disabled),
    );
  };
  if (sideNavSelect) {
    sideNavSelect.addEventListener("change", updateSideNavToggleAvailability);
    updateSideNavToggleAvailability();
  }

  const builtInPresets = {
    startup: {
      name: "Startup landing page",
      components: { header: "cta", hero: "startup", side_nav: "none", footer: "newsletter" },
      showContent: true,
      sideNavToggle: true,
      size: "desktop",
    },
    store: {
      name: "Boutique storefront",
      components: { header: "storefront", hero: "store", side_nav: "store", footer: "columns" },
      showContent: true,
      sideNavToggle: true,
      size: "desktop",
    },
    restaurant: {
      name: "Restaurant",
      components: { header: "restaurant", hero: "restaurant", side_nav: "none", footer: "contact" },
      showContent: false,
      sideNavToggle: true,
      size: "desktop",
    },
    portfolio: {
      name: "Creative portfolio",
      components: { header: "minimal", hero: "portfolio", side_nav: "creator", footer: "social" },
      showContent: true,
      sideNavToggle: true,
      size: "desktop",
    },
  };

  const savedPresetOptions = document.querySelector("#saved-preset-options");
  const presetSelect = document.querySelector("#preset-select");
  const presetNameInput = document.querySelector("#preset-name");
  const defaultPalette = Object.fromEntries(
    paletteInputs.map((input) => [input.dataset.themeVariable, input.defaultValue]),
  );

  const getSavedPresets = () => {
    const presets = readStorage(presetsStorageKey, []);
    return Array.isArray(presets) ? presets.filter((preset) => preset && typeof preset.name === "string") : [];
  };

  const renderSavedPresets = () => {
    const presets = getSavedPresets();
    savedPresetOptions.replaceChildren();
    presets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = `saved:${index}`;
      option.textContent = preset.name;
      savedPresetOptions.append(option);
    });
  };

  const collectPreset = (name) => ({
    name,
    components: Object.fromEntries(
      [...form.querySelectorAll("select[name]")].map((select) => [select.name, select.value]),
    ),
    palette: currentPalette(),
    showContent: contentCheckbox ? contentCheckbox.checked : true,
    sideNavToggle: sideNavToggleInput ? sideNavToggleInput.checked : false,
    size: canvas.dataset.previewSize || "desktop",
  });

  const loadPreset = (preset) => {
    if (!preset || !preset.components) {
      setStatus("That preset is not valid.");
      return;
    }
    Object.entries(preset.components).forEach(([name, value]) => {
      const select = [...form.querySelectorAll("select[name]")].find(
        (option) => option.name === name,
      );
      if (select && [...select.options].some((option) => option.value === value)) {
        select.value = value;
      }
    });
    updateSideNavToggleAvailability();
    applyPalette(preset.palette || defaultPalette);
    if (contentCheckbox && typeof preset.showContent === "boolean") {
      contentCheckbox.checked = preset.showContent;
      updateSampleContent();
    }
    if (sideNavToggleInput && typeof preset.sideNavToggle === "boolean") {
      sideNavToggleInput.checked = preset.sideNavToggle;
    }
    applyPreviewSize(preset.size || "desktop");
    savePaletteToSession();
    form.requestSubmit();
  };

  document.querySelector("#load-preset").addEventListener("click", () => {
    const presetId = presetSelect.value;
    if (presetId.startsWith("builtin:")) {
      loadPreset(builtInPresets[presetId.slice("builtin:".length)]);
      return;
    }
    if (presetId.startsWith("saved:")) {
      loadPreset(getSavedPresets()[Number(presetId.slice("saved:".length))]);
      return;
    }
    setStatus("Choose a preset to load.");
  });

  document.querySelector("#save-preset").addEventListener("click", () => {
    const trimmedName = presetNameInput.value.trim();
    if (!trimmedName) {
      setStatus("Enter a name before saving the preset.");
      presetNameInput.focus();
      return;
    }
    const presets = getSavedPresets();
    const existingIndex = presets.findIndex(
      (preset) => preset.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    const preset = collectPreset(trimmedName);
    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }
    if (writeStorage(presetsStorageKey, presets)) {
      renderSavedPresets();
      presetSelect.value = `saved:${existingIndex >= 0 ? existingIndex : presets.length - 1}`;
      presetNameInput.value = "";
      setStatus(`Saved "${trimmedName}" in this browser.`);
    }
  });

  document.querySelector("#delete-preset").addEventListener("click", () => {
    if (!presetSelect.value.startsWith("saved:")) {
      setStatus("Choose one of your saved presets to delete.");
      return;
    }
    const index = Number(presetSelect.value.slice("saved:".length));
    const presets = getSavedPresets();
    const [removed] = presets.splice(index, 1);
    if (removed && writeStorage(presetsStorageKey, presets)) {
      renderSavedPresets();
      presetSelect.value = "";
      setStatus(`Deleted "${removed.name}".`);
    }
  });

  form.addEventListener("submit", savePaletteToSession);

  renderSavedPresets();
  const storedPalette = readSession(paletteStorageKey);
  if (storedPalette) {
    try {
      applyPalette(JSON.parse(storedPalette));
    } catch {
      setStatus("Could not restore the previous color palette.");
    }
  }
  applyPreviewSize(readSession(sizeStorageKey) || "desktop");
  updateSampleContent();
})();
