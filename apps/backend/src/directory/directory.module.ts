import { Global, Module } from "@nestjs/common";
import { DirectoryController } from "./directory.controller";
import { DirectoryService } from "./directory.service";

// Global so DirectoryService can be injected by the H-1 checklist flow without
// adding an import edge to GroupsModule (which sits in the GroupsModule <->
// RepositoriesModule forwardRef cycle and is sensitive to init ordering).
@Global()
@Module({
  controllers: [DirectoryController],
  providers: [DirectoryService],
  exports: [DirectoryService],
})
export class DirectoryModule {}
