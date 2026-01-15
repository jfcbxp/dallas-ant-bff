import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AntModule } from './ant/ant.module';

@Module({
  imports: [AntModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
