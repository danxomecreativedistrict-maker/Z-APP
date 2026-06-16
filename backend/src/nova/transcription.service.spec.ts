import { makeConfig } from '../../test/fakes';
import { TranscriptionService } from './transcription.service';

describe('TranscriptionService (repli dev)', () => {
  it('retourne un placeholder sans clé OpenAI', async () => {
    const service = new TranscriptionService(makeConfig());
    const text = await service.transcribe(Buffer.from('audio'), 'audio/ogg');
    expect(text).toContain('Note vocale');
  });
});
