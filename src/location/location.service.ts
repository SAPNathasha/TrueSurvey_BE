import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProvinces() {
    const provinces = await this.prisma.province.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
      },
    });

    return {
      total: provinces.length,
      provinces,
    };
  }

  async getDistricts(provinceId: string) {
    if (!provinceId) {
      throw new BadRequestException('provinceId is required');
    }

    const province = await this.prisma.province.findUnique({
      where: {
        id: provinceId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    if (!province || !province.isActive) {
      throw new BadRequestException('Province not found');
    }

    const districts = await this.prisma.district.findMany({
      where: {
        provinceId,
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        provinceId: true,
      },
    });

    return {
      province: {
        id: province.id,
        name: province.name,
        code: province.code,
      },
      total: districts.length,
      districts,
    };
  }

  async getCities(districtId: string) {
    if (!districtId) {
      throw new BadRequestException('districtId is required');
    }

    const district = await this.prisma.district.findUnique({
      where: {
        id: districtId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        provinceId: true,
        isActive: true,
        province: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!district || !district.isActive) {
      throw new BadRequestException('District not found');
    }

    const cities = await this.prisma.city.findMany({
      where: {
        districtId,
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        districtId: true,
      },
    });

    return {
      province: district.province,
      district: {
        id: district.id,
        name: district.name,
        code: district.code,
        provinceId: district.provinceId,
      },
      total: cities.length,
      cities,
    };
  }
}
