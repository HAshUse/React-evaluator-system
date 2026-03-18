import extract from 'extract-zip'
import tmp from "tmp"

export default async function extractSubmission(zipPath) {

    const tempDir = tmp.dirSync({ unsafeCleanup: true});

    const extractPath = tempDir.name;

    try {
        await extract(zipPath, {dir:extractPath});

        console.log("Zip extracted to :", extractPath);

        return extractPath;

    }catch (error) {

        throw new Error("Invalid or corrupted zip file")

    }

}