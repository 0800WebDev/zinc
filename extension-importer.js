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

    const extension = {
        id: "",
        manifest: null,
        files: {}
    };

    const firstFile = files[0];

    if (!firstFile) {
        throw new Error("No files selected");
    }

    if (
        firstFile.name.toLowerCase().endsWith(".zip") &&
        files.length === 1
    ) {

        const zip = await JSZip.loadAsync(firstFile);

        const entries = Object.values(zip.files);

        for (const entry of entries) {

            if (entry.dir) continue;

            let path = entry.name;

            path = path.replace(/^\/+/, "");

            const parts = path.split("/");

            if (parts.length > 1) {

                const firstFolder = parts[0];

                const hasManifestAtRoot = entries.some(
                    item =>
                        !item.dir &&
                        item.name === "manifest.json"
                );

                if (!hasManifestAtRoot) {
                    path = parts.slice(1).join("/");
                }

            }

            if (!path) continue;

            const blob = await entry.async("blob");

            await processFile(path, blob, extension);

            if (path === "manifest.json") {

                const manifestText = await blob.text();

                try {
                    extension.manifest = JSON.parse(manifestText);
                } catch {
                    throw new Error("Invalid manifest.json");
                }

                extension.id = extension.manifest.id;
            }
        }

    } else {

        for (const file of files) {

            let path = file.webkitRelativePath;

            if (path) {
                path = path.split("/").slice(1).join("/");
            } else {
                path = file.name;
            }

            if (!path) continue;

            await processFile(path, file, extension);

            if (path === "manifest.json") {

                try {
                    extension.manifest = JSON.parse(
                        await file.text()
                    );
                } catch {
                    throw new Error("Invalid manifest.json");
                }

                extension.id = extension.manifest.id;
            }
        }
    }

    if (!extension.manifest) {
        throw new Error("manifest.json not found");
    }

    if (!extension.id) {
        throw new Error("Extension id missing");
    }

    const db = await openDB();

    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).put(extension);

    console.log("Stored extension:", extension);

    return new Promise((resolve, reject) => {

        tx.oncomplete = () => {
            console.log(
                "Installed:",
                extension.manifest.name
            );

            resolve(extension);
        };

        tx.onerror = () => {
            reject(tx.error);
        };

    });
}

document
    .getElementById("folderPicker")
    .addEventListener("change", async e => {

        try {

            await importExtension(e.target.files);

            alert("Extension installed!");

        } catch (err) {

            console.error(err);

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
