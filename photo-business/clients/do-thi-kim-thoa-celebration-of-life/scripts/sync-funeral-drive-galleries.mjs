import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const envPath = path.resolve(projectRoot, "../../..", ".env");
const outputPath = path.resolve(projectRoot, "data", "funeral-drive-galleries.js");

const folderMap = [
    {
        id: "day-1",
        folderId: "1XEYw_liTanq3NfIfKQSgja9-m9QidM5S"
    },
    {
        id: "day-2",
        folderId: "1U0gfd7EBMTs-BBxnUM27xHtHJyTHRNtT"
    },
    {
        id: "day-3",
        folderId: "1U4yp0qP35TFGucWGBv6X19fU5AdXGgjr"
    }
];

function loadEnvValue(key) {
    const envText = fs.readFileSync(envPath, "utf8");
    const line = envText.split("\n").find((entry) => entry.startsWith(`${key}=`));
    if (!line) {
        throw new Error(`Missing ${key} in ${envPath}`);
    }

    return line.slice(key.length + 1).trim();
}

function runGog(args) {
    const env = {
        ...process.env,
        GOG_KEYRING_PASSWORD: loadEnvValue("GOG_KEYRING_PASSWORD")
    };

    const output = execFileSync("gog", args, {
        cwd: projectRoot,
        env,
        encoding: "utf8"
    });

    return JSON.parse(output);
}

function toCaption(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function toDriveImage(file) {
    const caption = toCaption(file.name);

    return {
        src: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`,
        alt: caption || "Funeral day photo",
        caption: caption || "Shared from the funeral day folder."
    };
}

function isDefaultPlaceholder(file) {
    return /^default[-_]/i.test(String(file.name || ""));
}

const galleries = Object.fromEntries(folderMap.map(({ id, folderId }) => {
    const files = runGog([
        "drive",
        "ls",
        "--parent",
        folderId,
        "--account",
        "nghiemtruongcorp@gmail.com",
        "--json",
        "--results-only",
        "--no-input",
        "--max",
        "500"
    ]);

    const imageFiles = files
        .filter((file) => typeof file.mimeType === "string" && file.mimeType.startsWith("image/"))
        .sort((left, right) => String(left.modifiedTime).localeCompare(String(right.modifiedTime)));

    const nonDefaultImages = imageFiles.filter((file) => !isDefaultPlaceholder(file));
    const images = (nonDefaultImages.length > 0 ? nonDefaultImages : imageFiles).map(toDriveImage);

    return [id, images];
}));

const fileContents = `window.memorialFuneralDayGalleries = ${JSON.stringify(galleries, null, 4)};\n`;
fs.writeFileSync(outputPath, fileContents, "utf8");
process.stdout.write(`Wrote ${outputPath}\n`);
