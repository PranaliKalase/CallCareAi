const GEMINI_API_KEY = 'AIzaSyAMG9X5ykRGI-F3YK0UicmvXpb4zfVAA6I';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are VoiceCare AI, a friendly and professional healthcare voice assistant. 
You help patients with:
- Booking doctor appointments
- Understanding symptoms (but always recommend seeing a doctor)
- General health advice and wellness tips
- Navigating the VoiceCare AI app
- Emergency guidance (always recommend calling emergency services for real emergencies)

Keep responses concise (2-3 sentences max), warm, and professional. 
Never diagnose conditions - always suggest consulting a healthcare professional.
If someone describes an emergency, tell them to use the SOS Emergency feature or call local emergency services immediately.`;

export const sendToGemini = async (userMessage, conversationHistory = []) => {
  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          ...conversationHistory,
          {
            role: 'user',
            parts: [{ text: userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error details:', JSON.stringify(errorData, null, 2));
      
      if (response.status === 400) {
        throw new Error(`Gemini API Error (400): ${errorData.error?.message || 'Invalid request structure'}`);
      } else if (response.status === 403) {
        throw new Error('Gemini API Error (403): Invalid API key or permission denied');
      } else if (response.status === 404) {
        throw new Error('Gemini API Error (404): Model not found. Check the model name.');
      } else if (response.status === 429) {
        throw new Error('Gemini API Error (429): Rate limit exceeded');
      }
      
      throw new Error(`Gemini API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      if (data.promptFeedback?.blockReason) {
        throw new Error(`AI response blocked: ${data.promptFeedback.blockReason}`);
      }
      throw new Error('No response from AI candidates');
    }
    
    return text;
  } catch (error) {
    console.error('Gemini Service Error:', error.message);
    throw error;
  }
};

// Browser Speech-to-Text utility
export const startSpeechRecognition = () => {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported. Please type your message instead.'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = (event) => {
      reject(new Error(`Speech error: ${event.error}`));
    };

    recognition.start();
  });
};

// Browser Text-to-Speech utility
export const speakText = (text) => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';
    
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    
    window.speechSynthesis.speak(utterance);
  });
};
