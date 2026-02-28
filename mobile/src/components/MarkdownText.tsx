/**
 * src/components/MarkdownText.tsx
 * =================================
 * Renderizador leve de Markdown para React Native.
 * Suporta a saída típica do Gemini:
 *   ## Título          → h2
 *   **negrito**        → Text bold inline
 *   *itálico*          → Text italic inline
 *   - item / 1. item   → bullet / numerado
 *   💡 Dica...         → caixa de destaque verde
 *   linhas normais     → parágrafo
 *
 * Não requer dependências externas.
 */

import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  content: string;
}

// ---------------------------------------------------------------------------
// Inline parser: processa **bold** e *italic* dentro de um texto
// ---------------------------------------------------------------------------
type InlineStyle = Pick<TextStyle, 'fontWeight' | 'fontStyle' | 'color'>;

function parseInline(
  raw: string,
  base: InlineStyle,
  bold: InlineStyle,
  italic: InlineStyle,
): React.ReactNode[] {
  const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={[base, bold]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={i} style={[base, italic]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text key={i} style={base}>
        {part}
      </Text>
    );
  });
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const MarkdownText: React.FC<Props> = ({ content }) => {
  const { theme } = useTheme();

  const base: InlineStyle = { color: theme.textSecondary };
  const bold: InlineStyle = { fontWeight: '700', color: theme.text };
  const italic: InlineStyle = { fontStyle: 'italic' };
  const tipBase: InlineStyle = { color: theme.green };
  const tipBold: InlineStyle = { fontWeight: '700', color: theme.green };

  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const t = line.trim();

    // ── Linha vazia ─────────────────────────────────────────────────────────
    if (!t) {
      elements.push(<View key={`sp-${idx}`} style={{ height: 6 }} />);
      return;
    }

    // ── H1: # Título ────────────────────────────────────────────────────────
    if (t.startsWith('# ') && !t.startsWith('##')) {
      elements.push(
        <Text key={idx} style={[s.h1, { color: theme.green }]}>
          {t.slice(2)}
        </Text>,
      );
      return;
    }

    // ── H2: ## Título ────────────────────────────────────────────────────────
    if (t.startsWith('## ')) {
      elements.push(
        <Text key={idx} style={[s.h2, { color: theme.text }]}>
          {t.slice(3)}
        </Text>,
      );
      return;
    }

    // ── H3: ### Título ───────────────────────────────────────────────────────
    if (t.startsWith('### ')) {
      elements.push(
        <Text key={idx} style={[s.h3, { color: theme.text }]}>
          {t.slice(4)}
        </Text>,
      );
      return;
    }

    // ── Dica (linha começa com emoji 💡) ─────────────────────────────────────
    if (t.startsWith('💡')) {
      elements.push(
        <View
          key={idx}
          style={[s.tipBox, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder }]}
        >
          <Text style={[s.tipText, tipBase]}>
            {parseInline(t, tipBase, tipBold, italic)}
          </Text>
        </View>,
      );
      return;
    }

    // ── Bullet: - item ou * item ou • item ───────────────────────────────────
    if (/^[-*•]\s/.test(t)) {
      const text = t.slice(2);
      elements.push(
        <View key={idx} style={s.bulletRow}>
          <Text style={[s.bulletDot, { color: theme.green }]}>{'•'}</Text>
          <Text style={[s.bulletText, base]}>
            {parseInline(text, base, bold, italic)}
          </Text>
        </View>,
      );
      return;
    }

    // ── Lista numerada: 1. item ───────────────────────────────────────────────
    const numMatch = t.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      const [, num, text] = numMatch;
      elements.push(
        <View key={idx} style={s.bulletRow}>
          <Text style={[s.numLabel, { color: theme.green }]}>{num}.</Text>
          <Text style={[s.bulletText, base]}>
            {parseInline(text, base, bold, italic)}
          </Text>
        </View>,
      );
      return;
    }

    // ── Linha apenas negrito (seção: **Ingredientes**) ────────────────────────
    if (t.startsWith('**') && t.endsWith('**') && t.length > 4) {
      elements.push(
        <Text key={idx} style={[s.section, { color: theme.text }]}>
          {t.slice(2, -2)}
        </Text>,
      );
      return;
    }

    // ── Parágrafo comum ───────────────────────────────────────────────────────
    elements.push(
      <Text key={idx} style={[s.body, base]}>
        {parseInline(t, base, bold, italic)}
      </Text>,
    );
  });

  return <View style={s.root}>{elements}</View>;
};

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  root: {
    gap: 4,
  },
  h1: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 28,
  },
  h2: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 2,
    lineHeight: 24,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 2,
    lineHeight: 22,
  },
  section: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    width: 14,
  },
  numLabel: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    minWidth: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
  tipBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

export default MarkdownText;
