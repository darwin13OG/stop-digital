export async function onRequestPost(context) {
  try {
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY no está configurada en las variables de entorno de Cloudflare Pages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { letter, answers } = await context.request.json();
    if (!letter || !answers || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'Parámetros inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (answers.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Actúa como juez y diccionario experto para el juego STOP (Tutti Frutti).
Letra obligatoria: "${letter.toUpperCase()}"

Lista de palabras a evaluar por categoría:
${JSON.stringify(answers, null, 2)}

Regla Especial de Categorías:
- Para categorías como "Fruta", "Frutas", "Tutti Frutti", "Verdura" o "Fruta/Verdura", ACEPTA TANTO FRUTAS COMO VERDURAS U HORTALIZAS VÁLIDAS (por ejemplo: Tomate, Zanahoria, Lechuga, Aguacate, Pepino, Brócoli, Papa, Cebolla, Espinaca, Ajo son 100% VÁLIDAS como status "valid"). No seas estricto con la diferenciación botánica.

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

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(
        JSON.stringify({ error: 'Error al consultar Gemini API', details: errText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'No se pudo consultar el juez IA', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
