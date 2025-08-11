import { App, TFile } from 'obsidian';
import { NSPublishSettings } from './types';
import { ExcalidrawUtil } from './ExcalidrawUtil';

export class WikilinkParser {
	private app: App;
	private settings: NSPublishSettings;
	private excalidrawUtil: ExcalidrawUtil;

	constructor(app: App, settings: NSPublishSettings) {
		this.app = app;
		this.settings = settings;
		this.excalidrawUtil = new ExcalidrawUtil(app);
	}

	async getLinkedFiles(file: TFile): Promise<TFile[]> {
		try {
			const content = await this.app.vault.read(file);
			const linkedFiles: TFile[] = [];

			const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
			let match;

			while ((match = wikilinkRegex.exec(content)) !== null) {
				const linkText = match[1].trim();
				
				if (this.isExcluded(linkText)) {
					continue;
				}

				const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkText, file.path);
				
				if (linkedFile && linkedFile.extension === 'md') {
					const isExcalidraw = await this.isExcalidrawFile(linkedFile, file);
					if (isExcalidraw) {
						continue;
					}
					
					linkedFiles.push(linkedFile);
				}
			}

			return linkedFiles;
		} catch (error) {
			console.error(`Error parsing wikilinks in ${file.path}:`, error);
			return [];
		}
	}

	private isExcluded(linkText: string): boolean {
		return this.settings.excludePatterns.some(pattern => {
			try {
				const regex = new RegExp(pattern);
				return regex.test(linkText);
			} catch {
				return linkText.includes(pattern);
			}
		});
	}

	async getAllLinkedFilesRecursively(
		startFile: TFile, 
		maxDepth: number = this.settings.maxDepth,
		visited: Set<string> = new Set()
	): Promise<Set<TFile>> {
		const allLinkedFiles = new Set<TFile>();
		
		await this.getAllLinkedFilesRecursivelyHelper(
			startFile, 
			maxDepth, 
			0, 
			visited, 
			allLinkedFiles
		);
		
		return allLinkedFiles;
	}

	private async getAllLinkedFilesRecursivelyHelper(
		file: TFile,
		maxDepth: number,
		currentDepth: number,
		visited: Set<string>,
		allLinkedFiles: Set<TFile>
	): Promise<void> {
		if (currentDepth >= maxDepth || visited.has(file.path)) {
			return;
		}

		visited.add(file.path);

		try {
			const linkedFiles = await this.getLinkedFiles(file);
			
			for (const linkedFile of linkedFiles) {
				allLinkedFiles.add(linkedFile);
				
				// Recursively process linked files
				await this.getAllLinkedFilesRecursivelyHelper(
					linkedFile,
					maxDepth,
					currentDepth + 1,
					visited,
					allLinkedFiles
				);
			}
		} catch (error) {
			console.error(`Error processing links for ${file.path}:`, error);
		}
	}

	private async isExcalidrawFile(file: TFile, currentFile: TFile): Promise<boolean> {
		try {
			const fileContent = await this.app.vault.cachedRead(file);
			
			const frontmatterMatch = fileContent.match(/^---\s*([\s\S]*?)\s*---/);
			
			if (!frontmatterMatch) {
				return file.extension === 'excalidraw' || file.name.endsWith('.excalidraw');
			}
			
			const frontmatter = frontmatterMatch[1];
			
			const hasExcalidrawPlugin = /excalidraw-plugin:\s*parsed/i.test(frontmatter);
			const hasExcalidrawInTags = /excalidraw/i.test(frontmatter);
			const hasDrawingSection = /##?\s*Drawing/i.test(fileContent);
			
			return hasExcalidrawPlugin || (hasExcalidrawInTags && hasDrawingSection) || file.extension === 'excalidraw';
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
			return false;
		}
	}

	updateSettings(newSettings: NSPublishSettings): void {
		this.settings = newSettings;
	}
}