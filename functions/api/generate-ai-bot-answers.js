export async function onRequestPost(context) {
  try {
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY no está configurada en las variables de entorno de Cloudflare Pages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { letter, categories, botLevel = 'normal' } = await context.request.json();
    if (!letter || !categories || !Array.isArray(categories)) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
      JSON.stringify({ error: 'Error al generar bot IA', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
