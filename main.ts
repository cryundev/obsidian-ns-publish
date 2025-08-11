import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { NSPublishSettings, DEFAULT_SETTINGS } from './Source/types';
import { NoteCopier } from './Source/NoteCopier';
import { NSPublishSettingTab } from './Source/SettingsTab';

export default class NSPublishPlugin extends Plugin {
	settings: NSPublishSettings;
	private noteCopier: NoteCopier;

	async onload() {
		await this.loadSettings();

		// Initialize the note copier with current settings
		this.noteCopier = new NoteCopier(this.app, this.settings);

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon('paper-plane', 'NS Publish', (evt: MouseEvent) => {
			this.publishCurrentNote();
		});
		ribbonIconEl.addClass('ns-publish-ribbon-class');

		// Main command to publish current note with linked notes
		this.addCommand({
			id: 'publish-current-note',
			name: 'Publish current note with linked notes',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === 'md') {
					if (!checking) {
						this.publishCurrentNote();
					}
					return true;
				}
				return false;
			}
		});

		// Command to publish current note only (without linked notes)
		this.addCommand({
			id: 'publish-current-note-only',
			name: 'Publish current note only',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === 'md') {
					if (!checking) {
						this.publishCurrentNoteOnly();
					}
					return true;
				}
				return false;
			}
		});

		// Command to show publishing statistics
		this.addCommand({
			id: 'show-publish-stats',
			name: 'Show publishing statistics',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === 'md') {
					if (!checking) {
						this.showPublishingStats();
					}
					return true;
				}
				return false;
			}
		});

		// Add settings tab
		this.addSettingTab(new NSPublishSettingTab(this.app, this));
	}

	onunload() {
		// Clean up when plugin is disabled
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update the note copier with new settings
		if (this.noteCopier) {
			this.noteCopier.updateSettings(this.settings);
		}
	}

	/**
	 * Publish the current note with linked notes (main action)
	 */
	async publishCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file to publish');
			return;
		}

		try {
			const result = await this.noteCopier.publishNote(activeFile, {
				includeLinked: this.settings.includeLinkedNotes,
				maxDepth: this.settings.maxDepth,
				excludePatterns: this.settings.excludePatterns
			});

			if (result.errors.length > 0) {
				new Notice(`Published with ${result.errors.length} error(s). Check console for details.`);
			}

		} catch (error) {
			console.error('Error in publishCurrentNote:', error);
			new Notice(`Failed to publish: ${error.message}`);
		}
	}

	/**
	 * Publish only the current note without following links
	 */
	async publishCurrentNoteOnly() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file to publish');
			return;
		}

		try {
			const result = await this.noteCopier.publishNote(activeFile, {
				includeLinked: false
			});

			if (result.errors.length > 0) {
				new Notice(`Published with ${result.errors.length} error(s). Check console for details.`);
			}

		} catch (error) {
			console.error('Error in publishCurrentNoteOnly:', error);
			new Notice(`Failed to publish: ${error.message}`);
		}
	}

	/**
	 * Show statistics about what would be published
	 */
	async showPublishingStats() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file selected');
			return;
		}

		try {
			const stats = await this.noteCopier.getPublishingStats(
				activeFile, 
				this.settings.includeLinkedNotes
			);

			const sizeKB = Math.round(stats.estimatedSize / 1024 * 100) / 100;
			
			let message = `Publishing Statistics:\n`;
			message += `• Total files: ${stats.totalFiles}\n`;
			message += `• Main file: ${activeFile.name}\n`;
			message += `• Linked files: ${stats.linkedFiles.length}\n`;
			message += `• Estimated size: ${sizeKB} KB\n`;
			
			if (stats.linkedFiles.length > 0) {
				message += `\nLinked files:\n`;
				stats.linkedFiles.slice(0, 10).forEach(file => {
					message += `  - ${file.name}\n`;
				});
				
				if (stats.linkedFiles.length > 10) {
					message += `  ... and ${stats.linkedFiles.length - 10} more\n`;
				}
			}

			new Notice(message, 8000);
			console.log('Publishing stats:', stats);

		} catch (error) {
			console.error('Error getting publishing stats:', error);
			new Notice(`Error calculating stats: ${error.message}`);
		}
	}
}