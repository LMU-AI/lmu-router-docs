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

export const { GET } = createFromSource(source, {
  components: {
    tokenizer: createTokenizer(),
  },
  search: {
    threshold: 0,
    tolerance: 1,
  },
});
