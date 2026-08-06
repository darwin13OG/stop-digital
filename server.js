import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

let aiInstance = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiInstance;
}

function cleanAndParseJSON(rawText) {
  if (!rawText) return {};
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Error al parsear JSON de Gemini:', e, 'Texto original:', rawText);
    return {};
  }
}

// Endpoint para validar palabras con IA de manera justa y objetiva
app.post('/api/validate-words', async (req, res) => {
  try {
    const { letter, answers } = req.body;
    if (!letter || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    if (answers.length === 0) {
      return res.json({ results: [] });
    }

    const ai = getAI();
    const prompt = `Actúa como juez y diccionario experto para el juego STOP (Tutti Frutti).
Letra obligatoria: "${letter.toUpperCase()}"

Lista de palabras a evaluar por categoría:
${JSON.stringify(answers, null, 2)}

Instrucciones para CADA elemento de la lista:
1. Determina el "status":
   - "valid": Es una palabra/concepto real que empieza por "${letter.toUpperCase()}" y pertenece a la categoría.
   - "half": Es una palabra debatible, diminutivo, jerga aceptable o respuesta incompleta (vale 50 pts).
   - "invalid": NO empieza por "${letter.toUpperCase()}", no existe, o no pertenece a la categoría.
2. Genera una "definition": Breve definición estilo diccionario (máximo 15 palabras).
3. Genera un "reason": Breve explicación del veredicto (máximo 10 palabras).

Devuelve un JSON estrictamente válido con esta estructura:
{
  "results": [
    {
      "category": "nombre categoría",
      "word": "palabra evaluada",
      "status": "valid" | "half" | "invalid",
      "reason": "Explicación breve del veredicto",
      "definition": "Definición estilo diccionario",
      "players": ["Nombre Jugador 1", "Nombre Jugador 2"]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = cleanAndParseJSON(response.text || '{}');
    return res.json(parsed);
  } catch (error) {
    console.error('Error al validar con Gemini:', error);
    return res.status(500).json({ error: 'No se pudo consultar el juez IA', details: error.message });
  }
});

// Endpoint para generar respuestas del Bot IA en Modo Solitario
app.post('/api/generate-ai-bot-answers', async (req, res) => {
  try {
    const { letter, categories, botLevel = 'normal' } = req.body;
    if (!letter || !categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }

    const ai = getAI();
    const prompt = `Juegas como un rival entusiasta en STOP (Tutti Frutti).
Letra de la ronda: "${letter.toUpperCase()}"
Categorías a llenar: ${JSON.stringify(categories)}
Nivel de habilidad: ${botLevel.toUpperCase()}

Instrucciones:
- Responde para CADA categoría con una palabra real en español que empiece con la letra "${letter.toUpperCase()}".
- En nivel FÁCIL: Usa palabras sencillas e infantiles. Deja 1 casilla vacía con "-".
- En nivel NORMAL: Responde palabras cotidianas y correctas para casi todas las categorías.
- En nivel EXPERTO: Responde palabras rápidas, precisas y originales para todas las categorías.

Devuelve EXCLUSIVAMENTE un JSON válido con la siguiente estructura:
{
  "answers": {
    "Categoría 1": "Palabra1",
    "Categoría 2": "Palabra2"
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = cleanAndParseJSON(response.text || '{}');
    return res.json(parsed);
  } catch (error) {
    console.error('Error al generar respuestas del bot IA:', error);
    return res.status(500).json({ error: 'Error al generar bot IA', details: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

