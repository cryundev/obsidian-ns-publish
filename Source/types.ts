export interface NSPublishSettings {
	targetFolderPath: string;
	includeLinkedNotes: boolean;
	maxDepth: number;
	excludePatterns: string[];
	preserveFolderStructure: boolean;
	addPublishPrefix: boolean;
	publishPrefix: string;
	baseUrl: string;
}

export const DEFAULT_SETTINGS: NSPublishSettings = {
	targetFolderPath: '700_Publish',
	includeLinkedNotes: true,
	maxDepth: 5,
	excludePatterns: [],
	preserveFolderStructure: true,
	addPublishPrefix: false,
	publishPrefix: 'published_',
	baseUrl: 'http://172.28.35.242:8080'
};

export interface PublishResult {
	publishedFiles: Set<string>;
	skippedFiles: Set<string>;
	errors: string[];
}

export interface PublishOptions {
	includeLinked: boolean;
	maxDepth?: number;
	excludePatterns?: string[];
}