import { makeConfig } from '../../test/fakes';
import { TtsService } from './tts.service';

describe('TtsService', () => {
  it('désactive la synthèse sans clé OpenAI (repli texte)', async () => {
    const service = new TtsService(makeConfig());
    expect(service.isLive).toBe(false);
    expect(await service.synthesize('Bonjour')).toBeNull();
  });
});
