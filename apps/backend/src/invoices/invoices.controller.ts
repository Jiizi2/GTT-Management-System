import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  MethodNotAllowedException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";

@ApiTags("Invoices")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@Controller("invoices")
export class InvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get("clients")
  listClients() {
    return this.invoicesService.listClients();
  }

  @Post()
  create(@Body() payload: CreateInvoiceDto) {
    return this.invoicesService.create(payload);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() payload: UpdateInvoiceDto) {
    return this.invoicesService.update(id, payload);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    throw new MethodNotAllowedException(
      `Invoice '${id}' cannot be deleted. Set status to CANCELLED instead.`,
    );
  }
}
