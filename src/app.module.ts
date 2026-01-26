import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AntModule } from './ant/ant.module';
import { UsersModule } from './users/users.module';
import { LessonModule } from './lesson/lesson.module';

@Module({
	imports: [AntModule, UsersModule, LessonModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
