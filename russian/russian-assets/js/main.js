
document.addEventListener("DOMContentLoaded", () => {
  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  let currentCalendar = "julian"; // Old calendar by default
  let currentDate = new Date();   // month shown in selector
  let selectedDate = new Date();  // day whose data is shown on the left


  function withMainAnimation(updateFn, options) {
    const main = document.querySelector(".app-main");
    const opts = options || {};
    const scrollToTop = !!opts.scrollToTop;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (!main) {
      updateFn();
      return;
    }

    const DURATION = 230; // keep in sync with CSS

    // Phase 1: fade out
    main.classList.add("is-updating");

    setTimeout(() => {
      // Phase 2: run update while faded out
      const maybePromise = updateFn();

      const finish = () => {
        // Force reflow so the browser recognizes DOM changes
        void main.offsetWidth;

        // Restore scroll position (or force top)
        window.scrollTo(0, scrollToTop ? 0 : scrollY);

        // Phase 3: fade back in
        main.classList.remove("is-updating");
      };

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.finally(finish);
      } else {
        finish();
      }
    }, DURATION);
  }

function updateCivilDate() {
    const el = document.getElementById("civil-date");
    if (!el) return;
    const fmt = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    el.textContent = fmt.format(selectedDate);
  }

  function monthName(num) {
    const names = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return names[num] || "";
  }

  function setToggleUI() {
    const julBtn = document.getElementById("toggle-julian");
    const gregBtn = document.getElementById("toggle-gregorian");
    if (!julBtn || !gregBtn) return;

    if (currentCalendar === "julian") {
      julBtn.classList.add("active");
      gregBtn.classList.remove("active");
    } else {
      gregBtn.classList.add("active");
      julBtn.classList.remove("active");
    }
  }

  function apiDayUrl(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `https://orthocal.info/api/slavic/${currentCalendar}/${y}/${m}/${d}/?translation=kjv`;
  }

  // Normalise Orthocal references like "1 Timothy 1.18-20, 2.8-15" -> "1 Timothy 1:18-20"
  function normaliseReference(ref) {
    if (!ref) return "";
    let firstPart = ref.split(",")[0].trim();
    firstPart = firstPart.replace(/(\d)\.(\d)/g, "$1:$2");
    return firstPart;
  }

  // Bible text API (KJV via bible-api.com – free, public domain)
  async function fetchBiblePassage(reference) {
    if (!reference) return "";
    const displayRef = reference.replace(/\.$/, "");
    const normalised = normaliseReference(displayRef);
    if (!normalised) return displayRef;

    const url = `https://bible-api.com/${encodeURIComponent(normalised)}?translation=kjv`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (data && data.text) {
        return `${displayRef} (KJV)\n\n${data.text.trim()}`;
      }
    } catch (e) {
      console.error("Bible API error:", e);
    }
    return `${displayRef}\n\nPassage text could not be loaded. Please open this reference in your Bible.`;
  }

  function resetToday() {
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setText("calendar-date-label", "—");
    setText("liturgical-date", "—");

    ["feast-list", "saints-list", "service-notes-list", "readings-list", "fast-list"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
      }
    );

    const notes = document.getElementById("service-notes");
    if (notes) notes.style.display = "none";

    const readingsEmpty = document.getElementById("readings-empty");
    if (readingsEmpty) readingsEmpty.style.display = "none";

    const errorEl = document.getElementById("summary-error");
    if (errorEl) errorEl.style.display = "none";
  }

  function extraFastFoods(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("fast-free") || t.includes("no fasting") || t.includes("no fast")) {
    return [];
  }
  let foods = new Set();

  // Explicit "no X" phrases in the Orthocal text
  if (t.includes("no meat") || t.includes("without meat") || t.includes("abstain from meat")) {
    foods.add("meat");
  }
  if (t.includes("no dairy") || t.includes("without dairy")) {
    foods.add("dairy");
  }
  if (t.includes("no eggs") || t.includes("without eggs")) {
    foods.add("eggs");
  }
  if (t.includes("no fish") || t.includes("without fish")) {
    foods.add("fish");
  }
  if (t.includes("no oil") || t.includes("no olive oil") || t.includes("without oil")) {
    foods.add("oil");
  }
  if (t.includes("no wine") || t.includes("no alcoholic") || t.includes("no alcohol")) {
    foods.add("wine");
  }
  if (t.includes("no animal products")) {
    ["meat", "dairy", "eggs"].forEach((f) => foods.add(f));
  }

  // Generic patterns by fast name (fallback)
  if (t.includes("strict fast")) {
    ["meat", "dairy", "eggs", "fish", "oil", "wine"].forEach((f) => foods.add(f));
  }
  if (
      t.includes("nativity fast") ||
      t.includes("great lent") ||
      t.includes("great fast") ||
      t.includes("lenten fast") ||
      t.includes("dormition") ||
      t.includes("apostles fast")
    ) {
      ["meat", "dairy"].forEach((f) => foods.add(f));
  }

  // If we still have nothing but the word "fast" is present, assume at least meat.
  if (t.includes("fast") && foods.size === 0) {
    foods.add("meat");
  }

  return Array.from(foods);
}


const FAST_FOOD_CATEGORIES = ["Meat", "Dairy", "Eggs", "Fish", "Wine", "Oil"];

/**
 * From Orthocal fast descriptions, compute which foods are allowed and forbidden.
 */



function computeFastRules(fastLevelDesc, fastExceptionDesc, fastLevel, fastException) {
  const combined = ((fastLevelDesc || "") + " " + (fastExceptionDesc || "")).trim();
  const t = combined.toLowerCase();
  const level = Number(fastLevel);
  const exception = Number(fastException);
  const allFoods = ["Meat", "Fish", "Dairy", "Eggs", "Wine", "Oil"];

  const explicitlyNoFast =
    level === 0 || exception === 11 ||
    t.includes("fast-free") || t.includes("fast free") ||
    t.includes("no fast") || t.includes("no fasting");

  if (explicitlyNoFast || (!combined && !Number.isFinite(level))) {
    return { label: combined || "No fast", isNoFast: true, allowed: allFoods.slice(), forbidden: [] };
  }

  const isFast = (Number.isFinite(level) && level > 0) || t.includes("fast") || t.includes("lent");
  if (!isFast) {
    return { label: combined || "No fast", isNoFast: true, allowed: allFoods.slice(), forbidden: [] };
  }

  const allowedSet = new Set();
  const forbiddenSet = new Set(allFoods);
  const allow = (...foods) => foods.forEach(food => { forbiddenSet.delete(food); allowedSet.add(food); });

  // Orthocal's exception values/descriptions are the authoritative relaxation for a fast day.
  if (exception === 7 || t.includes("meat fast") || t.includes("cheese-fare") || t.includes("cheese fare") || t.includes("cheesefare")) {
    allow("Dairy", "Eggs", "Fish", "Wine", "Oil");
  } else if ([2, 4].includes(exception) || t.includes("fish, wine and oil") || t.includes("fish, wine & oil") || t.includes("fish wine and oil")) {
    allow("Fish", "Wine", "Oil");
  } else if ([1, 3, 8].includes(exception) || t.includes("wine and oil") || t.includes("wine & oil")) {
    allow("Wine", "Oil");
  } else if (exception === 5 || t.includes("wine is allowed") || t.includes("wine allowed")) {
    allow("Wine");
  } else if (exception === 6 || t.includes("wine, oil and caviar") || t.includes("wine oil and caviar")) {
    allow("Wine", "Oil");
  }

  // Explicit phrases override the general exception map if the API wording is more specific.
  if (t.includes("fish allowed") || t.includes("fish is allowed")) allow("Fish");
  if (t.includes("wine allowed") || t.includes("wine is allowed")) allow("Wine");
  if (t.includes("oil allowed") || t.includes("oil is allowed") || t.includes("olive oil allowed")) allow("Oil");

  const forbid = food => { forbiddenSet.add(food); allowedSet.delete(food); };
  if (t.includes("no meat") || t.includes("abstain from meat")) forbid("Meat");
  if (t.includes("no dairy") || t.includes("abstain from dairy")) forbid("Dairy");
  if (t.includes("no eggs") || t.includes("abstain from eggs")) forbid("Eggs");
  if (t.includes("no fish") || t.includes("abstain from fish")) forbid("Fish");
  if (t.includes("no wine") || t.includes("abstain from wine") || t.includes("no alcohol")) forbid("Wine");
  if (t.includes("no oil") || t.includes("abstain from oil") || t.includes("no olive oil")) forbid("Oil");

  return {
    label: fastLevelDesc || combined || "Fast",
    isNoFast: false,
    allowed: Array.from(allowedSet),
    forbidden: Array.from(forbiddenSet),
    exceptionText: fastExceptionDesc || "",
    specialAllowed: exception === 6 ? ["Caviar"] : []
  };
}


function normalizeReadingText(raw) {
  if (!raw) return "";
  const s = String(raw).replace(/\r\n/g, "\n");
  const paragraphs = s.split(/\n{2,}/);
  const cleaned = paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  return cleaned.join("\n\n");
}


function normalizeCommemorationLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&[^;]+;/g, " ")
    .replace(/\bst[.]?\b/g, "saint")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAdministrativeCommemoration(title) {
  const t = normalizeCommemorationLabel(title);
  return /^(canonization|glorification)\b/.test(t) || /\b(canonization|glorification)\s+of\b/.test(t);
}

function findStoryForSaint(data, name, index = -1) {
  const stories = Array.isArray(data?.stories) ? data.stories.filter(Boolean) : [];
  if (!stories.length || !name) return null;

  const target = normalizeCommemorationLabel(name);
  const stop = new Set(["saint","holy","martyr","martyrs","venerable","apostle","hieromartyr","bishop","priest","monk","nun","new","the","of","and","our","father","mother"]);
  const targetTokens = target.split(" ").filter(w => w.length > 2 && !stop.has(w));
  let best = null;
  let bestScore = 0;

  stories.forEach((story, storyIndex) => {
    const title = normalizeCommemorationLabel(story?.title || story?.name || "");
    if (!title) return;
    if (title === target || title.includes(target) || target.includes(title)) {
      const score = 1000 - Math.abs(title.length - target.length);
      if (score > bestScore) { best = story; bestScore = score; }
      return;
    }
    const titleTokens = new Set(title.split(" ").filter(w => w.length > 2 && !stop.has(w)));
    const hits = targetTokens.filter(w => titleTokens.has(w)).length;
    const score = targetTokens.length ? hits / targetTokens.length : 0;
    if (score > bestScore && (hits >= 2 || score >= .67)) {
      best = story;
      bestScore = score;
    }
  });

  // Orthocal commonly returns saints and stories in corresponding order. Use that
  // only when name matching could not identify a story and the indexed story exists.
  if (!best && index >= 0 && stories[index]) best = stories[index];
  return best;
}

function findCommemorationDetail(data, name, index = -1) {
  if (!data || !name) return "";
  const n = name.trim().toLowerCase();

  // Orthocal's documented daily endpoint supplies lives of the saints in `stories`.
  const story = findStoryForSaint(data, name, index);
  if (story) {
    const text = story.story || story.text || story.description || story.life || "";
    if (text) return String(text).trim();
  }

  // Helper: deep search data for a long string mentioning this name
  function deepSearch(obj) {
    if (!obj || typeof obj !== "object") return "";
    if (Array.isArray(obj)) {
      for (const v of obj) {
        const res = typeof v === "object" ? deepSearch(v) : "";
        if (res) return res;
      }
      return "";
    }
    // plain object
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        const text = value.trim();
        if (text.length > 200) {
          const tLower = text.toLowerCase();
          // Only use significant words from the saint's name, not generic titles
          const STOP_WORDS = new Set([
            "saint","st","holy","most","great","martyr","martyrs","venerable",
            "apostle","hieromartyr","wonderworker","and","of","the","with",
            "from","in","on","for","to","our","father","mother","virgin",
            "confessor","bishop","priest","monk","nun","new","equal","apostles"
          ]);
          const tokens = n
            .split(/\s+/)
            .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
            .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
          let hits = 0;
          for (const w of tokens) {
            if (tLower.includes(w)) {
              hits++;
              if (hits >= 2) {
                return text;
              }
            }
          }
        }
      } else if (typeof value === "object") {
        const res = deepSearch(value);
        if (res) return res;
      }
    }
    return "";
  }

  // Try a 'commemorations' array if present
    if (Array.isArray(data.commemorations)) {
      for (const item of data.commemorations) {
        const title = (item.title || item.name || item.commemoration || "").trim();
        const text =
          item.text ||
          item.description ||
          item.bio ||
          item.life ||
          item.synaxarion ||
          "";
        if (!text) continue;
        const tLower = title.toLowerCase();
        if (tLower && (tLower.includes(n) || n.includes(tLower))) {
          return String(text).trim();
        }
      }
    }

    // Try a 'saint_details' style array if present
    if (Array.isArray(data.saint_details)) {
      for (const item of data.saint_details) {
        const title = (item.title || item.name || "").trim();
        const text = item.text || item.description || "";
        if (!text) continue;
        const tLower = title.toLowerCase();
        if (tLower && (tLower.includes(n) || n.includes(tLower))) {
          return String(text).trim();
        }
      }
    }

    

  // Fallback: deep search any nested long text that mentions this name
  const deep = deepSearch(data);
  if (deep) return deep;

  return "";
}
function findFeastDetail(data, name) {
  if (!data || !name) return "";
  const n = name.trim().toLowerCase();

  function deepSearch(obj) {
    if (!obj || typeof obj !== "object") return "";
    if (Array.isArray(obj)) {
      for (const v of obj) {
        const res = typeof v === "object" ? deepSearch(v) : "";
        if (res) return res;
      }
      return "";
    }
    // plain object
    let candidate = "";
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        const text = value.trim();
        if (text.length > 200) {
          const tLower = text.toLowerCase();
          const tokens = n.split(/\s+/).filter((w) => w.length > 3);
          let hits = 0;
          for (const w of tokens) {
            if (tLower.includes(w)) {
              hits++;
              if (hits >= 2) {
                return text;
              }
            }
          }
          if (!candidate) candidate = text;
        }
      } else if (typeof value === "object") {
        const res = deepSearch(value);
        if (res) return res;
      }
    }
    return candidate;
  }

  // Try a dedicated feast details array if present
  if (Array.isArray(data.feast_details)) {
    for (const item of data.feast_details) {
      const title = (item.title || item.name || item.feast || "").trim();
      const text =
        item.text ||
        item.description ||
        item.note ||
        "";
      if (!text) continue;
      const tLower = title.toLowerCase();
      if (tLower && (tLower.includes(n) || n.includes(tLower))) {
        return String(text).trim();
      }
    }
  }

  // Fallback: reuse the commemorations deep search logic over the whole payload
  const deep = deepSearch(data);
  if (deep) return deep;

  return "";
}
function buildFeastDescription(text) {
    const t = (text || "").trim();
    if (!t) return "";
    if (/theotokos|mother of god/i.test(t)) {
      return "Feast of the Theotokos, honouring the Mother of God in the life of the Church.";
    }
    if (/nativity|birth/i.test(t)) {
      return "Feast of the Nativity, celebrating the birth connected with this event.";
    }
    if (/entry|presentation/i.test(t)) {
      return "Feast recalling the entry into the holy place and dedication to God.";
    }
    if (/resurrection|pascha/i.test(t)) {
      return "Feast of the Resurrection, centred on the victory of Christ over death.";
    }
    return "Feast kept today in the Orthodox Church in honour of this event or saint.";
  }

  function buildServiceNoteDescription(text) {
    const t = (text || "").toLowerCase();
    if (!t) return "";
    if (t.includes("great canon")) {
      return "A long penitential canon by St Andrew of Crete, appointed in the services of Great Lent.";
    }
    if (t.includes("presanctified")) {
      return "A Liturgy of the Presanctified Gifts, served on certain weekdays of Great Lent.";
    }
    if (t.includes("akathist")) {
      return "A hymn of praise chanted standing, often in honour of the Theotokos or a saint.";
    }
    if (t.includes("memorial") || t.includes("panikhida")) {
      return "Memorial prayers offered for the departed.";
    }
    return "Liturgical note for today’s services in the Orthodox Church.";
  }


  async function loadTodayFromAPI() {
    resetToday();
    updateCivilDate();

    const liturgicalDateEl = document.getElementById("liturgical-date");
    const feastListEl = document.getElementById("feast-list");
    const saintsListEl = document.getElementById("saints-list");
    const serviceNotesBlock = document.getElementById("service-notes");
    const serviceNotesList = document.getElementById("service-notes-list");
    const fastListEl = document.getElementById("fast-list");
    const readingsList = document.getElementById("readings-list");
    const readingsEmpty = document.getElementById("readings-empty");
    const errorEl = document.getElementById("summary-error");

    try {
      const url = apiDayUrl(selectedDate);
      const resp = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();

      const y = data.year;
      const m = data.month;
      const d = data.day;
      const labelEl = document.getElementById("calendar-date-label");

      if (labelEl) {
        labelEl.textContent =
          currentCalendar === "julian"
            ? "Julian calendar date:"
            : "Gregorian calendar date:";
      }

      if (y && m && d && liturgicalDateEl) {
        liturgicalDateEl.textContent = `${d} ${monthName(m)} ${y}`;
      }

      const namedSaints = Array.isArray(data.saints) ? data.saints.filter(Boolean).map(String) : [];
      const storyTitles = Array.isArray(data.stories)
        ? data.stories.map(story => story?.title || story?.name || "").filter(Boolean)
        : [];
      const saintsArray = [];

      // Use only the date-specific commemorations returned by Orthocal. Some Orthocal
      // records also contain administrative anniversaries (for example a canonization
      // anniversary) whose saint's actual feast falls on another date. Those are not
      // shown in the saints list.
      [...namedSaints, ...storyTitles].forEach(title => {
        if (!title || isAdministrativeCommemoration(title)) return;
        const normalized = normalizeCommemorationLabel(title);
        const alreadyListed = saintsArray.some(name => {
          const n = normalizeCommemorationLabel(name);
          return n === normalized || n.includes(normalized) || normalized.includes(n);
        });
        if (!alreadyListed) saintsArray.push(title);
      });

      // Saints of the day with the corresponding life/story returned by Orthocal.

if (saintsListEl) {
        saintsListEl.innerHTML = "";
        if (saintsArray.length > 0) {
          saintsArray.forEach((s, idx) => {
            const li = document.createElement("li");

            // Build a card similar to scripture cards, with expandable detail.
            const card = document.createElement("div");
            card.className = "reading-card"; // reuse reading card styling

            const header = document.createElement("div");
            header.className = "reading-header";

            const main = document.createElement("div");
            main.className = "reading-main";

            const nameEl = document.createElement("div");
            nameEl.className = "saint-name";
            nameEl.textContent = s;

            main.appendChild(nameEl);

            const toggle = document.createElement("div");
            toggle.className = "reading-toggle";
            toggle.textContent = "Learn More";

            header.appendChild(main);
            header.appendChild(toggle);

            const body = document.createElement("div");
            body.className = "reading-body";
            body.style.display = "none";

            const fullText = findCommemorationDetail(data, s, idx);
            if (fullText) {
              const text = String(fullText).trim();
              if (/[<>&]/.test(text)) {
                body.innerHTML = text;
              } else {
                body.textContent = text;
              }
            } else {
              body.textContent = `${s} is commemorated today in the Orthodox calendar. Our data source does not reveal any further information for this commemoration, so please feel free to use Google to learn more.`;
            }

            const toggleBody = () => {
              if (body.style.display === "none" || !body.style.display) {
                body.style.display = "block";
                toggle.textContent = "Hide";
              } else {
                body.style.display = "none";
                toggle.textContent = "Learn More";
              }
            };

            header.addEventListener("click", toggleBody);
            toggle.addEventListener("click", (ev) => {
              ev.stopPropagation();
              toggleBody();
            });

            card.appendChild(header);
            card.appendChild(body);
            li.appendChild(card);
            saintsListEl.appendChild(li);
          });
        } else {
          const li = document.createElement("li");
          const nameEl = document.createElement("div");
          nameEl.className = "saint-name";
          nameEl.textContent = "No specific commemorations listed for this day.";
          li.appendChild(nameEl);
          saintsListEl.appendChild(li);
        }
      }

// Fasting: bullet for type, then forbidden list
// (card style: fast name + expandable details from fast_exception_desc only)

      if (fastListEl) {
        fastListEl.innerHTML = "";

        const fastLevelDesc = data.fast_level_desc || "";
        const fastExceptionDesc = data.fast_exception_desc || "";
        const rules = computeFastRules(fastLevelDesc, fastExceptionDesc, data.fast_level, data.fast_exception);

        const li = document.createElement("li");

        // Card container, matching Scripture and Commemorations
        const card = document.createElement("div");
        card.className = "reading-card";

        const header = document.createElement("div");
        header.className = "reading-header";

        const main = document.createElement("div");
        main.className = "reading-main";

        const nameEl = document.createElement("div");
        nameEl.className = "fast-name";

        if (rules.isNoFast) {
          nameEl.textContent = "No fast";
        } else {
          nameEl.textContent =
            data.fast_name ||
            data.fast_period ||
            fastLevelDesc ||
            fastExceptionDesc ||
            "Fast day";
        }

        main.appendChild(nameEl);

        const toggle = document.createElement("div");
        toggle.className = "reading-toggle";
        toggle.textContent = "Learn More";

        header.appendChild(main);
        header.appendChild(toggle);

        const body = document.createElement("div");
        body.className = "reading-body";
        body.style.display = "none";

        if (rules.isNoFast) {
          body.textContent = "There is no fasting prescribed for this day.";
        } else {
          const forbidden = rules.forbidden || [];
          const allowed = rules.allowed || [];

          const restriction = document.createElement("p");
          restriction.className = "fast-rule-summary";
          restriction.textContent = forbidden.length
            ? `Abstain from ${forbidden.map(x => x.toLowerCase()).join(", ")}.`
            : "Follow the fasting guidance shown for this day.";
          body.appendChild(restriction);

          const allowedToday = [...allowed, ...(rules.specialAllowed || [])];
          if (allowedToday.length) {
            const allowance = document.createElement("p");
            allowance.className = "fast-rule-allowance";
            allowance.textContent = `Allowed today: ${allowedToday.join(", ")}.`;
            body.appendChild(allowance);
          }

          if (fastExceptionDesc && fastExceptionDesc.toLowerCase() !== "no overrides") {
            const exception = document.createElement("p");
            exception.className = "fast-rule-source";
            exception.textContent = fastExceptionDesc;
            body.appendChild(exception);
          }
        }

        const toggleBody = () => {
          if (body.style.display === "none" || !body.style.display) {
            body.style.display = "block";
            toggle.textContent = "Hide";
          } else {
            body.style.display = "none";
            toggle.textContent = "Learn More";
          }
        };

        header.addEventListener("click", toggleBody);
        toggle.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleBody();
        });

        card.appendChild(header);
        card.appendChild(body);
        li.appendChild(card);
        fastListEl.appendChild(li);
      }

// Feasts with richer descriptions, excluding "Liturgy..."
      if (feastListEl) {
        feastListEl.innerHTML = "";
        let added = false;
        if (Array.isArray(data.feasts) && data.feasts.length > 0) {
          data.feasts.forEach((f) => {
            if (typeof f === "string" && f.toLowerCase().startsWith("liturgy")) {
              return;
            }
            if (!f) return;
            const li = document.createElement("li");

            // Build a card similar to scripture and commemorations
            const card = document.createElement("div");
            card.className = "reading-card";

            const header = document.createElement("div");
            header.className = "reading-header";

            const main = document.createElement("div");
            main.className = "reading-main";

            const nameEl = document.createElement("div");
            nameEl.className = "feast-name";
            nameEl.textContent = f;
            main.appendChild(nameEl);

            const toggle = document.createElement("div");
            toggle.className = "reading-toggle";
            toggle.textContent = "Learn More";

            header.appendChild(main);
            header.appendChild(toggle);

            const body = document.createElement("div");
            body.className = "reading-body";
            body.style.display = "none";

            const fullText = findFeastDetail(data, f) || buildFeastDescription(f);
            if (fullText) {
              const text = String(fullText).trim();
              if (/[<>&]/.test(text)) {
                body.innerHTML = text;
              } else {
                body.textContent = text;
              }
            }

            const toggleBody = () => {
              if (body.style.display === "none" || !body.style.display) {
                body.style.display = "block";
                toggle.textContent = "Hide";
              } else {
                body.style.display = "none";
                toggle.textContent = "Learn More";
              }
            };

            header.addEventListener("click", toggleBody);
            toggle.addEventListener("click", (ev) => {
              ev.stopPropagation();
              toggleBody();
            });

            card.appendChild(header);
            card.appendChild(body);
            li.appendChild(card);
            feastListEl.appendChild(li);
            added = true;
          });
        }
        if (!added) {
          const li = document.createElement("li");
          const nameEl = document.createElement("div");
          nameEl.className = "feast-name";
          nameEl.textContent = "This is not a major feast day.";
          li.appendChild(nameEl);
          feastListEl.appendChild(li);
        }
      }
      if (serviceNotesList && serviceNotesBlock) {
        serviceNotesList.innerHTML = "";
        if (Array.isArray(data.service_notes) && data.service_notes.length > 0) {
          serviceNotesBlock.style.display = "block";
          data.service_notes.forEach((note) => {
            const li = document.createElement("li");

            const nameEl = document.createElement("div");
            nameEl.className = "note-name";
            nameEl.textContent = note;

            const descEl = document.createElement("div");
            descEl.className = "note-description";
            descEl.textContent = buildServiceNoteDescription(note);

            li.appendChild(nameEl);
            li.appendChild(descEl);
            serviceNotesList.appendChild(li);
          });
        } else {
          serviceNotesBlock.style.display = "none";
        }
      }

      // Readings — preload Bible text so toggles are instant
      if (readingsList && readingsEmpty) {
        readingsList.innerHTML = "";
        if (Array.isArray(data.readings) && data.readings.length > 0) {
          const refs = data.readings.map(
            (reading) => reading.display || reading.short_display || ""
          );
          const texts = await Promise.all(refs.map((r) => fetchBiblePassage(r)));

          data.readings.forEach((reading, index) => {
            const card = document.createElement("div");
            card.className = "reading-card";

            const header = document.createElement("div");
            header.className = "reading-header";

            const main = document.createElement("div");
            main.className = "reading-main";

            const refEl = document.createElement("div");
            refEl.className = "reading-ref";
            refEl.textContent = refs[index];

            const typeEl = document.createElement("div");
            typeEl.className = "reading-type";
            typeEl.textContent = reading.source || "Reading";

            main.appendChild(refEl);
            main.appendChild(typeEl);

            const toggle = document.createElement("div");
            toggle.className = "reading-toggle";
            toggle.textContent = "Read Scripture";

            const actions = document.createElement("div");
            actions.className = "reading-actions";
            actions.appendChild(toggle);

            header.appendChild(main);
            header.appendChild(actions);

            const body = document.createElement("div");
            body.className = "reading-body";
            body.id = `reading-body-${index}`;
            const rawText = texts[index] || refs[index];
            body.textContent = normalizeReadingText(rawText);

            header.addEventListener("click", () => {
              const isActive = body.classList.contains("active");
              if (isActive) {
                body.classList.remove("active");
                toggle.textContent = "Read Scripture";
              } else {
                body.classList.add("active");
                toggle.textContent = "Hide";
              }
            });

            card.appendChild(header);
            card.appendChild(body);
            readingsList.appendChild(card);
          });

          readingsEmpty.style.display = "none";
        } else {
          readingsEmpty.style.display = "block";
        }
      }
      window.OrthodoxAccessibility?.refreshTranslation?.();
    } catch (err) {
      console.error(err);
      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.textContent =
          "Could not load the Orthodox calendar information at this time.";
      }
    }
  }

  function updateMonthLabel() {
    const monthLabel = document.getElementById("month-label");
    if (!monthLabel) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthLabel.textContent = `${monthName(month + 1)} ${year}`;
  }

  function buildMonthGrid() {
    const tbody = document.getElementById("month-grid-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let day = 1;
    for (let week = 0; week < 6; week++) {
      const tr = document.createElement("tr");
      for (let dow = 0; dow < 7; dow++) {
        const td = document.createElement("td");

        if (week === 0 && dow < startDay) {
          td.className = "month-day-empty";
          td.textContent = "";
        } else if (day > daysInMonth) {
          td.className = "month-day-empty";
          td.textContent = "";
        } else {
          const dateObj = new Date(year, month, day);
          const isSelected =
            dateObj.getFullYear() === selectedDate.getFullYear() &&
            dateObj.getMonth() === selectedDate.getMonth() &&
            dateObj.getDate() === selectedDate.getDate();

          if (isSelected) td.classList.add("month-day-selected");

          const inner = document.createElement("div");
          inner.className = "month-day-inner";
          inner.textContent = String(day);
          td.appendChild(inner);

          const targetDay = day;
          td.addEventListener("click", () => {
            withMainAnimation(async () => {
              selectedDate = new Date(year, month, targetDay);
              updateCivilDate();
              await loadTodayFromAPI();
              buildMonthGrid();
            }, { scrollToTop: true });
          });

          day++;
        }

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      if (day > daysInMonth) break;
    }
  }

  const julBtn = document.getElementById("toggle-julian");
  const gregBtn = document.getElementById("toggle-gregorian");

  if (julBtn) {
    julBtn.addEventListener("click", () => {
      if (currentCalendar !== "julian") {
        withMainAnimation(async () => {
          currentCalendar = "julian";
          setToggleUI();
          updateMonthLabel();
          buildMonthGrid();
          await loadTodayFromAPI();
        }, { scrollToTop: true });
      }
    });
  }

  if (gregBtn) {
    gregBtn.addEventListener("click", () => {
      if (currentCalendar !== "gregorian") {
        withMainAnimation(async () => {
          currentCalendar = "gregorian";
          setToggleUI();
          updateMonthLabel();
          buildMonthGrid();
          await loadTodayFromAPI();
        }, { scrollToTop: true });
      }
    });
  }

  const prevMonth = document.getElementById("prev-month");
  const nextMonth = document.getElementById("next-month");

  if (prevMonth) {
    prevMonth.addEventListener("click", () => {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );
      updateMonthLabel();
      buildMonthGrid();
    });
  }

  if (nextMonth) {
    nextMonth.addEventListener("click", () => {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );
      updateMonthLabel();
      buildMonthGrid();
    });
  }

  

  // Hymn audio player
  const hymnButton = document.getElementById("hymn-random-btn");
  const hymnControls = document.getElementById("hymn-controls");
  const hymnPlayPause = document.getElementById("hymn-play-pause");
  const hymnVolume = document.getElementById("hymn-volume");
  const hymnAudio = document.getElementById("hymn-audio");
  const hymnNowPlaying = document.getElementById("hymn-now-playing");
  const hymnPrev = document.getElementById("hymn-prev");
  const hymnNext = document.getElementById("hymn-next");
  const hymnLoop = document.getElementById("hymn-loop");

  // Fixed hymn track list wired to assets/music
  // Make sure these file names exist in russian-assets/music/
const HYMN_TRACKS = [
    { title: "Belisarius", src: "russian-assets/music/Belisarius.mp3" },
    { title: "Cherubic Hymn", src: "russian-assets/music/Cherubic Hymn.mp3" },
    { title: "Hymn of the Cherubim", src: "russian-assets/music/Hymn of the Cherubim.mp3" },
    { title: "Lord, I have cried unto Thee", src: "russian-assets/music/Lord, I have cried unto Thee.mp3" },
    { title: "May my prayer be set forth", src: "russian-assets/music/May my prayer be set forth.mp3" },
    { title: "My Sinful Soul", src: "russian-assets/music/My Sinful Soul.mp3" },
    { title: "Open to me the doors of repentance", src: "russian-assets/music/Open to me the doors of repentance.mp3" },
    { title: "That We May Receive the King", src: "russian-assets/music/That We May Receive the King.mp3" },
    { title: "We bow down before Your Cross", src: "russian-assets/music/We bow down before Your Cross.mp3" },
    { title: "We Praise Thee", src: "russian-assets/music/We Praise Thee.mp3" },
  ];
;


  let currentHymnIndex = -1;
  let hymnHasStarted = false;
  let hymnLoopEnabled = false;
  const HYMN_BASE_VOLUME = 0.2;

  function pickRandomHymnIndex() {
    if (!HYMN_TRACKS.length) return -1;
    let idx = Math.floor(Math.random() * HYMN_TRACKS.length);
    if (HYMN_TRACKS.length > 1 && idx === currentHymnIndex) {
      idx = (idx + 1) % HYMN_TRACKS.length;
    }
    return idx;
  }


  function nextSequentialIndex() {
    if (!HYMN_TRACKS.length) return -1;
    if (currentHymnIndex === -1) return 0;
    return (currentHymnIndex + 1) % HYMN_TRACKS.length;
  }

  function prevSequentialIndex() {
    if (!HYMN_TRACKS.length) return -1;
    if (currentHymnIndex === -1) return 0;
    return (currentHymnIndex - 1 + HYMN_TRACKS.length) % HYMN_TRACKS.length;
  }

  function showHymnControls() {
    if (hymnControls && !hymnControls.classList.contains("is-visible")) {
      hymnControls.classList.add("is-visible");
    }
  }

  function updateNowPlaying(title) {
    if (!hymnNowPlaying) return;
    hymnNowPlaying.textContent = title ? `Now playing: ${title}` : "";
    hymnNowPlaying.style.display = title ? "block" : "none";
  }

  function fadeVolume(audio, from, to, durationMs, done) {
    if (!audio) {
      if (done) done();
      return;
    }
    const start = performance.now();
    const startVol = from;
    const delta = to - from;

    function step(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const v = startVol + delta * t;
      audio.volume = Math.max(0, Math.min(1, v));
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (done) {
        done();
      }
    }

    requestAnimationFrame(step);
  }

  function playTrackByIndex(idx) {
    if (!hymnAudio || idx < 0 || idx >= HYMN_TRACKS.length) return;
    const track = HYMN_TRACKS[idx];
    currentHymnIndex = idx;

    hymnAudio.src = track.src;
    hymnAudio.load();
    hymnAudio.volume = 0;
    hymnAudio
      .play()
      .then(() => {
        hymnHasStarted = true;
        showHymnControls();
        updateNowPlaying(track.title);
        hymnAudio.loop = false; // we handle looping manually on ended
        if (hymnPlayPause) hymnPlayPause.textContent = "⏸";
        fadeVolume(hymnAudio, 0, HYMN_BASE_VOLUME, 600);
      })
      .catch((err) => {
        console.error("Hymn play failed:", err);
      });
  }


    function playRandomTrackWithFade() {
    if (!hymnAudio || !HYMN_TRACKS.length) return;
    const nextIdx = pickRandomHymnIndex();
    if (nextIdx === -1) return;

    const startNew = () => playTrackByIndex(nextIdx);

    if (!hymnAudio.paused && !hymnAudio.ended && hymnAudio.currentTime > 0) {
      // Cross-fade: fade out current, then start new
      fadeVolume(
        hymnAudio,
        hymnAudio.volume,
        0,
        500,
        () => {
          hymnAudio.pause();
          startNew();
        }
      );
    } else {
      startNew();
    }
  }

  if (hymnAudio) {
    hymnAudio.volume = HYMN_BASE_VOLUME;
  }


  if (hymnButton && hymnAudio) {
    hymnButton.addEventListener("click", () => {
      // First click: start random chant
      if (!hymnHasStarted) {
        playRandomTrackWithFade();
        return;
      }

      // If paused, resume current with a gentle fade-in
      if (hymnAudio.paused) {
        hymnAudio
          .play()
          .then(() => {
            showHymnControls();
            if (hymnPlayPause) hymnPlayPause.textContent = "⏸";
            fadeVolume(hymnAudio, 0, HYMN_BASE_VOLUME, 400);
          })
          .catch((err) => console.error("Hymn play failed:", err));
      } else {
        // Already playing: treat as "next track" with cross-fade
        playRandomTrackWithFade();
      }
    });
  }

  if (hymnPlayPause && hymnAudio) {
    hymnPlayPause.addEventListener("click", () => {
      if (hymnAudio.paused) {
        hymnAudio
          .play()
          .then(() => {
            hymnHasStarted = true;
            showHymnControls();
            hymnPlayPause.textContent = "⏸";
            fadeVolume(hymnAudio, 0, HYMN_BASE_VOLUME, 400);
          })
          .catch((err) => console.error("Hymn play failed:", err));
      } else {
        fadeVolume(hymnAudio, hymnAudio.volume, 0, 300, () => {
          hymnAudio.pause();
          hymnPlayPause.textContent = "▶";
        });
      }
    });
  }

  if (hymnPrev && hymnAudio) {
    hymnPrev.addEventListener("click", () => {
      if (!hymnHasStarted) {
        playRandomTrackWithFade();
        return;
      }
      const idx = prevSequentialIndex();
      if (idx !== -1) {
        playTrackByIndex(idx);
      }
    });
  }

  if (hymnNext && hymnAudio) {
    hymnNext.addEventListener("click", () => {
      if (!hymnHasStarted) {
        playRandomTrackWithFade();
        return;
      }
      const idx = nextSequentialIndex();
      if (idx !== -1) {
        playTrackByIndex(idx);
      }
    });
  }

  if (hymnLoop) {
    hymnLoop.addEventListener("click", () => {
      hymnLoopEnabled = !hymnLoopEnabled;
      hymnLoop.classList.toggle("is-active", hymnLoopEnabled);
    });
  }

  if (hymnVolume && hymnAudio) {
    hymnVolume.value = String(HYMN_BASE_VOLUME);
    hymnVolume.addEventListener("input", () => {
      const v = parseFloat(hymnVolume.value);
      if (!Number.isNaN(v)) {
        hymnAudio.volume = Math.min(1, Math.max(0, v));
      }
    });
  }

  // Continuous shuffle or loop on ended
  if (hymnAudio) {
    hymnAudio.addEventListener("ended", () => {
      if (hymnLoopEnabled && currentHymnIndex !== -1) {
        playTrackByIndex(currentHymnIndex);
      } else {
        playRandomTrackWithFade();
      }
    });
  }

  if (hymnVolume && hymnAudio) {
    hymnVolume.value = String(HYMN_BASE_VOLUME);
    hymnVolume.addEventListener("input", () => {
      const v = parseFloat(hymnVolume.value);
      if (!Number.isNaN(v)) {
        hymnAudio.volume = Math.min(1, Math.max(0, v));
      }
    });
  }

  // Continuous shuffle: when a track ends, automatically go to the next random one
  if (hymnAudio) {
    hymnAudio.addEventListener("ended", () => {
      playRandomTrackWithFade();
    });
  }

// Initial load
  updateCivilDate();
  setToggleUI();
  loadTodayFromAPI();
  updateMonthLabel();
  buildMonthGrid();
});
