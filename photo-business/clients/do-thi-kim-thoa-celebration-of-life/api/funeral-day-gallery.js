const DRIVE_FOLDER_URL = "https://drive.google.com/embeddedfolderview";
const DRIVE_FILE_URL_RE = /\/file\/d\/([A-Za-z0-9_-]+)/;
const ENTRY_RE = /<div class="flip-entry"[\s\S]*?<a href="([^"]+)"[\s\S]*?<img src="([^"]+)" alt="([^"]*)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
const GOOGLE_PHOTOS_IMAGE_RE = /https:\/\/lh3\.googleusercontent\.com\/pw\/[^"'\\\s<>)]+/g;
const GOOGLE_PHOTOS_VIDEO_RE = /https:\/\/lh3\.googleusercontent\.com\/pw\/[^"'\\\s<>)]+(?:=m37|=m18|\/mp4)[^"'\\\s<>)]*/g;
const VIEWER_SIZES = "(max-width: 768px) 92vw, (max-width: 1200px) 86vw, 1200px";
const THUMB_SIZES = "(max-width: 768px) 96px, 112px";
const VIDEO_FILE_EXT_RE = /\.(mp4|mov|avi|mkv|webm|3gp)$/i;

function decodeHtml(value) {
    return String(value || "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function toCaption(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function isDefaultPlaceholder(name) {
    return /^default[-_]/i.test(String(name || ""));
}

function buildSrcSet(urlBuilder, widths) {
    return widths.map((width) => `${urlBuilder(width)} ${width}w`).join(", ");
}

function buildDriveImageVariants(fileId) {
    const driveUrl = (width) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
    const driveThumbUrl = (width) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;

    return {
        src: driveUrl(2000),
        displaySrc: driveUrl(1280),
        thumbSrc: driveThumbUrl(320),
        viewerSrcSet: buildSrcSet(driveUrl, [640, 960, 1280, 1600, 2000]),
        viewerSizes: VIEWER_SIZES,
        thumbSrcSet: buildSrcSet(driveThumbUrl, [160, 240, 320, 480]),
        thumbSizes: THUMB_SIZES
    };
}

function buildDriveVideoVariants(fileId, posterSrc = "") {
    const directUrl = `https://drive.google.com/uc?id=${fileId}`;
    const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

    return {
        src: directUrl,
        embedSrc: embedUrl,
        displaySrc: posterSrc,
        thumbSrc: null,
        viewerSrcSet: "",
        viewerSizes: VIEWER_SIZES,
        thumbSrcSet: "",
        thumbSizes: THUMB_SIZES
    };
}

function buildGooglePhotoImageVariants(baseUrl) {
    const viewerUrl = (width) => `${baseUrl}=w${width}`;
    const thumbUrl = (width) => `${baseUrl}=w${width}-h${Math.round(width * 0.75)}-p-k-no`;

    return {
        src: viewerUrl(2000),
        displaySrc: viewerUrl(1280),
        thumbSrc: thumbUrl(320),
        viewerSrcSet: buildSrcSet(viewerUrl, [640, 960, 1280, 1600, 2000]),
        viewerSizes: VIEWER_SIZES,
        thumbSrcSet: buildSrcSet(thumbUrl, [160, 240, 320, 480]),
        thumbSizes: THUMB_SIZES
    };
}

function extractItems(html) {
    const items = [];
    const matches = html.matchAll(ENTRY_RE);

    for (const match of matches) {
        const href = decodeHtml(match[1]);
        const thumbSrc = decodeHtml(match[2]);
        const alt = decodeHtml(match[3]);
        const title = decodeHtml(match[4]).replace(/<[^>]+>/g, "").trim();
        const fileId = href.match(DRIVE_FILE_URL_RE)?.[1];

        if (!fileId || isDefaultPlaceholder(title)) {
            continue;
        }

        const caption = toCaption(title);
        const isVideo = VIDEO_FILE_EXT_RE.test(title);
        const imageVariants = buildDriveImageVariants(fileId);
        const posterSrc = thumbSrc || imageVariants.thumbSrc || imageVariants.displaySrc || imageVariants.src;
        const variants = isVideo
            ? buildDriveVideoVariants(fileId, posterSrc)
            : imageVariants;

        items.push({
            ...variants,
            type: isVideo ? "video" : "image",
            thumbSrc: isVideo ? null : (thumbSrc || variants.thumbSrc),
            posterSrc: isVideo ? posterSrc : null,
            name: title,
            filename: title,
            createdTime: null,
            mimeType: null,
            alt: caption || alt || "Funeral day photo",
            caption: caption || "Shared from the funeral day folder."
        });
    }

    return items;
}

function normalizeGooglePhotoUrl(url) {
    return String(url || "").replace(/=([a-z0-9-]+)$/i, "");
}

function extractAlbumItems(html) {
    const rawUrls = html.match(GOOGLE_PHOTOS_IMAGE_RE) || [];
    const seen = new Set();
    const items = [];

    for (const rawUrl of rawUrls) {
        const baseUrl = normalizeGooglePhotoUrl(decodeHtml(rawUrl));

        if (!baseUrl || seen.has(baseUrl)) {
            continue;
        }

        seen.add(baseUrl);
        items.push({
            ...buildGooglePhotoImageVariants(baseUrl),
            type: "image",
            posterSrc: null,
            name: "",
            filename: "",
            createdTime: null,
            mimeType: null,
            alt: "Vietnam memorial photo",
            caption: "Shared from the Vietnam memorial album."
        });
    }

    // Also scan for video entries. Google Photos pages can embed a "VIDEO"
    // marker near media URLs, and `m37` is the most common playable MP4 form.
    const videoMarkerRe = /"VIDEO"[\s\S]{0,500}?(https:\/\/lh3\.googleusercontent\.com\/pw\/[^"'\\\s<>)]+)/g;
    let videoMatch;

    while ((videoMatch = videoMarkerRe.exec(html)) !== null) {
        const baseUrl = normalizeGooglePhotoUrl(decodeHtml(videoMatch[1]));

        if (!baseUrl || seen.has(baseUrl)) {
            continue;
        }

        seen.add(baseUrl);
        items.push({
            src: `${baseUrl}=m37`,
            embedSrc: null,
            displaySrc: `${baseUrl}=w1280`,
            thumbSrc: `${baseUrl}=w320-h240-p-k-no`,
            posterSrc: `${baseUrl}=w640`,
            viewerSrcSet: "",
            viewerSizes: VIEWER_SIZES,
            thumbSrcSet: "",
            thumbSizes: THUMB_SIZES,
            type: "video",
            name: "",
            filename: "",
            createdTime: null,
            mimeType: "video/mp4",
            alt: "Vietnam memorial video",
            caption: "Shared from the Vietnam memorial album."
        });
    }

    // Fallback: if Google Photos already exposes direct video-form URLs in the
    // HTML, capture them even without a nearby "VIDEO" marker.
    const directVideoUrls = html.match(GOOGLE_PHOTOS_VIDEO_RE) || [];

    for (const rawVideoUrl of directVideoUrls) {
        const videoUrl = decodeHtml(rawVideoUrl);
        const baseUrl = normalizeGooglePhotoUrl(videoUrl);

        if (!baseUrl || seen.has(baseUrl)) {
            continue;
        }

        seen.add(baseUrl);
        items.push({
            src: `${baseUrl}=m37`,
            embedSrc: null,
            displaySrc: `${baseUrl}=w1280`,
            thumbSrc: `${baseUrl}=w320-h240-p-k-no`,
            posterSrc: `${baseUrl}=w640`,
            viewerSrcSet: "",
            viewerSizes: VIEWER_SIZES,
            thumbSrcSet: "",
            thumbSizes: THUMB_SIZES,
            type: "video",
            name: "",
            filename: "",
            createdTime: null,
            mimeType: "video/mp4",
            alt: "Vietnam memorial video",
            caption: "Shared from the Vietnam memorial album."
        });
    }

    return items;
}

async function fetchFolderHtml(folderId) {
    const url = new URL(DRIVE_FOLDER_URL);
    url.searchParams.set("id", folderId);
    const response = await fetch(url, {
        headers: {
            "user-agent": "Buddy/1.0"
        }
    });

    if (!response.ok) {
        throw new Error(`Drive folder request failed with ${response.status}`);
    }

    return response.text();
}

async function fetchAlbumHtml(albumUrl) {
    const response = await fetch(albumUrl, {
        headers: {
            "user-agent": "Buddy/1.0"
        }
    });

    if (!response.ok) {
        throw new Error(`Google Photos album request failed with ${response.status}`);
    }

    return response.text();
}

module.exports = async (req, res) => {
    const folderId = String(req.query.folderId || "").trim();
    const albumUrl = String(req.query.albumUrl || "").trim();

    if (!folderId && !albumUrl) {
        res.status(400).json({ error: "Missing folderId or albumUrl query parameter." });
        return;
    }

    try {
        const items = albumUrl
            ? extractAlbumItems(await fetchAlbumHtml(albumUrl))
            : extractItems(await fetchFolderHtml(folderId));

        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
        res.status(200).json({ items });
    } catch (error) {
        res.status(502).json({
            error: albumUrl
                ? "Unable to load the public Google Photos album right now."
                : "Unable to load the public Drive folder right now.",
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
