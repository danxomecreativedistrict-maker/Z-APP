import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

// Global : RealtimeService est injectable partout sans réimporter le module.
@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
