import * as ML from '../ml/MLServiceClient.js';
import type { TranslationProvider, TranslationSegment, TranslationResult } from './TranslationProvider.js';

export class OwnModelProvider implements TranslationProvider {
  readonly name = 'own-model';

  async translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslationResult[]> {
    return ML.translate(segments, sourceLang, targetLang);
  }
}
