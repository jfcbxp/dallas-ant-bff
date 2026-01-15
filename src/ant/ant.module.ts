import { Module } from '@nestjs/common';
import { AntService } from './ant.service';
import { AntController } from './ant.controller';

@Module({
  providers: [AntService],
  controllers: [AntController]
})
export class AntModule {}
