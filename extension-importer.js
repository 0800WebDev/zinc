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
    return await new Promise(resolve => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.readAsDataURL(file);
    });
}

async function importExtension(files) {

    let manifest = null;

    const extension = {
        id: "",
        manifest: null,
        files: {}
    };

    for (const file of files) {

        const path = file.webkitRelativePath.split("/").slice(1).join("/");

        if (path === "manifest.json") {

            manifest = JSON.parse(await file.text());

            extension.manifest = manifest;
            extension.id = manifest.id;

        }

        if (
            file.type.startsWith("image/")
        ) {

            extension.files[path] = {
                type: file.type,
                data: await fileToBase64(file)
            };

        } else {

            extension.files[path] = {
                type: file.type || "text/plain",
                data: await fileToText(file)
            };

        }

    }

    if (!manifest)
        throw new Error("manifest.json not found");

    if (!manifest.id)
        throw new Error("Extension id missing");

    const db = await openDB();

    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).put(extension);




console.log("Stored extension:", extension);





    
    return new Promise(resolve => {

        tx.oncomplete = () => {
            console.log("Installed:", manifest.name);
            resolve(extension);
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
