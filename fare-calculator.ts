import { db } from "./db";
import { fareByDistance, fareFlatRoutes, fareHourly, fareExtras } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface BookingRequest {
  vehicleType: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  routeId?: number;
  isHourly?: boolean;
  estimatedHours?: number;
  extras?: string[];
}

interface FareCalculation {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  extrasFare: number;
  totalFare: number;
  calculationType: 'distance' | 'route' | 'hourly';
  breakdown: {
    base?: number;
    perKm?: number;
    distance?: number;
    routePrice?: number;
    hourlyRate?: number;
    hours?: number;
    extras: Array<{ item: string; price: number }>;
  };
}

// Calculate distance between two GPS coordinates using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function calculateFare(request: BookingRequest): Promise<FareCalculation> {
  const { vehicleType, pickupLat, pickupLng, dropoffLat, dropoffLng, routeId, isHourly, estimatedHours, extras } = request;

  let calculation: FareCalculation = {
    baseFare: 0,
    distanceFare: 0,
    timeFare: 0,
    extrasFare: 0,
    totalFare: 0,
    calculationType: 'distance',
    breakdown: {
      extras: []
    }
  };

  try {
    // 1. Calculate base fare based on type
    if (routeId) {
      // Fixed route pricing
      const [routeFare] = await db
        .select()
        .from(fareFlatRoutes)
        .where(and(
          eq(fareFlatRoutes.id, routeId),
          eq(fareFlatRoutes.vehicleType, vehicleType),
          eq(fareFlatRoutes.isActive, true)
        ));

      if (routeFare) {
        calculation.calculationType = 'route';
        calculation.baseFare = parseFloat(routeFare.price);
        calculation.breakdown.routePrice = parseFloat(routeFare.price);
      } else {
        throw new Error('Route fare not found or inactive');
      }

    } else if (isHourly && estimatedHours) {
      // Hourly pricing
      const [hourlyFare] = await db
        .select()
        .from(fareHourly)
        .where(and(
          eq(fareHourly.vehicleType, vehicleType),
          eq(fareHourly.isActive, true)
        ));

      if (hourlyFare) {
        calculation.calculationType = 'hourly';
        const hours = Math.max(estimatedHours, hourlyFare.minimumHours || 1);
        const cappedHours = Math.min(hours, hourlyFare.maximumHours || 12);
        calculation.timeFare = parseFloat(hourlyFare.pricePerHour) * cappedHours;
        calculation.breakdown.hourlyRate = parseFloat(hourlyFare.pricePerHour);
        calculation.breakdown.hours = cappedHours;
      } else {
        throw new Error('Hourly fare not found or inactive');
      }

    } else if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      // Distance-based pricing
      const [distanceFare] = await db
        .select()
        .from(fareByDistance)
        .where(eq(fareByDistance.vehicleType, vehicleType));

      if (distanceFare) {
        calculation.calculationType = 'distance';
        const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
        calculation.baseFare = parseFloat(distanceFare.baseFare);
        calculation.distanceFare = parseFloat(distanceFare.perKm) * distance;
        calculation.breakdown.base = parseFloat(distanceFare.baseFare);
        calculation.breakdown.perKm = parseFloat(distanceFare.perKm);
        calculation.breakdown.distance = distance;
      } else {
        throw new Error(`Distance fare not found for vehicle type: ${vehicleType}`);
      }

    } else {
      throw new Error('Invalid booking request: missing required location or route information');
    }

    // 2. Calculate extras
    if (extras && extras.length > 0) {
      const extraCharges = await db
        .select()
        .from(fareExtras)
        .where(eq(fareExtras.isActive, true));

      for (const extraItem of extras) {
        const extraCharge = extraCharges.find(charge => 
          charge.item.toLowerCase() === extraItem.toLowerCase() &&
          (charge.applicableVehicleTypes === 'all' || 
           charge.applicableVehicleTypes?.includes(vehicleType))
        );

        if (extraCharge) {
          const extraPrice = parseFloat(extraCharge.price);
          calculation.extrasFare += extraPrice;
          calculation.breakdown.extras.push({
            item: extraCharge.item,
            price: extraPrice
          });
        }
      }
    }

    // 3. Calculate total
    calculation.totalFare = calculation.baseFare + calculation.distanceFare + calculation.timeFare + calculation.extrasFare;

    return calculation;

  } catch (error: any) {
    console.error('Fare calculation error:', error);
    throw new Error(`Fare calculation failed: ${error.message}`);
  }
}

export async function getAvailableRoutes(vehicleType?: string) {
  try {
    if (vehicleType) {
      return await db
        .select()
        .from(fareFlatRoutes)
        .where(and(
          eq(fareFlatRoutes.isActive, true),
          eq(fareFlatRoutes.vehicleType, vehicleType)
        ));
    } else {
      return await db
        .select()
        .from(fareFlatRoutes)
        .where(eq(fareFlatRoutes.isActive, true));
    }
  } catch (error) {
    console.error('Error fetching available routes:', error);
    throw new Error('Failed to fetch available routes');
  }
}

export async function getVehicleTypePricing() {
  try {
    const [distancePricing, hourlyPricing] = await Promise.all([
      db.select().from(fareByDistance),
      db.select().from(fareHourly).where(eq(fareHourly.isActive, true))
    ]);

    return {
      distance: distancePricing,
      hourly: hourlyPricing
    };
  } catch (error) {
    console.error('Error fetching vehicle pricing:', error);
    throw new Error('Failed to fetch vehicle pricing');
  }
}