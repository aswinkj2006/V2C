# V2C - Voice to Code AI Assistant

## Enhanced Features Overview

### 🚀 **Core Enhancements**

#### **File Management & Export**
- **Smart File Export**: Single files export as individual files, multi-file projects export as ZIP with auto-generated README and project structure
- **Multiple File Tabs**: Create, manage, and switch between multiple code files with proper tab interface
- **Dynamic File Naming**: Automatic file extensions based on selected programming language (.py, .js, .java, etc.)
- **Project Structure Generation**: Auto-generated documentation showing file hierarchy and descriptions

#### **Version Control & History**
- **Code Versioning**: Complete history tracking with timestamps for all code changes
- **Rollback System**: UNDO functionality to restore previous versions with one click
- **History Viewer**: Modal interface to browse and restore from up to 10 recent versions

#### **GitHub Integration**
- **Direct Export**: Export projects directly to GitHub repositories
- **Repository Creation**: Create new public/private repositories with project description
- **Secure Token Management**: Uses GitHub personal access tokens for authentication

### 🎤 **Advanced Voice Features**

#### **Enhanced Voice Editing**
- **Line-Range Commands**: Voice commands like "Edit line 5 to 10, change variable name to counter"
- **Natural Language Processing**: Intelligent parsing of voice editing instructions
- **Voice Command Recognition**: Supports commands for explain, debug, export, and code generation

#### **Blind Mode Interface**
- **Dedicated Accessibility Mode**: Full voice-first interface for visually impaired users
- **Spacebar Activation**: Press spacebar to activate voice commands
- **Audio Feedback**: Text-to-speech for all responses and code narration
- **Voice-Only Navigation**: Complete application control through voice commands

#### **Audio Features**
- **Code Narration**: Have your code read aloud with text-to-speech
- **Audio Explanations**: Voice output for code explanations and error messages
- **Error Announcements**: Spoken feedback for compilation errors and issues

### 🎨 **User Interface Enhancements**

#### **Theme System**
- **Dark/Light Toggle**: Switch between dark and light themes with persistent storage
- **CSS Variables**: Comprehensive theming system using CSS custom properties
- **Smooth Transitions**: Animated theme switching with visual feedback

#### **Enhanced Editor**
- **Fixed Line Numbers**: Proper line-by-line numbering with improved display
- **Advanced Toolbar**: Quick access buttons for explain, debug, format, export, and run
- **Live Preview**: Real-time preview for HTML/CSS/JavaScript projects
- **Split View**: Side-by-side code editor and preview panel

#### **Modal System**
- **History Modal**: Browse and restore previous code versions
- **GitHub Export Modal**: Configure repository settings for export
- **Explanation Modal**: Display code explanations in formatted popup

### 🔧 **Development Tools**

#### **Code Analysis**
- **Bug Detection**: AI-powered analysis to identify potential issues and improvements
- **Code Explanation**: Detailed explanations of code functionality in plain English
- **Best Practices**: Suggestions for code quality improvements

#### **Code Execution**
- **Live Execution**: Run JavaScript code directly in the browser
- **Output Panel**: Dedicated console for displaying execution results
- **Error Handling**: Comprehensive error reporting with line numbers

#### **Code Formatting**
- **Auto-Formatting**: Clean up code indentation and structure
- **Language-Specific**: Proper formatting rules for each programming language
- **Linting Integration**: Basic code quality checks and suggestions

### 🌐 **Live Preview System**

#### **Web Development Support**
- **HTML Preview**: Real-time rendering of HTML content
- **CSS Styling**: Live preview of CSS changes
- **JavaScript Execution**: Interactive preview with script execution
- **Responsive Design**: Preview panel with adjustable sizing

## 🎯 **Voice Commands Reference**

### **General Commands**
- "Generate code for [description]" - Create new code
- "Explain this code" - Get detailed code explanation
- "Check for bugs" - Analyze code for issues
- "Download code" / "Export project" - Export current project
- "Read code" - Have code spoken aloud

### **Line Editing Commands**
- "Edit line 5" - Modify specific line
- "Edit line 5 to 10" - Modify line range
- "Change line 3, [modification]" - Specific line changes

### **Blind Mode Commands**
- Press **SPACEBAR** to activate voice command mode
- All general commands work in blind mode
- Audio feedback for all actions
- Voice confirmation for all operations

## 🛠️ **Setup Instructions**

### **Dependencies**
```bash
pip install -r requirements.txt
```

### **Configuration**
1. Update `config.py` with your Google Gemini API key
2. For GitHub integration, generate a personal access token
3. Ensure microphone permissions are enabled in your browser

### **Running the Application**
```bash
python app.py
```
Navigate to `http://localhost:5000`

## 📱 **Browser Compatibility**

- **Chrome/Chromium**: Full feature support including voice recognition
- **Firefox**: Limited voice features, full UI functionality
- **Safari**: Basic functionality, limited voice support
- **Edge**: Full feature support

## ♿ **Accessibility Features**

- **Screen Reader Compatible**: Proper ARIA labels and semantic HTML
- **Keyboard Navigation**: Full application control via keyboard
- **High Contrast**: Theme options for better visibility
- **Voice-First Interface**: Complete blind mode for voice-only interaction
- **Audio Feedback**: Text-to-speech for all important actions

## 🔐 **Security Features**

- **Secure Token Storage**: GitHub tokens handled securely
- **Input Validation**: Comprehensive validation for all user inputs
- **XSS Protection**: Sanitized output to prevent code injection
- **CORS Handling**: Proper cross-origin request management

## 📊 **Performance Optimizations**

- **Lazy Loading**: Components loaded on demand
- **Efficient Rendering**: Optimized syntax highlighting
- **Memory Management**: Proper cleanup of audio/video resources
- **Caching**: Local storage for themes and preferences

## 🚀 **Future Enhancements**

- **Collaborative Editing**: Real-time collaboration features
- **Cloud Storage**: Integration with cloud storage providers
- **Advanced Debugging**: Breakpoint and step-through debugging
- **Plugin System**: Extensible architecture for custom features
- **Mobile App**: Native mobile application development

## 📞 **Support**

For issues, feature requests, or contributions, please refer to the project documentation or contact the development team.

---

**V2C - Voice to Code AI Assistant** - Transforming voice into code with AI-powered assistance.
