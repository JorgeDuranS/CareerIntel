# CareerIntel AI

Motor de inteligencia de carrera que analiza perfiles profesionales, los compara contra ofertas laborales con scoring semántico, y genera curículums optimizados para sistemas ATS.

## Stack

| Capa | Tecnología |
|------|-------------|
| Frontend | React 19 + TypeScript + Tailwind CSS |
| IA | Google Gemini (`@google/genai`) |
| Gráficos | Recharts (radar de compatibilidad) |
| Procesamiento de archivos | Mammoth (DOCX) + pdfjs-dist (PDF) |
| Build | Vite 6 |

## Flujo

1. **Ingesta** — Sube tu CV (PDF/DOCX/TXT) o pega tu perfil profesional. Gemini extrae habilidades, experiencia y dominios.
2. **Knowledge Hub** — Revisa y edita tu perfil extraído. Puedes agregar habilidades adicionales vía lenguaje natural.
3. **Match Engine** — Pega una descripción de oferta laboral. Gemini analiza la oferta y calcula un score de compatibilidad por categoría (skills, experiencia, dominio, educación).
4. **CV Optimizado** — Si el score supera el umbral configurado, Gemini genera un CV adaptado a la oferta, listo para imprimir como PDF.

## Configuración

Crear un archivo `.env.local` con tu API key de Google Gemini:

```
VITE_GEMINI_API_KEY=tu_api_key_aqui
```

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Estructura

```
├── App.tsx                  # Componente principal y UI
├── index.tsx                 # Entry point React
├── index.html                # HTML base con estilos de impresión
├── services/
│   └── geminiService.ts      # Comunicación con Gemini API
├── utils/
│   ├── fileProcessor.ts      # Extracción de texto (PDF, DOCX)
│   └── logic.ts              # Cálculos deterministas (experiencia, scoring)
├── types.ts                  # Definiciones TypeScript
└── metadata.json             # Metadatos de la app
```