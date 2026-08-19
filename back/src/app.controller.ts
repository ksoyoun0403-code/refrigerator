import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getStatus() {
    return {
      service: 'mydish-back',
      status: 'ok',
    };
  }
}
