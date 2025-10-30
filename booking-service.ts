import { db } from "./db";
import { rides, type InsertRide } from "@shared/schema";
import { calculateFare } from "./fare-calculator";

interface BookingData {
  customerId: number;
  vehicleType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  routeId?: number;
  isHourly?: boolean;
  estimatedHours?: number;
  extras?: string[];
  scheduledTime?: Date;
  paymentMethod?: string;
}

export async function createBooking(bookingData: BookingData) {
  try {
    // 1. Calculate fare using the fare calculator
    const fareCalculation = await calculateFare({
      vehicleType: bookingData.vehicleType,
      pickupLat: bookingData.pickupLat,
      pickupLng: bookingData.pickupLng,
      dropoffLat: bookingData.dropoffLat,
      dropoffLng: bookingData.dropoffLng,
      routeId: bookingData.routeId,
      isHourly: bookingData.isHourly,
      estimatedHours: bookingData.estimatedHours,
      extras: bookingData.extras
    });

    // 2. Prepare ride data for database insertion
    const rideData: InsertRide = {
      customerId: bookingData.customerId,
      pickupLocation: bookingData.pickupLocation,
      dropoffLocation: bookingData.dropoffLocation,
      pickupCoords: bookingData.pickupLat && bookingData.pickupLng ? {
        lat: bookingData.pickupLat,
        lng: bookingData.pickupLng
      } : null,
      dropoffCoords: bookingData.dropoffLat && bookingData.dropoffLng ? {
        lat: bookingData.dropoffLat,
        lng: bookingData.dropoffLng
      } : null,
      vehicleType: bookingData.vehicleType as "economy_4" | "economy_5" | "van_economy" | "van_luxe" | "business" | "executive",
      fare: fareCalculation.totalFare.toString(),
      baseFare: fareCalculation.baseFare.toString(),
      distance: fareCalculation.breakdown.distance?.toString(),
      status: "pending",
      paymentMethod: bookingData.paymentMethod || "cash",
      scheduledTime: bookingData.scheduledTime,
      isScheduled: !!bookingData.scheduledTime,
      rideType: fareCalculation.calculationType === 'hourly' ? 'business' : 'standard',
      estimatedDuration: bookingData.isHourly ? 
        (bookingData.estimatedHours! * 60) : 
        fareCalculation.breakdown.distance ? Math.round(fareCalculation.breakdown.distance * 2) : null
    };

    // 3. Insert booking into database
    const [newBooking] = await db.insert(rides).values(rideData).returning();

    // 4. Return booking details with fare breakdown
    return {
      booking: newBooking,
      fareBreakdown: fareCalculation,
      message: "Booking created successfully"
    };

  } catch (error: any) {
    console.error('Booking creation error:', error);
    throw new Error(`Failed to create booking: ${error.message}`);
  }
}