# NS Publish - Obsidian Plugin

A powerful Obsidian plugin that enables seamless note publishing with automatic link resolution, Excalidraw image conversion, and instant URL sharing.

## ✨ Features

### 📝 Smart Note Publishing
- **Publish with Links**: Automatically copy the current note and all linked notes recursively
- **Publish Only**: Copy just the current note without following links
- **Configurable Depth**: Set maximum recursion depth to control publishing scope
- **Folder Structure**: Preserve or flatten folder hierarchy as needed

### 🎨 Excalidraw Integration
- **Automatic Detection**: Intelligently identifies Excalidraw files in wikilinks
- **Image Conversion**: Converts Excalidraw drawings to PNG images automatically
- **Organized Storage**: Places generated images in `_Image` subfolder
- **Link Preservation**: Maintains display text and formatting from original links
- **Exclusion**: Automatically excludes original Excalidraw files from publishing

### 🔗 Instant URL Sharing
- **Automatic Clipboard Copy**: Generated URLs are immediately copied to clipboard after successful publishing
- **URL-Friendly Conversion**: Converts file names to web-compatible format (`spaces → hyphens`, `& → --and--`)
- **Configurable Base URL**: Set your server's base URL for consistent link generation
- **Smart Notifications**: Visual feedback showing the copied URL

### ⚙️ Advanced Configuration
- **Exclude Patterns**: Use regex patterns to exclude specific files from linking
- **File Prefixes**: Optional prefixes for published files
- **Target Path Validation**: Prevents path traversal and ensures vault safety
- **Publishing Statistics**: Preview what files will be published before execution

## 🚀 Installation

### Manual Installation
1. Download the latest release files (`main.js`, `manifest.json`, `styles.css`)
2. Create a folder `obsidian-ns-publish` in your vault's `.obsidian/plugins/` directory
3. Place the downloaded files in the created folder
4. Enable the plugin in Obsidian's Community Plugins settings

## 📖 Usage

### Basic Publishing
1. Open any note you want to publish
2. Use the ribbon icon (📁) or command palette
3. Choose between:
   - **Publish with Links**: Includes all linked notes recursively
   - **Publish Only**: Just the current note
   - **Show Statistics**: Preview publishing scope

### Configuration
Access plugin settings to configure:
- **Target Folder Path**: Where published files will be stored
- **Base URL**: Your server URL for automatic link generation
- **Max Depth**: Maximum recursion depth for linked notes
- **Exclude Patterns**: Regex patterns to skip specific files
- **Folder Structure**: Preserve or flatten directory hierarchy

### URL Sharing
After successful publishing:
1. The generated URL is automatically copied to your clipboard
2. A notification shows the copied URL
3. Share the link immediately with others

## 🎯 Example Workflow

1. **Write** your note with Excalidraw drawings and wikilinks
2. **Publish** using the plugin (automatic Excalidraw → PNG conversion)
3. **Share** the instantly generated URL from your clipboard

**Input**: `100_UnrealEngine/언리얼 충돌 시스템 & Hit Location.md`
**Output URL**: `http://your-server.com/100_UnrealEngine/언리얼-충돌-시스템--and--Hit-Location`

## ⚙️ Settings Reference

| Setting | Description | Default |
|---------|-------------|---------|
| Target Folder Path | Destination folder within vault | `700_Publish` |
| Include Linked Notes | Follow wikilinks recursively | `true` |
| Max Depth | Maximum recursion depth | `5` |
| Preserve Folder Structure | Maintain directory hierarchy | `true` |
| Add Publish Prefix | Add prefix to published files | `false` |
| Exclude Patterns | Regex patterns to exclude | `[]` |
| Base URL | Server URL for link generation | `http://172.28.35.242:8080` |

## 🛠️ Technical Details

### Excalidraw Processing
- Detects files with `excalidraw-plugin: parsed` frontmatter
- Supports embedded files and complex drawings
- Generates high-quality PNG exports
- Handles naming conflicts automatically

### URL Generation
- Converts spaces to hyphens for web compatibility
- Transforms `&` symbols to `--and--`
- Properly encodes non-ASCII characters
- Excludes target folder path from URLs

### Safety Features
- Path traversal prevention
- Comprehensive error handling
- Graceful degradation on failures
- Detailed logging for troubleshooting

## 🔧 Development

### Build from Source
```bash
npm install
npm run dev    # Development build with watch
npm run build  # Production build
```

### File Structure
```
Source/
├── main.ts           # Plugin entry point
├── NoteCopier.ts     # Core publishing logic
├── WikilinkParser.ts # Link resolution engine
├── ExcalidrawUtil.ts # Drawing conversion
├── SettingsTab.ts    # Configuration UI
└── types.ts          # Type definitions
```

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📋 Changelog

### Version 1.0.0
- Initial release
- Smart note publishing with recursive link resolution
- Excalidraw to PNG conversion
- Automatic URL generation and clipboard sharing
- Comprehensive settings and exclusion patterns
- Production-ready with full error handling

---

**Happy Publishing!** 🚀