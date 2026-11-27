import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators.js';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { AddressesService } from './addresses.service.js';

const addressSchema = z.object({
  label: z.string().trim().max(80).nullish(),
  recipientName: z.string().trim().max(120).nullish(),
  phone: z.string().trim().min(9).max(20).nullish(),
  addressLine: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(80),
  subCity: z.string().trim().max(80).nullish(),
  woreda: z.string().trim().max(80).nullish(),
  houseNumber: z.string().trim().max(40).nullish(),
  landmark: z.string().trim().max(160).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  isDefault: z.boolean().optional(),
});

@ApiTags('Addresses')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List saved addresses for the customer' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.addressesService.findMine(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a saved address' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: addressSchema }) body: z.infer<typeof addressSchema>,
  ) {
    return this.addressesService.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved address' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body({ schema: addressSchema.partial() })
    body: Partial<z.infer<typeof addressSchema>>,
  ) {
    return this.addressesService.update(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an unused saved address' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.addressesService.remove(user.id, id);
  }
}
