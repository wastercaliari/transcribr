/**
 * TranscriBR - Módulo de Tradução Simultânea Multilíngue para Atas Técnicas (PT/EN/ES)
 * Ticket: SCRUM-57 (I-13)
 *
 * Responsável por:
 * - Validação e normalização de idiomas alvo (Português, Inglês, Espanhol, Bilíngue).
 * - Geração de diretrizes e prompts de síntese multilíngue preservando jargões técnicos de engenharia.
 * - Formatação de atas bilíngues estruturadas.
 */

'use strict';

const SUPPORTED_LANGUAGES = {
  pt: {
    code: 'pt',
    name: 'Português (Brasil)',
    locale: 'pt-BR',
    title: 'ATA TÉCNICA DE REUNIÃO',
    sections: {
      overview: '1. 📌 Visão Geral e Propósito da Conversa',
      timeline: '2. ⏱️ Linha do Tempo / Cronologia dos Assuntos',
      topics: '3. 💬 Tópicos Principais & Posicionamento dos Participantes',
      tools: '4. 🛠️ Ferramentas, Tecnologias ou Sistemas Mencionados',
      issues: '5. ⚠️ Problemas, Dificuldades ou Impedimentos Levantados',
      decisions: '6. ✅ Decisões, Combinados e Próximos Passos'
    }
  },
  en: {
    code: 'en',
    name: 'English (US)',
    locale: 'en-US',
    title: 'TECHNICAL MEETING MINUTES',
    sections: {
      overview: '1. 📌 Executive Overview & Meeting Purpose',
      timeline: '2. ⏱️ Chronological Timeline of Topics',
      topics: '3. 💬 Key Discussion Points & Participant Contributions',
      tools: '4. 🛠️ Tools, Technologies & Systems Referenced',
      issues: '5. ⚠️ Identified Blockers, Issues & Challenges',
      decisions: '6. ✅ Action Items, Decisions & Next Steps'
    }
  },
  es: {
    code: 'es',
    name: 'Español',
    locale: 'es-ES',
    title: 'ACTA TÉCNICA DE REUNIÓN',
    sections: {
      overview: '1. 📌 Resumen Ejecutivo y Propósito de la Reunión',
      timeline: '2. ⏱️ Cronología y Línea de Tiempo de los Temas',
      topics: '3. 💬 Temas Principales y Postura de los Participantes',
      tools: '4. 🛠️ Herramientas, Tecnologías y Sistemas Mencionados',
      issues: '5. ⚠️ Problemas, Bloqueos o Impedimentos Planteados',
      decisions: '6. ✅ Acuerdos, Decisiones y Próximos Pasos'
    }
  },
  bilingual: {
    code: 'bilingual',
    name: 'Bilíngue (Português & English)',
    locale: 'pt-BR / en-US',
    title: 'ATA TÉCNICA BILÍNGUE / BILINGUAL MEETING MINUTES',
    sections: {
      overview: '1. 📌 Visão Geral & Overview Executivo',
      timeline: '2. ⏱️ Linha do Tempo / Timeline',
      topics: '3. 💬 Tópicos & Key Discussion Points',
      tools: '4. 🛠️ Tecnologias & Tech Stack',
      issues: '5. ⚠️ Impedimentos & Identified Issues',
      decisions: '6. ✅ Decisões & Action Items'
    }
  }
};

/**
 * Normaliza a string de idioma informada pelo usuário ou opções do comando.
 * @param {string} [input]
 * @returns {'pt' | 'en' | 'es' | 'bilingual'}
 */
function normalizeTargetLanguage(input) {
  if (!input || typeof input !== 'string') return 'pt';
  const clean = input.trim().toLowerCase().replace(/_/g, '-');

  if (clean === 'pt' || clean === 'pt-br' || clean.startsWith('portug')) {
    return 'pt';
  }
  if (clean === 'en' || clean === 'en-us' || clean === 'en-gb' || clean.startsWith('ingl') || clean.startsWith('engl')) {
    return 'en';
  }
  if (clean === 'es' || clean === 'es-es' || clean === 'es-la' || clean.startsWith('espan') || clean.startsWith('span')) {
    return 'es';
  }
  if (clean === 'bilingual' || clean === 'bilingue' || clean === 'bilíngue' || clean === 'pt-en' || clean === 'dual') {
    return 'bilingual';
  }

  return 'pt';
}

/**
 * Retorna as instruções específicas de idioma e tradução para o modelo de LLM.
 * @param {string} targetLang
 * @returns {string} Instruções de prompt
 */
function getLanguageInstructions(targetLang) {
  const langKey = normalizeTargetLanguage(targetLang);
  const langMeta = SUPPORTED_LANGUAGES[langKey];

  if (langKey === 'en') {
    return `
IDIOMA DE SAÍDA: ENGLISH (US).
- The entire meeting minutes, analysis, summaries, and action items MUST BE WRITTEN IN ENGLISH.
- Translate all spoken Portuguese utterances accurately into fluent, professional business and engineering English.
- Preserve technical terms verbatim (e.g., Docker, Kubernetes, CI/CD, PR, branch, commit, AWS, Groq, Whisper, Jira, Confluence, etc.).
- Maintain participant names unchanged as provided in the transcript.
`;
  }

  if (langKey === 'es') {
    return `
IDIOMA DE SAÍDA: ESPAÑOL.
- Toda el acta técnica, análisis, resúmenes y compromisos DEBEN SER REDACTADOS EN ESPAÑOL profesional.
- Traduzca con precisión los diálogos del portugués al español corporativo y técnico.
- Conserve los términos técnicos estándar en ingeniería de software (ej.: Docker, Kubernetes, CI/CD, PR, commit, branch, AWS, etc.).
- Mantenga los nombres de los participantes tal como aparecen en la transcripción.
`;
  }

  if (langKey === 'bilingual') {
    return `
IDIOMA DE SAÍDA: FORMATO BILÍNGUE (PORTUGUÊS & ENGLISH).
- Forneça cada seção da ata estruturada de forma bilíngue: primeiro a explicação detalhada em Português e, logo abaixo, a respectiva síntese executiva em Inglês (English Executive Summary).
- Assegure que stakeholders internacionais que não falam português compreendam com precisão todas as decisões, impedimentos e próximos passos acordados na chamada.
- Preserve termos técnicos e nomes dos participantes.
`;
  }

  // Padrão: Português
  return `
IDIOMA DE SAÍDA: PORTUGUÊS (BRASIL).
- Redija a ata em Português corporativo, claro, formal e direto.
- Preserve termos técnicos de engenharia e tecnologia no formato habitual de mercado.
`;
}

/**
 * Constrói prompt dedicado para traduzir uma ata técnica existente para outro idioma.
 * @param {string} ataText Texto da ata técnica em português
 * @param {string} targetLanguage Idioma alvo
 * @returns {string} Prompt para Groq
 */
function buildTranslationPrompt(ataText, targetLanguage) {
  const lang = normalizeTargetLanguage(targetLanguage);
  const meta = SUPPORTED_LANGUAGES[lang];

  return `Você é um tradutor técnico sênior especializado em engenharia de software e atas corporativas.
Sua missão é traduzir a seguinte ata técnica com máxima fidelidade terminológica para o idioma: ${meta.name} (${meta.code}).

DIRETRIZES DE TRADUÇÃO:
1. Mantenha a formatação Markdown idêntica (títulos, negrito, tópicos verticais "•").
2. NUNCA use tabelas Markdown com barras verticais ("|").
3. Preserve nomes de pessoas, timestamps, códigos, comandos e jargões técnicos (ex.: Docker, PR, merge, CI/CD).
4. Forneça tradução fluente e profissional, adaptada ao contexto corporativo.

ATA TÉCNICA ORIGINAL:
${ataText}`;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  normalizeTargetLanguage,
  getLanguageInstructions,
  buildTranslationPrompt
};
