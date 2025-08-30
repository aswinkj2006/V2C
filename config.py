import os
from dotenv import load_dotenv


load_dotenv()

# Get API key from environment
GEMINIAPI_KEY = os.getenv('API_KEY')

class Config:
    # Google Gemini API Configuration
    GEMINI_API_KEY = GEMINIAPI_KEY  # Replace with your actual API key
    GEMINI_MODEL = 'gemini-1.5-flash'
    
    # Flask Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # Supported Languages
    SUPPORTED_LANGUAGES = {
        'en': 'English',
        'es': 'Spanish', 
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
        'hi': 'Hindi',
        'ar': 'Arabic',
        'ta': 'Tamil',
        'ml': 'Malayalam',
        'te': 'Telugu'
    }
    
    # Programming Languages
    PROGRAMMING_LANGUAGES = {
        'python': 'Python',
        'javascript': 'JavaScript',
        'java': 'Java',
        'c': 'C',
        'cpp': 'C++',
        'html': 'HTML/CSS/JS',
        'sql': 'SQL',
        'bash': 'Bash'
    }
    
