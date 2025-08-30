from flask import Flask, request, jsonify, render_template, send_file
import google.generativeai as genai
import speech_recognition as sr
from googletrans import Translator
import os
import tempfile
import requests
import base64
import json
from io import BytesIO
import zipfile
import datetime
import pyttsx3
import threading
from werkzeug.utils import secure_filename
from config import Config
from github import Github
import wave
import audioop

app = Flask(__name__)
app.config.from_object(Config)

# Configure Google Gemini
genai.configure(api_key=app.config['GEMINI_API_KEY'])
model = genai.GenerativeModel(app.config['GEMINI_MODEL'])

# Initialize speech recognizer, translator, and TTS
recognizer = sr.Recognizer()
translator = Translator()
tts_engine = pyttsx3.init()

# Project management
projects = {}
current_project_id = None
code_history = {}

@app.route('/')
def index():
    return render_template('index.html', 
                         voice_languages=app.config['SUPPORTED_LANGUAGES'],
                         programming_languages=app.config['PROGRAMMING_LANGUAGES'])

@app.route('/generate_code', methods=['POST'])
def generate_code():
    try:
        data = request.json
        text = data.get('text', '')
        language = data.get('language', 'python')
        
        # Translate if not in English
        try:
            detected_lang = translator.detect(text).lang
            if detected_lang != 'en':
                text = translator.translate(text, dest='en').text
        except Exception as e:
            print(f"Translation error: {e}")
        
        # Generate code using Gemini
        prompt = f"""
        Convert the following natural language description into {language} code.
        Be concise but functional. Include comments for clarity.
        
        Description: {text}
        
        Please provide clean, working code without any additional explanations.
        """
        
        response = model.generate_content(prompt)
        generated_code = response.text
        
        # Clean up the response - remove markdown code blocks if present
        if generated_code.startswith('```'):
            lines = generated_code.split('\n')
            generated_code = '\n'.join(lines[1:-1])
        
        return jsonify({
            'success': True,
            'code': generated_code
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/modify_code', methods=['POST'])
def modify_code():
    try:
        data = request.json
        original_code = data.get('original_code', '')
        selected_lines = data.get('selected_lines', '')
        line_start = data.get('line_start', 1)
        line_end = data.get('line_end', 1)
        modification = data.get('modification', '')
        language = data.get('language', 'python')
        
        prompt = f"""
        I have {language} code and need to modify specific lines.
        
        Original code:
        {original_code}
        
        Selected lines ({line_start}-{line_end}):
        {selected_lines}
        
        Modification request: {modification}
        
        Please provide the complete modified code with the changes applied only to the specified lines.
        Keep the rest of the code unchanged. Return only the code without explanations.
        """
        
        response = model.generate_content(prompt)
        modified_code = response.text
        
        # Clean up the response
        if modified_code.startswith('```'):
            lines = modified_code.split('\n')
            modified_code = '\n'.join(lines[1:-1])
        
        return jsonify({
            'success': True,
            'modified_code': modified_code
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({'success': False, 'error': 'No audio file provided'})
        
        # Save uploaded file temporarily
        filename = secure_filename(audio_file.filename)
        temp_path = os.path.join(tempfile.gettempdir(), filename)
        audio_file.save(temp_path)
        
        # Convert audio to text
        with sr.AudioFile(temp_path) as source:
            audio = recognizer.record(source)
            
        try:
            # Try to recognize speech
            transcript = recognizer.recognize_google(audio)
            
            # Translate if needed
            try:
                detected_lang = translator.detect(transcript).lang
                if detected_lang != 'en':
                    transcript = translator.translate(transcript, dest='en').text
            except:
                pass  # Use original transcript if translation fails
            
        except sr.UnknownValueError:
            return jsonify({'success': False, 'error': 'Could not understand audio'})
        except sr.RequestError as e:
            return jsonify({'success': False, 'error': f'Speech recognition error: {e}'})
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
        return jsonify({
            'success': True,
            'transcript': transcript
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/run_code', methods=['POST'])
def run_code():
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'python')
        
        if language == 'python':
            output, error = execute_python_code(code)
            return jsonify({
                'success': True,
                'output': output,
                'error': error
            })
        elif language == 'javascript':
            return jsonify({
                'success': True,
                'output': 'JavaScript execution handled in browser',
                'error': None
            })
        elif language == 'java':
            output, error = execute_java_code(code)
            return jsonify({
                'success': True,
                'output': output,
                'error': error
            })
        elif language in ['cpp', 'c++', 'c']:
            output, error = execute_c_cpp_code(code, language)
            return jsonify({
                'success': True,
                'output': output,
                'error': error
            })
        elif language == 'html':
            return jsonify({
                'success': True,
                'output': 'HTML rendered in preview',
                'error': None
            })
        else:
            return jsonify({
                'success': False,
                'output': '',
                'error': f'{language.title()} execution not supported on server'
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/format_code', methods=['POST'])
def format_code():
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'python')
        
        formatted_code = format_code_by_language(code, language)
        
        return jsonify({
            'success': True,
            'formatted_code': formatted_code
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/debug_code', methods=['POST'])
def debug_code():
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'python')
        
        debug_info = analyze_code_for_debugging(code, language)
        
        return jsonify({
            'success': True,
            'debug_info': debug_info
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/generate_description', methods=['POST'])
def generate_description():
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'python')
        
        prompt = f"""
        Provide a clear, concise description of what this {language} code does:
        
        {code}
        
        Explain in simple terms what the code accomplishes, its main functionality, 
        and any important features. Keep it brief but informative.
        """
        
        response = model.generate_content(prompt)
        description = response.text
        
        return jsonify({
            'success': True,
            'description': description
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/create_multi_file_project', methods=['POST'])
def create_multi_file_project():
    try:
        data = request.json
        description = data.get('description', '')
        language = data.get('language', 'python')
        
        # Check if this should be a multi-file project
        prompt = f"""
        Analyze this project description and determine if it needs multiple files:
        "{description}"
        
        Language: {language}
        
        If it needs multiple files, respond with JSON:
        {{
            "is_multi_file": true,
            "files": [
                {{"filename": "main.py", "content": "# Main file content"}},
                {{"filename": "utils.py", "content": "# Utility functions"}}
            ]
        }}
        
        If it's a simple single-file project, respond with:
        {{"is_multi_file": false}}
        """
        
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(prompt)
        
        try:
            import json
            project_data = json.loads(response.text.strip())
            return jsonify({'success': True, 'project_data': project_data})
        except:
            return jsonify({'success': True, 'project_data': {'is_multi_file': False}})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def execute_python_code(code):
    try:
        # Simple Python execution (in production, use a proper sandbox)
        import io
        import sys
        from contextlib import redirect_stdout, redirect_stderr
        
        # Capture output
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(code)
        
        output = stdout_capture.getvalue()
        error = stderr_capture.getvalue()
        
        return {
            'success': True,
            'output': output if output else 'Code executed successfully',
            'error': error if error else None
        }
    except Exception as e:
        return {'success': False, 'output': '', 'error': str(e)}

def execute_java_code(code):
    return {'success': False, 'output': '', 'error': 'Java execution requires compilation setup'}

def execute_cpp_code(code):
    return {'success': False, 'output': '', 'error': 'C++ execution requires compilation setup'}

def format_code_by_language(code, language):
    if language == 'python':
        # Basic Python formatting
        lines = code.split('\n')
        formatted_lines = []
        indent_level = 0
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                formatted_lines.append('')
                continue
                
            if stripped.endswith(':'):
                formatted_lines.append('    ' * indent_level + stripped)
                indent_level += 1
            elif stripped in ['else:', 'elif', 'except:', 'finally:']:
                indent_level = max(0, indent_level - 1)
                formatted_lines.append('    ' * indent_level + stripped)
                indent_level += 1
            else:
                formatted_lines.append('    ' * indent_level + stripped)
        
        return '\n'.join(formatted_lines)
    
    elif language == 'javascript':
        # Basic JavaScript formatting
        return code.replace(';', ';\n').replace('{', '{\n').replace('}', '\n}')
    
    else:
        # Return original code with basic cleanup
        return '\n'.join(line.strip() for line in code.split('\n') if line.strip())

def analyze_code_for_debugging(code, language):
    try:
        prompt = f"""
        Analyze this {language} code for potential bugs, errors, and improvements:
        
        {code}
        
        Provide a detailed analysis including:
        1. Syntax errors (if any)
        2. Logic errors or potential issues
        3. Performance improvements
        4. Best practice recommendations
        5. Security concerns (if any)
        
        Format as a structured analysis with clear sections.
        """
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Debug analysis failed: {str(e)}"

def get_file_extension(language):
    """Get appropriate file extension for programming language"""
    extensions = {
        'python': '.py',
        'javascript': '.js',
        'java': '.java',
        'cpp': '.cpp',
        'c': '.c',
        'csharp': '.cs',
        'php': '.php',
        'ruby': '.rb',
        'go': '.go',
        'rust': '.rs',
        'swift': '.swift',
        'kotlin': '.kt',
        'typescript': '.ts',
        'html': '.html',
        'css': '.css',
        'sql': '.sql',
        'r': '.R',
        'matlab': '.m',
        'scala': '.scala',
        'perl': '.pl',
        'bash': '.sh'
    }
    return extensions.get(language, '.txt')

@app.route('/create_project', methods=['POST'])
def create_project():
    try:
        data = request.json
        project_name = data.get('name', 'Untitled Project')
        language = data.get('language', 'python')
        
        project_id = f"project_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        projects[project_id] = {
            'name': project_name,
            'language': language,
            'files': {},
            'created_at': datetime.datetime.now().isoformat(),
            'readme': ''
        }
        
        global current_project_id
        current_project_id = project_id
        
        return jsonify({
            'success': True,
            'project_id': project_id,
            'project': projects[project_id]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/add_file', methods=['POST'])
def add_file():
    try:
        data = request.json
        project_id = data.get('project_id', current_project_id)
        filename = data.get('filename', '')
        content = data.get('content', '')
        language = data.get('language', 'python')
        
        if not project_id or project_id not in projects:
            return jsonify({'success': False, 'error': 'Invalid project'})
        
        if not filename:
            # Auto-generate filename based on language
            base_name = f"main{get_file_extension(language)}"
            counter = 1
            while base_name in projects[project_id]['files']:
                base_name = f"file{counter}{get_file_extension(language)}"
                counter += 1
            filename = base_name
        
        projects[project_id]['files'][filename] = {
            'content': content,
            'created_at': datetime.datetime.now().isoformat(),
            'language': language
        }
        
        # Save to history
        if project_id not in code_history:
            code_history[project_id] = []
        
        code_history[project_id].append({
            'timestamp': datetime.datetime.now().isoformat(),
            'action': 'add_file',
            'filename': filename,
            'content': content
        })
        
        return jsonify({
            'success': True,
            'filename': filename,
            'project': projects[project_id]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/export_project/<project_id>')
def export_project(project_id):
    try:
        if project_id not in projects:
            return jsonify({'success': False, 'error': 'Project not found'})
        
        project = projects[project_id]
        
        # Single file export
        if len(project['files']) == 1:
            filename, file_data = next(iter(project['files'].items()))
            
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename, content in files.items():
                zip_file.writestr(filename, content)
            
            # Add console output if available
            if console_output:
                zip_file.writestr('console_output.txt', console_output)
            
            # Add code description if available
            if code_description:
                zip_file.writestr('code_description.txt', code_description)
            
            # Add README
            readme_content = f"""# {project_name}

Generated by V2C (Voice-to-Code) AI Assistant

## Files
{chr(10).join([f"- {filename}" for filename in files.keys()])}

## Additional Files
- console_output.txt: Console execution output
- code_description.txt: AI-generated code description

## Usage
This project was created using voice commands and AI assistance.
"""
            zip_file.writestr('README.md', readme_content)
        
        zip_buffer.seek(0)
        
        return send_file(
            BytesIO(zip_buffer.read()),
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'{project_name}.zip'
        )
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/get_history/<project_id>')
def get_history(project_id):
    try:
        history = code_history.get(project_id, [])
        return jsonify({
            'success': True,
            'history': history[-10:]  # Last 10 versions
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/rollback', methods=['POST'])
def rollback():
    try:
        data = request.json
        project_id = data.get('project_id', current_project_id)
        version_index = data.get('version_index', -1)
        
        if project_id not in code_history:
            return jsonify({'success': False, 'error': 'No history found'})
        
        history = code_history[project_id]
        if version_index >= len(history) or version_index < 0:
            return jsonify({'success': False, 'error': 'Invalid version'})
        
        # Restore to selected version
        version = history[version_index]
        filename = version['filename']
        content = version['content']
        
        if project_id in projects and filename in projects[project_id]['files']:
            projects[project_id]['files'][filename]['content'] = content
        
        return jsonify({
            'success': True,
            'restored_content': content,
            'filename': filename
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/explain_code', methods=['POST'])
def explain_code():
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'python')
        audio_output = data.get('audio_output', False)
        
        prompt = f"""
        Explain the following {language} code in simple terms:
        
        {code}
        
        Provide a clear, beginner-friendly explanation of what this code does,
        how it works, and any important concepts involved.
        """
        
        response = model.generate_content(prompt)
        explanation = response.text
        
        # Generate audio if requested
        audio_file = None
        if audio_output:
            audio_file = generate_audio_explanation(explanation)
        
        return jsonify({
            'success': True,
            'explanation': explanation,
            'audio_file': audio_file
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/detect_bugs', methods=['POST'])
def detect_bugs():
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'python')
        
        prompt = f"""
        Analyze the following {language} code for potential bugs, errors, or improvements:
        
        {code}
        
        Provide:
        1. List of potential bugs or issues
        2. Suggested fixes for each issue
        3. Code quality improvements
        4. Best practice recommendations
        
        Format your response as JSON with 'issues' and 'suggestions' arrays.
        """
        
        response = model.generate_content(prompt)
        analysis = response.text
        
        return jsonify({
            'success': True,
            'analysis': analysis
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/voice_command', methods=['POST'])
def voice_command():
    try:
        data = request.json
        command = data.get('command', '').lower()
        code = data.get('code', '')
        language = data.get('language', 'python')
        
        # Parse voice commands for line editing
        if 'line' in command and ('change' in command or 'edit' in command or 'modify' in command):
            # Extract line numbers
            import re
            line_match = re.search(r'line[s]?\s*(\d+)(?:\s*(?:to|-)\s*(\d+))?', command)
            
            if line_match:
                start_line = int(line_match.group(1))
                end_line = int(line_match.group(2)) if line_match.group(2) else start_line
                
                # Extract modification instruction
                modification = re.sub(r'.*line[s]?\s*\d+(?:\s*(?:to|-)\s*\d+)?\s*', '', command)
                
                return jsonify({
                    'success': True,
                    'action': 'modify_lines',
                    'start_line': start_line,
                    'end_line': end_line,
                    'modification': modification
                })
        
        # Other voice commands
        if 'explain' in command:
            return jsonify({
                'success': True,
                'action': 'explain_code'
            })
        elif 'download' in command or 'export' in command:
            return jsonify({
                'success': True,
                'action': 'export_project'
            })
        elif 'bug' in command or 'error' in command:
            return jsonify({
                'success': True,
                'action': 'detect_bugs'
            })
        elif 'run' in command:
            if language == 'python':
                output, error = execute_python_code(code)
                return jsonify({
                    'success': True,
                    'output': output,
                    'error': error
                })
            elif language == 'java':
                output, error = execute_java_code(code)
                return jsonify({
                    'success': True,
                    'output': output,
                    'error': error
                })
            elif language in ['c', 'cpp', 'c++']:
                output, error = execute_c_cpp_code(code, language)
                return jsonify({
                    'success': True,
                    'output': output,
                    'error': error
                })
            else:
                return jsonify({
                    'success': True,
                    'output': f'Server-side execution for {language} not available. Code should run client-side.',
                    'error': None
                })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

def generate_readme(project):
    """Generate README content for project"""
    files_list = '\n'.join([f"- {filename}" for filename in project['files'].keys()])
    
    readme = f"""# {project['name']}

## Description
This project was generated using V2C - Voice to Code AI Assistant.

## Files
{files_list}

## Programming Language
{project['language'].title()}

## How to Run
1. Make sure you have the required dependencies installed
2. Run the main file to execute the program

## Generated On
{project['created_at']}

---
*Generated by V2C - Voice to Code AI Assistant*
"""
    return readme

def generate_project_structure(project):
    """Generate project structure documentation"""
    structure = f"""# Project Structure

## Overview
```
{project['name']}/
├── README.md
├── PROJECT_STRUCTURE.md
"""
    
    for filename in project['files'].keys():
        structure += f"├── {filename}\n"
    
    structure += "```\n\n## File Descriptions\n\n"
    
    for filename, file_data in project['files'].items():
        structure += f"### {filename}\n"
        structure += f"- **Language**: {file_data['language'].title()}\n"
        structure += f"- **Created**: {file_data['created_at']}\n"
        structure += f"- **Purpose**: Main {file_data['language']} file\n\n"
    
    return structure

def generate_audio_explanation(text):
    """Generate audio file from text explanation"""
    try:
        # This would generate an audio file - simplified for demo
        # In production, you'd save to a temporary file and return the path
        return "audio_explanation.mp3"  # Placeholder
    except:
        return None

if __name__ == '__main__':
    print("=" * 50)
    print(" V2C - Voice to Code AI Assistant")
    print("=" * 50)
    print("Features:")
    print(" Multi-language voice support with auto-detection")
    print(" AI-powered code generation using Google Gemini")
    print(" VSCode-like editor with syntax highlighting")
    print(" Line-specific code editing")
    print(" Audio file upload support")
    print(" Multiple programming languages")
    print("=" * 50)
    print("Setup Instructions:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Update config.py with your Gemini API key")
    print("3. Run: python app.py")
    print("4. Open: http://localhost:5000")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
