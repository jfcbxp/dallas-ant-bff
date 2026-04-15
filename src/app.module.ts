import { Module } from '@nestjs/common';

import { AntModule } from './ant/ant.module';
import { UsersModule } from './users/users.module';
import { LessonModule } from './lesson/lesson.module';

@Module({
	imports: [AntModule, UsersModule, LessonModule],
	controllers: [],
	providers: [],
})
export class AppModule {}
