const DB_NAME = "ZincExtensions";
const STORE_NAME = "extensions";

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME, {
                keyPath: "id"
            });
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);
    });
}

async function fileToText(file) {
    return await file.text();
}

async function fileToBase64(file) {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(file);
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(blob);
    });
}

function getFileType(path, blob) {
    if (blob.type) return blob.type;

    const extension = path.split(".").pop().toLowerCase();

    const types = {
        html: "text/html",
        htm: "text/html",
        css: "text/css",
        js: "text/javascript",
        mjs: "text/javascript",
        json: "application/json",
        txt: "text/plain",
        xml: "application/xml",
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        ico: "image/x-icon",
        bmp: "image/bmp",
        avif: "image/avif",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        otf: "font/otf"
    };

    return types[extension] || "application/octet-stream";
}

async function processFile(path, file, extension) {

    const type = getFileType(path, file);

    const textTypes = [
        "text/",
        "application/javascript",
        "text/javascript",
        "application/json",
        "application/xml"
    ];

    if (
        textTypes.some(prefix => type.startsWith(prefix)) ||
        [
            ".html",
            ".htm",
            ".css",
            ".js",
            ".mjs",
            ".json",
            ".txt",
            ".xml"
        ].some(ext => path.toLowerCase().endsWith(ext))
    ) {

        extension.files[path] = {
            type,
            data: await file.text()
        };

    } else {

        extension.files[path] = {
            type,
            data: await blobToBase64(file)
        };

    }
}

async function importExtension(files) {
    if (!files || !files.length) {
        throw new Error("No file selected");
    }

    const selectedFile = files[0];

    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
        throw new Error("Please select a ZIP file");
    }

    if (typeof JSZip === "undefined") {
        throw new Error("JSZip failed to load");
    }

    const zip = await JSZip.loadAsync(selectedFile);
    const entries = Object.values(zip.files);

    const extension = {
        id: "",
        manifest: null,
        files: {},
        enabled: true
    };

    let manifestPath = null;

    for (const entry of entries) {
        if (entry.dir) continue;

        const path = entry.name.replace(/^\/+/, "");

        if (path === "manifest.json") {
            manifestPath = path;
            break;
        }

        if (path.endsWith("/manifest.json")) {
            manifestPath = path;
            break;
        }
    }

    if (!manifestPath) {
        throw new Error("manifest.json not found");
    }

    const root = manifestPath.slice(
        0,
        manifestPath.lastIndexOf("manifest.json")
    );

    for (const entry of entries) {
        if (entry.dir) continue;

        let path = entry.name.replace(/^\/+/, "");

        if (root && path.startsWith(root)) {
            path = path.slice(root.length);
        }

        if (!path) continue;

        const blob = await entry.async("blob");
        const type = getFileType(path, blob);

        const isText =
            type.startsWith("text/") ||
            [
                "application/javascript",
                "text/javascript",
                "application/json",
                "application/xml"
            ].includes(type) ||
            /\.(html?|css|js|mjs|json|txt|xml)$/i.test(path);

        if (isText) {
            extension.files[path] = {
                type,
                data: await blob.text()
            };
        } else {
            extension.files[path] = {
                type,
                data: await blobToBase64(blob)
            };
        }
    }

    const manifestFile = extension.files["manifest.json"];

    if (!manifestFile) {
        throw new Error("manifest.json could not be loaded");
    }

    try {
        extension.manifest = JSON.parse(manifestFile.data);
    } catch (err) {
        console.error("Manifest:", manifestFile.data);
        throw new Error("Invalid manifest.json");
    }

    if (!extension.manifest.id) {
        throw new Error("Extension id missing");
    }

    extension.id = extension.manifest.id;

    const db = await openDB();

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        store.put(extension);

        tx.oncomplete = resolve;

        tx.onerror = () => {
            reject(tx.error || new Error("Database transaction failed"));
        };

        tx.onabort = () => {
            reject(tx.error || new Error("Database transaction aborted"));
        };
    });

    console.log("Installed extension:", extension.manifest.name);
    console.log("Extension ID:", extension.id);
    console.log("Files:", Object.keys(extension.files));

    return extension;
}

document.addEventListener("change", async e => {
    if (e.target.id !== "folderPicker") return;

    try {
        const extension = await importExtension(e.target.files);

        alert(`Extension installed: ${extension.manifest.name}`);

        e.target.value = "";

        if (window.parent && typeof window.parent.renderExtensions === "function") {
            window.parent.renderExtensions();
        }

    } catch (err) {
        console.error("Extension installation failed:", err);
        alert(err.message);
    }
});









async function getExtension(extensionId) {

    const db = await openDB();

    return new Promise(resolve => {

        const tx = db.transaction(STORE_NAME, "readonly");

        const request = tx.objectStore(STORE_NAME).get(extensionId);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            resolve(null);
        };

    });
}


async function getExtensionFile(extensionId, filename) {

    const extension = await getExtension(extensionId);

    if (!extension) {
        console.error("Extension not found:", extensionId);
        return null;
    }

    return extension.files[filename]?.data ?? null;
}











async function buildExtensionPage(extensionId, filename) {

    const extension = await getExtension(extensionId);

    if (!extension) return null;

    let html = extension.files[filename]?.data;

    if (!html) return null;







    




const runtime = `
window.zinc = {

    tabs: {

        executeScript(code) {

            return new Promise(resolve => {

                const id = Math.random().toString(36).slice(2);

                function listener(event) {

                    if (
                        event.data?.type === "zinc-response" &&
                        event.data.id === id
                    ) {

                        window.removeEventListener("message", listener);

                        resolve(event.data.result);

                    }

                }

                window.addEventListener("message", listener);

                window.parent.postMessage({
                    type: "zinc-execute-script",
                    id,
                    code
                }, "*");

            });

        }

    }

};
`;

html = html.replace(
    "</head>",
    `<script>${runtime}<\/script></head>`
);






    







    

    // Replace CSS files
    html = html.replace(
        /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi,
        (match, path) => {

            const file = extension.files[path];

            if (!file) return match;

            return `<style>${file.data}</style>`;
        }
    );


    // Replace JavaScript files
    html = html.replace(
        /<script\s+src=["']([^"']+)["']\s*><\/script>/gi,
        (match, path) => {

            const file = extension.files[path];

            if (!file) return match;

            return `<script>${file.data}<\/script>`;
        }
    );


    // Replace images
    html = html.replace(
        /src=["']([^"']+)["']/gi,
        (match, path) => {

            const file = extension.files[path];

            if (!file || !file.type.startsWith("image/")) {
                return match;
            }

            return `src="${file.data}"`;
        }
    );


    return html;
}







async function setExtensionEnabled(id, enabled) {

    const db = await openDB();

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const req = store.get(id);

    req.onsuccess = () => {

        const extension = req.result;

        if (!extension) return;

        extension.enabled = enabled;

        store.put(extension);

    };

    return new Promise(resolve => {
        tx.oncomplete = resolve;
    });

}









