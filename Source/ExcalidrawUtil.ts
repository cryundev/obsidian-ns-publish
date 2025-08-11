import { exportToBlob } from "@excalidraw/excalidraw";
import { TFile, App } from 'obsidian';
import * as LZString from 'lz-string';

// Constants for parsing Excalidraw compressed content
export const DRAWING_COMPRESSED_REG = /(\n##? Drawing\n[^`]*(?:```compressed-json\n))([\s\S]*?)(```\n)/gm;
const DRAWING_COMPRESSED_REG_FALLBACK = /(\n##? Drawing\n(?:```compressed-json\n)?)(.*)((```)?(%%)?)/gm;

// Type definitions
interface FileTypeResult {
    mimeType: string;
}

interface EmbeddedFileData {
    id: string;
    dataURL: string;
    mimeType: string;
    created: number;
    lastRetrieved: number;
}

// Global file type checker (assumed to be available)
declare const fileTypeChecker: {
    detectFile(buffer: ArrayBuffer): FileTypeResult | null;
};

/**
 * Utility class for processing Excalidraw files and converting them to images
 */
export class ExcalidrawUtil {
    private app: App;
    private createdImages: string[] = [];
    private targetFolderPath: string = '';

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Set the target folder path for image creation
     * @param targetFolderPath Path where images should be created
     */
    public setTargetFolderPath(targetFolderPath: string): void {
        this.targetFolderPath = targetFolderPath;
    }

    /**
     * Process note content and replace Excalidraw links with exported images
     * @param content The note content to process
     * @param currentFile The current file context for resolving relative links
     * @returns Processed content with Excalidraw links replaced by image links
     */
    public async processNoteContent(content: string, currentFile: TFile): Promise<string> {
        const wikilinkRegex = /(!?\[\[([^|\]]+)(?:\|([^\]]+))?\]\])/g;
        let processedContent = content;
        const matches = Array.from(content.matchAll(wikilinkRegex));

        for (const match of matches) {
            const fullMatch = match[1];
            const fileName = match[2];
            const displayText = match[3];
            
            try {
                if (await this.isExcalidrawFile(fileName, currentFile)) {
                    const imageFileName = await this.exportExcalidrawToImage(fileName, currentFile);
                    if (imageFileName) {
                        const imageLink = displayText ? `![[${imageFileName}|${displayText}]]` : `![[${imageFileName}]]`;
                        processedContent = processedContent.replace(fullMatch, imageLink);
                    }
                }
            } catch (error) {
                console.error(`Failed to process file ${fileName}:`, error);
            }
        }

        return processedContent;
    }
    /**
     * Export Excalidraw file to PNG image
     * @param fileName Name of the Excalidraw file to export
     * @param currentFile Current file context for resolving paths
     * @returns Generated image filename or null if export failed
     */
    private async exportExcalidrawToImage(fileName: string, currentFile: TFile): Promise<string | null> {
        const file = this.app.metadataCache.getFirstLinkpathDest(fileName, currentFile.path);
        
        if (!(file instanceof TFile)) {
            return null;
        }

        try {
            const excalidrawContent = await this.app.vault.cachedRead(file);
            const decompressedContent = this.decompressExcalidrawContent(excalidrawContent);
            
            if (!decompressedContent) {
                return null;
            }
            
            const json = JSON.parse(decompressedContent);
            const embeddedFiles = await this.getExcalidrawEmbeddedFiles(excalidrawContent);
            
            const blob = await exportToBlob({
                elements: json.elements || [],
                files: embeddedFiles,
                appState: {
                    exportBackground: true,
                    exportWithDarkMode: false,
                    exportScale: 1
                }
            });
                
            if (!blob) {
                return null;
            }

            const baseName = file.basename;
            let imageFileName = `${baseName}.png`;
            const imageFolderPath = this.targetFolderPath ? `${this.targetFolderPath}/_Image` : "_Image";
            let filePath = `${imageFolderPath}/${imageFileName}`;
            
            await this.ensureImageFolderExists(imageFolderPath);
            
            let counter = 1;
            while (this.app.vault.getAbstractFileByPath(filePath)) {
                imageFileName = `${baseName}_${counter}.png`;
                filePath = `${imageFolderPath}/${imageFileName}`;
                counter++;
            }
            
            const arrayBuffer = await blob.arrayBuffer();
            await this.app.vault.createBinary(filePath, arrayBuffer);
            this.createdImages.push(filePath);

            return imageFileName;
        } catch (error) {
            console.error(`Error exporting Excalidraw file ${fileName}:`, error);
            return null;
        }
    }
    
    /**
     * Decompress Excalidraw content from LZ-string format
     * @param content Raw Excalidraw file content
     * @returns Decompressed JSON content
     */
    private decompressExcalidrawContent(content: string): string | null {
        let match = content.matchAll(DRAWING_COMPRESSED_REG);
        let parts = match.next();

        if (parts.done) {
            match = content.matchAll(DRAWING_COMPRESSED_REG_FALLBACK);
            parts = match.next();
        }

        if (parts.value && parts.value.length > 1) {
            const compressedContent = parts.value[2];
            const cleanedData = compressedContent.replace(/[\n\r]/g, '');
            
            try {
                return LZString.decompressFromBase64(cleanedData);
            } catch (error) {
                console.error('Decompression failed:', error);
                return null;
            }
        }
        
        return content;
    }
    
    /**
     * Extract embedded files from Excalidraw content for image export
     * @param content Raw Excalidraw file content
     * @returns Record of embedded file data keyed by file ID
     */
    private async getExcalidrawEmbeddedFiles(content: string): Promise<Record<string, EmbeddedFileData>> {
        const embeddedFiles: Record<string, EmbeddedFileData> = {};
        const embeddedFilesMatch = content.match(/## Embedded Files\s+([\s\S]*?)(?=\s*##|$)/);

        if (!embeddedFilesMatch?.[1]) {
            return embeddedFiles;
        }

        const fileEntries = embeddedFilesMatch[1].trim().split('\n');

        for (const entry of fileEntries) {
            const fileMatch = entry.match(/([a-f0-9]+):\s*\[\[(.*?)\]\]/);

            if (!fileMatch || fileMatch.length < 3) {
                continue;
            }

            const fileId = fileMatch[1];
            const filePath = fileMatch[2].trim();

            try {
                const imageFile = this.app.metadataCache.getFirstLinkpathDest(filePath, filePath);

                if (imageFile instanceof TFile) {
                    const fileContent = await this.app.vault.readBinary(imageFile);
                    const fileType = fileTypeChecker.detectFile(fileContent);
                    const mimeType = fileType?.mimeType || 'image/png';
                    const base64Content = this.arrayBufferToBase64String(fileContent);
                    const dataURL = `data:${mimeType};base64,${base64Content}`;

                    embeddedFiles[fileId] = {
                        id: fileId,
                        dataURL,
                        mimeType,
                        created: Date.now(),
                        lastRetrieved: Date.now()
                    };
                }
            } catch (error) {
                console.error(`Error loading embedded file ${filePath}:`, error);
            }
        }
        
        return embeddedFiles;
    }
    
    /**
     * Convert ArrayBuffer to base64 string
     * @param buffer ArrayBuffer to convert
     * @returns Base64 encoded string
     */
    private arrayBufferToBase64String(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        return window.btoa(binary);
    }

    /**
     * Check if a file is an Excalidraw file by examining its frontmatter
     * @param fileName Name of the file to check
     * @param currentFile Current file context for resolving paths
     * @returns True if the file is an Excalidraw file
     */
    private async isExcalidrawFile(fileName: string, currentFile: TFile): Promise<boolean> {
        const file = this.app.metadataCache.getFirstLinkpathDest(fileName, currentFile.path);
        
        if (!(file instanceof TFile)) {
            return false;
        }

        try {
            const fileContent = await this.app.vault.cachedRead(file);
            const frontmatterMatch = fileContent.match(/^---\s*([\s\S]*?)\s*---/);
            
            if (!frontmatterMatch) {
                return file.extension === 'excalidraw' || fileName.endsWith('.excalidraw');
            }
            
            const frontmatter = frontmatterMatch[1];
            const hasExcalidrawPlugin = /excalidraw-plugin:\s*parsed/i.test(frontmatter);
            const hasExcalidrawInTags = /excalidraw/i.test(frontmatter);
            const hasDrawingSection = /##?\s*Drawing/i.test(fileContent);
            
            return hasExcalidrawPlugin || (hasExcalidrawInTags && hasDrawingSection) || file.extension === 'excalidraw';
        } catch (error) {
            console.error(`Error reading file ${fileName}:`, error);
            return false;
        }
    }

    private async ensureImageFolderExists(imageFolderPath: string): Promise<void> {
        const existingFolder = this.app.vault.getAbstractFileByPath(imageFolderPath);
        if (!existingFolder) {
            await this.createFolderRecursively(imageFolderPath);
        }
    }

    private async createFolderRecursively(folderPath: string): Promise<void> {
        const parts = folderPath.split('/');
        let currentPath = '';

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            const existingFolder = this.app.vault.getAbstractFileByPath(currentPath);
            if (!existingFolder) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    public getCreatedImages(): string[] {
        return [...this.createdImages];
    }
}