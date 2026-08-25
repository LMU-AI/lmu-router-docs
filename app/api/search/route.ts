import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { createTokenizer as createMandarinTokenizer } from '@orama/tokenizers/mandarin';

// The Mandarin tokenizer segments text via Intl.Segmenter but, unlike Orama's
// default tokenizer, never lowercases tokens. That makes Latin-script search
// case-sensitive (e.g. "Trae" wouldn't match "trae"). Lowercase the input
// before segmentation so indexing and queries are case-insensitive.
function createTokenizer() {
  const tokenizer = createMandarinTokenizer();
  const tokenize = tokenizer.tokenize;
  tokenizer.tokenize = function (input, language, prop) {
    const normalized = typeof input === 'string' ? input.toLowerCase() : input;
    return tokenize.call(this, normalized, language, prop);
  };
  return tokenizer;
}

// The source is i18n (cn + en), so createFromSource builds one index per locale
// and picks each locale's tokenizer from localeMap. Chinese needs the Mandarin
// segmenter (Intl.Segmenter) to split CJK runs into terms; English uses Orama's
// built-in tokenizer/stemmer, which handles stemming and stop-words properly —
// applying the Mandarin tokenizer to English would lose that.
export const { GET } = createFromSource(source, {
  localeMap: {
    cn: {
      components: {
        tokenizer: createTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 1,
      },
    },
    en: 'english',
  },
});
