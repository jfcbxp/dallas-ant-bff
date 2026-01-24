import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AntModule } from './ant/ant.module';
import { UsersModule } from './users/users.module';

@Module({
	imports: [AntModule, UsersModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
