import { App, TFile, Notice } from 'obsidian';
import { NSPublishSettings, PublishResult, PublishOptions } from './types';
import { WikilinkParser } from './WikilinkParser';
import { ExcalidrawUtil } from './ExcalidrawUtil';

export class NoteCopier {
	private app: App;
	private settings: NSPublishSettings;
	private wikilinkParser: WikilinkParser;
	private excalidrawUtil: ExcalidrawUtil;

	constructor(app: App, settings: NSPublishSettings) {
		this.app = app;
		this.settings = settings;
		this.wikilinkParser = new WikilinkParser(app, settings);
		this.excalidrawUtil = new ExcalidrawUtil(app);
	}

	/**
	 * Publish a note with optional linked notes
	 * @param file - The file to publish
	 * @param options - Publishing options
	 * @returns PublishResult with details of the operation
	 */
	async publishNote(file: TFile, options: PublishOptions = { includeLinked: true }): Promise<PublishResult> {
		const result: PublishResult = {
			publishedFiles: new Set(),
			skippedFiles: new Set(),
			errors: []
		};

		// Validate prerequisites
		const validation = this.validatePublishPrerequisites(file);
		if (!validation.isValid) {
			result.errors.push(validation.error || 'Unknown validation error');
			return result;
		}

		const progressNotice = new Notice('Publishing note...', 0);

		try {
			if (options.includeLinked) {
				await this.publishNoteWithLinks(file, result, options);
			} else {
				await this.publishSingleNote(file, result);
			}

			progressNotice.hide();
			new Notice(`Successfully published ${result.publishedFiles.size} file(s)`);

			if (result.errors.length > 0) {
				console.warn('Publishing completed with errors:', result.errors);
			}

		} catch (error) {
			progressNotice.hide();
			const errorMessage = `Error publishing note: ${error.message}`;
			result.errors.push(errorMessage);
			new Notice(errorMessage);
			console.error('Publishing error:', error);
		}

		// Copy URL to clipboard if files were published
		if (result.publishedFiles.size > 0) {
			const publishedUrl = this.generatePublishedUrl(file);
			if (publishedUrl) {
				await navigator.clipboard.writeText(publishedUrl);
				new Notice(`URL copied to clipboard: ${publishedUrl}`);
			}
		}

		return result;
	}

	/**
	 * Publish a single note without following links
	 */
	private async publishSingleNote(file: TFile, result: PublishResult): Promise<void> {
		try {
			await this.copyFileToTarget(file);
			result.publishedFiles.add(file.path);
		} catch (error) {
			result.errors.push(`Failed to copy ${file.path}: ${error.message}`);
		}
	}

	/**
	 * Publish a note and all its linked notes recursively
	 */
	private async publishNoteWithLinks(
		file: TFile, 
		result: PublishResult, 
		options: PublishOptions
	): Promise<void> {
		const maxDepth = options.maxDepth || this.settings.maxDepth;
		const visited = new Set<string>();
		const processing = new Set<string>();

		await this.publishNoteRecursively(file, result, visited, processing, 0, maxDepth);
	}

	/**
	 * Recursively publish notes and their links
	 */
	private async publishNoteRecursively(
		file: TFile,
		result: PublishResult,
		visited: Set<string>,
		processing: Set<string>,
		depth: number,
		maxDepth: number
	): Promise<void> {
		const filePath = file.path;

		// Skip if already processed or being processed (cycle detection)
		if (visited.has(filePath) || processing.has(filePath)) {
			return;
		}

		if (depth > maxDepth) {
			result.skippedFiles.add(filePath);
			return;
		}

		processing.add(filePath);

		try {
			await this.copyFileToTarget(file);
			result.publishedFiles.add(filePath);

			const linkedFiles = await this.wikilinkParser.getLinkedFiles(file);

			for (const linkedFile of linkedFiles) {
				await this.publishNoteRecursively(
					linkedFile,
					result,
					visited,
					processing,
					depth + 1,
					maxDepth
				);
			}

		} catch (error) {
			const errorMsg = `Error processing ${filePath}: ${error.message}`;
			result.errors.push(errorMsg);
			console.error(errorMsg, error);
		} finally {
			processing.delete(filePath);
			visited.add(filePath);
		}
	}

	/**
	 * Copy a file to the target folder within the vault and process Excalidraw content
	 */
	private async copyFileToTarget(file: TFile): Promise<void> {
		try {
			const content = await this.app.vault.read(file);
			const targetPath = this.getTargetPath(file);

			// Ensure target folder exists
			await this.ensureTargetFolderExists(targetPath);

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(targetPath);
			let targetFile: TFile;
			
			if (existingFile instanceof TFile) {
				await this.app.vault.modify(existingFile, content);
				targetFile = existingFile;
			} else {
				targetFile = await this.app.vault.create(targetPath, content) as TFile;
			}

		await this.processExcalidrawContent(targetFile);

		} catch (error) {
			throw new Error(`Failed to copy ${file.path}: ${error.message}`);
		}
	}

	/**
	 * Get the target path for a file within the vault
	 */
	private getTargetPath(file: TFile): string {
		const fileName = this.settings.addPublishPrefix 
			? `${this.settings.publishPrefix}${file.name}` 
			: file.name;

		if (this.settings.preserveFolderStructure) {
			// Preserve folder structure within target folder
			const relativePath = file.parent ? file.parent.path : '';
			return relativePath 
				? `${this.settings.targetFolderPath}/${relativePath}/${fileName}`
				: `${this.settings.targetFolderPath}/${fileName}`;
		} else {
			// Flat structure in target folder
			return `${this.settings.targetFolderPath}/${fileName}`;
		}
	}

	/**
	 * Ensure target folder exists, creating it if necessary
	 */
	private async ensureTargetFolderExists(targetPath: string): Promise<void> {
		const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
		
		if (!folderPath) {
			return; // File is in root
		}

		const existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!existingFolder) {
			// Create folder recursively
			await this.createFolderRecursively(folderPath);
		}
	}

	/**
	 * Create folder recursively
	 */
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

	/**
	 * Validate prerequisites for publishing
	 */
	private validatePublishPrerequisites(file: TFile): { isValid: boolean; error?: string } {
		if (!file) {
			return { isValid: false, error: 'No file provided' };
		}

		if (file.extension !== 'md') {
			return { isValid: false, error: 'Can only publish markdown files' };
		}

		if (!this.settings.targetFolderPath) {
			return { isValid: false, error: 'Please configure target folder path in settings' };
		}

		return { isValid: true };
	}

	/**
	 * Update settings and notify parser
	 */
	updateSettings(newSettings: NSPublishSettings): void {
		this.settings = newSettings;
		this.wikilinkParser.updateSettings(newSettings);
	}

	/**
	 * Get publishing statistics for a file (dry run)
	 */
	async getPublishingStats(file: TFile, includeLinked = true): Promise<{
		totalFiles: number;
		linkedFiles: TFile[];
		estimatedSize: number;
	}> {
		const stats = {
			totalFiles: 1,
			linkedFiles: [] as TFile[],
			estimatedSize: 0
		};

		try {
			// Calculate size of main file
			const mainContent = await this.app.vault.read(file);
			stats.estimatedSize += mainContent.length;

			if (includeLinked) {
				const allLinkedFiles = await this.wikilinkParser.getAllLinkedFilesRecursively(file);
				stats.linkedFiles = Array.from(allLinkedFiles);
				stats.totalFiles += stats.linkedFiles.length;

				// Calculate size of linked files
				for (const linkedFile of stats.linkedFiles) {
					try {
						const content = await this.app.vault.read(linkedFile);
						stats.estimatedSize += content.length;
					} catch (error) {
						console.warn(`Could not read ${linkedFile.path} for size calculation:`, error);
					}
				}
			}

		} catch (error) {
			console.error('Error calculating publishing stats:', error);
		}

		return stats;
	}

	/**
	 * Process Excalidraw content in the copied file
	 */
	private async processExcalidrawContent(targetFile: TFile): Promise<void> {
		try {
			this.excalidrawUtil.setTargetFolderPath(this.settings.targetFolderPath);
			const content = await this.app.vault.read(targetFile);
			const processedContent = await this.excalidrawUtil.processNoteContent(content, targetFile);
			
			if (processedContent !== content) {
				await this.app.vault.modify(targetFile, processedContent);
			}
		} catch (error) {
			console.error(`Error processing Excalidraw content in ${targetFile.path}:`, error);
		}
	}

	/**
	 * Check if target folder path is valid
	 */
	isValidTargetPath(folderPath: string): boolean {
		// Check for invalid characters and path traversal
		if (!folderPath || folderPath.includes('..') || folderPath.includes('\\')) {
			return false;
		}

		// Must be a relative path within the vault
		return !folderPath.startsWith('/') && !folderPath.includes(':');
	}

	private generatePublishedUrl(file: TFile): string | null {
		if (!this.settings.baseUrl) {
			return null;
		}

		// Generate the URL based on original file path, not target path
		const originalPath = file.path;
		const pathWithoutExtension = originalPath.replace(/\.md$/, '');
		
		// Convert path to URL-friendly format
		const urlFriendlyPath = pathWithoutExtension.split('/').map(segment => {
			return segment
				.replace(/\s*&\s*/g, '--and--')  // Replace ' & ' with '--and--'
				.replace(/\s+/g, '-')            // Replace remaining spaces with hyphens
		}).join('/');
		
		const encodedPath = urlFriendlyPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
		
		return `${this.settings.baseUrl}/${encodedPath}`;
	}
}

