import { App, PluginSettingTab, Setting } from 'obsidian';
import { NSPublishSettings } from './types';

export interface NSPublishPlugin {
	settings: NSPublishSettings;
	saveSettings(): Promise<void>;
}

export class NSPublishSettingTab extends PluginSettingTab {
	plugin: NSPublishPlugin;

	constructor(app: App, plugin: NSPublishPlugin) {
		super(app, plugin as any);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'NS Publish Settings' });

		// Target folder path setting
		new Setting(containerEl)
			.setName('Target Folder Path')
			.setDesc('Folder within this vault where notes will be copied (e.g., "700_Publish")')
			.addText(text => text
				.setPlaceholder('700_Publish')
				.setValue(this.plugin.settings.targetFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.targetFolderPath = value.trim();
					await this.plugin.saveSettings();
				}));

		// Include linked notes setting
		new Setting(containerEl)
			.setName('Include Linked Notes')
			.setDesc('Also copy notes that are linked via wikilinks')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeLinkedNotes)
				.onChange(async (value) => {
					this.plugin.settings.includeLinkedNotes = value;
					await this.plugin.saveSettings();
				}));

		// Max depth setting
		new Setting(containerEl)
			.setName('Maximum Link Depth')
			.setDesc('Maximum depth to follow wikilinks (prevents infinite loops)')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(String(this.plugin.settings.maxDepth))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0 && numValue <= 20) {
						this.plugin.settings.maxDepth = numValue;
						await this.plugin.saveSettings();
					}
				}));

		// Preserve folder structure setting
		new Setting(containerEl)
			.setName('Preserve Folder Structure')
			.setDesc('Maintain the same folder structure in target vault')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.preserveFolderStructure)
				.onChange(async (value) => {
					this.plugin.settings.preserveFolderStructure = value;
					await this.plugin.saveSettings();
				}));

		// Add publish prefix setting
		new Setting(containerEl)
			.setName('Add Publish Prefix')
			.setDesc('Add a prefix to published file names')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.addPublishPrefix)
				.onChange(async (value) => {
					this.plugin.settings.addPublishPrefix = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide prefix setting
				}));

		// Publish prefix setting (only show if enabled)
		if (this.plugin.settings.addPublishPrefix) {
			new Setting(containerEl)
				.setName('Publish Prefix')
				.setDesc('Prefix to add to published file names')
				.addText(text => text
					.setPlaceholder('published_')
					.setValue(this.plugin.settings.publishPrefix)
					.onChange(async (value) => {
						this.plugin.settings.publishPrefix = value;
						await this.plugin.saveSettings();
					}));
		}

		// Exclude patterns setting
		new Setting(containerEl)
			.setName('Exclude Patterns')
			.setDesc('Comma-separated patterns to exclude from linking (supports regex)')
			.addTextArea(text => text
				.setPlaceholder('template.*,^_.*,daily/.*')
				.setValue(this.plugin.settings.excludePatterns.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludePatterns = value
						.split(',')
						.map(p => p.trim())
						.filter(p => p.length > 0);
					await this.plugin.saveSettings();
				}));

		// Base URL setting for clipboard sharing
		new Setting(containerEl)
			.setName('Base URL')
			.setDesc('Base URL for generating shareable links (copied to clipboard after publishing)')
			.addText(text => text
				.setPlaceholder('http://172.28.35.242:8080')
				.setValue(this.plugin.settings.baseUrl)
				.onChange(async (value) => {
					this.plugin.settings.baseUrl = value;
					await this.plugin.saveSettings();
				}));

		// Additional settings section
		containerEl.createEl('h3', { text: 'Advanced Settings' });

		// Show current vault info
		const infoDiv = containerEl.createDiv();
		infoDiv.style.backgroundColor = 'var(--background-secondary)';
		infoDiv.style.padding = '10px';
		infoDiv.style.borderRadius = '5px';
		infoDiv.style.marginBottom = '15px';
		infoDiv.createEl('p', { text: `Current vault: ${this.app.vault.getName()}` });
		infoDiv.createEl('p', { text: `Target path: ${this.plugin.settings.targetFolderPath}` });

		// Help text
		const helpDiv = containerEl.createDiv();
		helpDiv.createEl('p', { text: 'Tips:' });
		helpDiv.createEl('ul').innerHTML = `
			<li>Target folder will be created if it doesn't exist</li>
			<li>Use forward slashes (/) for nested folders (e.g., "publish/output")</li>
			<li>Exclude patterns support regular expressions</li>
			<li>Higher max depth values may slow down publishing</li>
			<li>Folder structure preservation maintains original organization</li>
			<li>Prefix helps distinguish published files from originals</li>
		`;

		// Add some styling
		helpDiv.style.backgroundColor = 'var(--background-secondary)';
		helpDiv.style.padding = '10px';
		helpDiv.style.borderRadius = '5px';
		helpDiv.style.marginTop = '20px';
	}
}