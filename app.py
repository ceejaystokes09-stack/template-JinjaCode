import re
from pathlib import Path

from flask import Flask, abort, get_template_attribute, render_template, request

app = Flask(__name__)

TEMPLATE_OPTIONS = {
    "header": {
        "minimal": ("Minimal", "header_minimal"),
        "centered": ("Centered", "header_centered"),
        "storefront": ("Storefront", "header_announcement"),
        "cta": ("Call to action", "header_call_to_action"),
        "restaurant": ("Restaurant", "header_restaurant"),
    },
    "hero": {
        "startup": ("Startup", "hero_startup"),
        "portfolio": ("Portfolio", "hero_portfolio"),
        "store": ("Store", "hero_store"),
        "event": ("Event", "hero_event"),
        "restaurant": ("Restaurant", "hero_restaurant"),
    },
    "side_nav": {
        "none": ("No side navigation", None),
        "dashboard": ("Dashboard", "sidenav_dashboard"),
        "docs": ("Documentation", "sidenav_docs"),
        "store": ("Shop categories", "sidenav_store"),
        "creator": ("Creator profile", "sidenav_creator"),
        "support": ("Help center", "sidenav_support"),
    },
    "footer": {
        "simple": ("Simple", "footer_simple"),
        "columns": ("Link columns", "footer_columns"),
        "newsletter": ("Newsletter", "footer_newsletter"),
        "social": ("Social links", "footer_social"),
        "contact": ("Contact", "footer_contact"),
    },
}

COMMON_CSS_CLASSES = {
    "site-header",
    "brand",
    "brand-mark",
    "header-links",
    "header-link",
    "button-link",
    "eyebrow",
    "hero",
    "hero-copy",
    "hero-actions",
    "text-link",
    "hero-meta",
    "side-nav",
    "side-brand",
    "side-label",
    "side-item",
    "side-count",
    "side-profile",
    "side-search",
    "side-note",
    "avatar",
    "creator-avatar",
    "creator-name",
    "creator-role",
    "creator-follow",
    "support-mark",
    "site-footer",
    "footer-bottom",
    "footer-legal",
}

THEME_COLOR_KEYS = (
    "--page-bg",
    "--surface",
    "--surface-soft",
    "--surface-muted",
    "--text",
    "--text-muted",
    "--text-subtle",
    "--text-on-accent",
    "--border",
    "--border-soft",
    "--accent",
    "--accent-hover",
    "--accent-soft",
    "--accent-warm",
    "--restaurant-bg",
    "--restaurant-accent",
    "--hero-bg",
    "--hero-ink",
    "--hero-warm",
    "--side-bg",
    "--side-active-bg",
    "--side-border",
    "--quote-bg",
)


def get_macro_sources():
    source, _, _ = app.jinja_env.loader.get_source(app.jinja_env, "macros.html")
    macro_pattern = re.compile(
        r"{%\s*macro\s+([A-Za-z_]\w*)\s*\([^%]*?\)\s*%}.*?{%\s*endmacro\s*%}",
        re.DOTALL,
    )
    return {
        match.group(1): match.group(0).strip()
        for match in macro_pattern.finditer(source)
    }


def iter_css_blocks(css):
    position = 0
    while position < len(css):
        while position < len(css) and css[position].isspace():
            position += 1
        if position >= len(css):
            break

        start = position
        while position < len(css) and css[position] not in "{;":
            position += 1
        if position >= len(css):
            break

        prelude = css[start:position].strip()
        if css[position] == ";":
            yield prelude + ";", None
            position += 1
            continue

        position += 1
        body_start = position
        depth = 1
        quote = None
        while position < len(css) and depth:
            character = css[position]
            if quote:
                if character == quote and css[position - 1] != "\\":
                    quote = None
            elif character in ("'", '"'):
                quote = character
            elif character == "{":
                depth += 1
            elif character == "}":
                depth -= 1
            position += 1

        yield prelude, css[body_start : position - 1]


def extract_css(css, class_names, include_globals=False):
    rules = []
    global_selectors = {"*", "body", "a"}

    for prelude, body in iter_css_blocks(css):
        if body is None:
            if include_globals and prelude.startswith("@import"):
                rules.append(prelude)
            continue

        if prelude.startswith("@"):
            nested_rules = extract_css(body, class_names)
            if nested_rules:
                rules.append(f"{prelude} {{\n{nested_rules}\n}}")
            continue

        if prelude == ":root":
            if include_globals:
                rules.append(f"{prelude} {{{body}\n}}")
            continue

        selected_selectors = []
        for selector in prelude.split(","):
            selector = selector.strip()
            selector_classes = set(re.findall(r"\.([_a-zA-Z][\w-]*)", selector))
            if selector in global_selectors and include_globals:
                selected_selectors.append(selector)
            elif (
                selector_classes
                and selector_classes.issubset(class_names | COMMON_CSS_CLASSES)
                and (
                    selector_classes.intersection(class_names)
                    or selector_classes.issubset(COMMON_CSS_CLASSES)
                )
            ):
                selected_selectors.append(selector)

        if selected_selectors:
            rules.append(f"{', '.join(selected_selectors)} {{{body}\n}}")

    return "\n\n".join(rules)


def get_theme_colors(stylesheet):
    root_match = re.search(r":root\s*\{([^}]*)\}", stylesheet, re.DOTALL)
    if root_match is None:
        return {}

    declarations = dict(
        re.findall(
            r"(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;",
            root_match.group(1),
        )
    )
    return {
        name: declarations[name]
        for name in THEME_COLOR_KEYS
        if name in declarations
    }


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/preview")
def preview():
    defaults = {
        "header": "minimal",
        "hero": "startup",
        "side_nav": "dashboard",
        "footer": "simple",
    }
    selected = {}
    selected_macros = {}

    for component, options in TEMPLATE_OPTIONS.items():
        choice = request.args.get(component, defaults[component])
        if choice not in options:
            abort(400, description=f"Unknown {component.replace('_', ' ')} option: {choice}")
        selected[component] = choice
        macro_name = options[choice][1]
        selected_macros[component] = (
            get_template_attribute("macros.html", macro_name)
            if macro_name is not None
            else None
        )
    side_nav_toggle_values = request.args.getlist("side_nav_toggle")
    side_nav_toggle = (
        "1" in side_nav_toggle_values
        if side_nav_toggle_values
        else selected["side_nav"] != "none"
    )
    side_nav_toggle = side_nav_toggle and selected["side_nav"] != "none"

    option_lists = {
        component: [(key, details[0]) for key, details in options.items()]
        for component, options in TEMPLATE_OPTIONS.items()
    }
    macro_sources = get_macro_sources()
    stylesheet = Path(app.static_folder, "style.css").read_text(encoding="utf-8")
    show_content_values = request.args.getlist("show_content")
    show_content = not show_content_values or "1" in show_content_values
    selected_code = {}
    selected_css = {}
    selected_labels = {}
    for component, choice in selected.items():
        macro_name = TEMPLATE_OPTIONS[component][choice][1]
        selected_code[component] = (
            macro_sources[macro_name] if macro_name is not None else None
        )
        selected_labels[component] = TEMPLATE_OPTIONS[component][choice][0]
        if macro_name is not None:
            rendered_macro = str(selected_macros[component]())
            if component == "side_nav" and side_nav_toggle:
                rendered_macro = str(
                    get_template_attribute("macros.html", "sidenav_toggle")(
                        selected_macros[component]
                    )
                )
            class_names = {
                class_name
                for class_attribute in re.findall(
                    r"""\bclass=["']([^"']+)["']""", rendered_macro
                )
                for class_name in class_attribute.split()
            }
            if component == "side_nav" and side_nav_toggle:
                class_names.update(
                    {"side-nav-layout", "is-nav-collapsed", "side-nav-page-content"}
                )
            selected_css[component] = extract_css(stylesheet, class_names)
        else:
            selected_css[component] = None

    if selected["side_nav"] != "none":
        nav_markup = str(selected_macros["side_nav"]()).strip()
        if side_nav_toggle:
            selected_code["side_nav"] = (
                '<div class="side-nav-layout">\n'
                '  <aside class="side-nav-component" data-side-nav-component>\n'
                '    <button class="side-nav-toggle" type="button" '
                'aria-controls="side-nav-panel" aria-expanded="true" '
                'data-side-nav-toggle>\n'
                '      <span class="side-nav-toggle-icon" aria-hidden="true">☰</span>\n'
                '      <span class="side-nav-toggle-label">Hide navigation</span>\n'
                '    </button>\n'
                '    <button class="side-nav-backdrop" type="button" '
                'aria-label="Close navigation" tabindex="-1" data-side-nav-close></button>\n'
                '    <div class="side-nav-drawer" id="side-nav-panel">\n'
                f'{nav_markup}\n'
                '    </div>\n'
                '  </aside>\n'
                '  <main class="side-nav-page-content">Your page content</main>\n'
                '</div>'
            )
            selected_code["side_nav_js"] = Path(
                app.static_folder, "side-nav.js"
            ).read_text(encoding="utf-8")
        else:
            selected_code["side_nav"] = nav_markup

    if show_content:
        sample_macros = ("extra_feature_cards", "extra_quote", "extra_cta")
        selected_code["sample_content"] = "\n\n".join(
            macro_sources[macro_name] for macro_name in sample_macros
        )
        selected_labels["sample_content"] = "Sample content"
        rendered_samples = [
            str(get_template_attribute("macros.html", macro_name)())
            for macro_name in sample_macros
        ]
        sample_classes = {
            class_name
            for rendered_sample in rendered_samples
            for class_attribute in re.findall(
                r"""\bclass=["']([^"']+)["']""", rendered_sample
            )
            for class_name in class_attribute.split()
        }
        selected_css["sample_content"] = extract_css(stylesheet, sample_classes)

    return render_template(
        "preview.html",
        selected=selected,
        selected_macros=selected_macros,
        option_lists=option_lists,
        selected_code=selected_code,
        selected_css=selected_css,
        shared_css=extract_css(stylesheet, set(), include_globals=True),
        theme_colors=get_theme_colors(stylesheet),
        show_content=show_content,
        side_nav_toggle=side_nav_toggle,
        selected_labels=selected_labels,
    )


if __name__ == "__main__":
    app.run(debug=True, port=5001)