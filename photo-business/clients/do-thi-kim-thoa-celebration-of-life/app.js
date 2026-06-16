const siteData = window.memorialSiteData;
const LANGUAGE_STORAGE_KEY = "memorial-language";
const SUPPORTED_LANGUAGES = ["en", "vi"];
const LANGUAGE_LABELS = {
    en: "English",
    vi: "Tiếng Việt"
};

const heroName = document.getElementById("heroName");
const brandName = document.getElementById("brandName");
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
const galleryContribute = document.getElementById("galleryContribute");
const galleryContributeCopy = document.getElementById("galleryContributeCopy");
const galleryContributeBtn = document.getElementById("galleryContributeBtn");
const galleryContributeLabel = document.getElementById("galleryContributeLabel");
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
const languageToggleButton = document.getElementById("languageToggleButton");

const updateModal = document.getElementById("updateModal");
const updateModalStage = document.getElementById("updateModalStage");
const updateModalThumbStrip = document.getElementById("updateModalThumbStrip");
const updateModalClose = document.getElementById("updateModalClose");

const lightbox = document.getElementById("lightbox");
const lightboxMedia = document.getElementById("lightboxMedia");
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
let updateModalOpen = false;
let tabSwitchTimer = null;
let updateImagesPrimeObserver = null;
let galleryStageLoadToken = 0;
const brokenGallerySources = new Set();
const imageCache = new Map();
const preloadQueue = [];
let preloadRunning = false;
const PRELOAD_CONCURRENCY = 3;
let activePreloads = 0;

const randomizedFinalGallery = shuffleArray(siteData.finalGallery);
const updateGalleryState = Object.fromEntries(siteData.dailyUpdates.map((day) => [
    day.id,
    {
        images: Array.isArray(day.images) ? [...day.images] : [],
        status: "idle",
        loadedAt: 0
    }
]));
const updateSelectedImageIndex = Object.fromEntries(siteData.dailyUpdates.map((day) => [day.id, 0]));
const updateThumbStripScroll = Object.fromEntries(siteData.dailyUpdates.map((day) => [day.id, 0]));
const updateModalThumbStripScroll = Object.fromEntries(siteData.dailyUpdates.map((day) => [day.id, 0]));

const UPDATE_REFRESH_MS = 60 * 1000;
const UPDATE_VIEWER_SIZES = "(max-width: 768px) 92vw, (max-width: 1200px) 86vw, 1200px";
const UPDATE_THUMB_SIZES = "(max-width: 768px) 96px, 112px";
const UPDATE_SESSION_CACHE_PREFIX = "memorial-update-gallery";
const VIDEO_FILE_EXT_RE = /\.(mp4|mov|avi|mkv|webm|3gp)$/i;

async function getCachedImageUrl(src) {
    if (!src) {
        return src;
    }

    if (imageCache.has(src)) {
        return imageCache.get(src);
    }

    const promise = fetch(src)
        .then((response) => response.blob())
        .then((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            imageCache.set(src, objectUrl);
            return objectUrl;
        })
        .catch(() => {
            imageCache.delete(src);
            return src;
        });

    imageCache.set(src, promise);
    return promise;
}

function enqueuePreload(url, priority = 5) {
    if (!url || imageCache.has(url)) {
        return;
    }

    const existing = preloadQueue.findIndex((item) => item.url === url);
    if (existing !== -1) {
        if (priority < preloadQueue[existing].priority) {
            preloadQueue[existing].priority = priority;
            preloadQueue.sort((a, b) => a.priority - b.priority);
        }
        return;
    }

    preloadQueue.push({ url, priority });
    preloadQueue.sort((a, b) => a.priority - b.priority);
    drainPreloadQueue();
}

function drainPreloadQueue() {
    if (preloadRunning && activePreloads >= PRELOAD_CONCURRENCY) {
        return;
    }

    preloadRunning = true;

    while (activePreloads < PRELOAD_CONCURRENCY && preloadQueue.length > 0) {
        const { url } = preloadQueue.shift();
        if (imageCache.has(url)) {
            continue;
        }

        activePreloads += 1;
        getCachedImageUrl(url).finally(() => {
            activePreloads -= 1;
            drainPreloadQueue();
        });
    }

    if (preloadQueue.length === 0 && activePreloads === 0) {
        preloadRunning = false;
    }
}

function scheduleSmartPreload(images, selectedIndex) {
    if (!images.length) {
        return;
    }

    preloadQueue.length = 0;

    const selected = images[selectedIndex];
    if (selected?.src && !isVideoItem(selected)) {
        enqueuePreload(selected.src, 0);
    }

    const selectedDisplay = isVideoItem(selected)
        ? (selected?.posterSrc || selected?.thumbSrc)
        : (selected?.displaySrc || selected?.thumbSrc);
    if (selectedDisplay && selectedDisplay !== selected?.src) {
        enqueuePreload(selectedDisplay, 0);
    }

    for (let offset = 1; offset <= 3; offset += 1) {
        const prev = images[selectedIndex - offset];
        const next = images[selectedIndex + offset];

        if (getUpdateThumbSrc(prev)) {
            enqueuePreload(getUpdateThumbSrc(prev), 1);
        }
        if (getUpdateThumbSrc(next)) {
            enqueuePreload(getUpdateThumbSrc(next), 1);
        }
    }

    for (let offset = 1; offset <= 1; offset += 1) {
        const prev = images[selectedIndex - offset];
        const next = images[selectedIndex + offset];

        if (prev?.src && !isVideoItem(prev)) {
            enqueuePreload(prev.src, 2);
        }
        if (next?.src && !isVideoItem(next)) {
            enqueuePreload(next.src, 2);
        }
    }
}

function escapeHtmlAttribute(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function isVideoItem(item) {
    return item?.type === "video"
        || VIDEO_FILE_EXT_RE.test(item?.src || "")
        || VIDEO_FILE_EXT_RE.test(item?.name || item?.filename || "");
}

function getUpdateThumbSrc(image) {
    return isVideoItem(image)
        ? (image?.posterSrc || image?.thumbSrc || image?.displaySrc || image?.src || "")
        : (image?.thumbSrc || image?.displaySrc || image?.src || "");
}

function getUpdateImageDisplaySrc(image) {
    return image?.displaySrc || image?.posterSrc || image?.thumbSrc || image?.src || "";
}

function getUpdateResponsiveAttributes(image, kind = "viewer") {
    if (isVideoItem(image)) {
        return "";
    }

    const srcSet = kind === "thumb" ? image?.thumbSrcSet : image?.viewerSrcSet;
    const sizes = kind === "thumb"
        ? (image?.thumbSizes || UPDATE_THUMB_SIZES)
        : (image?.viewerSizes || UPDATE_VIEWER_SIZES);

    return `${srcSet ? ` srcset="${escapeHtmlAttribute(srcSet)}"` : ""}${sizes ? ` sizes="${escapeHtmlAttribute(sizes)}"` : ""}`;
}

function getUpdateTimeBucket() {
    return Math.floor(Date.now() / (60 * 1000));
}

function getUpdateSessionCacheKey(updateId, query, timeBucket) {
    return `${UPDATE_SESSION_CACHE_PREFIX}:${updateId}:${timeBucket}:${query}`;
}

function readUpdateSessionCache(updateId, query, timeBucket) {
    try {
        const raw = window.sessionStorage.getItem(getUpdateSessionCacheKey(updateId, query, timeBucket));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.items)) {
            return parsed;
        }

        if (Array.isArray(parsed?.images)) {
            return {
                items: parsed.images,
                cachedAt: parsed.cachedAt || Date.now()
            };
        }

        return null;
    } catch {
        return null;
    }
}

function writeUpdateSessionCache(updateId, query, timeBucket, images) {
    try {
        window.sessionStorage.setItem(
            getUpdateSessionCacheKey(updateId, query, timeBucket),
            JSON.stringify({
                items: images.map((image) => ({
                    type: image.type || "image",
                    src: image.src,
                    displaySrc: image.displaySrc,
                    thumbSrc: image.thumbSrc,
                    posterSrc: image.posterSrc,
                    viewerSrcSet: image.viewerSrcSet,
                    viewerSizes: image.viewerSizes,
                    thumbSrcSet: image.thumbSrcSet,
                    thumbSizes: image.thumbSizes,
                    name: image.name,
                    filename: image.filename,
                    createdTime: image.createdTime,
                    mimeType: image.mimeType || null,
                    alt: image.alt,
                    caption: image.caption
                })),
                cachedAt: Date.now()
            })
        );
    } catch {
        return;
    }
}

function scheduleIdleUpdatePrime(dayId, delayMs = 0) {
    const runPrime = () => {
        fetchUpdateImages(dayId).catch((error) => {
            console.error("Unable to prime daily photo folder", dayId, error);
        });
    };

    const queueIdle = () => {
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(() => {
                runPrime();
            }, { timeout: 2500 });
            return;
        }

        window.setTimeout(runPrime, 0);
    };

    if (delayMs > 0) {
        window.setTimeout(queueIdle, delayMs);
        return;
    }

    queueIdle();
}

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

    if (updateModalClose) {
        updateModalClose.setAttribute("aria-label", getText(siteData.ui.lightbox.closeUpdateAria));
    }
    lightboxClose.setAttribute("aria-label", getText(siteData.ui.lightbox.closeAria));
    lightboxPrev.setAttribute("aria-label", getText(siteData.ui.lightbox.previousAria));
    lightboxNext.setAttribute("aria-label", getText(siteData.ui.lightbox.nextAria));
}

function renderLanguageToggle() {
    const nextLanguage = currentLanguage === "en" ? "vi" : "en";
    const nextLabel = LANGUAGE_LABELS[nextLanguage] || nextLanguage;

    languageToggle.dataset.currentLanguage = currentLanguage;
    languageToggle.setAttribute("aria-label", `Current language ${LANGUAGE_LABELS[currentLanguage]}. Switch to ${nextLabel}.`);
    languageToggleButton.textContent = nextLabel;
    languageToggleButton.dataset.language = nextLanguage;
    languageToggleButton.setAttribute("aria-label", `Switch language to ${nextLabel}`);
    languageToggleButton.setAttribute("title", nextLabel);
}

function renderGalleryContribution() {
    const contribution = siteData.galleryContribution;
    const hasUrl = Boolean(contribution?.url);

    galleryContribute.hidden = !hasUrl;
    if (!hasUrl) {
        galleryContributeCopy.textContent = "";
        galleryContributeBtn.setAttribute("href", "#");
        galleryContributeBtn.setAttribute("aria-hidden", "true");
        return;
    }

    galleryContributeCopy.textContent = getText(contribution.copy) || getText(siteData.ui.gallery.contributeCopy);
    galleryContributeLabel.textContent = getText(contribution.label) || getText(siteData.ui.gallery.contributeLabel);
    galleryContributeBtn.setAttribute("href", contribution.url);
    galleryContributeBtn.removeAttribute("aria-hidden");
}

function setHero() {
    brandName.textContent = getText(siteData.hero.name);
    heroName.textContent = getText(siteData.hero.name);
    heroDates.textContent = getText(siteData.hero.dates);
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
                        <p class="schedule-location">${getText(item.venue)}</p>
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
    updatePanel.querySelectorAll(".update-thumb-item, .update-main-frame, .update-modal-main-frame").forEach((slideEl) => {
        const img = slideEl.querySelector("img");
        const photoUrl = img?.currentSrc || img?.src;

        if (!photoUrl) {
            return;
        }

        slideEl.style.setProperty("--slide-bg", `url("${photoUrl}")`);
    });
}

function buildVideoPlayIconMarkup() {
    return `
        <span class="thumb-play-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
                <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"></circle>
                <polygon points="10,8 16,12 10,16" fill="white"></polygon>
            </svg>
        </span>
    `;
}

function buildUpdateThumbMarkup(image, index, dayTitle, {
    selected = false,
    dataAttr = "data-update-thumb",
    thumbClass = "update-thumb-item"
} = {}) {
    const thumbSrc = getUpdateThumbSrc(image);
    const responsiveAttrs = isVideoItem(image) ? "" : getUpdateResponsiveAttributes(image, "thumb");

    return `
        <button
            class="${thumbClass}${isVideoItem(image) ? " is-video" : ""}${selected ? " is-selected" : ""}"
            type="button"
            ${dataAttr}="true"
            data-image-index="${index}"
            aria-label="${formatText(siteData.ui.updates.thumbAria, { index: index + 1, title: dayTitle })}"
            aria-pressed="${selected ? "true" : "false"}"
        >
            <img src="${thumbSrc}"${responsiveAttrs} alt="${escapeHtmlAttribute(image.alt || "")}" loading="lazy" decoding="async">
            ${isVideoItem(image) ? buildVideoPlayIconMarkup() : ""}
        </button>
    `;
}

function getSelectedUpdateImageIndex(updateId) {
    const images = getUpdateImages(updateId);

    if (!images.length) {
        updateSelectedImageIndex[updateId] = 0;
        return 0;
    }

    const currentIndex = Number(updateSelectedImageIndex[updateId] || 0);
    const safeIndex = Math.min(Math.max(currentIndex, 0), images.length - 1);
    updateSelectedImageIndex[updateId] = safeIndex;
    return safeIndex;
}

function setSelectedUpdateImageIndex(updateId, index) {
    const images = getUpdateImages(updateId);
    if (!images.length) {
        updateSelectedImageIndex[updateId] = 0;
        return;
    }

    updateSelectedImageIndex[updateId] = Math.min(Math.max(index, 0), images.length - 1);
}

function rememberUpdateThumbStripScroll(updateId, scrollLeft) {
    updateThumbStripScroll[updateId] = Math.max(0, Number(scrollLeft) || 0);
}

function rememberUpdateModalThumbStripScroll(updateId, scrollLeft) {
    updateModalThumbStripScroll[updateId] = Math.max(0, Number(scrollLeft) || 0);
}

function restoreStripScroll(strip, scrollLeft) {
    if (!strip) {
        return;
    }

    window.requestAnimationFrame(() => {
        strip.scrollLeft = Math.max(0, Number(scrollLeft) || 0);
    });
}

function buildUpdateStageMarkup(image, index, total, title, className, { useCachedDisplay = false } = {}) {
    const isVideo = isVideoItem(image);
    const previewSrc = getUpdateImageDisplaySrc(image);
    const displaySrc = !isVideo && useCachedDisplay ? (image._cachedUrl || image.src) : previewSrc;
    const backgroundSrc = isVideo ? (image.posterSrc || previewSrc || image.src) : displaySrc;
    const isMainFrame = className === "update-main-frame";
    const interactiveAttrs = isMainFrame && !isVideo ? 'role="button" tabindex="0"' : "";
    return `
        <div
            class="${className}${isVideo ? " is-video" : ""}"
            aria-label="${formatText(siteData.ui.updates.mainFrameAria, { title })}"
            data-media-type="${isVideo ? "video" : "image"}"
            ${interactiveAttrs}
        >
            <div class="update-main-background" aria-hidden="true">
                <img class="update-main-bg-image" src="${backgroundSrc}"${isVideo ? "" : getUpdateResponsiveAttributes(image, "viewer")} data-full-src="${image.src}" alt="" decoding="async">
            </div>
            <div class="update-main-foreground">
                ${isVideo ? `
                    <video
                        class="update-main-video"
                        src="${image.src}"
                        poster="${escapeHtmlAttribute(image.posterSrc || previewSrc || "")}"
                        data-image-index="${index}"
                        controls
                        playsinline
                        preload="metadata"
                    ></video>
                ` : `
                    <img class="update-main-img" src="${displaySrc}"${getUpdateResponsiveAttributes(image, "viewer")} data-full-src="${image.src}" data-image-index="${index}" alt="${escapeHtmlAttribute(image.alt || "")}" decoding="async">
                `}
            </div>
            <span class="update-main-counter">${index + 1} / ${total}</span>
        </div>
    `;
}

function updateMainPhoto(images, index) {
    const image = images[index];
    if (!image) {
        return;
    }

    const mainFrame = updatePanel.querySelector(".update-main-frame");
    const previewSrc = getUpdateImageDisplaySrc(image);
    const fullSrc = image.src;
    const dayTitle = getText(getCurrentUpdate()?.title || "");
    const isVideo = isVideoItem(image);

    updatePanel.querySelector(".update-main-video")?.pause();
    if (mainFrame) {
        const temp = document.createElement("div");
        temp.innerHTML = buildUpdateStageMarkup(image, index, images.length, dayTitle, "update-main-frame");
        const newFrame = temp.firstElementChild;
        if (newFrame) {
            mainFrame.replaceWith(newFrame);
        }
        bindUpdatePanelEvents();
    }

    const nextMainBg = updatePanel.querySelector(".update-main-bg-image");
    const nextMainImg = updatePanel.querySelector(".update-main-img");

    updatePanel.querySelectorAll(".update-thumb-item").forEach((button) => {
        const isSelected = Number(button.dataset.imageIndex) === index;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
    });

    const upgradeCurrentImage = () => {
        getCachedImageUrl(fullSrc).then((cachedUrl) => {
            image._cachedUrl = cachedUrl;

            if (!nextMainImg || nextMainImg.dataset.imageIndex !== String(index)) {
                return;
            }

            if (nextMainBg) {
                nextMainBg.src = cachedUrl;
            }

            nextMainImg.src = cachedUrl;
        });
    };

    if (!isVideo && previewSrc !== fullSrc) {
        upgradeCurrentImage();
    } else if (!isVideo) {
        getCachedImageUrl(fullSrc).then((cachedUrl) => {
            image._cachedUrl = cachedUrl;
        });
    }

    syncUpdateSlideBackgrounds();
    scheduleSmartPreload(images, index);
}

function renderUpdatePanelText() {
    const hasViewer = updatePanel.querySelector(".update-grid, .update-main-frame, .update-empty-state");
    if (!hasViewer) {
        renderUpdatePanel();
        return;
    }

    const day = getCurrentUpdate();
    if (!day) {
        return;
    }

    const images = getUpdateImages(day.id);
    const dayTitle = getText(day.title);
    const eyebrow = updatePanel.querySelector(".update-header .eyebrow");
    const title = updatePanel.querySelector(".update-title");
    const subtitle = updatePanel.querySelector(".update-day");
    const summary = updatePanel.querySelector(".update-summary-copy p");
    const kicker = updatePanel.querySelector(".update-photo-kicker");
    const counter = updatePanel.querySelector(".update-photo-counter");
    const contributeBtn = updatePanel.querySelector(".update-contribute-btn");
    const contributeBtnLabel = contributeBtn?.querySelector("span");
    const contributeCopy = updatePanel.querySelector(".update-contribute-copy");
    const thumbStrip = document.getElementById("updateThumbStrip");
    const mainFrame = updatePanel.querySelector(".update-main-frame");

    if (eyebrow) eyebrow.textContent = getText(day.date);
    if (title) title.textContent = dayTitle;
    if (subtitle) subtitle.textContent = getText(day.subtitle);
    if (summary) summary.textContent = getText(day.summary);
    if (kicker) kicker.textContent = getText(siteData.ui.updates.photoKicker);
    if (counter) counter.textContent = getPhotoCountLabel(images.length);
    if (contributeBtnLabel) contributeBtnLabel.textContent = getText(siteData.ui.updates.contributeLabel);
    if (contributeCopy) contributeCopy.textContent = getText(siteData.ui.updates.contributeCopy);
    if (mainFrame) {
        mainFrame.setAttribute("aria-label", formatText(siteData.ui.updates.mainFrameAria, { title: dayTitle }));
    }
    if (thumbStrip) {
        thumbStrip.setAttribute("aria-label", formatText(siteData.ui.updates.thumbStripAria, { title: dayTitle }));
        thumbStrip.querySelectorAll("[data-update-thumb]").forEach((button) => {
            const index = Number(button.dataset.imageIndex);
            button.setAttribute("aria-label", formatText(siteData.ui.updates.thumbAria, { index: index + 1, title: dayTitle }));
        });
    }
}

function appendNewUpdatePhotos(updateId, previousImages) {
    const images = getUpdateImages(updateId);
    const day = siteData.dailyUpdates.find((entry) => entry.id === updateId);
    if (!day) {
        return;
    }

    const previousCount = Array.isArray(previousImages) ? previousImages.length : 0;
    const isAppendOnly = previousImages.every((image, index) => {
        const nextImage = images[index];
        return nextImage
            && (image.type || "image") === (nextImage.type || "image")
            && image.src === nextImage.src
            && (image.thumbSrc || "") === (nextImage.thumbSrc || "")
            && (image.posterSrc || "") === (nextImage.posterSrc || "")
            && (image.name || "") === (nextImage.name || "")
            && (image.filename || "") === (nextImage.filename || "")
            && (image.alt || "") === (nextImage.alt || "")
            && (image.createdTime || "") === (nextImage.createdTime || "")
            && (image.mimeType || "") === (nextImage.mimeType || "");
    });

    if (!isAppendOnly) {
        renderUpdatePanel();
        bindGalleryControlEvents();
        return;
    }

    const newPhotos = images.slice(previousCount);
    if (newPhotos.length === 0) {
        return;
    }

    const thumbStrip = document.getElementById("updateThumbStrip");
    const counter = updatePanel.querySelector(".update-photo-counter");

    if (!thumbStrip) {
        renderUpdatePanel();
        bindGalleryControlEvents();
        return;
    }

    const dayTitle = getText(day.title);
    const fragment = document.createDocumentFragment();

    newPhotos.forEach((image, offset) => {
        const index = previousCount + offset;
        const button = document.createElement("button");
        button.className = `update-thumb-item${isVideoItem(image) ? " is-video" : ""}${index === getSelectedUpdateImageIndex(updateId) ? " is-selected" : ""}`;
        button.type = "button";
        button.dataset.updateThumb = "true";
        button.dataset.imageIndex = String(index);
        button.setAttribute("aria-label", formatText(siteData.ui.updates.thumbAria, { index: index + 1, title: dayTitle }));
        button.setAttribute("aria-pressed", String(index === getSelectedUpdateImageIndex(updateId)));

        const img = document.createElement("img");
        img.src = getUpdateThumbSrc(image);
        if (!isVideoItem(image) && image.thumbSrcSet) {
            img.srcset = image.thumbSrcSet;
            img.sizes = image.thumbSizes || UPDATE_THUMB_SIZES;
        }
        img.alt = image.alt || "";
        img.loading = "lazy";
        img.decoding = "async";
        button.appendChild(img);

        if (isVideoItem(image)) {
            const overlay = document.createElement("span");
            overlay.className = "thumb-play-icon";
            overlay.setAttribute("aria-hidden", "true");
            overlay.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
                    <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"></circle>
                    <polygon points="10,8 16,12 10,16" fill="white"></polygon>
                </svg>
            `;
            button.appendChild(overlay);
        }

        fragment.appendChild(button);
    });

    thumbStrip.appendChild(fragment);
    syncUpdateSlideBackgrounds();

    if (counter) {
        counter.textContent = getPhotoCountLabel(images.length);
    }

    thumbStrip.querySelectorAll("[data-update-thumb]").forEach((button) => {
        if (button.dataset.boundClick === "true") {
            return;
        }

        button.dataset.boundClick = "true";
        button.addEventListener("click", () => {
            const index = Number(button.dataset.imageIndex);
            setSelectedUpdateImageIndex(updateId, index);

            updateMainPhoto(getUpdateImages(updateId), index);

            const selected = thumbStrip.querySelector(".is-selected");
            if (selected) {
                selected.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
        });
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
    const selectedIndex = getSelectedUpdateImageIndex(day.id);
    const selectedImage = images[selectedIndex];
    const hasContributeUrl = Boolean(day.contributeUrl);

    updatePanel.innerHTML = `
        <div class="update-header reveal">
            <div class="update-summary">
                <p class="eyebrow">${getText(day.date)}</p>
                <h3 class="update-title">${dayTitle}</h3>
                <p class="update-day">${getText(day.subtitle)}</p>
                <div class="update-summary-copy">
                    <p>${getText(day.summary)}</p>
                </div>
                ${hasContributeUrl ? `
                    <div class="update-contribute">
                        <p class="update-contribute-copy">${getText(siteData.ui.updates.contributeCopy)}</p>
                        <a class="update-contribute-btn" href="${day.contributeUrl}" target="_blank" rel="noreferrer">
                            <span>${getText(siteData.ui.updates.contributeLabel)}</span>
                            <i data-lucide="arrow-up-right" aria-hidden="true"></i>
                        </a>
                    </div>
                ` : ""}
            </div>
        </div>
        <div class="update-photo-card reveal">
            ${hasImages ? `
                <div class="update-viewer">
                    ${buildUpdateStageMarkup(selectedImage, selectedIndex, images.length, dayTitle, "update-main-frame")}
                </div>
                <div class="update-thumb-strip" id="updateThumbStrip" aria-label="${formatText(siteData.ui.updates.thumbStripAria, { title: dayTitle })}">
                    ${images.map((image, index) => buildUpdateThumbMarkup(image, index, dayTitle, {
                        selected: index === selectedIndex
                    })).join("")}
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

    if (hasImages && selectedImage) {
        updateMainPhoto(images, selectedIndex);
    }

    syncUpdateSlideBackgrounds();
    renderUpdateModal();
    bindUpdatePanelEvents();
    restoreStripScroll(document.getElementById("updateThumbStrip"), updateThumbStripScroll[day.id]);

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

function renderUpdateModal() {
    const day = getCurrentUpdate();
    if (!day || !updateModalStage || !updateModalThumbStrip) {
        return;
    }

    const images = getUpdateImages(day.id);
    const dayTitle = getText(day.title);

    if (!images.length) {
        updateModalStage.innerHTML = "";
        updateModalThumbStrip.innerHTML = "";
        return;
    }

    const selectedIndex = getSelectedUpdateImageIndex(day.id);
    const selectedImage = images[selectedIndex];
    updateModalStage.querySelector("video")?.pause();
    updateModalStage.innerHTML = buildUpdateStageMarkup(
        selectedImage,
        selectedIndex,
        images.length,
        dayTitle,
        "update-modal-main-frame",
        { useCachedDisplay: Boolean(selectedImage._cachedUrl) }
    );
    updateModalStage.dataset.updateDayId = day.id;
    updateModalStage.dataset.imageCount = String(images.length);

    const modalBg = updateModalStage.querySelector(".update-main-bg-image");
    const modalImg = updateModalStage.querySelector(".update-main-img");

    const activeIndex = selectedIndex;
    const imageSignature = images.map((image) => `${image.type || "image"}|${image.src || ""}|${image.thumbSrc || ""}|${image.posterSrc || ""}|${image.alt || ""}`).join("::");
    const shouldRebuildStrip = updateModalThumbStrip.dataset.updateDayId !== day.id
        || updateModalThumbStrip.dataset.imageSignature !== imageSignature;

    if (shouldRebuildStrip) {
        updateModalThumbStrip.innerHTML = images.map((image, index) => buildUpdateThumbMarkup(image, index, dayTitle, {
            selected: index === activeIndex,
            dataAttr: "data-update-modal-thumb"
        })).join("");
        updateModalThumbStrip.dataset.updateDayId = day.id;
        updateModalThumbStrip.dataset.imageSignature = imageSignature;
    } else {
        updateModalThumbStrip.querySelectorAll("[data-update-modal-thumb]").forEach((button) => {
            const isSelected = Number(button.dataset.imageIndex) === activeIndex;
            button.classList.toggle("is-selected", isSelected);
            button.setAttribute("aria-pressed", String(isSelected));
            button.setAttribute("aria-label", formatText(siteData.ui.updates.thumbAria, {
                index: Number(button.dataset.imageIndex) + 1,
                title: dayTitle
            }));
        });
    }

    if (modalImg && !selectedImage._cachedUrl && !isVideoItem(selectedImage) && getUpdateImageDisplaySrc(selectedImage) !== selectedImage.src) {
        getCachedImageUrl(selectedImage.src).then((cachedUrl) => {
            selectedImage._cachedUrl = cachedUrl;

            if (!modalImg || modalImg.dataset.imageIndex !== String(selectedIndex)) {
                return;
            }

            window.requestAnimationFrame(() => {
                if (modalBg) {
                    modalBg.src = cachedUrl;
                }
                modalImg.src = cachedUrl;
            });
        });
    }

    syncUpdateSlideBackgrounds();
    bindUpdateModalEvents({ rebindThumbs: shouldRebuildStrip });
    restoreStripScroll(updateModalThumbStrip, updateModalThumbStripScroll[day.id]);
    window.requestAnimationFrame(() => {
        const selectedThumb = updateModalThumbStrip.querySelector(".is-selected");
        if (selectedThumb) {
            selectedThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    });
}

function shouldRefreshUpdateImages(updateId) {
    const state = getUpdateGalleryState(updateId);
    return !state.loadedAt || Date.now() - state.loadedAt >= UPDATE_REFRESH_MS;
}

function haveSameUpdateImages(previousImages, nextImages) {
    if (previousImages.length !== nextImages.length) {
        return false;
    }

    return previousImages.every((image, index) => {
        const nextImage = nextImages[index];
        return nextImage
            && (image.type || "image") === (nextImage.type || "image")
            && image.src === nextImage.src
            && (image.thumbSrc || "") === (nextImage.thumbSrc || "")
            && (image.posterSrc || "") === (nextImage.posterSrc || "")
            && (image.name || "") === (nextImage.name || "")
            && (image.filename || "") === (nextImage.filename || "")
            && (image.alt || "") === (nextImage.alt || "")
            && (image.createdTime || "") === (nextImage.createdTime || "")
            && (image.mimeType || "") === (nextImage.mimeType || "");
    });
}

async function fetchUpdateImages(updateId, { force = false } = {}) {
    const day = siteData.dailyUpdates.find((entry) => entry.id === updateId);
    const state = getUpdateGalleryState(updateId);
    const previousImages = Array.isArray(state.images) ? state.images : [];
    const hadExistingImages = previousImages.length > 0;

    if ((!day?.folderId && !day?.albumUrl) || state.status === "loading" || (!force && state.status === "ready" && !shouldRefreshUpdateImages(updateId))) {
        return;
    }

    state.status = "loading";
    if (currentUpdateId === updateId && !hadExistingImages) {
        renderUpdatePanel();
        bindGalleryControlEvents();
    }

    try {
        const query = day.albumUrl
            ? `albumUrl=${encodeURIComponent(day.albumUrl)}`
            : `folderId=${encodeURIComponent(day.folderId)}`;
        const timeBucket = getUpdateTimeBucket();
        const cachedSession = !force ? readUpdateSessionCache(updateId, query, timeBucket) : null;
        if (cachedSession) {
            const cachedImages = Array.isArray(cachedSession.items) ? cachedSession.items : [];
            const didImagesChange = !haveSameUpdateImages(previousImages, cachedImages);
            state.images = didImagesChange ? cachedImages : previousImages;
            state.status = "ready";
            state.loadedAt = cachedSession.cachedAt || Date.now();
            state.lastRefreshHadChanges = didImagesChange;
            const startIndex = updateSelectedImageIndex[updateId] ?? 0;
            scheduleSmartPreload(state.images, startIndex);
            getSelectedUpdateImageIndex(updateId);

            if (currentUpdateId === updateId && state.lastRefreshHadChanges) {
                if (updateModalOpen) {
                    state.pendingRender = true;
                    state.pendingPreviousImages = state.pendingPreviousImages || previousImages.slice();
                } else if (!hadExistingImages) {
                    renderUpdatePanel();
                    bindGalleryControlEvents();
                } else {
                    appendNewUpdatePhotos(updateId, previousImages);
                }
            }

            return;
        }
        const response = await fetch(`/api/funeral-day-gallery?${query}&t=${timeBucket}`);

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
        }

        const payload = await response.json();
        const raw = Array.isArray(payload.items)
            ? payload.items
            : Array.isArray(payload.images)
                ? payload.images
                : [];
        const nextImages = raw.slice().sort((a, b) => {
            if (a.createdTime && b.createdTime) {
                return new Date(a.createdTime) - new Date(b.createdTime);
            }

            const nameA = (a.name || a.filename || a.alt || "").toLowerCase();
            const nameB = (b.name || b.filename || b.alt || "").toLowerCase();

            if (nameA && nameB) {
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
            }

            return 0;
        });
        const didImagesChange = !haveSameUpdateImages(previousImages, nextImages);
        state.images = didImagesChange ? nextImages : previousImages;
        state.status = "ready";
        state.loadedAt = Date.now();
        state.lastRefreshHadChanges = didImagesChange;
        writeUpdateSessionCache(updateId, query, timeBucket, state.images);
        const startIndex = updateSelectedImageIndex[updateId] ?? 0;
        scheduleSmartPreload(state.images, startIndex);
        getSelectedUpdateImageIndex(updateId);

        if (currentUpdateId === updateId && state.lastRefreshHadChanges) {
            if (updateModalOpen) {
                state.pendingRender = true;
                state.pendingPreviousImages = state.pendingPreviousImages || previousImages.slice();
            } else if (!hadExistingImages) {
                renderUpdatePanel();
                bindGalleryControlEvents();
            } else {
                appendNewUpdatePhotos(updateId, previousImages);
            }
        }

        return;
    } catch (error) {
        state.images = [];
        state.status = "error";
        state.loadedAt = Date.now();
        console.error("Unable to load daily photos", day.id, error);
        updateSelectedImageIndex[updateId] = 0;
    }

    if (currentUpdateId === updateId) {
        renderUpdatePanel();
        bindGalleryControlEvents();
        updateRevealVisibility();
    }
}

function primeUpdateImages() {
    const section = updatePanel?.closest("section") || updatePanel?.parentElement;
    if (!section) {
        fetchUpdateImages(currentUpdateId).catch((error) => {
            console.error("Unable to prime daily photo folder", currentUpdateId, error);
        });
        return;
    }

    updateImagesPrimeObserver?.disconnect();
    updateImagesPrimeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            updateImagesPrimeObserver?.disconnect();
            updateImagesPrimeObserver = null;

            fetchUpdateImages(currentUpdateId).catch((error) => {
                console.error("Unable to prime daily photo folder", currentUpdateId, error);
            });

            siteData.dailyUpdates.forEach((day, index) => {
                if (day.id === currentUpdateId) {
                    return;
                }

                scheduleIdleUpdatePrime(day.id, (index + 1) * 250);
            });
        });
    }, { rootMargin: "200px" });

    updateImagesPrimeObserver.observe(section);
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
            updateRevealVisibility();
            window.clearTimeout(tabSwitchTimer);
            tabSwitchTimer = window.setTimeout(() => {
                fetchUpdateImages(currentUpdateId).catch((error) => {
                    console.error("Unable to refresh daily photo folder", currentUpdateId, error);
                });
            }, 300);

            const tabImages = getUpdateImages(currentUpdateId);
            if (tabImages.length) {
                scheduleSmartPreload(tabImages, getSelectedUpdateImageIndex(currentUpdateId));
            }
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

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopUpdateRefresh();
        return;
    }

    startUpdateRefresh();
    fetchUpdateImages(currentUpdateId, { force: true }).catch((error) => {
        console.error("Unable to refresh daily photo folder", currentUpdateId, error);
    });
});

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

function bindThumbStripDrag(strip = document.getElementById("updateThumbStrip")) {
    if (!strip || strip.dataset.boundDrag === "true") {
        return;
    }

    strip.dataset.boundDrag = "true";
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const endDrag = () => {
        isDown = false;
        strip.classList.remove("is-dragging");
    };

    strip.addEventListener("mousedown", (event) => {
        isDown = true;
        startX = event.pageX - strip.offsetLeft;
        scrollLeft = strip.scrollLeft;
        strip.classList.add("is-dragging");
    });

    strip.addEventListener("mouseleave", endDrag);
    strip.addEventListener("mouseup", endDrag);
    strip.addEventListener("mousemove", (event) => {
        if (!isDown) {
            return;
        }

        event.preventDefault();
        const x = event.pageX - strip.offsetLeft;
        strip.scrollLeft = scrollLeft - (x - startX) * 1.5;
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

    if (isVideoItem(item)) {
        lightboxMedia.innerHTML = `
            <video
                id="lightboxVideo"
                src="${item.src}"
                poster="${escapeHtmlAttribute(item.posterSrc || "")}"
                controls
                playsinline
                autoplay
                preload="metadata"
            ></video>
        `;
    } else {
        lightboxMedia.innerHTML = `
            <img
                id="lightboxImage"
                src="${item.src}"
                alt="${escapeHtmlAttribute(item.alt || "")}"
            >
        `;
    }
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
    lightboxMedia?.querySelector("video")?.pause();
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

    lightboxMedia?.querySelector("video")?.pause();
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

function openUpdateModal() {
    if (!getUpdateImages(currentUpdateId).length) {
        return;
    }

    updatePanel.querySelector(".update-main-video")?.pause();

    const mainStrip = document.getElementById("updateThumbStrip");
    if (mainStrip) {
        rememberUpdateThumbStripScroll(currentUpdateId, mainStrip.scrollLeft);
    }

    updateModalOpen = true;
    renderUpdateModal();
    updateModal.classList.add("is-open");
    updateModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeUpdateModal() {
    updateModalStage?.querySelector("video")?.pause();
    updateModalOpen = false;
    updateModal.classList.remove("is-open");
    updateModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = lightbox.classList.contains("is-open") ? "hidden" : "";

    const state = getUpdateGalleryState(currentUpdateId);
    if (state.pendingRender) {
        const previousImages = Array.isArray(state.pendingPreviousImages) ? state.pendingPreviousImages : [];
        state.pendingRender = false;
        state.pendingPreviousImages = null;

        if (previousImages.length === 0) {
            renderUpdatePanel();
            bindGalleryControlEvents();
            return;
        }

        appendNewUpdatePhotos(currentUpdateId, previousImages);
    }
}

function syncUpdatePanelSelection(images, index) {
    const mainFrame = updatePanel.querySelector(".update-main-frame");
    const thumbStrip = document.getElementById("updateThumbStrip");

    if (!mainFrame || !thumbStrip) {
        return;
    }

    updateMainPhoto(images, index);
}

function bindUpdatePanelEvents() {
    const mainFrame = document.querySelector(".update-main-frame");
    const thumbStrip = document.getElementById("updateThumbStrip");

    if (mainFrame && mainFrame.dataset.boundClick !== "true") {
        mainFrame.dataset.boundClick = "true";
        mainFrame.addEventListener("click", (event) => {
            if (event.target instanceof Element && event.target.closest("video")) {
                return;
            }

            openUpdateModal();
        });
    }
    if (mainFrame && mainFrame.dataset.boundKeydown !== "true") {
        mainFrame.dataset.boundKeydown = "true";
        mainFrame.addEventListener("keydown", (event) => {
            if (mainFrame.dataset.mediaType === "video") {
                return;
            }

            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            event.preventDefault();
            openUpdateModal();
        });
    }
    if (thumbStrip && thumbStrip.dataset.boundScroll !== "true") {
        thumbStrip.dataset.boundScroll = "true";
        thumbStrip.addEventListener("scroll", () => {
            rememberUpdateThumbStripScroll(currentUpdateId, thumbStrip.scrollLeft);
        }, { passive: true });
    }

    thumbStrip?.querySelectorAll("[data-update-thumb]").forEach((button) => {
        if (button.dataset.boundClick === "true") {
            return;
        }

        button.dataset.boundClick = "true";
        button.addEventListener("click", () => {
            const index = Number(button.dataset.imageIndex);
            setSelectedUpdateImageIndex(currentUpdateId, index);

            updateMainPhoto(getUpdateImages(currentUpdateId), index);

            const selected = thumbStrip?.querySelector(".is-selected");
            if (thumbStrip && selected) {
                selected.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
        });
    });

    bindThumbStripDrag(thumbStrip);
}

function bindUpdateModalEvents({ rebindThumbs = true } = {}) {
    if (updateModalClose && updateModalClose.dataset.boundClick !== "true") {
        updateModalClose.dataset.boundClick = "true";
        updateModalClose.addEventListener("click", closeUpdateModal);
    }
    if (updateModal && updateModal.dataset.boundClick !== "true") {
        updateModal.dataset.boundClick = "true";
        updateModal.addEventListener("click", (event) => {
            if (event.target === updateModal) {
                closeUpdateModal();
            }
        });
    }

    if (updateModalThumbStrip && updateModalThumbStrip.dataset.boundScroll !== "true") {
        updateModalThumbStrip.dataset.boundScroll = "true";
        updateModalThumbStrip.addEventListener("scroll", () => {
            rememberUpdateModalThumbStripScroll(currentUpdateId, updateModalThumbStrip.scrollLeft);
        }, { passive: true });
    }

    if (rebindThumbs) {
        updateModalThumbStrip?.querySelectorAll("[data-update-modal-thumb]").forEach((button) => {
            button.addEventListener("click", () => {
                rememberUpdateModalThumbStripScroll(currentUpdateId, updateModalThumbStrip?.scrollLeft || 0);
                const nextIndex = Number(button.dataset.imageIndex);
                setSelectedUpdateImageIndex(currentUpdateId, nextIndex);
                syncUpdatePanelSelection(getUpdateImages(currentUpdateId), nextIndex);
                renderUpdateModal();
                renderLucideIcons();
                window.setTimeout(() => {
                    const selected = updateModalThumbStrip?.querySelector(".is-selected");
                    selected?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }, 50);

                window.setTimeout(() => {
                    const mainSelected = document.getElementById("updateThumbStrip")?.querySelector(".is-selected");
                    mainSelected?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }, 50);
            });
        });
    }

    bindThumbStripDrag(updateModalThumbStrip);
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
    languageToggleButton.addEventListener("click", () => {
        setLanguage(languageToggleButton.dataset.language);
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
        if (updateModalOpen) {
            if (event.key === "Escape") {
                closeUpdateModal();
            }

            if (event.key === "ArrowLeft") {
                rememberUpdateModalThumbStripScroll(currentUpdateId, updateModalThumbStrip?.scrollLeft || 0);
                const nextIndex = getSelectedUpdateImageIndex(currentUpdateId) - 1;
                setSelectedUpdateImageIndex(currentUpdateId, nextIndex);
                syncUpdatePanelSelection(getUpdateImages(currentUpdateId), getSelectedUpdateImageIndex(currentUpdateId));
                renderUpdateModal();
                renderLucideIcons();
                window.setTimeout(() => {
                    document.getElementById("updateThumbStrip")?.querySelector(".is-selected")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }, 50);
            }

            if (event.key === "ArrowRight") {
                rememberUpdateModalThumbStripScroll(currentUpdateId, updateModalThumbStrip?.scrollLeft || 0);
                const nextIndex = getSelectedUpdateImageIndex(currentUpdateId) + 1;
                setSelectedUpdateImageIndex(currentUpdateId, nextIndex);
                syncUpdatePanelSelection(getUpdateImages(currentUpdateId), getSelectedUpdateImageIndex(currentUpdateId));
                renderUpdateModal();
                renderLucideIcons();
                window.setTimeout(() => {
                    document.getElementById("updateThumbStrip")?.querySelector(".is-selected")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }, 50);
            }

            return;
        }

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
    renderUpdatePanelText();
    renderGalleryContribution();
    renderGalleryFilters();
    renderGallery();
    bindTabEvents();
    bindFilterEvents();
    bindGalleryControlEvents();
    updateGalleryToggleLabel();
    updateRevealVisibility();
    renderLucideIcons();

    if (updateModalOpen) {
        renderUpdateModal();
    }

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
