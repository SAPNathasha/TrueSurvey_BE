import { Controller, Get, Query } from '@nestjs/common';

import { GetCitiesQueryDto } from './dto/get-cities-query.dto';
import { GetDistrictsQueryDto } from './dto/get-districts-query.dto';
import { LocationService } from './location.service';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('provinces')
  getProvinces() {
    return this.locationService.getProvinces();
  }

  @Get('districts')
  getDistricts(@Query() query: GetDistrictsQueryDto) {
    return this.locationService.getDistricts(query.provinceId);
  }

  @Get('cities')
  getCities(@Query() query: GetCitiesQueryDto) {
    return this.locationService.getCities(query.districtId);
  }
}
