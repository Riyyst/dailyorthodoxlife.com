(() => {
  "use strict";

  const PDF_URL = "assets/the-orthodox-study-bible.pdf";
  const PDF_DATA_MANIFEST = "assets/js/pdf-data-manifest.js";
  const PDF_DATA_DIRECTORY = "assets/pdf-data";
  const WORKER_URL = "assets/pdfjs/pdf.worker.min.js";
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.4;

  const state = {
    pdf: null,
    pageCount: 0,
    currentPage: 1,
    activePage: 1,
    zoom: 0.84,
    renderToken: 0,
    textCache: new Map(),
    interfaceScale: 1,
    navigationEntries: [],
    navigationTargets: [],
    embeddedPdfBytes: null,
    workerBlobUrl: null,
    stableStageHeight: 0,
  };

  const elements = {
    spread: document.getElementById("book-spread"),
    stage: document.getElementById("book-stage"),
    status: document.getElementById("reader-status"),
    previous: document.getElementById("previous-page-btn"),
    next: document.getElementById("next-page-btn"),
    locationLabel: document.getElementById("location-label"),
    bookSelect: document.getElementById("book-select"),
    partSelect: document.getElementById("part-select"),
    textSmaller: document.getElementById("text-smaller-btn"),
    textLarger: document.getElementById("text-larger-btn"),
    contrast: document.getElementById("contrast-btn"),
    ruler: document.getElementById("ruler-btn"),
    rulerOverlay: document.getElementById("reading-ruler"),
    textPanelButton: document.getElementById("text-panel-btn"),
    textPanel: document.getElementById("text-reader"),
    fullscreen: document.getElementById("fullscreen-btn"),
    pageText: document.getElementById("page-text-content"),
    searchInput: document.getElementById("text-search-input"),
    searchButton: document.getElementById("text-search-btn"),
  };

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve(existing);
        else existing.addEventListener("load", () => resolve(existing), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.dataset.dynamicSrc = src;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve(script);
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function createEmbeddedPdfBytes() {
    if (state.embeddedPdfBytes) return state.embeddedPdfBytes;

    setStatus("Preparing the local copy of the book…");
    if (!Number.isInteger(window.ORTHODOX_PDF_DATA_CHUNK_COUNT)) {
      await loadScript(PDF_DATA_MANIFEST);
    }

    const chunkCount = window.ORTHODOX_PDF_DATA_CHUNK_COUNT;
    if (!Number.isInteger(chunkCount) || chunkCount < 1) {
      throw new Error("The local PDF data is missing.");
    }

    window.ORTHODOX_PDF_DATA_CHUNKS = window.ORTHODOX_PDF_DATA_CHUNKS || [];
    const scripts = [];
    const batchSize = 8;

    for (let batchStart = 1; batchStart <= chunkCount; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, chunkCount);
      const batch = [];
      for (let index = batchStart; index <= batchEnd; index += 1) {
        const src = `${PDF_DATA_DIRECTORY}/chunk-${String(index).padStart(3, "0")}.js`;
        batch.push(loadScript(src));
      }
      scripts.push(...await Promise.all(batch));
      const percent = Math.round((batchEnd / chunkCount) * 100);
      setStatus(`Preparing the local copy of the book, ${percent} percent.`);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    const byteParts = [];
    let totalLength = 0;
    for (let index = 0; index < chunkCount; index += 1) {
      const encoded = window.ORTHODOX_PDF_DATA_CHUNKS[index];
      if (typeof encoded !== "string") throw new Error(`PDF data chunk ${index + 1} is missing.`);
      const binary = window.atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let byteIndex = 0; byteIndex < binary.length; byteIndex += 1) {
        bytes[byteIndex] = binary.charCodeAt(byteIndex);
      }
      byteParts.push(bytes);
      totalLength += bytes.length;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    byteParts.forEach((part) => {
      combined.set(part, offset);
      offset += part.length;
    });

    scripts.forEach((script) => script.remove());
    window.ORTHODOX_PDF_DATA_CHUNKS = null;
    state.embeddedPdfBytes = combined;
    return combined;
  }

  function configurePdfWorker() {
    if (!window.pdfjsLib) return;

    if (window.location.protocol === "file:" && typeof window.ORTHODOX_PDF_WORKER_SOURCE === "string") {
      const workerBlob = new Blob([window.ORTHODOX_PDF_WORKER_SOURCE], { type: "text/javascript" });
      state.workerBlobUrl = URL.createObjectURL(workerBlob);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = state.workerBlobUrl;
      window.ORTHODOX_PDF_WORKER_SOURCE = null;
      return;
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
  }

  function getVisiblePages() {
    if (!state.pdf) return [];
    return [state.currentPage];
  }

  function clampPage(value) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) return state.currentPage;
    return Math.min(Math.max(numeric, 1), state.pageCount || 1);
  }

  function normalisePartLabel(bookLabel, partLabel) {
    if (partLabel === "Introduction" || !/^\d+$/.test(partLabel)) return partLabel;
    return bookLabel === "Psalms" ? `Psalm ${partLabel}` : `Chapter ${partLabel}`;
  }

  function buildNavigation() {
    const source = window.ORTHODOX_BIBLE_NAVIGATION;
    if (!source) return;

    const entries = [];
    const groups = [
      ["Front matter", "front", source.frontMatter || []],
      ["Old Testament", "old", source.oldTestament || []],
      ["New Testament", "new", source.newTestament || []],
      ["Study and prayer", "study", source.studyAndPrayer || []],
    ];

    elements.bookSelect.innerHTML = "";

    groups.forEach(([groupLabel, prefix, items]) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = groupLabel;

      items.forEach((item, index) => {
        const key = `${prefix}:${index}`;
        const entry = { ...item, key, groupLabel };
        entries.push(entry);

        const option = document.createElement("option");
        option.value = key;
        option.textContent = item.label;
        optgroup.appendChild(option);
      });

      elements.bookSelect.appendChild(optgroup);
    });

    state.navigationEntries = entries;
    state.navigationTargets = entries.flatMap((entry) => {
      if (Array.isArray(entry.parts) && entry.parts.length) {
        return entry.parts.map((part, partIndex) => ({
          page: part.page,
          entryKey: entry.key,
          partIndex,
          label: `${entry.label}, ${normalisePartLabel(entry.label, part.label)}`,
        }));
      }
      return [{
        page: entry.page,
        entryKey: entry.key,
        partIndex: -1,
        label: entry.label,
      }];
    }).sort((a, b) => a.page - b.page);

    elements.bookSelect.value = entries[0]?.key || "";
    populatePartSelect(entries[0], null);
  }

  function getEntryByKey(key) {
    return state.navigationEntries.find((entry) => entry.key === key) || null;
  }

  function populatePartSelect(entry, selectedIndex = null) {
    elements.partSelect.innerHTML = "";
    const parts = entry && Array.isArray(entry.parts) ? entry.parts : [];

    if (!parts.length) {
      elements.partSelect.hidden = true;
      elements.partSelect.disabled = true;
      return;
    }

    elements.partSelect.hidden = false;
    elements.partSelect.disabled = false;

    const placeholder = document.createElement("option");
    placeholder.value = "__book_start__";
    placeholder.textContent = "Chapters";
    placeholder.title = `Open ${entry.label} start`;
    elements.partSelect.appendChild(placeholder);

    parts.forEach((part, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = normalisePartLabel(entry.label, part.label);
      elements.partSelect.appendChild(option);
    });

    if (Number.isInteger(selectedIndex) && selectedIndex >= 0) {
      elements.partSelect.value = String(Math.min(selectedIndex, parts.length - 1));
    } else {
      elements.partSelect.value = "__book_start__";
    }
  }

  function findNavigationTarget(pageNumber) {
    let best = state.navigationTargets[0] || null;
    for (const target of state.navigationTargets) {
      if (target.page > pageNumber) break;
      best = target;
    }
    return best;
  }

  function syncNavigationToPage(pageNumber, persist = true) {
    const target = findNavigationTarget(pageNumber);
    if (!target) {
      elements.locationLabel.textContent = pageNumber === 1 ? "Cover" : "The Orthodox Study Bible";
      return;
    }

    const entry = getEntryByKey(target.entryKey);
    if (!entry) return;

    elements.bookSelect.value = entry.key;
    populatePartSelect(entry, target.partIndex < 0 ? null : target.partIndex);
    elements.locationLabel.textContent = target.label;
    if (persist) {
      try {
        localStorage.setItem("orthodoxBiblePage", String(pageNumber));
        localStorage.setItem("orthodoxBibleLocation", target.label);
      } catch (_) {}
    }
  }

  function navigateFromBookSelect() {
    const entry = getEntryByKey(elements.bookSelect.value);
    if (!entry) return;
    populatePartSelect(entry, null);
    setCurrentPage(entry.page);
  }

  function navigateFromPartSelect() {
    const entry = getEntryByKey(elements.bookSelect.value);
    if (!entry || !Array.isArray(entry.parts)) return;
    if (elements.partSelect.value === "__book_start__") {
      setCurrentPage(entry.page);
      return;
    }
    const partIndex = Number.parseInt(elements.partSelect.value, 10);
    if (!Number.isInteger(partIndex)) return;
    const part = entry.parts[partIndex];
    if (part) setCurrentPage(part.page);
  }

  function setCurrentPage(pageNumber, options = {}) {
    const nextPage = clampPage(pageNumber);
    state.currentPage = nextPage;
    state.activePage = nextPage;
    syncNavigationToPage(nextPage, options.persist !== false);
    renderSpread();
    updateAccessibleText(nextPage);
  }

  function updateNavigationButtons(pages) {
    elements.previous.disabled = state.currentPage <= 1;
    elements.next.disabled = pages.length === 0 || pages[pages.length - 1] >= state.pageCount;
  }

  function calculatePageWidth(baseViewport) {
    const availableWidth = Math.max(elements.stage.clientWidth - 12, 250);
    const fullscreen = document.fullscreenElement === elements.stage;

    if (fullscreen) {
      const availableHeight = Math.max(window.innerHeight - 28, 320);
      const widthFromHeight = availableHeight * (baseViewport.width / baseViewport.height);
      const fittedWidth = Math.min(availableWidth, widthFromHeight, 1120);
      elements.stage.style.height = `${Math.round(availableHeight)}px`;
      elements.stage.classList.toggle("is-enlarged", fittedWidth * state.zoom > availableWidth + 1);
      return Math.max(260, fittedWidth * state.zoom);
    }

    const viewport = window.innerWidth;
    const desktopCap = viewport >= 1500 ? 540 : viewport >= 1100 ? 520 : viewport >= 760 ? 490 : availableWidth;
    const responsiveScale = viewport < 560 ? 1.08 : viewport < 760 ? 1.02 : 1;
    const fittedWidth = Math.min(availableWidth, desktopCap);
    const targetWidth = Math.max(250, fittedWidth * state.zoom * responsiveScale);

    elements.stage.style.height = "auto";
    elements.stage.classList.toggle("is-enlarged", targetWidth > availableWidth + 1);
    return targetWidth;
  }

  async function renderSpread() {
    if (!state.pdf) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const currentPageNode = elements.spread.querySelector(".book-page");
    const currentHeight = currentPageNode ? currentPageNode.getBoundingClientRect().height : elements.stage.getBoundingClientRect().height;
    if (currentHeight > 0) {
      state.stableStageHeight = Math.ceil(currentHeight);
      elements.stage.style.minHeight = `${state.stableStageHeight}px`;
    }

    const token = ++state.renderToken;
    const pages = getVisiblePages();
    elements.spread.innerHTML = "";
    elements.spread.classList.toggle("single-page", pages.length === 1);
    updateNavigationButtons(pages);
    setStatus("Opening the selected pages…");

    try {
      const rendered = await Promise.all(pages.map((pageNumber) => renderPage(pageNumber, token)));
      if (token !== state.renderToken) return;
      rendered.forEach((node) => elements.spread.appendChild(node));
      const renderedPage = elements.spread.querySelector(".book-page");
      if (renderedPage) {
        state.stableStageHeight = Math.ceil(renderedPage.getBoundingClientRect().height);
        elements.stage.style.minHeight = `${state.stableStageHeight}px`;
      }
      markActivePage();
      setStatus("");
      if (!document.fullscreenElement) {
        requestAnimationFrame(() => window.scrollTo({ left: scrollX, top: scrollY, behavior: "auto" }));
      }
    } catch (error) {
      if (token !== state.renderToken) return;
      console.error(error);
      setStatus("This part of the book could not be displayed.");
      elements.spread.innerHTML = '<div class="page-loading">This page could not be displayed. Use another chapter shortcut or reload the reader.</div>';
    }
  }

  async function renderPage(pageNumber, token) {
    const wrapper = document.createElement("div");
    wrapper.className = "book-page";
    wrapper.tabIndex = 0;
    wrapper.dataset.pageNumber = String(pageNumber);
    wrapper.setAttribute("aria-label", `Book page ${pageNumber}`);
    wrapper.innerHTML = '<div class="page-loading">Turning the page…</div>';

    wrapper.addEventListener("pointerdown", () => activatePage(pageNumber));
    wrapper.addEventListener("focus", () => activatePage(pageNumber));

    const page = await state.pdf.getPage(pageNumber);
    if (token !== state.renderToken) return wrapper;

    const baseViewport = page.getViewport({ scale: 1 });
    const pageWidth = calculatePageWidth(baseViewport);
    const cssScale = pageWidth / baseViewport.width;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
    const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
    const cssViewport = page.getViewport({ scale: cssScale });

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.max(1, Math.floor(renderViewport.width));
    canvas.height = Math.max(1, Math.floor(renderViewport.height));
    canvas.style.width = `${Math.floor(cssViewport.width)}px`;
    canvas.style.height = `${Math.floor(cssViewport.height)}px`;

    await page.render({ canvasContext: context, viewport: renderViewport }).promise;
    if (token !== state.renderToken) return wrapper;

    wrapper.innerHTML = "";
    wrapper.style.width = `${Math.floor(cssViewport.width)}px`;
    wrapper.style.height = `${Math.floor(cssViewport.height)}px`;
    wrapper.appendChild(canvas);

    await renderInteractiveLayers(page, wrapper, cssViewport, pageNumber);

    return wrapper;
  }

  async function renderInteractiveLayers(page, wrapper, viewport, pageNumber) {
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    textLayer.style.setProperty("--scale-factor", String(viewport.scale));
    textLayer.style.width = `${Math.floor(viewport.width)}px`;
    textLayer.style.height = `${Math.floor(viewport.height)}px`;
    wrapper.appendChild(textLayer);

    try {
      const textContent = await page.getTextContent({ includeMarkedContent: true });
      const task = window.pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport,
        textDivs: [],
      });
      await task.promise;
    } catch (error) {
      console.warn(`Text selection layer could not be rendered for page ${pageNumber}.`, error);
      textLayer.remove();
    }

    const annotationLayer = document.createElement("div");
    annotationLayer.className = "annotation-layer";
    annotationLayer.style.width = `${Math.floor(viewport.width)}px`;
    annotationLayer.style.height = `${Math.floor(viewport.height)}px`;
    wrapper.appendChild(annotationLayer);

    try {
      const annotations = await page.getAnnotations({ intent: "display" });
      annotations.filter((annotation) => annotation.subtype === "Link" && Array.isArray(annotation.rect))
        .forEach((annotation) => addPdfLink(annotationLayer, annotation, viewport));
    } catch (error) {
      console.warn(`PDF links could not be rendered for page ${pageNumber}.`, error);
      annotationLayer.remove();
    }
  }

  function addPdfLink(layer, annotation, viewport) {
    const rectangle = viewport.convertToViewportRectangle(annotation.rect);
    const left = Math.min(rectangle[0], rectangle[2]);
    const top = Math.min(rectangle[1], rectangle[3]);
    const width = Math.abs(rectangle[2] - rectangle[0]);
    const height = Math.abs(rectangle[3] - rectangle[1]);
    if (width < 2 || height < 2) return;

    const link = document.createElement("a");
    link.className = "pdf-link";
    link.style.left = `${left}px`;
    link.style.top = `${top}px`;
    link.style.width = `${width}px`;
    link.style.height = `${height}px`;
    link.setAttribute("aria-label", annotation.url ? "Open linked website" : "Open linked page in the book");
    link.title = annotation.url ? "Open linked website" : "Open linked page";
    link.addEventListener("pointerdown", (event) => event.stopPropagation());

    if (annotation.url) {
      link.href = annotation.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      link.href = "#book-stage";
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await followPdfDestination(annotation);
      });
    }

    layer.appendChild(link);
  }

  async function followPdfDestination(annotation) {
    try {
      if (annotation.action === "NextPage") {
        nextPages();
        return;
      }
      if (annotation.action === "PrevPage") {
        previousPages();
        return;
      }
      if (annotation.action === "FirstPage") {
        setCurrentPage(1);
        return;
      }
      if (annotation.action === "LastPage") {
        setCurrentPage(state.pageCount);
        return;
      }

      let destination = annotation.dest;
      if (typeof destination === "string") {
        destination = await state.pdf.getDestination(destination);
      }
      if (!Array.isArray(destination) || !destination.length) {
        setStatus("This PDF link does not contain a usable destination.");
        return;
      }

      const reference = destination[0];
      let pageIndex;
      if (Number.isInteger(reference)) {
        pageIndex = reference;
      } else {
        pageIndex = await state.pdf.getPageIndex(reference);
      }
      setCurrentPage(pageIndex + 1);
      setStatus("Opened the linked page.");
    } catch (error) {
      console.error(error);
      setStatus("This PDF link could not be opened.");
    }
  }

  function activatePage(pageNumber) {
    if (state.activePage === pageNumber) return;
    state.activePage = pageNumber;
    syncNavigationToPage(pageNumber);
    markActivePage();
    updateAccessibleText(pageNumber);
  }

  function markActivePage() {
    document.querySelectorAll(".book-page").forEach((page) => {
      page.classList.toggle("active-page", Number(page.dataset.pageNumber) === state.activePage);
    });
  }

  async function getPageText(pageNumber) {
    if (state.textCache.has(pageNumber)) return state.textCache.get(pageNumber);

    const page = await state.pdf.getPage(pageNumber);
    const textContent = await page.getTextContent({ normalizeWhitespace: true });
    const lines = [];
    let currentLine = "";
    let previousY = null;

    for (const item of textContent.items) {
      const value = item.str || "";
      const y = item.transform ? Math.round(item.transform[5]) : null;
      if (previousY !== null && y !== null && Math.abs(y - previousY) > 5 && currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      currentLine += `${value}${item.hasEOL ? "\n" : " "}`;
      if (item.hasEOL && currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      previousY = y;
    }

    if (currentLine.trim()) lines.push(currentLine.trim());
    const text = lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    state.textCache.set(pageNumber, text);
    return text;
  }

  async function updateAccessibleText(pageNumber) {
    elements.pageText.textContent = "Loading page text…";
    elements.searchInput.value = "";

    try {
      const text = await getPageText(pageNumber);
      if (state.activePage !== pageNumber) return;
      renderTextWords(text || "No extractable text was found on this page.");
    } catch (error) {
      console.error(error);
      elements.pageText.textContent = "The text for this page could not be extracted.";
    }
  }

  function renderTextWords(text) {
    elements.pageText.innerHTML = "";
    const tokens = text.match(/\S+|\s+/g) || [];
    let offset = 0;

    tokens.forEach((token) => {
      if (/^\s+$/.test(token)) {
        elements.pageText.appendChild(document.createTextNode(token));
      } else {
        const span = document.createElement("span");
        span.className = "word";
        span.textContent = token;
        span.dataset.start = String(offset);
        span.dataset.end = String(offset + token.length);
        elements.pageText.appendChild(span);
      }
      offset += token.length;
    });
  }

  function showTextPanel(show = true) {
    elements.textPanel.hidden = !show;
    elements.textPanelButton.setAttribute("aria-expanded", String(show));
    elements.textPanelButton.setAttribute("aria-label", show ? "Hide accessible page text" : "Show accessible page text");
    elements.textPanelButton.title = show ? "Hide accessible text" : "Accessible text view";
    elements.textPanelButton.classList.toggle("is-active", show);
  }

  function toggleTextPanel() {
    showTextPanel(elements.textPanel.hidden);
  }

  function changeTextSize(delta) {
    state.zoom = Math.min(Math.max(state.zoom + delta, MIN_ZOOM), MAX_ZOOM);
    state.interfaceScale = Math.min(Math.max(state.interfaceScale + delta, 0.85), 1.6);
    document.documentElement.style.setProperty("--text-size", `${state.interfaceScale.toFixed(2)}rem`);
    window.clearTimeout(changeTextSize.renderTimer);
    changeTextSize.renderTimer = window.setTimeout(renderSpread, 90);
    setStatus(`Page size set to ${Math.round(state.zoom * 100)} percent.`);
  }

  function findOnPage() {
    const query = elements.searchInput.value.trim();
    const fullText = elements.pageText.textContent;
    renderTextWords(fullText);

    if (!query) {
      setStatus("Enter a word or phrase to find on this page.");
      return;
    }

    const walker = document.createTreeWalker(elements.pageText, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let combined = "";
    while (walker.nextNode()) {
      textNodes.push({ node: walker.currentNode, start: combined.length });
      combined += walker.currentNode.nodeValue;
    }

    const matchIndex = combined.toLowerCase().indexOf(query.toLowerCase());
    if (matchIndex === -1) {
      setStatus(`“${query}” was not found on the active page.`);
      return;
    }

    const matchEnd = matchIndex + query.length;
    for (const entry of textNodes) {
      const nodeStart = entry.start;
      const nodeEnd = nodeStart + entry.node.nodeValue.length;
      if (matchEnd <= nodeStart || matchIndex >= nodeEnd) continue;

      const localStart = Math.max(0, matchIndex - nodeStart);
      const localEnd = Math.min(entry.node.nodeValue.length, matchEnd - nodeStart);
      const range = document.createRange();
      range.setStart(entry.node, localStart);
      range.setEnd(entry.node, localEnd);
      const mark = document.createElement("mark");
      range.surroundContents(mark);
      mark.scrollIntoView({ block: "center" });
      break;
    }

    setStatus(`Found “${query}”.`);
  }

  function nextPages() {
    setCurrentPage(Math.min(state.currentPage + 1, state.pageCount));
  }

  function previousPages() {
    setCurrentPage(Math.max(state.currentPage - 1, 1));
  }

  function toggleContrast() {
    const enabled = document.body.classList.toggle("high-contrast");
    elements.contrast.setAttribute("aria-pressed", String(enabled));
    setStatus(enabled ? "High contrast enabled." : "High contrast disabled.");
  }

  function toggleRuler() {
    const enabled = document.body.classList.toggle("ruler-enabled");
    elements.ruler.setAttribute("aria-pressed", String(enabled));
    setStatus(enabled ? "Reading ruler enabled." : "Reading ruler disabled.");
  }

  function adjustZoom(delta) {
    state.zoom = Math.min(Math.max(state.zoom + delta, MIN_ZOOM), MAX_ZOOM);
    renderSpread();
    setStatus(`Book zoom set to ${Math.round(state.zoom * 100)} percent.`);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await elements.stage.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error(error);
      setStatus("Full screen mode is unavailable in this browser.");
    } finally {
      window.setTimeout(renderSpread, 120);
    }
  }

  function bindEvents() {
    elements.previous.addEventListener("click", previousPages);
    elements.next.addEventListener("click", nextPages);
    elements.bookSelect.addEventListener("change", navigateFromBookSelect);
    elements.partSelect.addEventListener("change", navigateFromPartSelect);
    elements.partSelect.addEventListener("input", navigateFromPartSelect);
    elements.textSmaller.addEventListener("click", () => changeTextSize(-0.1));
    elements.textLarger.addEventListener("click", () => changeTextSize(0.1));
    elements.contrast.addEventListener("click", toggleContrast);
    elements.ruler.addEventListener("click", toggleRuler);
    elements.textPanelButton.addEventListener("click", toggleTextPanel);
    elements.fullscreen.addEventListener("click", toggleFullscreen);
    elements.searchButton.addEventListener("click", findOnPage);
    elements.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") findOnPage();
    });

    document.addEventListener("pointermove", (event) => {
      if (!document.body.classList.contains("ruler-enabled")) return;
      elements.rulerOverlay.style.top = `${Math.max(8, Math.min(event.clientY - 12, window.innerHeight - 32))}px`;
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (typing) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextPages();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousPages();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeTextSize(0.1);
      } else if (event.key === "-") {
        event.preventDefault();
        changeTextSize(-0.1);
      }
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        state.stableStageHeight = 0;
        elements.stage.style.minHeight = "0";
        renderSpread();
      }, 180);
    });

    window.addEventListener("beforeunload", () => {
      if (state.workerBlobUrl) URL.revokeObjectURL(state.workerBlobUrl);
    });
  }

  async function loadPdfDocument() {
    if (window.location.protocol === "file:") {
      const embeddedBytes = await createEmbeddedPdfBytes();
      return window.pdfjsLib.getDocument({
        data: embeddedBytes,
        disableRange: true,
        disableStream: true,
        disableAutoFetch: true,
      });
    }

    return window.pdfjsLib.getDocument({
      url: PDF_URL,
      disableAutoFetch: false,
    });
  }

  async function initialise() {
    if (!window.pdfjsLib) {
      setStatus("The book reader could not start.");
      return;
    }

    buildNavigation();
    bindEvents();
    configurePdfWorker();

    try {
      let loadingTask = await loadPdfDocument();
      loadingTask.onProgress = ({ loaded, total }) => {
        if (total) {
          const percent = Math.min(100, Math.round((loaded / total) * 100));
          setStatus(`Loading the book, ${percent} percent.`);
        }
      };

      try {
        state.pdf = await loadingTask.promise;
      } catch (firstError) {
        if (window.location.protocol === "file:") throw firstError;
        console.warn("The normal PDF file could not be opened. Trying the embedded copy.", firstError);
        const embeddedBytes = await createEmbeddedPdfBytes();
        loadingTask = window.pdfjsLib.getDocument({
          data: embeddedBytes,
          disableRange: true,
          disableStream: true,
          disableAutoFetch: true,
        });
        state.pdf = await loadingTask.promise;
      }

      state.pageCount = state.pdf.numPages;
      setCurrentPage(1, { persist: false });
    } catch (error) {
      console.error(error);
      setStatus("The book could not be opened.");
      elements.spread.innerHTML = '<div class="page-loading">The book could not be opened. Please reload this page.</div>';
    }
  }

  initialise();
})();
