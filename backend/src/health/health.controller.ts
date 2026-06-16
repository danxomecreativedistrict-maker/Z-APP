import { Controller, Get } from '@nestjs/common';
import { Responded } from '../common/interceptors/response.interceptor';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check() {
    const report = await this.health.check();
    const message =
      report.status === 'ok'
        ? 'Tous les services sont opérationnels'
        : 'Certains services sont indisponibles';
    return new Responded(report, message);
  }
}
