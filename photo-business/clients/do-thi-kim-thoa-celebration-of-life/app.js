const siteData = window.memorialSiteData;
const LANGUAGE_STORAGE_KEY = "memorial-language";
const SUPPORTED_LANGUAGES = ["en", "vi"];

const heroName = document.getElementById("heroName");
const heroDates = document.getElementById("heroDates");
const heroIntro = document.getElementById("heroIntro");
const heroNote = document.getElementById("heroNote");
const heroImage = document.getElementById("heroImage");
const heroEyebrow = document.getElementById("heroEyebrow");
const heroPrimaryAction = document.getElementById("heroPrimaryAction");
const heroSecondaryAction = document.getElementById("heroSecondaryAction");

const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const navSchedule = document.getElementById("navSchedule");
const navLife = document.getElementById("navLife");
const navUpdates = document.getElementById("navUpdates");
const navGallery = document.getElementById("navGallery");

const pageTitle = document.getElementById("pageTitle");
const pageDescription = document.getElementById("pageDescription");

const scheduleEyebrow = document.getElementById("scheduleEyebrow");
const scheduleHeading = document.getElementById("scheduleHeading");
const lifeEyebrow = document.getElementById("lifeEyebrow");
const lifeHeading = document.getElementById("lifeHeading");
const updatesHeading = document.getElementById("updatesHeading");
const galleryEyebrow = document.getElementById("galleryEyebrow");
const galleryHeading = document.getElementById("galleryHeading");

const scheduleGrid = document.getElementById("scheduleGrid");
const timeline = document.getElementById("timeline");
const lifeStory = document.getElementById("lifeStory");
const updateTabs = document.getElementById("updateTabs");
const updatePanel = document.getElementById("updatePanel");
const galleryFilters = document.getElementById("galleryFilters");
const galleryStage = document.getElementById("galleryStage");
const galleryStageBackdrop = document.getElementById("galleryStageBackdrop");
const galleryStageImage = document.getElementById("galleryStageImage");
const galleryStageCounter = document.getElementById("galleryStageCounter");
const galleryPrev = document.getElementById("galleryPrev");
const galleryToggle = document.getElementById("galleryToggle");
const galleryNext = document.getElementById("galleryNext");
const galleryStagePrev = document.getElementById("galleryStagePrev");
const galleryStageNext = document.getElementById("galleryStageNext");
const galleryProgressBar = document.getElementById("galleryProgressBar");
const galleryStagePanel = galleryStage?.closest(".gallery-stage-panel");

const languageToggle = document.getElementById("languageToggle");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxMeta = document.getElementById("lightboxMeta");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxPrev = document.getElementById("lightboxPrev");
const lightboxNext = document.getElementById("lightboxNext");
const lightboxControls = document.getElementById("lightboxControls");
const lightboxPrevControl = document.getElementById("lightboxPrevControl");
const lightboxToggle = document.getElementById("lightboxToggle");
const lightboxNextControl = document.getElementById("lightboxNextControl");
const lightboxCounter = document.getElementById("lightboxCounter");

let currentLanguage = getInitialLanguage();
let currentUpdateId = siteData.dailyUpdates[0].id;
let currentGalleryFilter = "all";
let currentGalleryIndex = 0;
let lifeStoryExpanded = false;
let updateRefreshTimer = null;
let galleryAutoplayTimer = null;
let galleryAutoplayEnabled = true;
let lightboxItems = [];
let lightboxIndex = 0;
let lightboxMode = "default";
let galleryStageLoadToken = 0;
const brokenGallerySources = new Set();

const randomizedFinalGallery = shuffleArray(siteData.finalGallery);
const updateGalleryState = Object.fromEntries(siteData.dailyUpdates.map((day) => [
    day.id,
    {
        images: Array.isArray(day.images) ? [...day.images] : [],
        status: "idle",
        loadedAt: 0
    }
]));

const UPDATE_REFRESH_MS = 60 * 1000;

function getInitialLanguage() {
    try {
        const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (SUPPORTED_LANGUAGES.includes(stored)) {
            return stored;
        }
    } catch (error) {
        console.warn("Unable to read saved language preference.", error);
    }

    return siteData.defaultLanguage || "en";
}

function getText(value) {
    if (value && typeof value === "object" && !Array.isArray(value) && (Object.hasOwn(value, "en") || Object.hasOwn(value, "vi"))) {
        return value[currentLanguage] || value.en || value.vi || "";
    }

    return value ?? "";
}

function formatText(template, values = {}) {
    return getText(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function saveLanguagePreference() {
    try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch (error) {
        console.warn("Unable to save language preference.", error);
    }
}

function setLanguage(nextLanguage) {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage) || nextLanguage === currentLanguage) {
        return;
    }

    currentLanguage = nextLanguage;
    saveLanguagePreference();
    renderSite();
}

function setPageMetadata() {
    document.documentElement.lang = currentLanguage;
    document.title = getText(siteData.page.title);
    pageTitle.textContent = getText(siteData.page.title);
    pageDescription.setAttribute("content", getText(siteData.page.description));
}

function renderChrome() {
    menuToggle.textContent = getText(siteData.ui.menu);
    navSchedule.textContent = getText(siteData.ui.navigation.schedule);
    navLife.textContent = getText(siteData.ui.navigation.life);
    navUpdates.textContent = getText(siteData.ui.navigation.updates);
    navGallery.textContent = getText(siteData.ui.navigation.gallery);

    heroEyebrow.textContent = getText(siteData.ui.heroEyebrow);
    heroPrimaryAction.textContent = getText(siteData.ui.heroActions.primary);
    heroSecondaryAction.textContent = getText(siteData.ui.heroActions.secondary);

    scheduleEyebrow.textContent = getText(siteData.ui.sectionHeadings.scheduleEyebrow);
    scheduleHeading.textContent = getText(siteData.ui.sectionHeadings.scheduleTitle);
    lifeEyebrow.textContent = getText(siteData.ui.sectionHeadings.lifeEyebrow);
    lifeHeading.textContent = getText(siteData.ui.sectionHeadings.lifeTitle);
    updatesHeading.textContent = getText(siteData.ui.sectionHeadings.updatesTitle);
    galleryEyebrow.textContent = getText(siteData.ui.sectionHeadings.galleryEyebrow);
    galleryHeading.textContent = getText(siteData.ui.sectionHeadings.galleryTitle);

    updateTabs.setAttribute("aria-label", getText(siteData.ui.updates.tabAria));

    galleryPrev.setAttribute("aria-label", getText(siteData.ui.gallery.prev));
    galleryPrev.setAttribute("title", getText(siteData.ui.gallery.prev));
    galleryNext.setAttribute("aria-label", getText(siteData.ui.gallery.next));
    galleryNext.setAttribute("title", getText(siteData.ui.gallery.next));
    galleryStagePrev.setAttribute("aria-label", getText(siteData.ui.gallery.prev));
    galleryStageNext.setAttribute("aria-label", getText(siteData.ui.gallery.next));

    lightboxClose.setAttribute("aria-label", getText(siteData.ui.lightbox.closeAria));
    lightboxPrev.setAttribute("aria-label", getText(siteData.ui.lightbox.previousAria));
    lightboxNext.setAttribute("aria-label", getText(siteData.ui.lightbox.nextAria));
}

function renderLanguageToggle() {
    languageToggle.querySelectorAll("[data-language]").forEach((button) => {
        const isActive = button.dataset.language === currentLanguage;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function setHero() {
    heroName.textContent = siteData.hero.name;
    heroDates.textContent = siteData.hero.dates;
    heroIntro.innerHTML = getText(siteData.hero.intro);
    heroNote.textContent = getText(siteData.hero.note);
    heroImage.src = siteData.hero.image.src;
    heroImage.alt = getText(siteData.hero.image.alt);
}

function renderSchedule() {
    scheduleGrid.innerHTML = siteData.schedule.map((day) => `
        <article class="schedule-card frame reveal">
            <h3>${getText(day.label)}</h3>
            <p class="schedule-date">${getText(day.date)}</p>
            <div class="schedule-items">
                ${day.items.map((item) => `
                    <div class="schedule-item">
                        <strong>${item.time} · ${getText(item.title)}</strong>
                        <p class="schedule-location">${item.venue}</p>
                        <p class="schedule-address">
                            <a href="${item.mapsUrl}" target="_blank" rel="noreferrer">${item.address}</a>
                        </p>
                        ${item.note ? `<p>${getText(item.note)}</p>` : ""}
                        ${item.livestream?.embedUrl ? `
                            <div class="schedule-livestream-player">
                                <iframe
                                    src="${item.livestream.embedUrl}"
                                    title="${getText(item.livestream.label)}"
                                    loading="lazy"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowfullscreen
                                ></iframe>
                            </div>
                        ` : ""}
                        ${item.livestream ? `
                            <p class="schedule-livestream">
                                <a href="${item.livestream.url}" target="_blank" rel="noreferrer">${getText(item.livestream.label)}</a>
                            </p>
                        ` : ""}
                    </div>
                `).join("")}
            </div>
        </article>
    `).join("");
}

function renderTimeline() {
    timeline.innerHTML = siteData.lifeChapters.map((chapter) => `
        <article class="timeline-card frame reveal">
            <div class="timeline-media">
                <img src="${chapter.image.src}" alt="${getText(chapter.image.alt)}">
            </div>
            <div class="timeline-copy">
                <p class="eyebrow">${getText(chapter.era)}</p>
                <h3>${getText(chapter.title)}</h3>
                <div class="timeline-caption">
                    <strong>${getText(chapter.captionTitle)}</strong>
                    <p>${getText(chapter.caption)}</p>
                </div>
            </div>
        </article>
    `).join("");
}

function renderLifeStory() {
    const paragraphs = siteData.lifeStory?.paragraphs?.[currentLanguage]
        || siteData.lifeStory?.paragraphs?.en
        || [];
    const previewCount = Math.max(1, Number(siteData.lifeStory?.previewCount || 2));
    const previewParagraphs = paragraphs.slice(0, previewCount);
    const remainingParagraphs = paragraphs.slice(previewCount);
    const hasMore = remainingParagraphs.length > 0;
    const visibleParagraphs = lifeStoryExpanded ? paragraphs : previewParagraphs;

    lifeStory.innerHTML = `
        <div class="life-story-inner">
            <div class="life-story-heading">
                <p class="eyebrow">${getText(siteData.ui.lifeStory.eyebrow)}</p>
                <h3>${getText(siteData.ui.lifeStory.title)}</h3>
            </div>
            <div class="life-story-copy ${lifeStoryExpanded ? "is-expanded" : ""}">
                ${visibleParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
            </div>
            ${hasMore ? `
                <button class="life-story-toggle" type="button" data-life-story-toggle aria-expanded="${lifeStoryExpanded ? "true" : "false"}">
                    <span>${lifeStoryExpanded ? getText(siteData.ui.lifeStory.showLess) : getText(siteData.ui.lifeStory.showMore)}</span>
                    <span class="life-story-toggle-icon" aria-hidden="true">${lifeStoryExpanded ? "↑" : "↓"}</span>
                </button>
            ` : ""}
        </div>
    `;
}

function renderUpdateTabs() {
    updateTabs.innerHTML = siteData.dailyUpdates.map((day) => `
        <button
            class="tab-button"
            type="button"
            role="tab"
            aria-selected="${day.id === currentUpdateId ? "true" : "false"}"
            data-update-id="${day.id}"
        >
            ${getText(day.tabLabel)}
        </button>
    `).join("");
}

function getPhotoCountLabel(count) {
    if (count === 0) {
        return getText(siteData.ui.updates.photoCountZero);
    }

    if (count === 1) {
        return getText(siteData.ui.updates.photoCountOne);
    }

    return formatText(siteData.ui.updates.photoCountMany, { count });
}

function renderLucideIcons() {
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
}

function syncUpdateSlideBackgrounds() {
    updatePanel.querySelectorAll(".update-thumb").forEach((slideEl) => {
        const img = slideEl.querySelector("img");
        const photoUrl = img?.currentSrc || img?.src;

        if (!photoUrl) {
            return;
        }

        slideEl.style.setProperty("--slide-bg", `url("${photoUrl}")`);
    });
}

function renderUpdatePanel() {
    const day = getCurrentUpdate();
    if (!day) {
        return;
    }

    const images = getUpdateImages(day.id);
    const status = getUpdateGalleryStatus(day.id);
    const isLoading = status === "loading";
    const hasImages = images.length > 0;
    const dayTitle = getText(day.title);

    updatePanel.innerHTML = `
        <div class="update-header reveal">
            <div class="update-summary">
                <p class="eyebrow">${getText(day.date)}</p>
                <h3 class="update-title">${dayTitle}</h3>
                <p class="update-day">${getText(day.subtitle)}</p>
                <div class="update-summary-copy">
                    <p>${getText(day.summary)}</p>
                </div>
            </div>
        </div>
        <div class="update-photo-card reveal">
            ${hasImages ? `
                <div class="update-grid" aria-label="${formatText(siteData.ui.updates.gridAria, { title: dayTitle })}">
                    ${images.map((image, index) => `
                        <button
                            class="update-thumb"
                            type="button"
                            data-gallery-source="updates"
                            data-update-id="${day.id}"
                            data-image-index="${index}"
                            aria-label="${formatText(siteData.ui.updates.thumbAria, { index: index + 1, title: dayTitle })}"
                        >
                            <img src="${image.src}" alt="${image.alt}">
                        </button>
                    `).join("")}
                </div>
            ` : `
                <div class="update-empty-state">
                    <p class="update-empty-title">${isLoading ? getText(siteData.ui.updates.emptyTitleLoading) : getText(siteData.ui.updates.emptyTitleIdle)}</p>
                    <p class="update-empty-copy">${isLoading ? getText(siteData.ui.updates.emptyCopyLoading) : getText(siteData.ui.updates.emptyCopyIdle)}</p>
                </div>
            `}
            <div class="update-photo-footer">
                <p class="update-photo-kicker">${getText(siteData.ui.updates.photoKicker)}</p>
                <span class="gallery-stage-counter update-photo-counter">${getPhotoCountLabel(images.length)}</span>
            </div>
        </div>
    `;

    syncUpdateSlideBackgrounds();
}

function getCurrentUpdate() {
    return siteData.dailyUpdates.find((entry) => entry.id === currentUpdateId);
}

function getUpdateGalleryState(updateId) {
    return updateGalleryState[updateId] || { images: [], status: "idle", loadedAt: 0 };
}

function getUpdateImages(updateId) {
    return getUpdateGalleryState(updateId).images;
}

function getUpdateGalleryStatus(updateId) {
    return getUpdateGalleryState(updateId).status;
}

function shouldRefreshUpdateImages(updateId) {
    const state = getUpdateGalleryState(updateId);
    return !state.loadedAt || Date.now() - state.loadedAt >= UPDATE_REFRESH_MS;
}

async function fetchUpdateImages(updateId, { force = false } = {}) {
    const day = siteData.dailyUpdates.find((entry) => entry.id === updateId);
    const state = getUpdateGalleryState(updateId);

    if (!day?.folderId || state.status === "loading" || (!force && state.status === "ready" && !shouldRefreshUpdateImages(updateId))) {
        return;
    }

    state.status = "loading";
    if (currentUpdateId === updateId) {
        renderUpdatePanel();
        bindGalleryControlEvents();
        updateRevealVisibility();
    }

    try {
        const response = await fetch(`/api/funeral-day-gallery?folderId=${encodeURIComponent(day.folderId)}`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
        }

        const payload = await response.json();
        state.images = Array.isArray(payload.images) ? payload.images : [];
        state.status = "ready";
        state.loadedAt = Date.now();
    } catch (error) {
        state.images = [];
        state.status = "error";
        state.loadedAt = Date.now();
        console.error("Unable to load daily photos", day.id, error);
    }

    if (currentUpdateId === updateId) {
        renderUpdatePanel();
        bindGalleryControlEvents();
        updateRevealVisibility();
    }
}

function primeUpdateImages() {
    siteData.dailyUpdates.forEach((day) => {
        fetchUpdateImages(day.id).catch((error) => {
            console.error("Unable to prime daily photo folder", day.id, error);
        });
    });
}

function renderGalleryFilters() {
    if (siteData.galleryFilters.length <= 1) {
        galleryFilters.hidden = true;
        galleryFilters.innerHTML = "";
        return;
    }

    galleryFilters.hidden = false;
    galleryFilters.innerHTML = siteData.galleryFilters.map((filter) => `
        <button class="chip ${filter.id === currentGalleryFilter ? "is-active" : ""}" type="button" data-filter-id="${filter.id}">
            ${getText(filter.label)}
        </button>
    `).join("");
}

function renderGallery() {
    const items = getFinalGalleryItems();

    if (!items.length) {
        galleryStage.classList.remove("is-landscape", "is-portrait");
        galleryStageBackdrop.src = "";
        galleryStageImage.src = "";
        galleryStageBackdrop.alt = "";
        galleryStageImage.alt = "";
        galleryStageCounter.textContent = "";
        return;
    }

    if (currentGalleryIndex >= items.length) {
        currentGalleryIndex = 0;
    }

    const activeItem = items[currentGalleryIndex];
    galleryStage.classList.remove("is-landscape", "is-portrait");
    galleryStageBackdrop.src = activeItem.src;
    galleryStageImage.src = activeItem.src;
    galleryStageBackdrop.alt = "";
    galleryStageImage.alt = activeItem.alt;
    galleryStageCounter.textContent = `${currentGalleryIndex + 1} / ${items.length}`;
    galleryStage.setAttribute("aria-label", formatText(siteData.ui.gallery.openStageAria, { title: activeItem.captionTitle }));
    updateGalleryStageLayout(activeItem.src);
}

function updateGalleryStageLayout(src) {
    const loadToken = ++galleryStageLoadToken;
    const probeImage = new window.Image();

    probeImage.addEventListener("load", () => {
        if (loadToken !== galleryStageLoadToken || galleryStageImage.src !== probeImage.src) {
            return;
        }

        const imageAspectRatio = probeImage.naturalWidth / probeImage.naturalHeight;
        const isLandscape = imageAspectRatio >= 1.2;

        galleryStage.classList.toggle("is-landscape", isLandscape);
        galleryStage.classList.toggle("is-portrait", !isLandscape);
    });

    probeImage.addEventListener("error", () => {
        if (loadToken !== galleryStageLoadToken) {
            return;
        }

        galleryStage.classList.remove("is-landscape");
        galleryStage.classList.add("is-portrait");
    });

    probeImage.src = src;
}

function bindTabEvents() {
    updateTabs.querySelectorAll(".tab-button").forEach((button) => {
        button.addEventListener("click", () => {
            currentUpdateId = button.dataset.updateId;
            renderUpdateTabs();
            renderUpdatePanel();
            bindTabEvents();
            bindGalleryControlEvents();
            bindTimelineEvents();
            updateRevealVisibility();
            fetchUpdateImages(currentUpdateId).catch((error) => {
                console.error("Unable to refresh daily photo folder", currentUpdateId, error);
            });
        });
    });
}

function stopUpdateRefresh() {
    if (updateRefreshTimer) {
        window.clearInterval(updateRefreshTimer);
        updateRefreshTimer = null;
    }
}

function startUpdateRefresh() {
    stopUpdateRefresh();

    updateRefreshTimer = window.setInterval(() => {
        const currentDay = getCurrentUpdate();
        if (!currentDay) {
            return;
        }

        fetchUpdateImages(currentDay.id, { force: true }).catch((error) => {
            console.error("Unable to refresh daily photo folder", currentDay.id, error);
        });
    }, UPDATE_REFRESH_MS);
}

function bindFilterEvents() {
    galleryFilters.querySelectorAll(".chip").forEach((button) => {
        button.addEventListener("click", () => {
            currentGalleryFilter = button.dataset.filterId;
            currentGalleryIndex = 0;
            renderGalleryFilters();
            renderGallery();
            bindFilterEvents();
            bindGalleryControlEvents();
            updateRevealVisibility();
            restartGalleryAutoplay();
        });
    });
}

function bindGalleryControlEvents() {
    document.querySelectorAll("[data-gallery-source]").forEach((button) => {
        if (button.dataset.boundClick === "true") {
            return;
        }

        button.dataset.boundClick = "true";
        button.addEventListener("click", () => {
            const source = button.dataset.gallerySource;
            if (source === "updates") {
                const items = getUpdateLightboxItems(button.dataset.updateId);
                const imageIndex = Number(button.dataset.imageIndex);
                openLightbox(items, imageIndex);
                return;
            }

            if (source === "final") {
                const items = getFinalGalleryItems();
                const imageIndex = Number(button.dataset.imageIndex);
                openLightbox(items, imageIndex);
                return;
            }

            if (source === "slideshow") {
                const items = getFinalGalleryItems();
                openLightbox(items, currentGalleryIndex, { mode: "slideshow" });
            }
        });
    });
}

function setGalleryIndex(nextIndex) {
    const items = getFinalGalleryItems();
    if (!items.length) {
        return;
    }

    currentGalleryIndex = (nextIndex + items.length) % items.length;
    renderGallery();
    bindGalleryControlEvents();
    updateRevealVisibility();
}

function moveGallery(direction) {
    setGalleryIndex(currentGalleryIndex + direction);
    restartGalleryAutoplay();
}

function updateGalleryToggleLabel() {
    const label = galleryAutoplayEnabled ? getText(siteData.ui.gallery.pause) : getText(siteData.ui.gallery.play);
    galleryToggle.innerHTML = `<i data-lucide="${galleryAutoplayEnabled ? "pause" : "play"}" aria-hidden="true"></i>`;
    galleryToggle.setAttribute("aria-label", label);
    galleryToggle.setAttribute("title", label);
    galleryToggle.setAttribute("aria-pressed", String(!galleryAutoplayEnabled));
    if (lightboxToggle) {
        lightboxToggle.innerHTML = `<i data-lucide="${galleryAutoplayEnabled ? "pause" : "play"}" aria-hidden="true"></i>`;
        lightboxToggle.setAttribute("aria-label", label);
        lightboxToggle.setAttribute("title", label);
        lightboxToggle.setAttribute("aria-pressed", String(!galleryAutoplayEnabled));
    }
    renderLucideIcons();
}

async function toggleGalleryFullscreen() {
    const isExpanded = galleryStage.classList.contains("is-expanded-overlay");
    if (isExpanded) {
        galleryStage.classList.remove("is-expanded-overlay");
        document.body.classList.remove("gallery-overlay-open");
    } else {
        galleryStage.classList.add("is-expanded-overlay");
        document.body.classList.add("gallery-overlay-open");
    }
}

function resetGalleryProgress() {
    galleryProgressBar.classList.remove("is-animating");
    void galleryProgressBar.offsetWidth;

    if (galleryAutoplayEnabled) {
        galleryProgressBar.style.animationDuration = `${siteData.gallerySlideshow.intervalMs}ms`;
        galleryProgressBar.classList.add("is-animating");
    }
}

function stopGalleryAutoplay() {
    if (galleryAutoplayTimer) {
        window.clearInterval(galleryAutoplayTimer);
        galleryAutoplayTimer = null;
    }

    galleryProgressBar.classList.remove("is-animating");
}

function startGalleryAutoplay() {
    stopGalleryAutoplay();

    if (!galleryAutoplayEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    resetGalleryProgress();
    galleryAutoplayTimer = window.setInterval(() => {
        if (lightbox.classList.contains("is-open") && lightboxMode === "slideshow") {
            moveLightbox(1);
        } else {
            setGalleryIndex(currentGalleryIndex + 1);
        }
        resetGalleryProgress();
    }, siteData.gallerySlideshow.intervalMs);
}

function restartGalleryAutoplay() {
    updateGalleryToggleLabel();
    startGalleryAutoplay();
}

function handleGalleryImageError() {
    const activeSrc = galleryStageImage.currentSrc || galleryStageImage.src;

    if (!activeSrc || brokenGallerySources.has(activeSrc)) {
        return;
    }

    brokenGallerySources.add(activeSrc);
    console.warn("Skipping gallery image that failed to load.", activeSrc);
    renderGalleryFilters();
    setGalleryIndex(currentGalleryIndex);
}

function bindGallerySlideshowEvents() {
    galleryPrev.addEventListener("click", () => moveGallery(-1));
    galleryNext.addEventListener("click", () => moveGallery(1));
    galleryStagePrev.addEventListener("click", () => moveGallery(-1));
    galleryStageNext.addEventListener("click", () => moveGallery(1));
    galleryToggle.addEventListener("click", () => {
        galleryAutoplayEnabled = !galleryAutoplayEnabled;
        updateGalleryToggleLabel();

        if (galleryAutoplayEnabled) {
            startGalleryAutoplay();
            return;
        }

        stopGalleryAutoplay();
    });
    galleryStageImage.addEventListener("error", handleGalleryImageError);
    galleryStageBackdrop.addEventListener("error", () => {
        galleryStage.classList.remove("is-landscape");
        galleryStage.classList.add("is-portrait");
        galleryStageBackdrop.src = "";
    });
}

function bindTimelineEvents() {
    document.querySelectorAll(".timeline-media img").forEach((image, index) => {
        if (image.dataset.boundClick === "true") {
            return;
        }

        image.dataset.boundClick = "true";
        image.style.cursor = "pointer";
        image.addEventListener("click", () => {
            const items = siteData.lifeChapters.map((chapter) => ({
                src: chapter.image.src,
                alt: getText(chapter.image.alt),
                caption: getText(chapter.caption),
                meta: getText(chapter.title)
            }));
            openLightbox(items, index);
        });
    });
}

function openLightbox(items, index, { mode = "default" } = {}) {
    lightboxItems = items;
    lightboxIndex = index;
    lightboxMode = mode;
    updateLightbox();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lightboxControls.hidden = lightboxMode !== "slideshow";
}

function updateLightbox() {
    const item = lightboxItems[lightboxIndex];
    if (!item) {
        return;
    }

    lightboxImage.src = item.src;
    lightboxImage.alt = item.alt;
    lightboxMeta.textContent = formatText(siteData.ui.lightbox.counter, {
        current: lightboxIndex + 1,
        total: lightboxItems.length,
        meta: item.meta
    });
    lightboxCaption.textContent = item.caption;
    if (lightboxMode === "slideshow") {
        currentGalleryIndex = lightboxIndex;
        lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
        renderGallery();
    }
}

function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lightboxMode = "default";
    lightboxControls.hidden = true;
}

function moveLightbox(direction) {
    if (!lightboxItems.length) {
        return;
    }

    lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
    updateLightbox();
}

function updateRevealVisibility() {
    const reveals = document.querySelectorAll(".reveal");
    const viewportHeight = window.innerHeight;

    reveals.forEach((element) => {
        const top = element.getBoundingClientRect().top;
        if (top < viewportHeight - 80) {
            element.classList.add("is-visible");
        }
    });
}

function getUpdateLightboxItems(updateId) {
    const day = siteData.dailyUpdates.find((entry) => entry.id === updateId);
    if (!day) {
        return [];
    }

    return getUpdateImages(updateId).map((image) => ({
        src: image.src,
        alt: image.alt,
        caption: image.caption,
        meta: getText(day.title)
    }));
}

function getFinalGalleryItems() {
    const items = currentGalleryFilter === "all"
        ? randomizedFinalGallery
        : randomizedFinalGallery.filter((item) => item.filter === currentGalleryFilter);

    return items.filter((item) => !brokenGallerySources.has(item.src)).map((item) => ({
        src: item.src,
        thumbSrc: item.thumbSrc,
        alt: getText(item.alt),
        caption: getText(item.caption),
        meta: getText(item.captionTitle),
        captionTitle: getText(item.captionTitle),
        captionMeta: getText(item.captionMeta)
    }));
}

function shuffleArray(items) {
    const cloned = [...items];

    for (let index = cloned.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
    }

    return cloned;
}

function bindLanguageEvents() {
    languageToggle.querySelectorAll("[data-language]").forEach((button) => {
        button.addEventListener("click", () => {
            setLanguage(button.dataset.language);
        });
    });
}

function bindEvents() {
    menuToggle.addEventListener("click", () => {
        const isOpen = siteNav.classList.toggle("is-open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    lifeStory.addEventListener("click", (event) => {
        const toggleButton = event.target.closest("[data-life-story-toggle]");
        if (!toggleButton) {
            return;
        }

        lifeStoryExpanded = !lifeStoryExpanded;
        renderLifeStory();
        updateRevealVisibility();
    });

    lightboxClose.addEventListener("click", closeLightbox);
    lightboxPrev.addEventListener("click", () => moveLightbox(-1));
    lightboxNext.addEventListener("click", () => moveLightbox(1));
    lightboxPrevControl.addEventListener("click", () => moveLightbox(-1));
    lightboxNextControl.addEventListener("click", () => moveLightbox(1));
    lightboxToggle.addEventListener("click", () => {
        galleryAutoplayEnabled = !galleryAutoplayEnabled;

        if (galleryAutoplayEnabled) {
            startGalleryAutoplay();
        } else {
            stopGalleryAutoplay();
        }

        updateGalleryToggleLabel();
    });

    lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (!lightbox.classList.contains("is-open")) {
            if (event.key === "ArrowLeft") {
                moveGallery(-1);
            }

            if (event.key === "ArrowRight") {
                moveGallery(1);
            }

            return;
        }

        if (event.key === "Escape") {
            closeLightbox();
        }

        if (event.key === "ArrowLeft") {
            moveLightbox(-1);
        }

        if (event.key === "ArrowRight") {
            moveLightbox(1);
        }
    });

    window.addEventListener("scroll", updateRevealVisibility, { passive: true });
    window.addEventListener("load", updateRevealVisibility);
    window.addEventListener("resize", updateRevealVisibility);
}

function renderSite() {
    setPageMetadata();
    renderChrome();
    renderLanguageToggle();
    setHero();
    renderSchedule();
    renderTimeline();
    renderLifeStory();
    renderUpdateTabs();
    renderUpdatePanel();
    renderGalleryFilters();
    renderGallery();
    bindTabEvents();
    bindFilterEvents();
    bindGalleryControlEvents();
    bindTimelineEvents();
    updateGalleryToggleLabel();
    updateRevealVisibility();
    renderLucideIcons();

    if (lightbox.classList.contains("is-open")) {
        updateLightbox();
    }
}

function init() {
    bindLanguageEvents();
    bindGallerySlideshowEvents();
    bindEvents();
    renderSite();
    primeUpdateImages();
    startUpdateRefresh();
    restartGalleryAutoplay();
    lucide.createIcons();
}

init();
